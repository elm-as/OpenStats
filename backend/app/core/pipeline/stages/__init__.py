"""
Package app.core.pipeline.stages.

Découpage modulaire du pipeline méthodologique d'analyse :
- stage_base : Types de base (StageResult), helpers de formatage (_chart, _safe) et contexte de session
- stage_exploration : Étapes 1 à 4 (problème, compréhension, qualité, univariée)
- stage_diagnostics : Étapes 5 à 8 (bivariée, diagnostics, correction / remédiation)
- stage_modeling : Étape 9 (modélisation supervisée et temporelle)
- stage_evaluation : Étapes 10 et 11 (validation et interprétation)
- stage_runner : Orchestrateur de déroulement continu (run_pipeline)
"""

from __future__ import annotations

from app.core.pipeline.stages.stage_base import (
    MAX_CHART_CATEGORIES,
    MAX_SCATTER_POINTS,
    StageResult,
    _categorical_columns,
    _chart,
    _kinds,
    _numeric_columns,
    _safe,
    _temporal_columns,
    get_current_schema,
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
from app.core.pipeline.stages.stage_runner import (
    run_pipeline,
)

__all__ = [
    "MAX_CHART_CATEGORIES",
    "MAX_SCATTER_POINTS",
    "StageResult",
    "_categorical_columns",
    "_chart",
    "_kinds",
    "_numeric_columns",
    "_safe",
    "_temporal_columns",
    "get_current_schema",
    "run_pipeline",
    "set_current_schema",
    "stage_bivariate",
    "stage_correction",
    "stage_diagnostics",
    "stage_interpretation",
    "stage_modeling",
    "stage_problem",
    "stage_quality",
    "stage_understand",
    "stage_univariate",
    "stage_validation",
]
