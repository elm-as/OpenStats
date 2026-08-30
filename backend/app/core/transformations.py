"""
Module de transformations de données guidées par les résultats statistiques (Façade publique).
Découpé en sous-modules pour respecter la limite de 350 lignes :
- transformations_catalog : catalogue exhaustif des opérations
- transformations_apply : application unitaire et vectorisée
- transformations_recommend : détection des défauts de distribution et recommandations
"""

from __future__ import annotations

from app.core.transformations_catalog import (
    TRANSFORM_CATALOG,
    get_transform_catalog,
)
from app.core.transformations_apply import (
    apply_transform,
    apply_transforms_to_df,
    _safe_float,
)
from app.core.transformations_recommend import (
    recommend_transforms,
)

__all__ = [
    "TRANSFORM_CATALOG",
    "get_transform_catalog",
    "apply_transform",
    "apply_transforms_to_df",
    "recommend_transforms",
    "_safe_float",
]
