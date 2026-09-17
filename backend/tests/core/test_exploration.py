"""Tests du moteur d'exploration adaptative."""

import warnings

import numpy as np
import pandas as pd
import pytest

from app.core.exploration import build_context, explore, explore_stream
from app.core.exploration.catalog import CATALOG, admissible_probes
from app.core.exploration.covariates import rank_covariates
from app.core.exploration.finding import Finding, rank_findings
from app.core.exploration.multiplicity import apply_fdr, benjamini_hochberg

warnings.filterwarnings("ignore")


@pytest.fixture
def linear_df():
    rng = np.random.default_rng(0)
    x = rng.normal(size=200)
    return pd.DataFrame({
        "driver": x,
        "noise": rng.normal(size=200),
        "y": 2 * x + rng.normal(scale=0.3, size=200),
    })


@pytest.fixture
def quadratic_df():
    rng = np.random.default_rng(1)
    x = rng.normal(scale=2, size=300)
    return pd.DataFrame({
        "x": x,
        "noise": rng.normal(size=300),
        "y": x ** 2 + rng.normal(scale=0.5, size=300),
    })


@pytest.fixture
def timeseries_df():
    rng = np.random.default_rng(2)
    n = 140
    driver = np.cumsum(rng.normal(size=n))
    lagged = np.concatenate([[0.0, 0.0], driver[:-2]])
    return pd.DataFrame({
        "date": pd.date_range("2015-01-01", periods=n, freq="ME"),
        "driver": driver,
        "y": lagged * 0.8 + np.cumsum(rng.normal(scale=0.4, size=n)),
    })


# -- Correction pour tests multiples --------------------------------------

def test_benjamini_hochberg_matches_statsmodels():
    from statsmodels.stats.multitest import multipletests

    rng = np.random.default_rng(9)
    p_values = list(np.round(rng.random(20), 4))
    rejected, q_values, _, _ = multipletests(p_values, alpha=0.05, method="fdr_bh")

    mine_q, mine_rejected = benjamini_hochberg(p_values, alpha=0.05)
    assert np.allclose(q_values, mine_q, atol=1e-5)
    assert list(rejected) == mine_rejected


def test_benjamini_hochberg_handles_empty():
    assert benjamini_hochberg([]) == ([], [])


def test_apply_fdr_leaves_descriptive_findings_untested():
    findings = [
        Finding(kind="a", variables=("x",), effect_size=0.5, effect_metric="m",
                headline="h", p_value=0.001, n=100),
        Finding(kind="b", variables=("y",), effect_size=0.5, effect_metric="m",
                headline="h", p_value=None, n=100),
    ]
    stats = apply_fdr(findings)

    assert stats["tested"] == 1
    assert stats["descriptive"] == 1
    assert findings[0].survives_fdr is True
    assert findings[1].survives_fdr is None
    assert findings[1].q_value is None


# -- Classement des covariables -------------------------------------------

def test_mutual_information_detects_nonlinear_link(quadratic_df):
    """L'information mutuelle voit la relation quadratique que Pearson manque."""
    from scipy import stats

    ranking = dict(rank_covariates(quadratic_df, "y", ["x", "noise"]))
    pearson_r = abs(stats.pearsonr(quadratic_df["x"], quadratic_df["y"])[0])

    assert ranking["x"] > ranking["noise"]
    assert ranking["x"] > 0.5
    assert pearson_r < 0.3  # la correlation, elle, ne voit rien


def test_ranking_puts_true_driver_first(linear_df):
    ranking = rank_covariates(linear_df, "y", ["driver", "noise"])
    assert ranking[0][0] == "driver"


# -- Admissibilite : ce qui est possible depend du dataset -----------------

def test_admissibility_depends_on_dataset_shape(linear_df, timeseries_df):
    numeric_keys = {s.key for s in admissible_probes(build_context(linear_df, "y"))}
    temporal_keys = {s.key for s in admissible_probes(build_context(timeseries_df, "y"))}

    assert "stationarity" not in numeric_keys
    assert "stationarity" in temporal_keys
    assert "trend" in temporal_keys


def test_no_target_enables_unsupervised_probes(linear_df):
    keys = {s.key for s in admissible_probes(build_context(linear_df, None))}
    assert "pairwise_structure" in keys
    assert "association" not in keys  # sans cible, pas d'association a la cible


# -- La boucle adapte son parcours ----------------------------------------

