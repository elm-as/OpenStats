"""
Module de modélisation : régression, classification, entraînement compétitif multi-algorithmes.
Phases 4-6 de la spécification.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from typing import Any
from sklearn.model_selection import cross_val_score, GridSearchCV, train_test_split
from sklearn.linear_model import (
    LinearRegression, Ridge, Lasso, ElasticNet,
    LogisticRegression,
)
from sklearn.ensemble import (
    RandomForestClassifier, RandomForestRegressor,
    GradientBoostingClassifier, GradientBoostingRegressor,
    AdaBoostClassifier, AdaBoostRegressor,
)
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.svm import SVC, SVR
from sklearn.discriminant_analysis import LinearDiscriminantAnalysis, QuadraticDiscriminantAnalysis
from sklearn.preprocessing import PolynomialFeatures, StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.metrics import (
    mean_squared_error, mean_absolute_error, r2_score, mean_absolute_percentage_error,
    accuracy_score, precision_score, recall_score, f1_score, roc_auc_score,
    confusion_matrix, classification_report,
)

try:
    from xgboost import XGBClassifier, XGBRegressor
    HAS_XGBOOST = True
except ImportError:
    HAS_XGBOOST = False

try:
    from lightgbm import LGBMClassifier, LGBMRegressor
    HAS_LIGHTGBM = True
except ImportError:
    HAS_LIGHTGBM = False


# ── Registres d'algorithmes ───────────────────────────────────────────

REGRESSION_MODELS = {
    "linear_regression": {
        "class": LinearRegression,
        "params": {},
        "name": "Régression Linéaire",
        "needs_scaling": True,
    },
    "ridge": {
        "class": Ridge,
        "params": {"alpha": [0.01, 0.1, 1.0, 10.0]},
        "name": "Ridge (L2)",
        "needs_scaling": True,
    },
    "lasso": {
        "class": Lasso,
        "params": {"alpha": [0.01, 0.1, 1.0, 10.0], "max_iter": [5000]},
        "name": "Lasso (L1)",
        "needs_scaling": True,
    },
    "elasticnet": {
        "class": ElasticNet,
        "params": {"alpha": [0.01, 0.1, 1.0], "l1_ratio": [0.2, 0.5, 0.8], "max_iter": [5000]},
        "name": "ElasticNet",
        "needs_scaling": True,
    },
    "polynomial_regression": {
        "class": None,  # Handled specially
        "params": {"degree": [2, 3]},
        "name": "Régression Polynomiale",
    },
    "decision_tree": {
        "class": DecisionTreeRegressor,
        "params": {"max_depth": [3, 5, 10, None], "min_samples_split": [2, 5, 10]},
        "name": "Arbre de Décision",
    },
    "random_forest": {
        "class": RandomForestRegressor,
        "params": {"n_estimators": [100], "max_depth": [5, 10, None], "min_samples_split": [2, 5]},
        "name": "Random Forest",
    },
    "gradient_boosting": {
        "class": GradientBoostingRegressor,
        "params": {"n_estimators": [100], "learning_rate": [0.05, 0.1], "max_depth": [3, 5]},
        "name": "Gradient Boosting",
    },
    "knn": {
        "class": KNeighborsRegressor,
        "params": {"n_neighbors": [3, 5, 7, 11]},
        "name": "K-Plus Proches Voisins",
        "needs_scaling": True,
    },
    "svr": {
        "class": SVR,
        "params": {"C": [0.1, 1.0, 10.0], "kernel": ["rbf"]},
        "name": "SVM (Régression)",
        "needs_scaling": True,
    },
}

CLASSIFICATION_MODELS = {
    "logistic_regression": {
        "class": LogisticRegression,
        "params": {"C": [0.01, 0.1, 1.0, 10.0], "max_iter": [1000]},
        "name": "Régression Logistique",
        "needs_scaling": True,
    },
    "decision_tree": {
        "class": DecisionTreeClassifier,
        "params": {"max_depth": [3, 5, 10, None], "min_samples_split": [2, 5, 10]},
        "name": "Arbre de Décision",
    },
    "random_forest": {
        "class": RandomForestClassifier,
        "params": {"n_estimators": [100], "max_depth": [5, 10, None], "min_samples_split": [2, 5]},
        "name": "Random Forest",
    },
    "gradient_boosting": {
        "class": GradientBoostingClassifier,
        "params": {"n_estimators": [100], "learning_rate": [0.05, 0.1], "max_depth": [3, 5]},
        "name": "Gradient Boosting",
    },
    "knn": {
        "class": KNeighborsClassifier,
        "params": {"n_neighbors": [3, 5, 7, 11, 21]},
        "name": "K-Plus Proches Voisins",
        "needs_scaling": True,
    },
    "svm": {
        "class": SVC,
        "params": {"C": [0.1, 1.0, 10.0], "kernel": ["rbf"], "probability": [True]},
        "name": "SVM",
        "needs_scaling": True,
    },
    "lda": {
        "class": LinearDiscriminantAnalysis,
        "params": {},
        "name": "Analyse Discriminante Linéaire",
    },
    "qda": {
        "class": QuadraticDiscriminantAnalysis,
        "params": {},
        "name": "Analyse Discriminante Quadratique",
    },
    "adaboost": {
        "class": AdaBoostClassifier,
        "params": {"n_estimators": [50, 100], "learning_rate": [0.1, 1.0]},
        "name": "AdaBoost",
    },
}

# Ajouter XGBoost/LightGBM si disponibles
if HAS_XGBOOST:
    REGRESSION_MODELS["xgboost"] = {
        "class": XGBRegressor,
        "params": {"n_estimators": [100], "learning_rate": [0.05, 0.1], "max_depth": [3, 5]},
        "name": "XGBoost",
    }
    CLASSIFICATION_MODELS["xgboost"] = {
        "class": XGBClassifier,
        "params": {"n_estimators": [100], "learning_rate": [0.05, 0.1], "max_depth": [3, 5], "use_label_encoder": [False], "eval_metric": ["logloss"]},
        "name": "XGBoost",
    }

if HAS_LIGHTGBM:
    REGRESSION_MODELS["lightgbm"] = {
        "class": LGBMRegressor,
        "params": {"n_estimators": [100], "learning_rate": [0.05, 0.1], "num_leaves": [31]},
        "name": "LightGBM",
    }
    CLASSIFICATION_MODELS["lightgbm"] = {
        "class": LGBMClassifier,
        "params": {"n_estimators": [100], "learning_rate": [0.05, 0.1], "num_leaves": [31]},
        "name": "LightGBM",
    }


def detect_task_type(y: pd.Series) -> str:
    """Détecte automatiquement si la tâche est une régression ou classification."""
    if pd.api.types.is_numeric_dtype(y):
        n_unique = y.nunique()
        n_total = len(y)
        ratio = n_unique / n_total if n_total > 0 else 1
        # Classification si très peu de valeurs uniques ET ratio faible
        if n_unique <= 10 and ratio < 0.05:
            return "classification"
        return "regression"
    return "classification"


def _parse_temporal_for_split(series: pd.Series) -> pd.Series:
    """Parsing léger des dates pour décider un split temporel."""
    s = series.dropna()
    if s.empty:
        return pd.Series(pd.NaT, index=series.index, dtype="datetime64[ns]")

    parsed = pd.Series(pd.NaT, index=series.index, dtype="datetime64[ns]")

    numeric_vals = pd.to_numeric(s, errors="coerce")
    if numeric_vals.notna().mean() > 0.9:
        years = numeric_vals.between(1000, 3000)
        if not years.empty and years.mean() > 0.8:
            parsed.loc[s.index] = pd.to_datetime(numeric_vals.round().astype("Int64").astype(str), format="%Y", errors="coerce")
            return parsed

    text_vals = s.astype(str).str.strip()
    parsed1 = pd.to_datetime(text_vals, errors="coerce", dayfirst=True, format="mixed")
    parsed2 = pd.to_datetime(text_vals, errors="coerce", dayfirst=False, format="mixed")
    best = parsed1 if parsed1.notna().mean() >= parsed2.notna().mean() else parsed2
    parsed.loc[s.index] = best
    return parsed


def _choose_temporal_column(df: pd.DataFrame, target_col: str, temporal_col: str | None) -> str | None:
    """Choisit une colonne temporelle exploitable pour split chronologique."""
    if temporal_col and temporal_col in df.columns and temporal_col != target_col:
        parsed = _parse_temporal_for_split(df[temporal_col])
        if parsed.notna().mean() >= 0.6 and parsed.nunique(dropna=True) >= 6:
            return temporal_col

    candidates = [c for c in df.columns if c != target_col]
    # Prioriser noms explicites
    scored = sorted(
        candidates,
        key=lambda c: 0 if any(k in c.lower() for k in ["date", "annee", "année", "year", "time"]) else 1,
    )
    for c in scored:
        parsed = _parse_temporal_for_split(df[c])
        if parsed.notna().mean() >= 0.6 and parsed.nunique(dropna=True) >= 6:
            return c
    return None


def _sanitize_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Supprime les caractères nuls (\x00) des colonnes, index et données string.
    Corrige les problèmes d'encodage qui causent 'embedded null character'
    lors de la sérialisation (pickle/multiprocessing)."""
    # Nettoyer les noms de colonnes
    df.columns = [c.replace('\x00', '') if isinstance(c, str) else c for c in df.columns]
    # Nettoyer les colonnes string/object
    for col in df.select_dtypes(include=['object']).columns:
        try:
            df[col] = df[col].astype(str).str.replace('\x00', '', regex=False)
        except Exception:
            pass
    # Reset l'index pour garantir un index entier propre
    df = df.reset_index(drop=True)
    return df


