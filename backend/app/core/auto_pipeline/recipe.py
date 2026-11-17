"""Recipe builder : génère un pipeline d'analyse adapté au profil du dataset.

Chaque étape décrit l'opération à réaliser, ses paramètres et son rationale métier.
"""

from __future__ import annotations

from typing import Any

from app.core.auto_pipeline.detector import DatasetProfile
from app.core.auto_pipeline.pipeline_schema import PipelineRecipe, PipelineStep
from app.core.auto_pipeline.recipe_labels import titre_et_description
from app.core.auto_pipeline.recipe_steps import (
    RecipeBuildContext,
    add_model_and_output_steps,
    add_prep_steps,
    add_temporal_and_panel_steps,
)


def _build_custom_recipe(
    profile: DatasetProfile,
    custom_steps: list[dict[str, Any] | PipelineStep],
    **meta: Any,
) -> PipelineRecipe:
    parsed_steps = [
        s
        if isinstance(s, PipelineStep)
        else PipelineStep(
            key=s.get("key", "step"),
            operation=s.get("operation", "generic"),
            label=s.get("label", "Étape"),
            rationale=s.get("rationale", ""),
            params=s.get("params", {}),
            optional=bool(s.get("optional", False)),
        )
        for s in custom_steps
    ]
    return PipelineRecipe(
        title=f"Pipeline Personnalisé ({len(parsed_steps)} étapes)",
        description="Pipeline personnalisé configuré par l'utilisateur.",
        problem_type=meta.get("task_type") or profile.problem_type,
        target=meta.get("target") or profile.suggested_target,
        steps=parsed_steps,
        estimated_duration_sec=len(parsed_steps) * 3,
        confidence="high",
    )


def _resolve_problem(
    profile: DatasetProfile,
    effective_target: str | None,
    task_type: str | None,
) -> str:
    target_type = profile.column_types.get(effective_target, "numeric") if effective_target else None
    if task_type and task_type != "auto":
        if "classif" in str(task_type).lower():
            return "binary_classification" if target_type == "binary" else "multiclass_classification"
        return task_type
    if profile.has_temporal and effective_target and target_type in ("numeric", "discrete", "continu"):
        return "forecast"
    if effective_target and target_type in ("categorical", "binary"):
        return "binary_classification" if target_type == "binary" else "multiclass_classification"
    if effective_target and target_type in ("numeric", "discrete", "continu"):
        return "regression"
    return profile.problem_type or "exploration"


def build_recipe(profile: DatasetProfile, df: Any | None = None, **options: Any) -> PipelineRecipe:
    """Construit un pipeline personnalisé et adapté au profil du dataset et aux choix de l'utilisateur."""
    custom_steps = options.get("custom_steps")
    target = options.get("target")
    task_type = options.get("task_type")
    selected_analyses = options.get("selected_analyses")

    if custom_steps:
        return _build_custom_recipe(profile, custom_steps, target=target, task_type=task_type)

    effective_target = target or profile.suggested_target
    problem = _resolve_problem(profile, effective_target, task_type)
    ctx = RecipeBuildContext(
        profile=profile,
        effective_target=effective_target,
        problem=problem,
        selected_analyses=set(selected_analyses) if selected_analyses is not None else None,
        df=df,
    )
    add_prep_steps(ctx)
    add_temporal_and_panel_steps(ctx)
    add_model_and_output_steps(ctx)

    title, desc = titre_et_description(profile, problem, effective_target)
    return PipelineRecipe(
        title=title,
        description=desc,
        problem_type=problem,
        target=effective_target,
        steps=ctx.steps,
        estimated_duration_sec=ctx.duration,
        confidence="high",
        warnings=ctx.warnings,
    )
