"""
Catalogue exhaustif des transformations mathématiques et statistiques.
"""

from __future__ import annotations

from typing import Any

TRANSFORM_CATALOG: dict[str, dict[str, Any]] = {
    "log": {
        "label": "Transformation logarithmique (log₁₀)",
        "description": "Réduit l'asymétrie positive et stabilise la variance. Nécessite des valeurs strictement positives.",
        "applies_to": "numeric",
        "fixes": ["skewness_positive", "heteroscedasticity", "non_stationary_variance"],
    },
    "log1p": {
        "label": "Transformation log(1+x)",
        "description": "Comme log mais accepte les zéros. Utile pour les données de comptage.",
        "applies_to": "numeric",
        "fixes": ["skewness_positive", "heteroscedasticity"],
    },
    "sqrt": {
        "label": "Racine carrée",
        "description": "Réduit l'asymétrie positive de façon plus modérée que le log.",
        "applies_to": "numeric",
        "fixes": ["skewness_moderate", "heteroscedasticity"],
    },
    "reciprocal": {
        "label": "Inverse (1/x)",
        "description": "Transformation forte, inverse les valeurs. Nécessite des valeurs non nulles.",
        "applies_to": "numeric",
        "fixes": ["skewness_positive_extreme"],
    },
    "square": {
        "label": "Carré (x²)",
        "description": "Corrige l'asymétrie négative.",
        "applies_to": "numeric",
        "fixes": ["skewness_negative"],
    },
    "boxcox": {
        "label": "Box-Cox",
        "description": "Trouve automatiquement la meilleure puissance pour normaliser. Nécessite des valeurs strictement positives.",
        "applies_to": "numeric",
        "fixes": ["skewness_positive", "skewness_negative", "non_normal"],
    },
    "yeo_johnson": {
        "label": "Yeo-Johnson",
        "description": "Comme Box-Cox mais accepte les valeurs négatives et nulles.",
        "applies_to": "numeric",
        "fixes": ["skewness_positive", "skewness_negative", "non_normal"],
    },
    "standardize": {
        "label": "Standardisation (Z-score)",
        "description": "Centre (μ=0) et réduit (σ=1). Préserve la forme de la distribution.",
        "applies_to": "numeric",
        "fixes": ["scale_difference", "multicollinearity_scale"],
    },
    "minmax": {
        "label": "Normalisation Min-Max [0, 1]",
        "description": "Met à l'échelle entre 0 et 1. Sensible aux outliers.",
        "applies_to": "numeric",
        "fixes": ["scale_difference"],
    },
    "robust_scale": {
        "label": "Mise à l'échelle robuste (médiane / IQR)",
        "description": "Utilise la médiane et l'IQR au lieu de la moyenne et l'écart-type. Résistant aux outliers.",
        "applies_to": "numeric",
        "fixes": ["scale_difference", "outliers"],
    },
    "diff": {
        "label": "Différenciation (Δ = xₜ − xₜ₋₁)",
        "description": "Élimine la tendance d'une série temporelle. Rend la série stationnaire.",
        "applies_to": "numeric",
        "fixes": ["non_stationary", "trend"],
    },
    "diff2": {
        "label": "Différenciation d'ordre 2",
        "description": "Double différenciation pour les tendances quadratiques.",
        "applies_to": "numeric",
        "fixes": ["non_stationary_strong"],
    },
    "seasonal_diff": {
        "label": "Différenciation saisonnière (Δₛ = xₜ − xₜ₋ₛ)",
        "description": "Supprime la composante saisonnière. La période est détectée automatiquement.",
        "applies_to": "numeric",
        "fixes": ["seasonality"],
    },
    "detrend": {
        "label": "Suppression de tendance linéaire",
        "description": "Ajuste une droite de régression et soustrait la tendance.",
        "applies_to": "numeric",
        "fixes": ["trend", "non_stationary"],
    },
    "winsorize": {
        "label": "Winsorisation (1er–99e percentile)",
        "description": "Remplace les valeurs extrêmes par les percentiles limites.",
        "applies_to": "numeric",
        "fixes": ["outliers"],
    },
    "rank": {
        "label": "Transformation en rangs",
        "description": "Remplace les valeurs par leur rang. Élimine l'effet des outliers et rend la distribution uniforme.",
        "applies_to": "numeric",
        "fixes": ["outliers", "non_normal", "skewness_positive", "skewness_negative"],
    },
}


def get_transform_catalog() -> list[dict[str, Any]]:
    """Retourne la liste des transformations disponibles pour le frontend."""
    return [{"key": k, **v} for k, v in TRANSFORM_CATALOG.items()]
