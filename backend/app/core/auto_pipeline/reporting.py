"""
Génération des synthèses d'insights, explicabilité et rapports de pipeline.
"""

from __future__ import annotations

import logging
from dataclasses import asdict
from typing import Any

import pandas as pd

from app.core.auto_pipeline.recipe import PipelineRecipe
from app.core.interpretation.base import sort_insights, insights_to_dict
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
)
from app.core.professional_report import build_report_payload


logger = logging.getLogger(__name__)


def _get_step_output(ctx: dict[str, Any], step_key: str) -> Any:
    step_info = ctx.get("steps", {}).get(step_key)
    if not step_info or not isinstance(step_info, dict):
        return None
    return step_info.get("output")


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
