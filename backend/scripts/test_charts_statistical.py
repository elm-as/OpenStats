"""
Tests des visualisations statistiques : descriptives, tests d'hypothèses et analyses factorielles (ACP, AFC, ACM).
"""

from __future__ import annotations

import requests

from chart_test_suite import (
    COL_CAT1,
    COL_CAT2,
    COL_DATE,
    COL_NUM1,
    COL_NUM2,
    COL_NUM3,
    COL_NUM4,
    X,
    Y,
    _check,
    _has_data,
    _sec,
)


def run_statistical_charts_tests(s: requests.Session, api_url: str, did: str) -> None:
    """Execute les tests des visualisations descriptives, tests d'hypotheses et factorielles."""
    # ── 2. VISUALISATIONS ANALYSE DESCRIPTIVE ─────────────────────────────────
    _sec("2. VISUALISATIONS — Statistiques descriptives")

    s.post(f"{api_url}/datasets/{did}/analysis", json={})

    res = s.post(f"{api_url}/datasets/{did}/chart-data", json={
        "chart_type": "bar",
        "x_col": COL_CAT2,
        "y_cols": [COL_NUM1],
        "aggregation": "mean",
    })
    _check("Histogramme agrégé (desc)", res, validators=[
        ("data non vide", lambda b: _has_data(b)),
        ("valeurs numériques", lambda b: isinstance(b["data"][0].get(COL_NUM1), (int, float))),
    ])

    res = s.get(f"{api_url}/datasets/{did}/analysis/correlations?method=pearson")
    _check("Corrélations Pearson (heatmap data)", res, validators=[
        ("matrix défini", lambda b: _has_data(b, "matrix") or isinstance(b.get("matrix"), dict)),
        ("significant_pairs", lambda b: isinstance(b.get("significant_pairs"), list)),
        ("columns défini", lambda b: isinstance(b.get("columns"), list) and len(b["columns"]) >= 1),
    ], warn_keys=["columns"])

    res = s.get(f"{api_url}/datasets/{did}/analysis/correlations?method=spearman")
    _check("Corrélations Spearman (heatmap data)", res, validators=[
        ("method='spearman'", lambda b: b.get("method") == "spearman"),
        ("matrix défini", lambda b: isinstance(b.get("matrix"), dict)),
    ])

    res = s.get(f"{api_url}/datasets/{did}/analysis/descriptive")
    r = _check("Stats descriptives complètes", res, validators=[
        ("au moins 1 colonne", lambda b: isinstance(b, dict) and len(b) >= 1),
        ("col numérique a mean", lambda b: any(
            "mean" in (v or {}) for v in b.values() if isinstance(v, dict)
        )),
    ])
    if r:
        num_cols = [k for k, v in r.items() if isinstance(v, dict) and "mean" in v]
        cat_cols = [k for k, v in r.items() if isinstance(v, dict) and "cardinality" in v]
        print(f"       {Y}↳ {len(num_cols)} col(s) numériques, {len(cat_cols)} col(s) catégorielles{X}")

    # ── 3. VISUALISATIONS TESTS D'HYPOTHÈSES ──────────────────────────────────
    _sec("3. VISUALISATIONS — Tests d'hypothèses")

    res = s.post(f"{api_url}/datasets/{did}/analysis/test", json={
        "test_type": "compare_means",
        "group_col": COL_CAT1,
        "value_col": COL_NUM1,
    })
    _check("Test compare_means", res, validators=[
        ("test défini", lambda b: "test" in b),
        ("p_value", lambda b: b.get("p_value") is not None),
        ("significant", lambda b: "significant" in b and isinstance(b["significant"], bool)),
        ("effect_size", lambda b: isinstance(b.get("effect_size"), dict)),
    ], warn_keys=["test", "p_value", "significant"])

    res = s.post(f"{api_url}/datasets/{did}/chart-data", json={
        "chart_type": "bar",
        "x_col": COL_CAT1,
        "y_cols": [COL_NUM1],
        "aggregation": "mean",
    })
    _check("Box-plot proxy : mean revenue par groupe", res, validators=[
        ("données par groupe", lambda b: _has_data(b)),
        ("2 groupes (0/1)", lambda b: len(b.get("data", [])) == 2),
    ])

    res = s.post(f"{api_url}/datasets/{did}/analysis/test", json={
        "test_type": "correlation",
        "col1": COL_NUM1,
        "col2": COL_NUM2,
    })
    _check("Test corrélation (scatter data)", res, validators=[
        ("coefficient", lambda b: b.get("coefficient") is not None),
        ("p_value", lambda b: b.get("p_value") is not None),
        ("significant", lambda b: isinstance(b.get("significant"), bool)),
        ("strength", lambda b: b.get("strength") is not None),
    ], warn_keys=["test", "coefficient", "significant"])

    res = s.post(f"{api_url}/datasets/{did}/chart-data", json={
        "chart_type": "scatter",
        "x_col": COL_NUM1,
        "y_cols": [COL_NUM2],
    })
    _check("Scatter revenue vs time_spent (corrél visu)", res, validators=[
        ("data non vide", lambda b: _has_data(b)),
        ("x numérique", lambda b: isinstance(b["data"][0].get("x"), (int, float))),
        ("y numérique", lambda b: isinstance(b["data"][0].get("y"), (int, float))),
    ])

    res = s.post(f"{api_url}/datasets/{did}/analysis/test", json={
        "test_type": "independence",
        "col1": COL_CAT1,
        "col2": COL_CAT2,
    })
    _check("Test indépendance Chi²", res, validators=[
        ("statistic", lambda b: b.get("statistic") is not None),
        ("significant", lambda b: isinstance(b.get("significant"), bool)),
        ("cramers_v", lambda b: b.get("effect_size", {}).get("cramers_v") is not None),
    ], warn_keys=["test", "p_value", "significant"])

    res = s.post(f"{api_url}/datasets/{did}/chart-data", json={
        "chart_type": "stacked_bar",
        "x_col": COL_CAT2,
        "y_cols": [COL_NUM1],
        "group_col": COL_CAT1,
        "aggregation": "count",
    })
    _check("Contingence visuelle (stacked bar)", res, validators=[
        ("data non vide", lambda b: _has_data(b)),
        ("groupes présents", lambda b: len(b.get("series", [])) >= 2),
    ])

    res = s.post(f"{api_url}/datasets/{did}/analysis/stationarity", json={"col": COL_NUM1})
    _check("Stationnarité ADF+KPSS", res, validators=[
        ("adf défini", lambda b: isinstance(b.get("adf"), dict)),
        ("kpss défini", lambda b: isinstance(b.get("kpss"), dict)),
        ("is_stationary bool", lambda b: isinstance(b.get("is_stationary"), bool)),
        ("adf.is_stationary bool", lambda b: isinstance(b["adf"].get("is_stationary"), bool)),
        ("kpss.is_stationary bool", lambda b: isinstance(b["kpss"].get("is_stationary"), bool)),
        ("conclusion défini", lambda b: b.get("conclusion") is not None),
    ], warn_keys=["is_stationary", "conclusion"])

    res = s.post(f"{api_url}/datasets/{did}/chart-data", json={
        "chart_type": "line",
        "x_col": COL_DATE,
        "y_cols": [COL_NUM1],
        "aggregation": "mean",
        "time_granularity": "month",
    })
    _check("Série temporelle visu (line chart)", res, validators=[
        ("data non vide", lambda b: _has_data(b)),
    ])

    # ── 4. VISUALISATIONS ACP ─────────────────────────────────────────────────
    _sec("4. VISUALISATIONS — ACP (PCA)")

    res = s.post(f"{api_url}/datasets/{did}/factor-analysis/pca", json={
        "columns": [COL_NUM1, COL_NUM2, COL_NUM3, COL_NUM4],
        "n_components": 3,
    })
    r = _check("ACP — données complètes", res, validators=[
        ("explained_variance_ratio", lambda b: isinstance(b.get("explained_variance_ratio"), list) and len(b["explained_variance_ratio"]) >= 2),
        ("scores (individus)", lambda b: isinstance(b.get("scores"), list) and len(b["scores"]) >= 1),
        ("loadings / components", lambda b: isinstance(b.get("loadings"), dict) or isinstance(b.get("components"), list)),
        ("eigenvalues", lambda b: isinstance(b.get("eigenvalues"), list)),
        ("cumulative_variance", lambda b: isinstance(b.get("cumulative_variance"), list)),
        ("scree plot : n_comp", lambda b: b.get("n_components", 0) >= 2),
        ("variables list", lambda b: isinstance(b.get("variables"), list)),
    ], warn_keys=["n_components", "explained_variance_ratio"])
    if r:
        evr = r.get("explained_variance_ratio", [])
        cum = r.get("cumulative_variance", [])
        print(f"       {Y}Variance expliquée par axe : {[round(v, 3) for v in evr]}{X}")
        if cum:
            print(f"       {Y}Variance cumulée         : {[round(v, 3) for v in cum]}{X}")

    # ── 5. VISUALISATIONS AFC ─────────────────────────────────────────────────
    _sec("5. VISUALISATIONS — AFC (CA)")

    res = s.post(f"{api_url}/datasets/{did}/factor-analysis/ca", json={
        "row_col": COL_CAT1,
        "col_col": COL_CAT2,
    })
    _check("AFC — données complètes", res, validators=[
        ("row_coords", lambda b: isinstance(b.get("row_coords"), dict) and len(b["row_coords"]) >= 1),
        ("col_coords", lambda b: isinstance(b.get("col_coords"), dict) and len(b["col_coords"]) >= 1),
        ("eigenvalues", lambda b: isinstance(b.get("eigenvalues"), list)),
        ("explained_variance_ratio", lambda b: isinstance(b.get("explained_variance_ratio"), list)),
        ("contingency_table présent", lambda b: "contingency_table" in b or "row_coords" in b),
    ], warn_keys=["n_components", "explained_variance_ratio"])

    # ── 6. VISUALISATIONS ACM ─────────────────────────────────────────────────
    _sec("6. VISUALISATIONS — ACM (MCA)")

    res = s.post(f"{api_url}/datasets/{did}/factor-analysis/mca", json={
        "columns": [COL_CAT1, COL_CAT2],
        "n_components": 2,
    })
    _check("ACM — données complètes", res, validators=[
        ("modality_coords", lambda b: isinstance(b.get("modality_coords"), dict) and len(b["modality_coords"]) >= 1),
        ("explained_variance_ratio", lambda b: isinstance(b.get("explained_variance_ratio"), list)),
        ("individual_coords", lambda b: isinstance(b.get("individual_coords"), list) and len(b["individual_coords"]) >= 1),
        ("eta2 présent", lambda b: isinstance(b.get("eta2"), dict)),
        ("sampled flag", lambda b: "sampled" in b),
        ("n_obs <= 5000", lambda b: b.get("n_observations", 0) <= 5000),
    ], warn_keys=["n_observations", "sampled", "n_modalities"])
