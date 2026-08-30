"""
Registres des algorithmes de modélisation (Régression & Classification).
"""

from __future__ import annotations

import warnings
from sklearn.exceptions import ConvergenceWarning, UndefinedMetricWarning
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

# Masquer globalement les warnings polluants de scikit-learn
warnings.filterwarnings("ignore", category=FutureWarning, module="sklearn")
warnings.filterwarnings("ignore", category=UserWarning, module="sklearn")
warnings.filterwarnings("ignore", category=ConvergenceWarning)
warnings.filterwarnings("ignore", category=UndefinedMetricWarning)

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
        "params": {"n_estimators": [50, 100], "learning_rate": [0.1, 1.0], "algorithm": ["SAMME"]},
        "name": "AdaBoost",
    },
}

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
