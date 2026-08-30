"""
Création, exécution et comparaison des scénarios what-if de base.
"""

from __future__ import annotations

from typing import Any
import numpy as np
import pandas as pd


def create_scenario(
    df: pd.DataFrame,
    modifications: dict[str, Any],
    name: str = "custom",
) -> dict:
    """
    Crée un scénario à partir de données de base et de modifications.
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
        "df": df_scenario,
    }


def create_preset_scenarios(
    df: pd.DataFrame,
    numeric_cols: list[str] | None = None,
) -> list[dict]:
    """Crée les scénarios prédéfinis : pessimiste, central, optimiste."""
    if numeric_cols is None:
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()

    scenarios = []

    mods_pessimiste = {col: {"set_quantile": 0.10} for col in numeric_cols}
    scenarios.append(create_scenario(df, mods_pessimiste, name="pessimiste"))

    mods_central = {col: {"set_quantile": 0.50} for col in numeric_cols}
    scenarios.append(create_scenario(df, mods_central, name="central"))

    mods_optimiste = {col: {"set_quantile": 0.90} for col in numeric_cols}
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
