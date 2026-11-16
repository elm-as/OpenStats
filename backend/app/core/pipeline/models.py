"""
Catalogue de modeles, recommandations et comparaison.

Façade réexportant les spécifications, le catalogue et le comparateur
pour préserver les signatures publiques et contrats existants.
"""

from __future__ import annotations

from app.core.pipeline.models_comparison import (
    compare_models,
    fit_best,
)
from app.core.pipeline.models_spec import (
    CATALOG,
    CATALOG_BY_KEY,
    TEMPORAL_MODELS,
    ModelSpec,
    recommend,
)

__all__ = [
    "ModelSpec",
    "CATALOG",
    "CATALOG_BY_KEY",
    "TEMPORAL_MODELS",
    "recommend",
    "compare_models",
    "fit_best",
]