def prepare_data(
    df: pd.DataFrame,
    target_col: str,
    test_size: float = 0.2,
    random_state: int = 42,
    split_strategy: str = "auto",
    temporal_col: str | None = None,
) -> dict:
    """Prépare les données pour la modélisation : séparation train/test."""
    working_df = _sanitize_dataframe(df.copy())
    if target_col not in working_df.columns:
        raise ValueError(f"Colonne cible '{target_col}' introuvable dans le dataset")

    # Éliminer impérativement les lignes où la variable cible est NaN
    working_df = working_df.dropna(subset=[target_col])
    if working_df.empty:
        raise ValueError(f"La colonne cible '{target_col}' ne contient que des valeurs manquantes (NaN)")

    # Échantillonnage représentatif pour les très grands datasets (> 20 000 lignes)
    # Permet d'entraîner les 9 modèles de ML en ~15 secondes au lieu de 5+ minutes
    if len(working_df) > 20000:
        working_df = working_df.sample(n=20000, random_state=random_state).reset_index(drop=True)

    y = working_df[target_col]

    # Conserver les colonnes numériques et catégorielles avec < 50 modalités, non totalement vides
    X = working_df.drop(columns=[target_col])
    
    cols_to_keep = []
    for col in X.columns:
        if X[col].dropna().empty:
            continue
        if pd.api.types.is_numeric_dtype(X[col]):
            cols_to_keep.append(col)
        else:
            if X[col].nunique() < 50:
                cols_to_keep.append(col)
                
    X = X[cols_to_keep]
    if X.empty:
        raise ValueError("Aucune feature valide disponible pour la modélisation")

    task_type = detect_task_type(y)

    use_time_split = False
    chosen_time_col = None
    if split_strategy not in {"auto", "random", "time"}:
        raise ValueError("split_strategy invalide (valeurs: auto, random, time)")

    if split_strategy in {"auto", "time"}:
        chosen_time_col = _choose_temporal_column(working_df, target_col, temporal_col)
        use_time_split = chosen_time_col is not None
        if split_strategy == "time" and chosen_time_col is None:
            raise ValueError("split temporel demandé mais aucune colonne temporelle valide trouvée")

    if use_time_split and chosen_time_col:
        parsed_time = _parse_temporal_for_split(working_df[chosen_time_col])
        order = parsed_time.sort_values().index
        X_sorted = X.loc[order]
        y_sorted = y.loc[order]
        t_sorted = parsed_time.loc[order]

        split_idx = max(1, int(len(X_sorted) * (1 - test_size)))
        if split_idx >= len(X_sorted):
            split_idx = len(X_sorted) - 1

        X_train, X_test = X_sorted.iloc[:split_idx], X_sorted.iloc[split_idx:]
        y_train, y_test = y_sorted.iloc[:split_idx], y_sorted.iloc[split_idx:]
        t_train, t_test = t_sorted.iloc[:split_idx], t_sorted.iloc[split_idx:]
        split_info = {
            "strategy": "time",
            "temporal_column": chosen_time_col,
            "train_time_range": {
                "start": t_train.min().isoformat() if t_train.notna().any() else None,
                "end": t_train.max().isoformat() if t_train.notna().any() else None,
            },
            "test_time_range": {
                "start": t_test.min().isoformat() if t_test.notna().any() else None,
                "end": t_test.max().isoformat() if t_test.notna().any() else None,
            },
        }
    else:
        stratify = y if task_type == "classification" and y.nunique() <= 50 else None
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state, stratify=stratify
        )
        split_info = {
            "strategy": "random",
            "temporal_column": None,
            "train_time_range": None,
            "test_time_range": None,
        }

    return {
        "X_train": X_train, "X_test": X_test,
        "y_train": y_train, "y_test": y_test,
        "task_type": task_type,
        "feature_names": X.columns.tolist(),
        "split_info": split_info,
    }


