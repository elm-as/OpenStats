"""
Entraînement des modèles individuels (Linéaire, Arbres, Boosting, SVM, Polynomiale).
"""

from __future__ import annotations

import logging
from typing import Any
import numpy as np
import pandas as pd
from sklearn.model_selection import cross_val_score, GridSearchCV
from sklearn.linear_model import Ridge
from sklearn.preprocessing import PolynomialFeatures
from sklearn.pipeline import Pipeline

from app.core.modeling_registry import REGRESSION_MODELS, CLASSIFICATION_MODELS
from app.core.modeling_preparation import _build_preprocessor
from app.core.modeling_metrics import (
    _safe_cv_folds, _regression_metrics, _classification_metrics, _get_feature_importance
)
from app.core.modeling_summaries import (
    extract_regression_ols_summary,
    extract_logistic_summary,
    extract_tree_summary,
    extract_lda_summary,
)

logger = logging.getLogger(__name__)


def train_single_model(
    model_key: str,
    data: dict,
    cv_folds: int = 5,
    is_competitive: bool = False,
) -> dict:
    """Entraîne un modèle unique avec validation croisée et GridSearch."""
    task_type = data["task_type"]
    cv_folds = _safe_cv_folds(data["y_train"], cv_folds)

    registry = REGRESSION_MODELS if task_type == "regression" else CLASSIFICATION_MODELS

    if model_key not in registry:
        return {"error": f"Modèle inconnu : {model_key}"}

    model_info = registry[model_key]
    X_train, X_test = data["X_train"], data["X_test"]
    y_train, y_test = data["y_train"], data["y_test"]

    if model_key == "polynomial_regression":
        return _train_polynomial(data, cv_folds)

    X_train_fit, y_train_fit = X_train, y_train
    max_fit_samples = 5000 if model_key in ("svr", "svc") else 50000

    if len(X_train) > max_fit_samples:
        idx = np.random.choice(len(X_train), max_fit_samples, replace=False)
        X_train_fit = X_train.iloc[idx]
        y_train_fit = y_train.iloc[idx]

    model_cls = model_info["class"]
    param_grid = model_info["params"]
    needs_scaling = model_info.get("needs_scaling", False)

    label_encoder = None
    if task_type == "classification":
        from sklearn.preprocessing import LabelEncoder
        label_encoder = LabelEncoder()
        y_train_fit = pd.Series(label_encoder.fit_transform(y_train_fit), index=y_train_fit.index)

    preprocessor = _build_preprocessor(X_train_fit, needs_scaling)
    base_model = model_cls()
    pipe = Pipeline([("preprocessor", preprocessor), ("model", base_model)])

    pipe_params = {f"model__{k}": v for k, v in param_grid.items() if isinstance(v, list)}
    fixed_params = {f"model__{k}": v for k, v in param_grid.items() if not isinstance(v, list)}

    if fixed_params:
        pipe.set_params(**fixed_params)

    scoring = "r2" if task_type == "regression" else "f1_weighted"

    if pipe_params or any(isinstance(v, list) for v in param_grid.values()):
        grid = GridSearchCV(
            pipe, pipe_params, cv=cv_folds, scoring=scoring, n_jobs=1, error_score="raise"
        )
        grid.fit(X_train_fit, y_train_fit)
        model = grid.best_estimator_
        best_params = {k.replace("model__", ""): v for k, v in grid.best_params_.items()}
    else:
        pipe.fit(X_train_fit, y_train_fit)
        model = pipe
        best_params = {k: v[0] if isinstance(v, list) else v for k, v in param_grid.items()}

    if label_encoder is not None:
        y_pred = label_encoder.inverse_transform(model.predict(X_test))
    else:
        y_pred = model.predict(X_test)

    if task_type == "regression":
        metrics = _regression_metrics(y_test, y_pred)
    else:
        metrics = _classification_metrics(y_test, y_pred, model, X_test)

    try:
        cv_scores = cross_val_score(model, X_train_fit, y_train_fit, cv=cv_folds, scoring=scoring, n_jobs=1)
    except Exception:
        cv_scores = np.array([0.0])

    cv_rmse_val = None
    if task_type == "regression":
        try:
            cv_neg_mse = cross_val_score(model, X_train_fit, y_train_fit, cv=cv_folds, scoring="neg_mean_squared_error", n_jobs=1)
            cv_rmse_val = round(float(np.sqrt(np.maximum(0.0, -cv_neg_mse.mean()))), 4)
        except Exception:
            pass

    importance = _get_feature_importance(model, data["feature_names"])

    warnings = []
    if task_type == "regression" and model_key in ["linear_regression", "ridge", "lasso", "elasticnet"]:
        try:
            from app.core.analysis import compute_vif
            vif_results = compute_vif(X_train)
            high_vif = [v["variable"] for v in vif_results if v["vif"] > 10]
            if high_vif:
                warnings.append(f"Attention: Forte multicolinéarité détectée (VIF > 10) pour: {', '.join(high_vif)}. Les coefficients du modèle peuvent être instables.")
        except Exception:
            pass

        residuals = y_test - y_pred
        if len(residuals) >= 3:
            import scipy.stats as stats
            res_shapiro = residuals[:5000] if len(residuals) > 5000 else residuals
            stat, p_val = stats.shapiro(res_shapiro)
            if p_val < 0.05:
                warnings.append("Attention: Les résidus ne sont pas normalement distribués (Test de Shapiro-Wilk échoué). Utilisez un modèle non-linéaire (Random Forest) ou transformez la cible.")

        try:
            from statsmodels.stats.stattools import durbin_watson
            dw = durbin_watson(residuals)
            if dw < 1.5 or dw > 2.5:
                warnings.append(f"Attention: Autocorrélation potentielle détectée (Durbin-Watson = {dw:.2f}).")
        except ImportError:
            pass

    regression_summary = None
    model_summary: dict[str, Any] = {}

    if task_type == "regression" and model_key in ["linear_regression", "ridge", "lasso", "elasticnet"]:
        summary_ols, _ = extract_regression_ols_summary(model, X_train, y_train)
        if summary_ols:
            regression_summary = summary_ols
            model_summary = summary_ols

    elif task_type == "classification" and model_key == "logistic_regression":
        model_summary = extract_logistic_summary(
            model, X_train, y_train, label_encoder, data["feature_names"]
        )

    elif model_key in ["decision_tree", "random_forest", "gradient_boosting", "xgboost", "lightgbm"]:
        model_summary = extract_tree_summary(model, importance)

    elif model_key == "lda":
        model_summary = extract_lda_summary(model, importance)

    result = {
        "model_key": model_key,
        "model_name": model_info["name"],
        "task_type": task_type,
        "best_params": best_params,
        "metrics": metrics,
        "cv_scores": {
            "mean": round(float(cv_scores.mean()), 4),
            "std": round(float(cv_scores.std()), 4),
            "scores": [round(float(s), 4) for s in cv_scores],
            "rmse_mean": cv_rmse_val,
            "metric": "R²" if task_type == "regression" else "F1",
        },
        "feature_importance": importance,
        "model": model,
        "label_encoder": label_encoder,
        "warnings": warnings,
    }
    if regression_summary is not None:
        result["regression_summary"] = regression_summary
    if model_summary:
        result["model_summary"] = model_summary

    return result


