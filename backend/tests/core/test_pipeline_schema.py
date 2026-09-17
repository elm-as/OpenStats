"""Le typage declare par l'utilisateur doit reellement piloter l'analyse."""

import warnings

import numpy as np
import pandas as pd
import pytest

from app.core.pipeline.schema import apply_schema, normalize_declared, sort_by_time
from app.core.pipeline.stages import run_pipeline

warnings.filterwarnings("ignore")


@pytest.fixture
def annual_frame():
    """« annee » est un entier : pandas n'y verra jamais une date tout seul."""
    rng = np.random.default_rng(0)
    n = 60
    return pd.DataFrame({
        "annee": np.arange(1960, 1960 + n),
        "code_region": rng.integers(1, 5, n),          # code, pas une grandeur
        "pib": np.cumsum(rng.normal(2, 1, n)) + 100,
        "inflation": rng.normal(3, 1.2, n),
    })


def _final(events):
    return next(e for e in events if e["type"] == "complete")


def _stage(final, key):
    return next(s for s in final["stages"] if s["key"] == key)


# ── Normalisation du vocabulaire de types ────────────────────────────────

def test_overrides_win_over_import_profile():
    profile = {"dictionary": [{"nom_brut": "annee", "type_statistique": "discret"}]}
    declared = normalize_declared({"annee": "temporel"}, profile)
    assert declared["annee"] == "temporal"


def test_profile_alone_is_honoured():
    profile = {"dictionary": [
        {"nom_brut": "x", "type_statistique": "catégoriel_nominal"},
        {"nom_brut": "y", "type_statistique": "continu"},
    ]}
    declared = normalize_declared(None, profile)
    assert declared == {"x": "categorical", "y": "numeric"}


def test_unknown_type_label_is_ignored():
    assert normalize_declared({"a": "zorglub"}, None) == {}
    assert normalize_declared({"a": "auto"}, None) == {}


# ── Conversion effective ─────────────────────────────────────────────────

def test_bare_years_become_real_dates(annual_frame):
    out, schema = apply_schema(annual_frame, {"annee": "temporal"})

    assert pd.api.types.is_datetime64_any_dtype(out["annee"])
    assert "annee" in schema.coerced
    assert schema.temporal == ["annee"]
    assert out["annee"].dt.year.tolist()[:3] == [1960, 1961, 1962]


def test_numeric_code_declared_categorical_stops_being_a_quantity(annual_frame):
    out, schema = apply_schema(annual_frame, {"code_region": "categorical"})

    assert not pd.api.types.is_numeric_dtype(out["code_region"])
    assert "code_region" in schema.categorical
    assert "code_region" not in schema.numeric


def test_impossible_declaration_is_reported_not_silently_applied():
    frame = pd.DataFrame({"libelle": ["rouge", "vert", "bleu"] * 5})
    out, schema = apply_schema(frame, {"libelle": "temporal"})

    assert "libelle" in schema.failures
    assert schema.kinds["libelle"] == "categorical"
    assert out["libelle"].tolist() == frame["libelle"].tolist()


def test_identifier_is_typed_apart():
    frame = pd.DataFrame({"id": range(20), "v": range(20)})
    _, schema = apply_schema(frame, {"id": "identifier"})
    assert schema.identifiers == ["id"]


def test_sorting_uses_the_declared_axis():
    frame = pd.DataFrame({
        "quand": ["2020-03-01", "2019-01-01", "2021-06-01"],
        "v": [3.0, 1.0, 5.0],
    })
    out, schema = apply_schema(frame, {"quand": "temporal"})
    ordered = sort_by_time(out, schema)
    assert ordered["v"].tolist() == [1.0, 3.0, 5.0]


def test_original_frame_is_left_untouched(annual_frame):
    before = annual_frame["annee"].dtype
    apply_schema(annual_frame, {"annee": "temporal"})
    assert annual_frame["annee"].dtype == before


# ── Effet sur le pipeline complet ────────────────────────────────────────

def test_declaring_temporal_activates_time_series_analysis(annual_frame):
    """Sans declaration : pas de serie temporelle. Avec : axe reconnu."""
    without = _final(list(run_pipeline(annual_frame, target="pib", max_iterations=2)))
    with_type = _final(list(run_pipeline(
        annual_frame, target="pib", max_iterations=2,
        type_overrides={"annee": "temporel"},
    )))

    problem_without = _stage(without, "problem")["data"]
    problem_with = _stage(with_type, "problem")["data"]

    assert problem_without["temporal"] == []
    assert problem_without["is_timeseries"] is False

    assert problem_with["temporal"] == ["annee"]
    assert problem_with["is_timeseries"] is True
    assert problem_with["problem_type"] == "forecast"


def test_non_stationarity_only_detected_once_the_axis_is_declared(annual_frame):
    """Le PIB est une marche aleatoire : non-stationnaire, mais seulement
    diagnostiquable si l'axe temporel est connu."""
    with_type = _final(list(run_pipeline(
        annual_frame, target="pib", max_iterations=1,
        type_overrides={"annee": "temporel"},
    )))
    codes = {i["code"] for i in _stage(with_type, "diagnostics")["data"]["issues"]}
    assert "non_stationary" in codes


def test_declared_categorical_is_not_diagnosed_as_a_quantity(annual_frame):
    """Un code region ne doit pas apparaitre dans les diagnostics numeriques."""
    final = _final(list(run_pipeline(
        annual_frame, target="pib", max_iterations=1,
        type_overrides={"code_region": "catégoriel_nominal"},
    )))
    issues = _stage(final, "diagnostics")["data"]["issues"]
    numeric_codes = {"outliers", "skewed", "collinearity", "non_stationary"}
    touched = {c for i in issues if i["code"] in numeric_codes for c in i["columns"]}
    assert "code_region" not in touched


def test_identifiers_are_dropped_from_the_analysis(annual_frame):
    frame = annual_frame.assign(dossier=[f"D{i:04d}" for i in range(len(annual_frame))])
    final = _final(list(run_pipeline(
        frame, target="pib", max_iterations=1,
        type_overrides={"dossier": "identifiant"},
    )))
    assert final["shape_after"]["columns"] < frame.shape[1]
    dictionary = _stage(final, "understand")["tables"][0]["rows"]
    assert all(row[0] != "dossier" for row in dictionary)


def test_schema_event_reports_conversions(annual_frame):
    events = list(run_pipeline(annual_frame, target="pib", max_iterations=1,
                              type_overrides={"annee": "temporel"}))
    schema_events = [e for e in events if e["type"] == "schema"]
    assert schema_events
    assert any("annee" in note for note in schema_events[0]["notes"])


def test_declared_type_appears_in_the_data_dictionary(annual_frame):
    final = _final(list(run_pipeline(
        annual_frame, target="pib", max_iterations=1,
        type_overrides={"annee": "temporel"},
    )))
    table = _stage(final, "understand")["tables"][0]
    assert "Type déclaré" in table["columns"]
    row = next(r for r in table["rows"] if r[0] == "annee")
    assert row[2] == "temporel"
