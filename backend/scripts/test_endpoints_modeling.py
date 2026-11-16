"""
Tests des endpoints de modelisation predictive, series temporelles, visualisations, scenarios et insights.
"""

from __future__ import annotations

import requests

from endpoint_test_suite import (
    COL_CAT1,
    COL_CAT2,
    COL_DATE,
    COL_NUM1,
    COL_NUM2,
    COL_NUM3,
    COL_TARGET,
    _check,
    _section,
)


def run_modeling_endpoints_tests(s: requests.Session, api_url: str, dataset_id: str) -> None:
    """Execute les tests de modelisation, series temporelles, graphiques, transformations, scenarios et insights."""
    # 8. MODÉLISATION PRÉDICTIVE
    _section("8. MODÉLISATION PRÉDICTIVE")
    res = s.post(f"{api_url}/datasets/{dataset_id}/model/train", json={
        "target_column": COL_TARGET,
        "models": ["linear_regression", "random_forest"],
        "test_size": 0.2,
        "split_strategy": "auto",
    })
    r = _check("Entraînement modèles", res, show_keys=["task_type", "best_model_key", "ranking"])
    if r:
        for m in r.get("ranking", [])[:3]:
            score_key = "r2" if r.get("task_type") == "regression" else "f1"
            score = m.get("metrics", {}).get(score_key, m.get("metrics", {}))
            print(f"      {m.get('key')}: {score}")

    _check("Résultats modèle (GET)", s.get(f"{api_url}/datasets/{dataset_id}/model/results"),
           show_keys=["best_model_key", "task_type"])
    _check("Feature ranges", s.get(f"{api_url}/datasets/{dataset_id}/model/feature-ranges"),
           show_keys=["features", "task_type"])

    feat_res = s.get(f"{api_url}/datasets/{dataset_id}/model/feature-ranges").json()
    if feat_res and feat_res.get("ranges"):
        sample_features = {k: v["mean"] for k, v in feat_res["ranges"].items()}
        res = s.post(f"{api_url}/datasets/{dataset_id}/model/predict", json={"features": sample_features})
        _check("Prédiction", res, show_keys=["predictions", "model_used"])

    # 9. SÉRIES TEMPORELLES
    _section("9. SÉRIES TEMPORELLES")
    res = s.post(f"{api_url}/datasets/{dataset_id}/timeseries", json={
        "date_col": COL_DATE,
        "value_col": COL_NUM1,
        "models": ["arima", "exponential_smoothing"],
        "forecast_steps": 10,
    })
    r = _check("Série temporelle univariée", res, show_keys=["models", "forecast", "best_model"])
    if r:
        print(f"      → modèles: {list((r.get('models') or {}).keys())}")

    res = s.post(f"{api_url}/datasets/{dataset_id}/timeseries/multivariate", json={
        "date_col": COL_DATE,
        "value_cols": [COL_NUM1, COL_NUM2],
        "models": ["var"],
        "forecast_steps": 10,
        "granger_max_lag": 4,
        "var_data_mode": "auto",
        "var_trend": "c",
        "granger_data_mode": "auto",
    })
    _check("Série temporelle multivariée (VAR)", res, show_keys=["models", "granger", "forecast"])

    # 10. GRAPHIQUES / VISUALISATIONS (chart-data)
    _section("10. GRAPHIQUES / VISUALISATIONS (chart-data)")
    charts = [
        ("Chart — Line (revenue/date)", {
            "chart_type": "line", "x_col": COL_DATE, "y_cols": [COL_NUM1], "aggregation": "mean",
        }),
        ("Chart — Bar (satisfaction)", {
            "chart_type": "bar", "x_col": COL_CAT2, "y_cols": [COL_NUM1], "aggregation": "mean", "top_n": 10,
        }),
        ("Chart — Pie (is_premium_member)", {
            "chart_type": "pie", "x_col": COL_CAT1, "y_cols": [COL_NUM1], "aggregation": "sum",
        }),
        ("Chart — Scatter (revenue vs time_spent)", {
            "chart_type": "scatter", "x_col": COL_NUM1, "y_cols": [COL_NUM2],
        }),
        ("Chart — Area (revenue/date)", {
            "chart_type": "area", "x_col": COL_DATE, "y_cols": [COL_NUM1], "aggregation": "sum",
        }),
        ("Chart — Stacked Bar (satisfaction × premium)", {
            "chart_type": "stacked_bar", "x_col": COL_CAT2, "y_cols": [COL_NUM1],
            "group_col": COL_CAT1, "aggregation": "mean",
        }),
    ]
    for name, payload in charts:
        res = s.post(f"{api_url}/datasets/{dataset_id}/chart-data", json=payload)
        r = _check(name, res, show_keys=["chart_type", "labels", "datasets"])
        if r:
            print(f"      → {len(r.get('labels', []))} points, {len(r.get('datasets', []))} série(s)")

    # 11. TRANSFORMATIONS
    _section("11. TRANSFORMATIONS")
    res = s.get(f"{api_url}/datasets/{dataset_id}/transforms/catalog")
    r = _check("Catalogue transformations", res, show_keys=["transforms"])
    if r:
        t_list = r.get("transforms", [])
        print(f"      → {len(t_list)} transforms disponibles: {[t.get('key') for t in t_list[:6]]}...")

    _check("Recommandations transforms", s.get(f"{api_url}/datasets/{dataset_id}/transforms/recommend"),
           show_keys=["recommendations"])

    res = s.post(f"{api_url}/datasets/{dataset_id}/transforms/preview", json={
        "column": COL_NUM1, "transform": "log", "params": {},
    })
    r = _check("Preview transform (log)", res, show_keys=["transform", "original", "transformed"])
    if r:
        orig = r.get("original", {})
        trans = r.get("transformed", {})
        print(f"      → skewness avant: {orig.get('skewness')}  après: {trans.get('skewness')}")

    res = s.post(f"{api_url}/datasets/{dataset_id}/transforms/apply", json={
        "transforms": [{"column": COL_NUM1, "transform": "log", "params": {}}],
        "inplace": False,
    })
    _check("Apply transform (dry-run)", res, show_keys=["logs", "applied", "shape"])

    res = s.post(f"{api_url}/datasets/{dataset_id}/compute-variable", json={
        "new_column": "revenue_per_min",
        "formula": f"{COL_NUM1} / ({COL_NUM2} + 1)",
    })
    _check("Calcul variable dérivée", res, show_keys=["log", "shape"])

    # 12. SCÉNARIOS & SIMULATION
    _section("12. SCÉNARIOS & SIMULATION")
    res = s.post(f"{api_url}/datasets/{dataset_id}/scenarios/presets", json={})
    r = _check("Scénarios prédéfinis (pessimiste/central/optimiste)", res, show_keys=["scenarios"])
    if r:
        print(f"      → scénarios: {[s_['name'] for s_ in r.get('scenarios', [])]}")

    res = s.post(f"{api_url}/datasets/{dataset_id}/scenarios/create", json={
        "name": "custom_test",
        "modifications": {COL_NUM1: {"shift": 0.1}, COL_NUM2: {"shift": -0.05}},
    })
    _check("Créer scénario custom", res, show_keys=["name", "modifications", "n_rows"])

    _check("Lister scénarios", s.get(f"{api_url}/datasets/{dataset_id}/scenarios"),
           show_keys=["scenarios", "count"])

    res = s.post(f"{api_url}/datasets/{dataset_id}/scenarios/run", json={
        "scenario_names": ["pessimiste", "central", "optimiste"],
    })
    r = _check("Exécuter scénarios", res, show_keys=["results", "comparison"])
    if r:
        for sc in r.get("results", []):
            print(f"      {sc.get('name')}: mean_pred={sc.get('mean_prediction')}")

    res = s.post(f"{api_url}/datasets/{dataset_id}/sensitivity", json={
        "variables": [COL_NUM2, COL_NUM3], "n_points": 10, "range_pct": 0.3,
    })
    _check("Analyse de sensibilité", res, show_keys=["analyses", "count"])

    _check("Tornado chart", s.post(f"{api_url}/datasets/{dataset_id}/tornado", json={"sigma": 1.0}),
           show_keys=["variables", "bars"])

    _check("Partial Dependence Plots", s.post(f"{api_url}/datasets/{dataset_id}/partial-dependence", json={
        "features": [COL_NUM2, COL_NUM3], "n_points": 15,
    }), show_keys=["features"])

    _check("Monte Carlo (500 sims)", s.post(f"{api_url}/datasets/{dataset_id}/monte-carlo", json={
        "n_simulations": 500, "noise_type": "gaussian", "noise_scale": 1.0, "seed": 42,
    }), show_keys=["n_simulations", "mean", "std", "percentiles"])

    _check("Stress test (±1σ, ±2σ)", s.post(f"{api_url}/datasets/{dataset_id}/stress-test", json={
        "sigmas": [1.0, 2.0],
    }), show_keys=["shocks"])

    # 13. INSIGHTS NARRATIFS
    _section("13. INSIGHTS NARRATIFS")
    res = s.get(f"{api_url}/datasets/{dataset_id}/insights")
    r = _check("Insights narratifs", res, show_keys=["count", "summary"])
    if r:
        summary = r.get("summary", {})
        print(f"      → {r.get('count')} insights  ({summary.get('critical', 0)} critical, "
              f"{summary.get('warning', 0)} warning, {summary.get('info', 0)} info)")
        for ins in r.get("insights", [])[:3]:
            print(f"        [{ins.get('severity', '')}] {ins.get('message', '')[:80]}")