def _safe_cv_folds(y_train, cv_folds: int) -> int:
    """Réduit le nombre de folds si le dataset est trop petit."""
    n_samples = len(y_train)
    # Pour la classification, on ne peut pas avoir plus de folds que la plus petite classe
    try:
        min_class_count = pd.Series(y_train).value_counts().min()
        max_folds = min(n_samples, min_class_count)
    except Exception:
        max_folds = n_samples
    # Limiter aussi par rapport à la taille du dataset
    max_folds = min(max_folds, n_samples // 2)
    return max(2, min(cv_folds, max_folds))


def _build_preprocessor(X: pd.DataFrame, needs_scaling: bool = False) -> ColumnTransformer:
    """Construit un ColumnTransformer pour l'imputation et l'encodage selon les types."""
    numeric_features = X.select_dtypes(include=[np.number]).columns.tolist()
    categorical_features = X.select_dtypes(exclude=[np.number]).columns.tolist()

    numeric_transformer_steps = [("imputer", SimpleImputer(strategy="median"))]
    if needs_scaling:
        numeric_transformer_steps.append(("scaler", StandardScaler()))
    
    numeric_transformer = Pipeline(steps=numeric_transformer_steps)
    
    categorical_transformer = Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False))
    ])
    
    transformers = []
    if numeric_features:
        transformers.append(("num", numeric_transformer, numeric_features))
    if categorical_features:
        transformers.append(("cat", categorical_transformer, categorical_features))
        
    return ColumnTransformer(transformers=transformers, remainder="passthrough")


