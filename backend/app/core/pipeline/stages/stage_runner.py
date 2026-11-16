"""
Orchestrateur principal du pipeline methodologique d'analyse.

Deroule la methodologie complete, de la comprehension du probleme a l'interpretation,
avec la boucle correction/re-diagnostic entre les etapes 7 et 8.
"""

from __future__ import annotations

import time
from typing import Any, Iterator

import pandas as pd

from app.core.pipeline.schema import (
    analysable_columns,
    apply_schema,
    normalize_declared,
    sort_by_time,
)
from app.core.pipeline.stages.stage_base import (
    StageResult,
    set_current_schema,
)
from app.core.pipeline.stages.stage_diagnostics import (
    stage_bivariate,
    stage_correction,
    stage_diagnostics,
)
from app.core.pipeline.stages.stage_evaluation import (
    stage_interpretation,
    stage_validation,
)
from app.core.pipeline.stages.stage_exploration import (
    stage_problem,
    stage_quality,
    stage_understand,
    stage_univariate,
)
from app.core.pipeline.stages.stage_modeling import (
    stage_modeling,
)


def run_pipeline(
    df: pd.DataFrame,
    target: str | None = None,
    task_hint: str | None = None,
    max_iterations: int = 5,
    allow_aggressive: bool = True,
    type_overrides: dict[str, Any] | None = None,
    stored_profile: dict[str, Any] | None = None,
) -> Iterator[dict[str, Any]]:
    """Déroule la méthodologie et émet un événement par étape."""
    started = time.time()
    stages: dict[str, StageResult] = {}

    declared = normalize_declared(type_overrides, stored_profile)
    working, schema = apply_schema(df, declared)
    set_current_schema(schema)
    working = sort_by_time(working, schema)
    # Les identifiants ne participent a aucune analyse.
    working = working[analysable_columns(working, schema)]

    def emit(result: StageResult, t0: float) -> dict[str, Any]:
        result.duration_ms = int((time.time() - t0) * 1000)
        stages[result.key] = result
        return {"type": "stage", "stage": result.to_dict()}

    yield {
        "type": "start",
        "total_stages": 11,
        "rows": len(working),
        "columns": working.shape[1],
        "schema": schema.to_dict(),
    }

    if schema.coerced or schema.failures:
        notes = []
        if schema.coerced:
            notes.append(
                "Colonnes converties selon le type déclaré : "
                + ", ".join(schema.coerced)
                + "."
            )
        if schema.failures:
            notes.append(
                "Type déclaré inapplicable (contenu incompatible) : "
                + ", ".join(schema.failures)
                + "."
            )
        yield {"type": "schema", "notes": notes, "schema": schema.to_dict()}

    t0 = time.time()
    problem = stage_problem(working, target, task_hint)
    yield emit(problem, t0)

    is_timeseries = bool(problem.data.get("is_timeseries"))
    problem_type = problem.data.get("problem_type", "exploration")

    t0 = time.time()
    yield emit(stage_understand(working), t0)

    t0 = time.time()
    yield emit(stage_quality(working, target, is_timeseries), t0)

    t0 = time.time()
    yield emit(stage_univariate(working), t0)

    t0 = time.time()
    yield emit(stage_bivariate(working, target), t0)

    t0 = time.time()
    yield emit(stage_diagnostics(working, target, is_timeseries), t0)

    t0 = time.time()
    correction, working = stage_correction(
        working, target, is_timeseries, max_iterations, allow_aggressive
    )
    yield emit(correction, t0)

    # Les étapes univariée et bivariée sont rejouées sur les données corrigées :
    # c'est ce qui rend l'effet des transformations visible.
    t0 = time.time()
    after = stage_univariate(working)
    after.key, after.index, after.title = (
        "univariate_after",
        8,
        "Analyse univariée (après correction)",
    )
    after.headline = "Distributions après application des transformations retenues."
    yield emit(after, t0)

    t0 = time.time()
    modeling = stage_modeling(
        working, target, problem_type, correction.data.get("modeling_flags", [])
    )
    yield emit(modeling, t0)

    t0 = time.time()
    yield emit(stage_validation(modeling, correction), t0)

    t0 = time.time()
    yield emit(stage_interpretation(stages, target), t0)

    yield {
        "type": "complete",
        "elapsed_sec": round(time.time() - started, 2),
        "problem_type": problem_type,
        "target": target,
        "shape_before": {"rows": len(df), "columns": df.shape[1]},
        "shape_after": {"rows": len(working), "columns": working.shape[1]},
        "stages": [stages[k].to_dict() for k in stages],
    }
