"""
Module de modélisation (Façade publique) : régression, classification, entraînement compétitif.
Découpé en sous-modules pour respecter la limite stricte de 350 lignes par fichier :
- modeling_registry : définitions des algorithmes et hyperparamètres
- modeling_preparation : détection de tâche, split train/test et prétraitement
- modeling_metrics : métriques d'évaluation et importance des variables
- modeling_summaries : extraction des résumés statistiques (OLS, Logit, arbres)
- modeling_trainers : entraînement individuel et polynomial
- modeling_competitive : tournoi multi-algorithmes
"""

from __future__ import annotations

from app.core.modeling_registry import (
    REGRESSION_MODELS,
    CLASSIFICATION_MODELS,
    HAS_XGBOOST,
    HAS_LIGHTGBM,
)
from app.core.modeling_preparation import (
    detect_task_type,
    prepare_data,
    _build_preprocessor,
    _sanitize_dataframe,
    _choose_temporal_column,
    _parse_temporal_for_split,
)
from app.core.modeling_metrics import (
    _safe_cv_folds,
    _regression_metrics,
    _classification_metrics,
    _get_feature_importance,
)
from app.core.modeling_trainers import (
    train_single_model,
    _train_polynomial,
)
from app.core.modeling_competitive import train_competitive

__all__ = [
    "REGRESSION_MODELS",
    "CLASSIFICATION_MODELS",
    "HAS_XGBOOST",
    "HAS_LIGHTGBM",
    "detect_task_type",
    "prepare_data",
    "_build_preprocessor",
    "_sanitize_dataframe",
    "_choose_temporal_column",
    "_parse_temporal_for_split",
    "_safe_cv_folds",
    "_regression_metrics",
    "_classification_metrics",
    "_get_feature_importance",
    "train_single_model",
    "_train_polynomial",
    "train_competitive",
]