def train_single_model(
    model_key: str,
    data: dict,
    cv_folds: int = 5,
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

    # Cas spécial : régression polynomiale
    if model_key == "polynomial_regression":
        return _train_polynomial(data, cv_folds)

    model_cls = model_info["class"]
    param_grid = model_info["params"]
    needs_scaling = model_info.get("needs_scaling", False)

    preprocessor = _build_preprocessor(X_train, needs_scaling)
    base_model = model_cls()
    pipe = Pipeline([("preprocessor", preprocessor), ("model", base_model)])
    
    # Préfixer les clés du param_grid avec "model__"
    pipe_params = {f"model__{k}": v for k, v in param_grid.items() if isinstance(v, list)}
    fixed_params = {f"model__{k}": v for k, v in param_grid.items() if not isinstance(v, list)}
    
    if fixed_params:
        pipe.set_params(**fixed_params)

    if pipe_params or any(isinstance(v, list) for v in param_grid.values()):
        scoring = "neg_mean_squared_error" if task_type == "regression" else "f1_weighted"
        grid = GridSearchCV(
            pipe, pipe_params, cv=cv_folds, scoring=scoring, n_jobs=1, error_score="raise"
        )
        grid.fit(X_train, y_train)
        model = grid.best_estimator_
        best_params = {k.replace("model__", ""): v for k, v in grid.best_params_.items()}
    else:
        pipe.fit(X_train, y_train)
        model = pipe
        best_params = {k: v[0] if isinstance(v, list) else v for k, v in param_grid.items()}

    # Prédictions
    y_pred = model.predict(X_test)

    # Métriques
    if task_type == "regression":
        metrics = _regression_metrics(y_test, y_pred)
    else:
        metrics = _classification_metrics(y_test, y_pred, model, X_test)

    # Cross-validation score
    scoring = "neg_mean_squared_error" if task_type == "regression" else "f1_weighted"
    cv_scores = cross_val_score(model, X_train, y_train, cv=cv_folds, scoring=scoring)

    # Feature importance
    importance = _get_feature_importance(model, data["feature_names"])

    # Validation des hypothèses statistiques (Régression linéaire)
    warnings = []
    if task_type == "regression" and model_key in ["linear_regression", "ridge", "lasso", "elasticnet"]:
        # 1. Vérification Multicolinéarité (VIF)
        try:
            from app.core.analysis import compute_vif
            vif_results = compute_vif(X_train)
            high_vif = [v["variable"] for v in vif_results if v["vif"] > 10]
            if high_vif:
                warnings.append(f"Attention: Forte multicolinéarité détectée (VIF > 10) pour: {', '.join(high_vif)}. Les coefficients du modèle peuvent être instables.")
        except Exception:
            pass
            
        # 2. Résidus
        residuals = y_test - y_pred
        if len(residuals) >= 3:
            import scipy.stats as stats
            # Shapiro supporte max 5000 samples, on sample si besoin
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

    return {
        "model_key": model_key,
        "model_name": model_info["name"],
        "task_type": task_type,
        "best_params": best_params,
        "metrics": metrics,
        "cv_scores": {
            "mean": round(float(cv_scores.mean()), 6),
            "std": round(float(cv_scores.std()), 6),
            "scores": [round(float(s), 6) for s in cv_scores],
        },
        "feature_importance": importance,
        "model": model,
        "warnings": warnings,
    }


def train_competitive(
    data: dict,
    model_keys: list[str] | None = None,
    cv_folds: int = 5,
) -> dict:
    """
    Entraînement compétitif multi-algorithmes.
    Retourne un classement des modèles avec le meilleur.
    """
    task_type = data["task_type"]
    registry = REGRESSION_MODELS if task_type == "regression" else CLASSIFICATION_MODELS

    if not model_keys:
        model_keys = list(registry.keys())

    results = []
    for key in model_keys:
        try:
            result = train_single_model(key, data, cv_folds)
            if "error" not in result:
                results.append(result)
        except Exception as e:
            results.append({
                "model_key": key,
                "model_name": registry.get(key, {}).get("name", key),
                "error": str(e),
            })

    # Trier par métrique principale
    valid_results = [r for r in results if "error" not in r]
    if task_type == "regression":
        valid_results.sort(key=lambda r: r["metrics"].get("r2", 0), reverse=True)
    else:
        valid_results.sort(key=lambda r: r["metrics"].get("f1_weighted", 0), reverse=True)

    # Nettoyer (retirer les objets modèle non sérialisables pour le résumé)
    ranking = []
    best_model = None
    for i, r in enumerate(valid_results):
        model_obj = r.pop("model", None)
        r["rank"] = i + 1
        ranking.append(r)
        if i == 0:
            best_model = model_obj

    failed = [r for r in results if "error" in r]

    diagnostics = {}
    if task_type == "regression" and ranking:
        best_r2 = ranking[0]["metrics"].get("r2")
        diagnostics["best_r2"] = best_r2
        diagnostics["quality_flag"] = "critical" if best_r2 is not None and best_r2 < 0 else "ok"
        if best_r2 is not None and best_r2 < 0:
            diagnostics["message"] = (
                "Tous les modèles généralisent mal (R² < 0). Vérifiez la cible, le split temporel, "
                "les valeurs extrêmes et la pertinence des features."
            )

    return {
        "task_type": task_type,
        "ranking": ranking,
        "failed": failed,
        "best_model": best_model,
        "best_model_key": ranking[0]["model_key"] if ranking else None,
        "feature_names": data.get("feature_names", []),
        "diagnostics": diagnostics,
    }


def _train_polynomial(data: dict, cv_folds: int) -> dict:
    """Entraîne une régression polynomiale."""
    best_score = -np.inf
    best_degree = 2
    best_model = None

    X_train, X_test = data["X_train"], data["X_test"]
    y_train, y_test = data["y_train"], data["y_test"]

    for degree in [2, 3]:
        pipe = Pipeline([
            ("poly", PolynomialFeatures(degree=degree, include_bias=False)),
            ("scaler", StandardScaler()),
            ("reg", Ridge(alpha=1.0)),
        ])
        try:
            cv_scores = cross_val_score(pipe, X_train, y_train, cv=cv_folds, scoring="neg_mean_squared_error")
            if cv_scores.mean() > best_score:
                best_score = cv_scores.mean()
                best_degree = degree
                pipe.fit(X_train, y_train)
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
            "mean": round(float(best_score), 6),
            "std": 0.0,
            "scores": [round(float(best_score), 6)],
        },
        "feature_importance": [],
        "model": best_model,
    }


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
    average = "binary" if n_classes == 2 else "weighted"

    metrics = {
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 6),
        "precision_weighted": round(float(precision_score(y_true, y_pred, average="weighted", zero_division=0)), 6),
        "recall_weighted": round(float(recall_score(y_true, y_pred, average="weighted", zero_division=0)), 6),
        "f1_weighted": round(float(f1_score(y_true, y_pred, average="weighted", zero_division=0)), 6),
    }

    # AUC-ROC si probabilités disponibles
    if hasattr(model, "predict_proba"):
        try:
            y_proba = model.predict_proba(X_test)
            if n_classes == 2:
                metrics["auc_roc"] = round(float(roc_auc_score(y_true, y_proba[:, 1])), 6)
            else:
                metrics["auc_roc"] = round(float(roc_auc_score(y_true, y_proba, multi_class="ovr", average="weighted")), 6)
        except Exception:
            pass

    # Matrice de confusion
    cm = confusion_matrix(y_true, y_pred)
    metrics["confusion_matrix"] = cm.tolist()
    metrics["classification_report"] = classification_report(y_true, y_pred, output_dict=True, zero_division=0)

    return metrics


def _get_feature_importance(model, feature_names: list[str]) -> list[dict]:
    """Extrait l'importance des features du modèle."""
    # Si Pipeline, extraire le modèle interne et les noms de features générés par le preprocessor
    inner = model
    actual_feature_names = feature_names
    
    if isinstance(model, Pipeline):
        inner = model.named_steps.get("model", model[-1])
        if "preprocessor" in model.named_steps:
            try:
                # get_feature_names_out() retourne les noms préfixés (ex: num__age, cat__sexe_M)
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
