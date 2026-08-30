"""
Métriques d'évaluation et importance des variables pour la modélisation.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline
from sklearn.metrics import (
    mean_squared_error, mean_absolute_error, r2_score, mean_absolute_percentage_error,
    accuracy_score, precision_score, recall_score, f1_score, roc_auc_score,
    confusion_matrix, classification_report,
)


def _safe_cv_folds(y_train, cv_folds: int) -> int:
    """Réduit le nombre de folds si le dataset est trop petit."""
    n_samples = len(y_train)
    try:
        min_class_count = pd.Series(y_train).value_counts().min()
        max_folds = min(n_samples, min_class_count)
    except Exception:
        max_folds = n_samples
    max_folds = min(max_folds, n_samples // 2)
    return max(2, min(cv_folds, max_folds))


def _regression_metrics(y_true, y_pred) -> dict:
    """Calcule les métriques de régression."""
    return {
        "rmse": round(float(np.sqrt(mean_squared_error(y_true, y_pred))), 6),
        "mae": round(float(mean_absolute_error(y_true, y_pred)), 6),
        "r2": round(float(r2_score(y_true, y_pred)), 6),
        "mape": round(float(mean_absolute_percentage_error(y_true, y_pred) * 100), 2),
    }


def _classification_metrics(y_true, y_pred, model, X_test) -> dict:
    """Calcule les métriques de classification."""
    n_classes = len(np.unique(y_true))
    metrics = {
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 6),
        "precision_weighted": round(float(precision_score(y_true, y_pred, average="weighted", zero_division=0)), 6),
        "recall_weighted": round(float(recall_score(y_true, y_pred, average="weighted", zero_division=0)), 6),
        "f1_weighted": round(float(f1_score(y_true, y_pred, average="weighted", zero_division=0)), 6),
    }

    if hasattr(model, "predict_proba"):
        try:
            y_proba = model.predict_proba(X_test)
            if n_classes == 2:
                metrics["auc_roc"] = round(float(roc_auc_score(y_true, y_proba[:, 1])), 6)
            else:
                metrics["auc_roc"] = round(float(roc_auc_score(y_true, y_proba, multi_class="ovr", average="weighted")), 6)
        except Exception:
            pass

    cm = confusion_matrix(y_true, y_pred)
    metrics["confusion_matrix"] = cm.tolist()
    metrics["classification_report"] = classification_report(y_true, y_pred, output_dict=True, zero_division=0)
    return metrics


def _get_feature_importance(model, feature_names: list[str]) -> list[dict]:
    """Extrait l'importance des features du modèle."""
    inner = model
    actual_feature_names = feature_names

    if isinstance(model, Pipeline):
        inner = model.named_steps.get("model", model[-1])
        if "preprocessor" in model.named_steps:
            try:
                actual_feature_names = model.named_steps["preprocessor"].get_feature_names_out()
                actual_feature_names = [name.split("__")[-1] for name in actual_feature_names]
            except Exception:
                pass

    importance = None
    if hasattr(inner, "feature_importances_"):
        importance = inner.feature_importances_
    elif hasattr(inner, "coef_"):
        coef = inner.coef_
        if coef.ndim > 1:
            importance = np.abs(coef).mean(axis=0)
        else:
            importance = np.abs(coef)

    if importance is None or len(importance) != len(actual_feature_names):
        return []

    result = [
        {"feature": name, "importance": round(float(imp), 6)}
        for name, imp in zip(actual_feature_names, importance)
    ]
    return sorted(result, key=lambda x: x["importance"], reverse=True)
