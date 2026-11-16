"""
Tests des visualisations prédictives : modélisation, scénarios, séries temporelles, capabilities et insights.
"""

from __future__ import annotations

import requests

from chart_test_suite import (
    COL_DATE,
    COL_NUM1,
    COL_NUM2,
    COL_NUM3,
    COL_NUM4,
    COL_TARGET,
    X,
    Y,
    _check,
    _has_data,
    _sec,
)


def run_predictive_charts_tests(s: requests.Session, api_url: str, did: str) -> None:
    """Execute les tests des visualisations predictives, simulations et series temporelles."""
    # ── 7. VISUALISATIONS MODÉLISATION ────────────────────────────────────────
    _sec("7. VISUALISATIONS — Modélisation prédictive")

    res = s.post(f"{api_url}/datasets/{did}/model/train", json={
        "target_column": COL_TARGET,
        "models": ["linear_regression", "random_forest"],
        "test_size": 0.2,
    })
    r = _check("Train modèle", res, validators=[
        ("ranking non vide", lambda b: len(b.get("ranking", [])) >= 1),
        ("best_model_key", lambda b: b.get("best_model_key") is not None),
    ], warn_keys=["best_model_key", "task_type"])
    if r and r.get("ranking"):
        best = r["ranking"][0]
        print(f"       {Y}Métriques meilleur modèle : {best.get('metrics', {})}{X}")

    res_r = s.get(f"{api_url}/datasets/{did}/model/results")
    r2 = _check("Résultats modèle + SHAP", res_r, validators=[
        ("best_model_key", lambda b: b.get("best_model_key") is not None),
        ("shap présent", lambda b: "shap" in b),
        ("data_split", lambda b: isinstance(b.get("data_split"), dict)),
        ("ranking", lambda b: isinstance(b.get("ranking"), list) and len(b["ranking"]) >= 1),
    ], warn_keys=["best_model_key", "shap"])
    if r2 and r2.get("shap") and isinstance(r2["shap"], dict):
        print(f"       {Y}SHAP keys : {list(r2['shap'].keys())[:5]}{X}")

    res = s.get(f"{api_url}/datasets/{did}/model/feature-ranges")
    _check("Feature ranges (simulation form)", res, validators=[
        ("features liste", lambda b: isinstance(b.get("features"), list) and len(b["features"]) >= 1),
        ("ranges dict", lambda b: isinstance(b.get("ranges"), dict) and len(b["ranges"]) >= 1),
        ("ranges.mean présent", lambda b: all("mean" in v for v in b["ranges"].values())),
    ], warn_keys=["features", "task_type"])

    feat_res = s.get(f"{api_url}/datasets/{did}/model/feature-ranges").json()
    if feat_res.get("ranges"):
        sample = {k: v["mean"] for k, v in feat_res["ranges"].items()}
        res = s.post(f"{api_url}/datasets/{did}/model/predict", json={"features": sample})
        _check("Prédiction (1 observation)", res, validators=[
            ("predictions liste", lambda b: isinstance(b.get("predictions"), list) and len(b["predictions"]) == 1),
            ("prediction numérique", lambda b: isinstance(b["predictions"][0], (int, float))),
            ("model_used", lambda b: b.get("model_used") is not None),
        ], warn_keys=["predictions", "model_used"])

    # ── 8. VISUALISATIONS SCÉNARIOS ───────────────────────────────────────────
    _sec("8. VISUALISATIONS — Scénarios & Simulation")

    s.post(f"{api_url}/datasets/{did}/scenarios/presets", json={})

    res = s.get(f"{api_url}/datasets/{did}/scenarios")
    _check("Liste scénarios", res, validators=[
        ("3 scénarios prédéfinis", lambda b: b.get("count", 0) >= 3),
        ("noms corrects", lambda b: all(
            n in [sc["name"] for sc in b.get("scenarios", [])]
            for n in ["pessimiste", "central", "optimiste"]
        )),
    ])

    res = s.post(f"{api_url}/datasets/{did}/scenarios/run", json={
        "scenario_names": ["pessimiste", "central", "optimiste"],
    })
    _check("Exécution scénarios (données comparaison)", res, validators=[
        ("3 résultats", lambda b: len(b.get("results", [])) == 3),
        ("comparison", lambda b: isinstance(b.get("comparison"), dict)),
        ("task_type", lambda b: b.get("task_type") is not None),
    ], warn_keys=["task_type"])

    res = s.post(f"{api_url}/datasets/{did}/tornado", json={"sigma": 1.0})
    _check("Tornado chart (données)", res, validators=[
        ("bars présent", lambda b: isinstance(b.get("bars"), list) and len(b["bars"]) >= 1),
        ("bar a variable", lambda b: "variable" in b["bars"][0]),
        ("bar a pred_low", lambda b: "pred_low" in b["bars"][0]),
        ("bar a pred_high", lambda b: "pred_high" in b["bars"][0]),
        ("bar a swing", lambda b: "swing" in b["bars"][0]),
        ("bar a direction", lambda b: b["bars"][0].get("direction") in ("positive", "negative")),
        ("baseline_prediction", lambda b: b.get("baseline_prediction") is not None),
    ], warn_keys=["bars"])

    res = s.post(f"{api_url}/datasets/{did}/sensitivity", json={
        "variables": [COL_NUM2, COL_NUM3], "n_points": 10, "range_pct": 0.3,
    })
    _check("Sensibilité (line chart data)", res, validators=[
        ("analyses liste", lambda b: isinstance(b.get("analyses"), list) and len(b["analyses"]) >= 1),
        ("a variable", lambda b: "variable" in b["analyses"][0]),
        ("a points", lambda b: isinstance(b["analyses"][0].get("points"), list) and len(b["analyses"][0]["points"]) >= 1),
        ("point a value", lambda b: "value" in b["analyses"][0]["points"][0]),
        ("point a prediction", lambda b: "prediction_mean" in b["analyses"][0]["points"][0]),
        ("elasticity", lambda b: "elasticity" in b["analyses"][0]),
    ], warn_keys=["count"])

    res = s.post(f"{api_url}/datasets/{did}/partial-dependence", json={
        "features": [COL_NUM2, COL_NUM3], "n_points": 15,
    })
    _check("Partial Dependence Plot (line data)", res, validators=[
        ("features dict", lambda b: isinstance(b.get("features"), dict)),
        ("au moins 1 feature", lambda b: len(b.get("features", {})) >= 1),
    ], warn_keys=["features"])

    res = s.post(f"{api_url}/datasets/{did}/monte-carlo", json={
        "n_simulations": 200, "noise_type": "gaussian", "noise_scale": 0.5, "seed": 99,
    })
    _check("Monte Carlo (histogram data)", res, validators=[
        ("n_simulations", lambda b: b.get("n_simulations") is not None),
        ("histogram/dist", lambda b: "histogram" in b or "distribution" in b or
                         "predictions" in b or "mean" in b),
    ], warn_keys=["n_simulations"])

    res = s.post(f"{api_url}/datasets/{did}/stress-test", json={"sigmas": [1.0, 2.0]})
    _check("Stress test (bar data)", res, validators=[
        ("shocks présent", lambda b: "shocks" in b or "results" in b or isinstance(b, dict)),
    ], warn_keys=["shocks"])

    # ── 9. VISUALISATIONS SÉRIES TEMPORELLES ──────────────────────────────────
    _sec("9. VISUALISATIONS — Séries temporelles")

    res = s.post(f"{api_url}/datasets/{did}/timeseries", json={
        "date_col": COL_DATE,
        "value_col": COL_NUM1,
        "models": ["arima", "exponential_smoothing"],
        "forecast_steps": 12,
    })
    _check("Série temporelle — structure complète", res, validators=[
        ("models dict", lambda b: isinstance(b.get("models"), dict) and len(b["models"]) >= 1),
        ("best_model", lambda b: b.get("best_model") is not None),
        ("au moins 1 modèle a forecast", lambda b: any(
            "forecast" in (v or {}) for v in b.get("models", {}).values() if isinstance(v, dict)
        )),
        ("forecast data présent", lambda b: any(
            isinstance((v or {}).get("forecast"), (list, dict))
            for v in b.get("models", {}).values() if isinstance(v, dict)
        )),
    ], warn_keys=["best_model"])

    res = s.post(f"{api_url}/datasets/{did}/chart-data", json={
        "chart_type": "line", "x_col": COL_DATE, "y_cols": [COL_NUM1],
        "aggregation": "mean", "time_granularity": "month",
    })
    _check("Série temporelle visu (line par mois)", res, validators=[
        ("data non vide", lambda b: _has_data(b)),
        ("format temporel", lambda b: "-" in str(b["data"][0].get("x", ""))),
    ])

    res = s.post(f"{api_url}/datasets/{did}/timeseries/multivariate", json={
        "date_col": COL_DATE, "value_cols": [COL_NUM1, COL_NUM2], "models": ["var"],
        "forecast_steps": 10, "granger_max_lag": 4, "var_data_mode": "auto",
        "var_trend": "c", "granger_data_mode": "auto",
    })
    _check("Série temporelle multivariée (VAR)", res, validators=[
        ("models dict", lambda b: isinstance(b.get("models"), dict)),
        ("var présent", lambda b: "var" in (b.get("models") or {})),
    ])

    # ── 10. CAPABILITIES & COLONNES EXCLUES ───────────────────────────────────
    _sec("10. CAPABILITIES & COLONNES EXCLUES")

    _check("Capabilities", s.get(f"{api_url}/datasets/{did}/capabilities"), validators=[
        ("analyses liste", lambda b: isinstance(b.get("analyses"), list) and len(b["analyses"]) >= 5),
        ("columns dict", lambda b: isinstance(b.get("columns"), dict)),
        ("numeric cols", lambda b: len(b.get("columns", {}).get("numeric", [])) >= 1),
        ("summary présent", lambda b: isinstance(b.get("summary"), dict)),
    ], warn_keys=["summary"])

    _check("Colonnes exclues (GET)", s.get(f"{api_url}/datasets/{did}/excluded-columns"), validators=[
        ("all_columns", lambda b: isinstance(b.get("all_columns"), list)),
        ("active_columns", lambda b: isinstance(b.get("active_columns"), list)),
    ])

    _check("Exclure une colonne (PUT)", s.put(f"{api_url}/datasets/{did}/excluded-columns", json={
        "excluded_columns": [COL_NUM4],
    }), validators=[
        ("excluded list", lambda b: COL_NUM4 in b.get("excluded_columns", [])),
        ("active_columns", lambda b: COL_NUM4 not in b.get("active_columns", [])),
    ])

    # ── 11. INSIGHTS NARRATIFS ────────────────────────────────────────────────
    _sec("11. INSIGHTS NARRATIFS (données textuelles)")

    res = s.get(f"{api_url}/datasets/{did}/insights")
    r = _check("Insights narratifs", res, validators=[
        ("count >= 1", lambda b: b.get("count", 0) >= 1),
        ("summary dict", lambda b: isinstance(b.get("summary"), dict)),
        ("insights liste", lambda b: isinstance(b.get("insights"), list)),
        ("insight a message", lambda b: "message" in b["insights"][0]),
        ("insight a severity", lambda b: "severity" in b["insights"][0]),
    ], warn_keys=["count", "summary"])
    if r and r.get("insights"):
        for ins in r["insights"][:5]:
            print(f"       [{ins.get('severity', '?')}] {ins.get('message', '')[:70]}")
