"""
Pipeline intelligent automatique.

Détecte les caractéristiques d'un dataset et propose un pipeline d'analyse adapté.
"""

from app.core.auto_pipeline.detector import (
    detect_dataset_profile,
    DatasetProfile,
)
from app.core.auto_pipeline.recipe import (
    build_recipe,
    PipelineRecipe,
    PipelineStep,
)
from app.core.auto_pipeline.executor import execute_recipe

__all__ = [
    "detect_dataset_profile",
    "DatasetProfile",
    "build_recipe",
    "PipelineRecipe",
    "PipelineStep",
    "execute_recipe",
]