def _executed(result):
    return [r["key"] for r in result["runs"] if r["status"] in ("success", "empty")]


def test_paths_differ_between_datasets(linear_df, timeseries_df):
    """Deux datasets differents ne suivent pas le meme chemin : c'est le coeur du moteur."""
    linear_path = _executed(explore(linear_df, "y", budget_sec=30))
    temporal_path = _executed(explore(timeseries_df, "y", budget_sec=40))

    assert linear_path != temporal_path
    assert "stationarity" in temporal_path
    assert "stationarity" not in linear_path


def test_probe_unlocked_by_established_fact(linear_df):
    """`redundancy` est verrouillee tant qu'aucune association n'est etablie."""
    result = explore(linear_df, "y", budget_sec=30)
    runs = {r["key"]: r for r in result["runs"]}

    assert runs["redundancy"]["status"] in ("success", "empty")
    assert runs["redundancy"]["triggered_by"], "doit indiquer le fait declencheur"
    assert "association_lineaire" in result["facts"]


def test_granger_finds_injected_lag(timeseries_df):
    result = explore(timeseries_df, "y", budget_sec=60)
    granger = [f for f in result["findings"] if f["kind"] == "causalite_granger"]

    assert granger, "la precedence temporelle injectee doit etre retrouvee"
    assert granger[0]["payload"]["best_lag"] == 2
    assert granger[0]["survives_fdr"] is True


def test_nonlinear_link_is_reported_as_such(quadratic_df):
    result = explore(quadratic_df, "y", budget_sec=30)
    kinds = {f["kind"] for f in result["findings"]}
    assert "association_non_lineaire" in kinds


# -- Robustesse et contrat ------------------------------------------------

@pytest.mark.parametrize("frame,target", [
    (pd.DataFrame({"a": [1.0, 2.0], "b": [3.0, 4.0]}), "a"),
    (pd.DataFrame({"a": [np.nan] * 30, "b": np.arange(30.0)}), "a"),
    (pd.DataFrame({"k": [1] * 40, "v": np.arange(40.0)}), "k"),
    (pd.DataFrame({"a": np.arange(40.0)}), "colonne_absente"),
    (pd.DataFrame({"txt": [f"c{i}" for i in range(60)], "v": np.arange(60.0)}), "v"),
])
def test_degenerate_inputs_do_not_crash(frame, target):
    result = explore(frame, target, budget_sec=10)
    assert "summary" in result
    assert not [r for r in result["runs"] if r["status"] == "error"]


def test_budget_is_respected(timeseries_df):
    result = explore(timeseries_df, "y", budget_sec=5)
    assert result["elapsed_sec"] <= 20  # marge : une sonde en cours va au bout


def test_stream_emits_expected_event_sequence(linear_df):
    events = list(explore_stream(linear_df, "y", budget_sec=20))
    types = [e["type"] for e in events]

    assert types[0] == "context"
    assert types[-1] == "complete"
    assert "probe_start" in types
    assert "probe_done" in types
    # chaque sonde demarree est aussi terminee
    assert types.count("probe_start") == types.count("probe_done")


def test_ranking_diversifies_variables():
    """Le classement penalise la redondance : deux findings sur la meme variable
    ne doivent pas occuper les deux premieres places si une autre piste existe."""
    findings = [
        Finding(kind="a", variables=("x", "y"), effect_size=0.9, effect_metric="m",
                headline="1", p_value=0.001, n=100),
        Finding(kind="b", variables=("x", "y"), effect_size=0.85, effect_metric="m",
                headline="2", p_value=0.001, n=100),
        Finding(kind="c", variables=("z",), effect_size=0.6, effect_metric="m",
                headline="3", p_value=0.001, n=100),
    ]
    ordered = rank_findings(findings)
    assert ordered[0].headline == "1"
    assert ordered[1].headline == "3", "une piste nouvelle passe devant une redite"


def test_catalog_specs_are_well_formed():
    keys = [spec.key for spec in CATALOG]
    assert len(keys) == len(set(keys)), "les cles doivent etre uniques"
    for spec in CATALOG:
        assert spec.label and spec.explains
        assert callable(spec.run) and callable(spec.admissible)
        # un fait declencheur doit etre produit par au moins une autre sonde
        for fact in spec.triggered_by:
            producers = [s for s in CATALOG if fact in s.yields and s.key != spec.key]
            assert producers, f"'{fact}' declenche {spec.key} mais n'est produit par personne"
