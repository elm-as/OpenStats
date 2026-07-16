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
from app.core.interpretation import (
    narrate_descriptive,
    narrate_correlations,
    narrate_vif,
    narrate_modeling,
    narrate_timeseries,
    narrate_multivariate_timeseries,
    narrate_pca,
    narrate_ca,
    narrate_mca,
    narrate_diagnostics,
)
from app.core.interpretation.base import insights_to_dict, sort_insights
from app.core.professional_report import build_report_payload

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
            # Mutation du df si cleaning a renvoyé un nouveau df
            if step.operation == "clean" and isinstance(output, dict) and "df" in output:
                work_df = output["df"]
                output.pop("df", None)

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

    if op == "pca":
        from app.core.factor_analysis import run_pca
        return run_pca(df, columns=params.get("columns"))

    if op == "model":
        from app.core.modeling import train_competitive, prepare_data, detect_task_type
        target = params["target_col"]
        data = prepare_data(df, target)
        result = train_competitive(
            data,
            model_keys=params.get("model_keys"),
            cv_folds=params.get("cv_folds", 5),
        )
        if result.get("ranking"):
            result["best"] = result["ranking"][0]
        result["target"] = target
        return result

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

    if op == "explainability":
        return _build_explainability_payload(ctx)

    if op == "insights":
        return _build_insights_payload(ctx)

    if op == "report":
        return _build_report_payload(df, ctx)

    raise ValueError(f"Opération inconnue : {op}")


def _get_step_output(ctx: dict[str, Any], step_key: str) -> Any:
    step = ctx.get("steps", {}).get(step_key, {})
    if not isinstance(step, dict) or step.get("status") != "success":
        return None
    return step.get("result")


def _collect_pipeline_insights(ctx: dict[str, Any]) -> list[dict[str, Any]]:
    insights: list[Any] = []

    sources = [
        ("descriptive", narrate_descriptive),
        ("correlations", narrate_correlations),
        ("vif", narrate_vif),
        ("model", narrate_modeling),
        ("timeseries", narrate_timeseries),
        ("timeseries_multivariate", narrate_multivariate_timeseries),
        ("pca", narrate_pca),
        ("ca", narrate_ca),
        ("mca", narrate_mca),
    ]

    for step_key, narrate in sources:
        payload = _get_step_output(ctx, step_key)
        if not payload:
            continue
        try:
            insights.extend(narrate(payload))
        except Exception:
            logger.exception("Failed to narrate step %s", step_key)

    return insights_to_dict(sort_insights(insights))


def _build_explainability_payload(ctx: dict[str, Any]) -> dict[str, Any]:
    model_res = _get_step_output(ctx, "model") or {}
    ranking = model_res.get("ranking") or []
    best = ranking[0] if ranking else {}
    feature_importance = best.get("feature_importance") or model_res.get("feature_importance") or []

    if not isinstance(feature_importance, list):
        feature_importance = []

    global_importance = []
    for item in feature_importance:
        feature = item.get("feature") or item.get("name")
        importance = item.get("importance") or item.get("mean_importance") or 0
        if feature is None:
            continue
        try:
            importance_value = round(float(importance), 6)
        except (TypeError, ValueError):
            continue
        global_importance.append({"feature": feature, "mean_shap": importance_value})

    global_importance.sort(key=lambda x: x["mean_shap"], reverse=True)
    waterfall_example = [
        {"feature": item["feature"], "shap_value": item["mean_shap"]}
        for item in global_importance[:20]
    ]

    return {
        "global_importance": global_importance,
        "waterfall_example": waterfall_example,
        "n_features": len(global_importance),
        "source": "feature_importance_proxy",
        "model_name": best.get("model_name") or best.get("model_key"),
    }


def _build_insights_payload(ctx: dict[str, Any]) -> dict[str, Any]:
    insights = _collect_pipeline_insights(ctx)
    summary = {"critical": 0, "warning": 0, "info": 0, "success": 0, "methodological": 0}
    for item in insights:
        sev = item.get("severity", "info")
        if sev in summary:
            summary[sev] += 1

    return {
        "insights": insights,
        "count": len(insights),
        "summary": summary,
    }


def _build_report_payload(df: pd.DataFrame, ctx: dict[str, Any]) -> dict[str, Any]:
    recipe: PipelineRecipe = ctx["recipe"]
    descriptive = _get_step_output(ctx, "descriptive") or {}
    model_results = _get_step_output(ctx, "model") or _get_step_output(ctx, "timeseries") or _get_step_output(ctx, "timeseries_multivariate") or {}
    insights = _collect_pipeline_insights(ctx)

    profile = {
        "n_rows": int(len(df)),
        "n_cols": int(df.shape[1]),
        "shape": {"rows": int(len(df)), "columns": int(df.shape[1])},
        "memory_usage_mb": round(float(df.memory_usage(deep=True).sum() / 1e6), 3),
        "numeric_cols": df.select_dtypes(include=["number"]).columns.tolist(),
        "categorical_cols": df.select_dtypes(include=["object", "category", "bool"]).columns.tolist(),
        "temporal_cols": [c for c in df.columns if pd.api.types.is_datetime64_any_dtype(df[c])],
        "dictionary": [],
    }

    report = build_report_payload(
        dataset_name=recipe.title,
        profile=profile,
        recipe=recipe.to_dict(),
        descriptive=descriptive if isinstance(descriptive, dict) else {},
        model_results=model_results if isinstance(model_results, dict) else {},
        insights=insights,
    )
    report.metadata = {
        **(report.metadata or {}),
        "source": "auto_pipeline",
        "pipeline_title": recipe.title,
        "steps": list(ctx.get("steps", {}).keys()),
    }

    return asdict(report)


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
