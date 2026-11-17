"""
Catalogue de modeles, specifications et recommandations.

Definit les candidats applicables selon le probleme, la taille de l'echantillon,
l'axe temporel et les bibliotheques reellement disponibles sur le systeme.
"""

from __future__ import annotations

import importlib
from dataclasses import dataclass
from typing import Any, Callable

import numpy as np

MIN_ROWS = 30
MAX_FEATURES = 60


def _available(module: str) -> bool:
    """Bibliotheque installee et chargeable.

    `OSError` couvre le cas d'une extension compilee dont une dependance
    systeme manque : le module existe mais ne peut pas se charger.
    """
    try:
        importlib.import_module(module)
    except (ImportError, OSError):
        return False
    return True


@dataclass
class ModelSpec:
    """Un candidat : quand il s'applique, comment le construire, ce qu'il apporte."""

    key: str
    label: str
    family: str                       # lineaire | penalise | arbres | boosting | temporel | reference
    problems: tuple[str, ...]
    build: Callable[[dict[str, Any]], Any]
    requires: tuple[str, ...] = ()    # modules necessaires
    min_rows: int = MIN_ROWS
    max_cv_rows: int | None = None    # plafond d'observations en validation croisee (O(N^2))
    strengths: str = ""
    caveat: str = ""

    def available(self) -> bool:
        return all(_available(module) for module in self.requires)

    def applicable(self, problem: str, n_rows: int, n_features: int) -> tuple[bool, str]:
        if problem not in self.problems:
            return False, "ne s'applique pas à ce type de problème"
        if not self.available():
            missing = [m for m in self.requires if not _available(m)]
            return False, f"bibliothèque absente : {', '.join(missing)}"
        if n_rows < self.min_rows:
            return False, f"{self.min_rows} observations minimum requises"
        return True, ""

    def to_dict(self, problem: str, n_rows: int, n_features: int) -> dict[str, Any]:
        ok, reason = self.applicable(problem, n_rows, n_features)
        return {
            "key": self.key, "label": self.label, "family": self.family,
            "applicable": ok, "reason": reason,
            "strengths": self.strengths, "caveat": self.caveat,
        }


# ── Constructeurs ────────────────────────────────────────────────────────

def _ols(_: dict[str, Any]):
    from sklearn.linear_model import LinearRegression
    return LinearRegression()


def _ridge(_: dict[str, Any]):
    from sklearn.linear_model import RidgeCV
    return RidgeCV(alphas=np.logspace(-3, 3, 13))


def _lasso(_: dict[str, Any]):
    from sklearn.linear_model import LassoCV
    return LassoCV(n_alphas=40, max_iter=5000, random_state=0)


def _elastic(_: dict[str, Any]):
    from sklearn.linear_model import ElasticNetCV
    return ElasticNetCV(l1_ratio=[0.2, 0.5, 0.8], n_alphas=30, max_iter=5000, random_state=0)


