"""
Exécute une PipelineRecipe : appelle les modules backend appropriés.

Note : la persistance des résultats reste à la charge des endpoints qui
mutent l'état du dataset (analysis_results, model_results, etc.).
Ici on agrège les sorties dans un dict.
"""

from __future__ import annotations

from dataclasses import asdict
from typing import Any
import logging

import pandas as pd

from app.core.auto_pipeline.recipe import PipelineRecipe, PipelineStep
from app.core.auto_pipeline.reporting import (
    _build_explainability_payload,
    _build_insights_payload,
    _build_report_payload,
    _collect_pipeline_insights,
    _get_step_output,
)


logger = logging.getLogger(__name__)


def execute_recipe(
    df: pd.DataFrame,
    recipe: PipelineRecipe,
    execute_optional: bool = False,
) -> dict[str, Any]:
    """Exécute chaque étape d'une recipe et retourne les résultats agrégés.

    Args:
        df: DataFrame à analyser (déjà chargé).
        recipe: PipelineRecipe à exécuter.
        execute_optional: si True, exécute aussi les étapes marquées optional.

    Returns:
        dict { step_key: { status, duration_ms, result | error } }
    """
    import time

    results: dict[str, Any] = {
        "title": recipe.title,
        "problem_type": recipe.problem_type,
        "target": recipe.target,
        "recipe": recipe,
        "steps": {},
    }

    # DataFrame travaillé (peut être muté par cleaning/transforms)
    work_df = df.copy()

    for step in recipe.steps:
        if step.optional and not execute_optional:
            results["steps"][step.key] = {
                "status": "skipped",
                "reason": "optional",
                "label": step.label,
            }
            continue

        t0 = time.time()
        step_result: dict[str, Any] = {"label": step.label, "operation": step.operation}

        try:
            output = _dispatch(step, work_df, results)
            # Mutation du df si cleaning ou transform a renvoyé un nouveau df
            if step.operation in ("clean", "transform") and isinstance(output, dict) and "df" in output:
                work_df = output["df"]
                output.pop("df", None)

                # Conservation des données transformées pour les étapes downstream (modélisation, stats)
                if step.operation == "transform":
                    logger.info("Pipeline: %d colonnes prêtes après transformation", work_df.shape[1])

            step_result["status"] = "success"
            step_result["result"] = output
        except Exception as e:
            logger.exception("Pipeline step %s failed", step.key)
            step_result["status"] = "error"
            step_result["error"] = str(e)

        step_result["duration_ms"] = int((time.time() - t0) * 1000)
        results["steps"][step.key] = step_result

    return results


# ── Dispatcher ───────────────────────────────────────────────────────────