def _train_polynomial(data: dict, cv_folds: int) -> dict:
    """Entraîne une régression polynomiale."""
    best_score = -np.inf
    best_rmse = None
    best_degree = 2
    best_model = None

    X_train, X_test = data["X_train"], data["X_test"]
    y_train, y_test = data["y_train"], data["y_test"]

    X_train_fit, y_train_fit = X_train, y_train
    if len(X_train) > 10000:
        idx = np.random.choice(len(X_train), 10000, replace=False)
        X_train_fit = X_train.iloc[idx]
        y_train_fit = y_train.iloc[idx]

    n_features = X_train_fit.shape[1]
    degrees = [2] if n_features > 10 else [2, 3]

    preprocessor = _build_preprocessor(X_train_fit, needs_scaling=True)

    for degree in degrees:
        pipe = Pipeline([
            ("preprocessor", preprocessor),
            ("poly", PolynomialFeatures(degree=degree, include_bias=False)),
            ("reg", Ridge(alpha=1.0)),
        ])
        try:
            cv_scores = cross_val_score(pipe, X_train_fit, y_train_fit, cv=cv_folds, scoring="r2", n_jobs=1)
            cv_mse = cross_val_score(pipe, X_train_fit, y_train_fit, cv=cv_folds, scoring="neg_mean_squared_error", n_jobs=1)
            if cv_scores.mean() > best_score:
                best_score = cv_scores.mean()
                best_rmse = round(float(np.sqrt(np.maximum(0.0, -cv_mse.mean()))), 4)
                best_degree = degree
                pipe.fit(X_train_fit, y_train_fit)
                best_model = pipe
        except Exception:
            continue

    if best_model is None:
        return {"error": "Impossible d'entraîner la régression polynomiale"}

    y_pred = best_model.predict(X_test)
    metrics = _regression_metrics(y_test, y_pred)

    return {
        "model_key": "polynomial_regression",
        "model_name": f"Régression Polynomiale (degré {best_degree})",
        "task_type": "regression",
        "best_params": {"degree": best_degree},
        "metrics": metrics,
        "cv_scores": {
            "mean": round(float(best_score), 4),
            "std": 0.0,
            "scores": [round(float(best_score), 4)],
            "rmse_mean": best_rmse,
            "metric": "R²",
        },
        "feature_importance": [],
        "model": best_model,
    }