def _rf_reg(ctx: dict[str, Any]):
    from sklearn.ensemble import RandomForestRegressor
    return RandomForestRegressor(n_estimators=250, random_state=0, n_jobs=1,
                                 min_samples_leaf=max(1, ctx.get("n_rows", 100) // 200))


def _gbm_reg(_: dict[str, Any]):
    from sklearn.ensemble import HistGradientBoostingRegressor
    return HistGradientBoostingRegressor(random_state=0)


def _xgb_reg(_: dict[str, Any]):
    from xgboost import XGBRegressor
    return XGBRegressor(n_estimators=250, learning_rate=0.08, max_depth=4,
                        subsample=0.9, random_state=0, n_jobs=1, verbosity=0)


def _lgbm_reg(_: dict[str, Any]):
    from lightgbm import LGBMRegressor
    return LGBMRegressor(n_estimators=250, learning_rate=0.08, random_state=0,
                         n_jobs=1, verbose=-1)


def _logistic(_: dict[str, Any]):
    from sklearn.linear_model import LogisticRegression
    return LogisticRegression(max_iter=2000, class_weight="balanced")


def _rf_clf(_: dict[str, Any]):
    from sklearn.ensemble import RandomForestClassifier
    return RandomForestClassifier(n_estimators=250, random_state=0, n_jobs=1,
                                  class_weight="balanced_subsample")


def _gbm_clf(_: dict[str, Any]):
    from sklearn.ensemble import HistGradientBoostingClassifier
    return HistGradientBoostingClassifier(random_state=0)


def _xgb_clf(_: dict[str, Any]):
    from xgboost import XGBClassifier
    return XGBClassifier(n_estimators=250, learning_rate=0.08, max_depth=4,
                         random_state=0, n_jobs=1, verbosity=0,
                         eval_metric="logloss")


def _lgbm_clf(_: dict[str, Any]):
    from lightgbm import LGBMClassifier
    return LGBMClassifier(n_estimators=250, learning_rate=0.08, random_state=0,
                          n_jobs=1, verbose=-1, class_weight="balanced")


def _svm_clf(_: dict[str, Any]):
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler
    from sklearn.svm import SVC
    return make_pipeline(StandardScaler(), SVC(kernel="rbf", class_weight="balanced"))


def _knn_clf(_: dict[str, Any]):
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler
    from sklearn.neighbors import KNeighborsClassifier
    return make_pipeline(StandardScaler(), KNeighborsClassifier(n_neighbors=5))


CATALOG: list[ModelSpec] = [
    # ── Regression ──
    ModelSpec("ols", "Régression linéaire (MCO)", "lineaire", ("regression",), _ols,
              strengths="Coefficients directement interprétables.",
              caveat="Sensible aux valeurs extrêmes et à la colinéarité."),
    ModelSpec("ridge", "Ridge (pénalisation L2)", "penalise", ("regression",), _ridge,
              strengths="Stabilise les coefficients quand les variables sont corrélées."),
    ModelSpec("lasso", "Lasso (pénalisation L1)", "penalise", ("regression",), _lasso,
              strengths="Sélectionne les variables en annulant les coefficients inutiles."),
    ModelSpec("elasticnet", "Elastic Net", "penalise", ("regression",), _elastic, min_rows=50,
              strengths="Compromis entre Ridge et Lasso."),
    ModelSpec("rf_reg", "Forêt aléatoire", "arbres", ("regression",), _rf_reg,
              strengths="Capte les non-linéarités et les interactions sans réglage.",
              caveat="Coefficients non interprétables directement."),
    ModelSpec("gbm_reg", "Gradient boosting", "boosting", ("regression",), _gbm_reg, min_rows=60,
              strengths="Souvent le plus performant sur données tabulaires."),
    ModelSpec("lgbm_reg", "LightGBM", "boosting", ("regression",), _lgbm_reg,
              requires=("lightgbm",), min_rows=80,
              strengths="Très rapide sur les grands jeux de données."),
    ModelSpec("xgb_reg", "XGBoost", "boosting", ("regression",), _xgb_reg,
              requires=("xgboost",), min_rows=60,
              strengths="Boosting optimisé, robuste aux valeurs manquantes."),

    # ── Classification ──
    ModelSpec("logistic", "Régression logistique", "lineaire",
              ("classification_binaire", "classification_multiclasse"), _logistic,
              strengths="Rapports de cotes interprétables.",
              caveat="Suppose une frontière linéaire."),
    ModelSpec("lgbm_clf", "LightGBM", "boosting",
              ("classification_binaire", "classification_multiclasse"), _lgbm_clf,
              requires=("lightgbm",), min_rows=80,
              strengths="Rapide, gère nativement les catégories."),
    ModelSpec("gbm_clf", "Gradient boosting", "boosting",
              ("classification_binaire", "classification_multiclasse"), _gbm_clf, min_rows=60,
              strengths="Généralement le plus précis sur données tabulaires."),
    ModelSpec("xgb_clf", "XGBoost", "boosting",
              ("classification_binaire", "classification_multiclasse"), _xgb_clf,
              requires=("xgboost",), min_rows=60,
              strengths="Boosting optimisé."),
    ModelSpec("rf_clf", "Forêt aléatoire", "arbres",
              ("classification_binaire", "classification_multiclasse"), _rf_clf,
              strengths="Robuste, gère les frontières complexes."),
    ModelSpec("svm", "SVM (noyau RBF)", "arbres",
              ("classification_binaire", "classification_multiclasse"), _svm_clf, min_rows=50,
              max_cv_rows=3000,
              strengths="Efficace en petite dimension avec frontière non linéaire.",
              caveat="Coûteux au-delà de quelques milliers de lignes (plafonné à 3 000 en CV)."),
    ModelSpec("knn", "k plus proches voisins", "arbres",
              ("classification_binaire", "classification_multiclasse"), _knn_clf,
              max_cv_rows=8000,
              strengths="Aucune hypothèse de forme.",
              caveat="Sensible à l'échelle et au bruit (plafonné à 8 000 en CV)."),
]

CATALOG_BY_KEY = {spec.key: spec for spec in CATALOG}

TEMPORAL_MODELS = [
    {"key": "naive", "label": "Persistance (référence)", "family": "reference",
     "requires": (), "min_rows": 12,
     "strengths": "Prédit la dernière valeur observée. Toute méthode doit faire mieux."},
    {"key": "drift", "label": "Dérive linéaire (référence)", "family": "reference",
     "requires": (), "min_rows": 12,
     "strengths": "Prolonge la tendance moyenne."},
    {"key": "holt_winters", "label": "Lissage exponentiel (Holt-Winters)", "family": "temporel",
     "requires": ("statsmodels",), "min_rows": 20,
     "strengths": "Capte niveau, tendance et saisonnalité."},
    {"key": "arima", "label": "ARIMA", "family": "temporel",
     "requires": ("statsmodels",), "min_rows": 25,
     "strengths": "Référence en séries univariées ; ordre choisi par AIC."},
    {"key": "sarima", "label": "SARIMA (saisonnier)", "family": "temporel",
     "requires": ("statsmodels",), "min_rows": 40,
     "strengths": "ARIMA avec composante saisonnière."},
    {"key": "prophet", "label": "Prophet", "family": "temporel",
     "requires": ("prophet",), "min_rows": 40,
     "strengths": "Robuste aux ruptures et aux données manquantes."},
]


def recommend(problem: str, n_rows: int, n_features: int,
              is_timeseries: bool = False) -> dict[str, Any]:
    """Modeles applicables et recommandes, avec la raison de chaque exclusion."""
    if problem == "forecast" or is_timeseries:
        entries = []
        for spec in TEMPORAL_MODELS:
            missing = [m for m in spec["requires"] if not _available(m)]
            ok = not missing and n_rows >= spec["min_rows"]
            reason = (f"bibliothèque absente : {', '.join(missing)}" if missing
                      else f"{spec['min_rows']} observations minimum requises"
                      if n_rows < spec["min_rows"] else "")
            entries.append({**{k: spec[k] for k in ("key", "label", "family", "strengths")},
                            "applicable": ok, "reason": reason, "caveat": ""})
        recommended = [e["key"] for e in entries if e["applicable"] and e["family"] != "reference"]
        return {"problem": "forecast", "candidates": entries,
                "recommended": recommended[:4],
                "note": "Validation par découpage chronologique : le modèle n'est jamais "
                        "entraîné sur des périodes postérieures à celles qu'il prédit."}

    entries = [spec.to_dict(problem, n_rows, n_features) for spec in CATALOG]
    applicable = [e for e in entries if e["applicable"]]

    recommended: list[str] = []
    seen_families: set[str] = set()
    for entry in applicable:
        if entry["family"] not in seen_families:
            recommended.append(entry["key"])
            seen_families.add(entry["family"])
    return {
        "problem": problem,
        "candidates": entries,
        "recommended": recommended,
        "note": "Chaque modèle est comparé à une référence naïve : sans elle, un score "
                "n'indique pas si le modèle apporte quoi que ce soit.",
    }
