"""
Moteur de scénarios : création, exécution, comparaison, sensibilité, Monte Carlo.
Phase 5 de la spécification.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from typing import Any


def create_scenario(
    df: pd.DataFrame,
    modifications: dict[str, Any],
    name: str = "custom",
) -> dict:
    """
    Crée un scénario à partir de données de base et de modifications.
    
    modifications: {
        "col_name": value,               # valeur fixe
        "col_name": {"shift": 0.1},       # +10%
        "col_name": {"multiply": 1.1},    # x1.1
        "col_name": {"add": 5},           # +5
        "col_name": {"set_quantile": 0.9} # 90ème percentile
    }
    """
    df_scenario = df.copy()

    applied = []
    for col, mod in modifications.items():
        if col not in df_scenario.columns:
            continue

        if isinstance(mod, (int, float)):
            original_mean = float(df_scenario[col].mean()) if pd.api.types.is_numeric_dtype(df_scenario[col]) else None
            df_scenario[col] = mod
            applied.append({"column": col, "operation": "set", "value": mod, "original_mean": original_mean})

        elif isinstance(mod, dict):
            if not pd.api.types.is_numeric_dtype(df_scenario[col]):
                continue

            if "shift" in mod:
                pct = mod["shift"]
                df_scenario[col] = df_scenario[col] * (1 + pct)
                applied.append({"column": col, "operation": "shift", "percentage": pct})

            elif "multiply" in mod:
                factor = mod["multiply"]
                df_scenario[col] = df_scenario[col] * factor
                applied.append({"column": col, "operation": "multiply", "factor": factor})

            elif "add" in mod:
                offset = mod["add"]
                df_scenario[col] = df_scenario[col] + offset
                applied.append({"column": col, "operation": "add", "offset": offset})

            elif "set_quantile" in mod:
                q = mod["set_quantile"]
                val = float(df_scenario[col].quantile(q))
                df_scenario[col] = val
                applied.append({"column": col, "operation": "set_quantile", "quantile": q, "value": val})

    return {
        "name": name,
        "modifications": applied,
        "n_rows": len(df_scenario),
        "df": df_scenario,  # DataFrame modifié (in-memory)
    }


def create_preset_scenarios(
    df: pd.DataFrame,
    numeric_cols: list[str] | None = None,
) -> list[dict]:
    """Crée les scénarios prédéfinis : pessimiste, central, optimiste."""
    if numeric_cols is None:
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()

    scenarios = []

    # Pessimiste : Q10
    mods_pessimiste = {}
    for col in numeric_cols:
        mods_pessimiste[col] = {"set_quantile": 0.10}
    scenarios.append(create_scenario(df, mods_pessimiste, name="pessimiste"))

    # Central : médiane
    mods_central = {}
    for col in numeric_cols:
        mods_central[col] = {"set_quantile": 0.50}
    scenarios.append(create_scenario(df, mods_central, name="central"))

    # Optimiste : Q90
    mods_optimiste = {}
    for col in numeric_cols:
        mods_optimiste[col] = {"set_quantile": 0.90}
    scenarios.append(create_scenario(df, mods_optimiste, name="optimiste"))

    return scenarios


def run_scenario(
    scenario_df: pd.DataFrame,
    model: Any,
    feature_names: list[str],
    task_type: str = "regression",
) -> dict:
    """Exécute un modèle sur un scénario et retourne les résultats."""
    X = scenario_df[feature_names].copy()

    # Pré-remplir les NaN avec la médiane
    for col in X.columns:
        if X[col].isna().any():
            X[col] = X[col].fillna(X[col].median())

    predictions = model.predict(X)
    result = {
        "n_predictions": len(predictions),
        "predictions_mean": float(np.nanmean(predictions)),
        "predictions_std": float(np.nanstd(predictions)),
        "predictions_min": float(np.nanmin(predictions)),
        "predictions_max": float(np.nanmax(predictions)),
        "predictions_median": float(np.nanmedian(predictions)),
    }

    if task_type == "regression":
        result["predictions_q25"] = float(np.nanpercentile(predictions, 25))
        result["predictions_q75"] = float(np.nanpercentile(predictions, 75))
    else:
        # Classification : distribution des classes
        unique, counts = np.unique(predictions, return_counts=True)
        result["class_distribution"] = {
            str(cls): int(cnt) for cls, cnt in zip(unique, counts)
        }
        if hasattr(model, "predict_proba"):
            try:
                probas = model.predict_proba(X)
                result["mean_probabilities"] = {
                    str(cls): float(np.mean(probas[:, i]))
                    for i, cls in enumerate(model.classes_)
                }
            except Exception:
                pass

    return result


def compare_scenarios(
    results: list[dict],
    names: list[str],
    baseline_index: int = 0,
) -> dict:
    """Compare les résultats de plusieurs scénarios."""
    if len(results) != len(names):
        raise ValueError("results et names doivent avoir la même longueur")

    baseline = results[baseline_index]
    comparison = []

    for i, (res, name) in enumerate(zip(results, names)):
        entry = {
            "name": name,
            "is_baseline": i == baseline_index,
            "predictions_mean": res["predictions_mean"],
            "predictions_std": res["predictions_std"],
            "predictions_min": res["predictions_min"],
            "predictions_max": res["predictions_max"],
        }

        if i != baseline_index:
            diff = res["predictions_mean"] - baseline["predictions_mean"]
            entry["diff_from_baseline"] = diff
            if baseline["predictions_mean"] != 0:
                entry["pct_change"] = diff / abs(baseline["predictions_mean"]) * 100
            else:
                entry["pct_change"] = None
        else:
            entry["diff_from_baseline"] = 0.0
            entry["pct_change"] = 0.0

        comparison.append(entry)

    return {
        "baseline": names[baseline_index],
        "scenarios": comparison,
        "spread": max(r["predictions_mean"] for r in results) - min(r["predictions_mean"] for r in results),
    }


def sensitivity_analysis(
    model: Any,
    df: pd.DataFrame,
    feature_names: list[str],
    variable: str,
    task_type: str = "regression",
    n_points: int = 20,
    range_pct: float = 0.5,
) -> dict:
    """
    Analyse de sensibilité : fait varier une variable dans une plage
    et observe l'impact sur la prédiction.
    """
    if variable not in feature_names:
        raise ValueError(f"Variable '{variable}' non trouvée dans les features")

    X_base = df[feature_names].copy()
    for col in X_base.columns:
        if X_base[col].isna().any():
            X_base[col] = X_base[col].fillna(X_base[col].median())

    col_values = X_base[variable]
    col_mean = float(col_values.mean())
    col_std = float(col_values.std())
    col_min, col_max = float(col_values.min()), float(col_values.max())

    # Plage de variation
    range_width = (col_max - col_min) * range_pct
    low = col_mean - range_width
    high = col_mean + range_width
    test_values = np.linspace(low, high, n_points)

    results = []
    for val in test_values:
        X_test = X_base.copy()
        X_test[variable] = val
        preds = model.predict(X_test)
        results.append({
            "value": float(val),
            "prediction_mean": float(np.nanmean(preds)),
            "prediction_std": float(np.nanstd(preds)),
        })

    # Calculer l'élasticité moyenne
    pred_at_mean = float(np.nanmean(model.predict(X_base)))
    # Élasticité = (ΔY/Y) / (ΔX/X) approximée
    if len(results) >= 2 and pred_at_mean != 0 and col_mean != 0:
        delta_x = results[-1]["value"] - results[0]["value"]
        delta_y = results[-1]["prediction_mean"] - results[0]["prediction_mean"]
        elasticity = (delta_y / pred_at_mean) / (delta_x / col_mean)
    else:
        elasticity = None

    return {
        "variable": variable,
        "base_mean": col_mean,
        "base_std": col_std,
        "range": [float(low), float(high)],
        "points": results,
        "elasticity": elasticity,
        "prediction_at_mean": pred_at_mean,
    }


def tornado_chart_data(
    model: Any,
    df: pd.DataFrame,
    feature_names: list[str],
    task_type: str = "regression",
    sigma: float = 1.0,
) -> dict:
    """
    Données pour tornado chart : pour chaque variable, calcule
    la prédiction à mean-σ*std et mean+σ*std.
    """
    X_base = df[feature_names].copy()
    for col in X_base.columns:
        if X_base[col].isna().any():
            X_base[col] = X_base[col].fillna(X_base[col].median())

    baseline_pred = float(np.nanmean(model.predict(X_base)))
    bars = []

    for var in feature_names:
        if not pd.api.types.is_numeric_dtype(X_base[var]):
            continue

        col_mean = float(X_base[var].mean())
        col_std = float(X_base[var].std())

        if col_std == 0 or np.isnan(col_std):
            continue

        # Prédiction à mean - σ*std
        X_low = X_base.copy()
        X_low[var] = col_mean - sigma * col_std
        pred_low = float(np.nanmean(model.predict(X_low)))

        # Prédiction à mean + σ*std
        X_high = X_base.copy()
        X_high[var] = col_mean + sigma * col_std
        pred_high = float(np.nanmean(model.predict(X_high)))

        swing = abs(pred_high - pred_low)
        bars.append({
            "variable": var,
            "low_value": col_mean - sigma * col_std,
            "high_value": col_mean + sigma * col_std,
            "pred_low": pred_low,
            "pred_high": pred_high,
            "swing": swing,
            "direction": "positive" if pred_high > pred_low else "negative",
        })

    # Trier par swing décroissant
    bars.sort(key=lambda b: b["swing"], reverse=True)

    return {
        "baseline_prediction": baseline_pred,
        "sigma": sigma,
        "bars": bars,
    }


def partial_dependence_data(
    model: Any,
    df: pd.DataFrame,
    feature_names: list[str],
    features: list[str],
    n_points: int = 30,
) -> dict:
    """
    Partial Dependence Plots : effet marginal de chaque feature.
    """
    X = df[feature_names].copy()
    for col in X.columns:
        if X[col].isna().any():
            X[col] = X[col].fillna(X[col].median())

    pdp_results = {}

    for feat in features:
        if feat not in feature_names:
            continue
        if not pd.api.types.is_numeric_dtype(X[feat]):
            continue

        values = np.linspace(float(X[feat].min()), float(X[feat].max()), n_points)
        avg_predictions = []

        for val in values:
            X_modified = X.copy()
            X_modified[feat] = val
            preds = model.predict(X_modified)
            avg_predictions.append(float(np.nanmean(preds)))

        pdp_results[feat] = {
            "values": [float(v) for v in values],
            "predictions": avg_predictions,
            "feature_mean": float(X[feat].mean()),
            "feature_std": float(X[feat].std()),
        }

    return {"features": pdp_results}


def monte_carlo_simulation(
    model: Any,
    df: pd.DataFrame,
    feature_names: list[str],
    n_simulations: int = 1000,
    noise_type: str = "gaussian",
    noise_scale: float = 1.0,
    task_type: str = "regression",
    seed: int | None = 42,
) -> dict:
    """
    Simulation Monte Carlo : génère N scénarios aléatoires
    en perturbant les données et retourne la distribution des prédictions.
    
    noise_type: "gaussian" (bruit normal) | "uniform" (bruit uniforme)
    noise_scale: multiplicateur de l'écart-type pour le bruit
    """
    rng = np.random.default_rng(seed)

    X_base = df[feature_names].copy()
    for col in X_base.columns:
        if X_base[col].isna().any():
            X_base[col] = X_base[col].fillna(X_base[col].median())

    numeric_features = [f for f in feature_names if pd.api.types.is_numeric_dtype(X_base[f])]
    stds = {f: float(X_base[f].std()) for f in numeric_features}

    simulation_means = []
    simulation_medians = []

    for _ in range(n_simulations):
        X_sim = X_base.copy()
        for feat in numeric_features:
            std = stds[feat]
            if std == 0 or np.isnan(std):
                continue
            if noise_type == "gaussian":
                noise = rng.normal(0, std * noise_scale, size=len(X_sim))
            else:  # uniform
                noise = rng.uniform(-std * noise_scale, std * noise_scale, size=len(X_sim))
            X_sim[feat] = X_sim[feat] + noise

        preds = model.predict(X_sim)
        simulation_means.append(float(np.nanmean(preds)))
        simulation_medians.append(float(np.nanmedian(preds)))

    means_arr = np.array(simulation_means)
    result = {
        "n_simulations": n_simulations,
        "noise_type": noise_type,
        "noise_scale": noise_scale,
        "distribution": {
            "mean": float(np.mean(means_arr)),
            "std": float(np.std(means_arr)),
            "min": float(np.min(means_arr)),
            "max": float(np.max(means_arr)),
            "q05": float(np.percentile(means_arr, 5)),
            "q25": float(np.percentile(means_arr, 25)),
            "median": float(np.median(means_arr)),
            "q75": float(np.percentile(means_arr, 75)),
            "q95": float(np.percentile(means_arr, 95)),
        },
        "histogram": _build_histogram(means_arr),
    }

    return result


def stress_test(
    model: Any,
    df: pd.DataFrame,
    feature_names: list[str],
    task_type: str = "regression",
    sigmas: list[float] | None = None,
) -> dict:
    """
    Stress test : applique des chocs de ±1σ et ±2σ sur chaque variable.
    """
    if sigmas is None:
        sigmas = [1.0, 2.0]

    X_base = df[feature_names].copy()
    for col in X_base.columns:
        if X_base[col].isna().any():
            X_base[col] = X_base[col].fillna(X_base[col].median())

    baseline_pred = float(np.nanmean(model.predict(X_base)))
    results = []

    for var in feature_names:
        if not pd.api.types.is_numeric_dtype(X_base[var]):
            continue

        col_std = float(X_base[var].std())
        col_mean = float(X_base[var].mean())
        if col_std == 0 or np.isnan(col_std):
            continue

        var_results = {"variable": var, "mean": col_mean, "std": col_std, "shocks": []}

        for s in sigmas:
            for direction in [-1, 1]:
                X_shock = X_base.copy()
                shock_val = col_mean + direction * s * col_std
                X_shock[var] = shock_val
                pred = float(np.nanmean(model.predict(X_shock)))
                var_results["shocks"].append({
                    "sigma": s * direction,
                    "value": shock_val,
                    "prediction": pred,
                    "impact": pred - baseline_pred,
                    "impact_pct": ((pred - baseline_pred) / abs(baseline_pred) * 100) if baseline_pred != 0 else None,
                })

        results.append(var_results)

    return {
        "baseline_prediction": baseline_pred,
        "sigmas_tested": sigmas,
        "variables": results,
    }


def _build_histogram(values: np.ndarray, n_bins: int = 30) -> dict:
    """Helper : construit un histogramme pour la distribution Monte Carlo."""
    counts, bin_edges = np.histogram(values, bins=n_bins)
    return {
        "counts": [int(c) for c in counts],
        "bin_edges": [float(e) for e in bin_edges],
        "bin_centers": [float((bin_edges[i] + bin_edges[i + 1]) / 2) for i in range(len(counts))],
    }
