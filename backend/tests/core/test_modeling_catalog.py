"""Le catalogue de modeles doit recommander, comparer et rester honnete."""

import warnings

import numpy as np
import pandas as pd
import pytest

from app.core.pipeline.models import CATALOG, compare_models, recommend
from app.core.pipeline.stages import run_pipeline
from app.core.pipeline.temporal_models import compare_temporal

warnings.filterwarnings("ignore")
RNG = np.random.default_rng(12)


def _final(events):
    return next(e for e in events if e["type"] == "complete")


def _stage(final, key):
    return next(s for s in final["stages"] if s["key"] == key)


# ── Recommandation ───────────────────────────────────────────────────────

def test_recommendation_matches_the_problem_type():
    reg = {c["key"] for c in recommend("regression", 500, 5)["candidates"] if c["applicable"]}
    clf = {c["key"] for c in recommend("classification_binaire", 500, 5)["candidates"]
           if c["applicable"]}

    assert "ols" in reg and "logistic" not in reg
    assert "logistic" in clf and "ols" not in clf


def test_small_samples_exclude_the_heaviest_models():
    reco = recommend("regression", 35, 3)
    excluded = {c["key"]: c["reason"] for c in reco["candidates"] if not c["applicable"]}
    assert "lgbm_reg" in excluded
    assert "observations minimum" in excluded["lgbm_reg"]


def test_recommendation_spans_several_families():
    """Recommander quatre variantes du meme modele n'aide pas a choisir."""
    reco = recommend("regression", 800, 6)
    families = {c["family"] for c in reco["candidates"] if c["key"] in reco["recommended"]}
    assert len(families) >= 3


def test_every_exclusion_carries_a_reason():
    for problem in ("regression", "classification_binaire", "classification_multiclasse"):
        for entry in recommend(problem, 40, 4)["candidates"]:
            if not entry["applicable"]:
                assert entry["reason"], f"{entry['key']} exclu sans motif"


def test_forecast_recommends_temporal_models_only():
    reco = recommend("forecast", 200, 1, is_timeseries=True)
    keys = {c["key"] for c in reco["candidates"]}
    assert {"arima", "sarima", "holt_winters", "naive"} <= keys
    assert "ols" not in keys


# ── Comparaison supervisee ───────────────────────────────────────────────

@pytest.fixture
def nonlinear():
    n = 400
    x1, x2 = RNG.normal(size=n), RNG.normal(size=n)
    X = pd.DataFrame({"x1": x1, "x2": x2, "bruit": RNG.normal(size=n)})
    y = pd.Series(np.sin(2 * x1) * 3 + x2 ** 2 + RNG.normal(0, 0.4, n))
    return X, y


def test_trees_beat_linear_models_on_a_nonlinear_target(nonlinear):
    X, y = nonlinear
    comparison = compare_models(X, y, "regression", budget_sec=120)
    scores = {r["key"]: r["score"] for r in comparison["results"] if r["status"] == "ok"}

    assert comparison["best"]["family"] in ("arbres", "boosting")
    assert scores[comparison["best"]["key"]] > scores["ols"] + 0.3


def test_comparison_reports_a_baseline(nonlinear):
    X, y = nonlinear
    comparison = compare_models(X, y, "regression", budget_sec=120)

    assert "baseline" in comparison
    assert comparison["baseline_label"]
    assert comparison["best"]["gain_vs_baseline"] > 0


def test_pure_noise_yields_no_gain_over_the_baseline():
    """Le point important : ne pas presenter un modele inutile comme un succes."""
    X = pd.DataFrame({"a": RNG.normal(size=300), "b": RNG.normal(size=300)})
    y = pd.Series(RNG.normal(size=300))
    comparison = compare_models(X, y, "regression", budget_sec=120)

    assert comparison["best"]["gain_vs_baseline"] < 0.05


def test_failures_do_not_stop_the_comparison():
    """Une colonne degeneree ne doit pas faire echouer toute l'etape."""
    X = pd.DataFrame({"constante": np.ones(80), "utile": RNG.normal(size=80)})
    y = pd.Series(X["utile"] * 2 + RNG.normal(0, 0.2, 80))
    comparison = compare_models(X, y, "regression", budget_sec=90)
    assert comparison["best"] is not None


def test_timeseries_uses_chronological_splits():
    X = pd.DataFrame({"a": np.arange(200.0), "b": RNG.normal(size=200)})
    y = pd.Series(np.arange(200.0) + RNG.normal(0, 1, 200))
    comparison = compare_models(X, y, "regression", is_timeseries=True, budget_sec=90)
    assert "chronologique" in comparison["validation"]


# ── Comparaison temporelle ───────────────────────────────────────────────

@pytest.fixture
def seasonal_series():
    k = 140
    index = pd.date_range("2013-01-31", periods=k, freq="ME")
    values = (100 + np.arange(k) * 0.9
              + 12 * np.sin(2 * np.pi * np.arange(k) / 12)
              + RNG.normal(0, 2.2, k))
    return pd.Series(values, index=index)


def test_seasonal_models_beat_persistence(seasonal_series):
    comparison = compare_temporal(seasonal_series, budget_sec=180)

    assert comparison["beats_baseline"]
    assert comparison["best"]["family"] == "temporel"
    assert comparison["best"]["skill_vs_naive"] > 0.2


def test_temporal_validation_is_a_rolling_origin(seasonal_series):
    comparison = compare_temporal(seasonal_series, budget_sec=180)
    assert "origine glissante" in comparison["validation"]
    assert comparison["folds"] >= 1


def test_random_walk_is_not_beaten_by_anything():
    """Sur une marche aleatoire, la persistance est optimale : le dire."""
    walk = pd.Series(np.cumsum(RNG.normal(size=120)),
                     index=pd.date_range("2015-01-31", periods=120, freq="ME"))
    comparison = compare_temporal(walk, budget_sec=180, keys=["naive", "drift", "holt_winters"])
    best = comparison["best"]
    if best:
        assert best.get("skill_vs_naive", 0) < 0.25


def test_short_series_is_refused_not_guessed():
    short = pd.Series([1.0, 2.0, 3.0, 4.0])
    comparison = compare_temporal(short)
    assert comparison.get("error")
    assert not comparison["results"]


# ── Integration dans l'etape ─────────────────────────────────────────────

def test_stage_exposes_recommendations_and_comparison(nonlinear):
    X, y = nonlinear
    frame = X.assign(cible=y)
    stage = _stage(_final(list(run_pipeline(frame, target="cible", max_iterations=1))), "modeling")

    assert stage["status"] == "success"
    assert stage["data"]["recommendation"]["candidates"]
    assert stage["data"]["comparison"]["results"]
    assert len(stage["tables"]) == 2
    assert any(c["kind"] == "model_comparison" for c in stage["charts"])


def test_stage_on_a_time_series_compares_forecasters(seasonal_series):
    frame = pd.DataFrame({"date": seasonal_series.index,
                          "ventes": seasonal_series.to_numpy(),
                          "autre": RNG.normal(size=len(seasonal_series))})
    stage = _stage(_final(list(run_pipeline(frame, target="ventes", max_iterations=1))), "modeling")

    assert stage["data"]["metric"] == "MAE"
    keys = {r["key"] for r in stage["data"]["comparison"]["results"]}
    assert "arima" in keys and "naive" in keys


def test_catalog_entries_are_well_formed():
    keys = [spec.key for spec in CATALOG]
    assert len(keys) == len(set(keys))
    for spec in CATALOG:
        assert spec.label and spec.problems and spec.family
        assert callable(spec.build)
