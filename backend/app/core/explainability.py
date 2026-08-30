"""
Module d'explicabilité : SHAP et analyse des features.
Phase 10 de la spécification.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from typing import Any


def compute_shap_values(model, X: pd.DataFrame, max_samples: int = 100) -> dict:
    """
    Calcule les valeurs SHAP pour un modèle (y compris Pipeline scikit-learn).
    """
    import shap

    if len(X) == 0:
        return {"error": "DataFrame vide pour SHAP"}

    # Limiter le nombre d'échantillons pour la performance (particulièrement critique sur Windows/Render)
    if len(X) > max_samples:
        X_sample = X.sample(max_samples, random_state=42)
    else:
        X_sample = X

    # Dépaqueter un Pipeline scikit-learn le cas échéant
    estimator = model
    X_transformed = X_sample
    if hasattr(model, "named_steps"):
        preproc = model.named_steps.get("preprocessor")
        estimator = model.named_steps.get("model", model)
        if preproc:
            try:
                X_trans = preproc.transform(X_sample)
                if hasattr(preproc, "get_feature_names_out"):
                    feature_names = preproc.get_feature_names_out()
                else:
                    feature_names = [f"f_{i}" for i in range(X_trans.shape[1])]
                X_transformed = pd.DataFrame(X_trans, columns=feature_names, index=X_sample.index)
            except Exception:
                X_transformed = X_sample

    model_type = type(estimator).__name__

    try:
        if "Forest" in model_type or "Boosting" in model_type or "Tree" in model_type or "XGB" in model_type or "LGBM" in model_type:
            explainer = shap.TreeExplainer(estimator)
            shap_values = explainer.shap_values(X_transformed)
        elif hasattr(estimator, "coef_"):
            explainer = shap.LinearExplainer(estimator, X_transformed)
            shap_values = explainer.shap_values(X_transformed)
        else:
            bg_size = min(30, len(X_transformed))
            background = shap.sample(X_transformed, bg_size)
            explainer = shap.KernelExplainer(getattr(estimator, "predict_proba", estimator.predict), background)
            shap_values = explainer.shap_values(X_transformed)
    except Exception:
        bg_size = min(20, len(X_transformed))
        background = shap.sample(X_transformed, bg_size)
        explainer = shap.KernelExplainer(getattr(estimator, "predict_proba", estimator.predict), background)
        shap_values = explainer.shap_values(X_transformed)

    # Si multiclasse, prendre la moyenne des valeurs absolues
    if isinstance(shap_values, list):
        shap_abs = np.abs(np.array(shap_values)).mean(axis=0)
    else:
        shap_abs = np.abs(shap_values)

    # Importance globale SHAP
    global_importance = shap_abs.mean(axis=0)
    feature_names = [str(f).split("__")[-1] for f in X_transformed.columns.tolist()]

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

    result = permutation_importance(model, X, y, n_repeats=n_repeats, random_state=42, n_jobs=1)
    importance = [
        {
            "feature": col,
            "importance_mean": round(float(result.importances_mean[i]), 6),
            "importance_std": round(float(result.importances_std[i]), 6),
        }
        for i, col in enumerate(X.columns)
    ]
    return sorted(importance, key=lambda x: x["importance_mean"], reverse=True)
