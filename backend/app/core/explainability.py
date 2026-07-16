"""
Module d'explicabilité : SHAP et analyse des features.
Phase 10 de la spécification.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from typing import Any


def compute_shap_values(model, X: pd.DataFrame, max_samples: int = 500) -> dict:
    """
    Calcule les valeurs SHAP pour un modèle.
    Retourne les valeurs SHAP globales et les données pour les visualisations.
    """
    import shap

    # Limiter le nombre d'échantillons pour la performance
    if len(X) > max_samples:
        X_sample = X.sample(max_samples, random_state=42)
    else:
        X_sample = X

    # Choisir l'explainer adapté
    model_type = type(model).__name__

    try:
        if hasattr(model, "predict_proba") or "Forest" in model_type or "Boosting" in model_type or "XGB" in model_type or "LGBM" in model_type:
            explainer = shap.TreeExplainer(model)
        else:
            background = shap.sample(X_sample, min(100, len(X_sample)))
            explainer = shap.KernelExplainer(model.predict, background)

        shap_values = explainer.shap_values(X_sample)
    except Exception:
        # Fallback : Kernel explainer
        background = shap.sample(X_sample, min(50, len(X_sample)))
        explainer = shap.KernelExplainer(model.predict, background)
        shap_values = explainer.shap_values(X_sample)

    # Si multiclasse, prendre la moyenne des valeurs absolues
    if isinstance(shap_values, list):
        shap_abs = np.abs(np.array(shap_values)).mean(axis=0)
    else:
        shap_abs = np.abs(shap_values)

    # Importance globale SHAP
    global_importance = shap_abs.mean(axis=0)
    feature_names = X_sample.columns.tolist()

    importance_ranking = [
        {"feature": name, "mean_shap": round(float(imp), 6)}
        for name, imp in zip(feature_names, global_importance)
    ]
    importance_ranking.sort(key=lambda x: x["mean_shap"], reverse=True)

    # Données pour un waterfall plot (première observation)
    if isinstance(shap_values, list):
        single_shap = shap_values[0][0] if len(shap_values) > 0 else shap_values[0]
    else:
        single_shap = shap_values[0]

    waterfall_data = [
        {"feature": name, "shap_value": round(float(val), 6)}
        for name, val in zip(feature_names, single_shap)
    ]

    return {
        "global_importance": importance_ranking,
        "waterfall_example": sorted(waterfall_data, key=lambda x: abs(x["shap_value"]), reverse=True),
        "n_samples_used": len(X_sample),
        "n_features": len(feature_names),
    }


def compute_feature_importance_permutation(model, X: pd.DataFrame, y: pd.Series, n_repeats: int = 10) -> list[dict]:
    """Importance par permutation (model-agnostic)."""
    from sklearn.inspection import permutation_importance

    result = permutation_importance(model, X, y, n_repeats=n_repeats, random_state=42, n_jobs=-1)
    importance = [
        {
            "feature": col,
            "importance_mean": round(float(result.importances_mean[i]), 6),
            "importance_std": round(float(result.importances_std[i]), 6),
        }
        for i, col in enumerate(X.columns)
    ]
    return sorted(importance, key=lambda x: x["importance_mean"], reverse=True)