def _dispatch(step: PipelineStep, df: pd.DataFrame, ctx: dict[str, Any]) -> Any:
    """Aiguille vers la bonne fonction métier."""
    op = step.operation
    params = step.params or {}

    if op == "clean":
        return _exec_clean(df, params)

    if op == "descriptive":
        from app.core.analysis import compute_descriptive_stats
        return compute_descriptive_stats(df, bootstrap_ci=params.get("bootstrap_ci", False))

    if op == "correlation":
        from app.core.analysis import compute_correlation_matrix
        return compute_correlation_matrix(df, method=params.get("method", "pearson"))

    if op == "vif":
        from app.core.analysis import compute_vif
        return compute_vif(df)

    if op == "transform_recommend":
        from app.core.transformations import recommend_transforms
        return {"recommendations": recommend_transforms(df)}

    if op == "transform":
        from app.core.transformations import apply_transforms_to_df
        transforms = params.get("transforms", [])
        if not transforms and "column" in params and "transform" in params:
            transforms = [params]
        if not transforms:
            return {"status": "skipped", "message": "Aucune transformation spécifiée"}
        clean_transforms = []
        for t in transforms:
            t_copy = dict(t)
            if t_copy.get("transform") in ("standardize", "minmax", "robust", "quantile", "power"):
                t_copy.setdefault("replace", True)
            clean_transforms.append(t_copy)
        df_res, logs = apply_transforms_to_df(df, clean_transforms)
        return {"logs": logs, "df": df_res}


    if op == "pca":
        from app.core.factor_analysis import run_pca
        return run_pca(df, columns=params.get("columns"))

    if op == "model":
        from app.core.modeling import train_competitive, prepare_data
        target = params["target_col"]
        task_type = params.get("task_type") or params.get("problem_type")
        data = prepare_data(df, target, task_type=task_type)
        result = train_competitive(
            data,
            model_keys=params.get("model_keys"),
            cv_folds=params.get("cv_folds", 5),
            task_type=task_type,
        )
        if result.get("ranking"):
            result["best"] = result["ranking"][0]
        result["target"] = target
        return result

    if op == "timeseries_stationarity":
        from app.core.timeseries.stationarity import test_stationarity
        cols = params.get("columns") or [c for c in df.select_dtypes(include="number").columns]
        res = {}
        for c in cols[:10]:
            try:
                res[c] = test_stationarity(df[c].dropna())
            except Exception as e:
                res[c] = {"error": str(e)}
        return res

    if op == "timeseries_cointegration":
        from app.core.timeseries.multivariate import test_johansen_cointegration
        cols = params.get("columns") or [c for c in df.select_dtypes(include="number").columns]
        if len(cols) >= 2:
            return test_johansen_cointegration(df[cols].dropna())
        return {"status": "skipped", "message": "Nécessite au moins 2 séries numériques"}

    if op == "timeseries":
        from app.core.timeseries import run_timeseries_analysis
        return run_timeseries_analysis(
            df,
            date_col=params["date_col"],
            value_col=params["value_col"],
            forecast_steps=params.get("forecast_steps", 10),
        )

    if op == "timeseries_multivariate":
        from app.core.timeseries import run_multivariate_timeseries_analysis
        return run_multivariate_timeseries_analysis(
            df,
            date_col=params["date_col"],
            value_cols=params["value_cols"],
            forecast_steps=params.get("forecast_steps", 10),
        )

    if op == "survival":
        from app.core.survival import run_survival_analysis
        return run_survival_analysis(df, duration_col=params.get("durationCol"), event_col=params.get("eventCol"))

    if op == "causal":
        from app.core.causal import run_difference_in_differences
        return run_difference_in_differences(df, treatment_col=params.get("treatmentCol"), outcome_col=params.get("outcomeCol"))

    if op == "manifold":
        from app.core.factor_analysis import run_tsne
        return run_tsne(df, columns=params.get("columns"))

    if op == "explainability":
        return _build_explainability_payload(ctx)

    if op == "insights":
        return _build_insights_payload(ctx)

    if op == "report":
        return _build_report_payload(df, ctx)

    raise ValueError(f"Opération inconnue : {op}")




def _exec_clean(df: pd.DataFrame, params: dict[str, Any]) -> dict[str, Any]:
    """Exécute les actions de cleaning sur le DataFrame."""
    actions = params.get("actions", [])
    cleaned = df.copy()
    summary: dict[str, Any] = {"actions": [], "before_rows": len(df), "before_cols": df.shape[1]}

    if "remove_duplicates" in actions:
        before = len(cleaned)
        cleaned = cleaned.drop_duplicates()
        summary["actions"].append({"action": "remove_duplicates", "removed": before - len(cleaned)})

    if "drop_high_missing_cols" in actions:
        cols = params.get("high_missing_cols", [])
        cols_to_drop = [c for c in cols if c in cleaned.columns]
        cleaned = cleaned.drop(columns=cols_to_drop)
        summary["actions"].append({"action": "drop_high_missing_cols", "dropped": cols_to_drop})

    if "drop_constant_cols" in actions:
        cols = params.get("constant_cols", [])
        cols_to_drop = [c for c in cols if c in cleaned.columns]
        cleaned = cleaned.drop(columns=cols_to_drop)
        summary["actions"].append({"action": "drop_constant_cols", "dropped": cols_to_drop})

    if "impute_missing" in actions:
        # Imputation simple : médiane numériques / mode catégorielles
        n_imputed = 0
        for col in cleaned.columns:
            if cleaned[col].isna().any():
                if pd.api.types.is_numeric_dtype(cleaned[col]):
                    val = cleaned[col].median()
                else:
                    mode = cleaned[col].mode()
                    val = mode.iloc[0] if not mode.empty else "missing"
                n_filled = cleaned[col].isna().sum()
                cleaned[col] = cleaned[col].fillna(val)
                n_imputed += n_filled
        summary["actions"].append({"action": "impute_missing", "n_imputed": int(n_imputed)})

    summary["after_rows"] = len(cleaned)
    summary["after_cols"] = cleaned.shape[1]
    summary["df"] = cleaned  # retourné pour mutation downstream
    return summary
