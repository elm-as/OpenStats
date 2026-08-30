"""
Recommandations de modèles prédictifs et génération d'avertissements méthodologiques.
"""

from __future__ import annotations

import pandas as pd
from app.core.recommendations_diagnosis import (
    SEVERITY_WARNING,
    SEVERITY_METHOD,
    _advisory,
)


def recommend_models(df: pd.DataFrame, target_col: str) -> list[dict]:
    """Recommande les modèles adaptés au dataset et à la variable cible."""
    from app.core.modeling import detect_task_type
    recommendations = []
    n, p = df.shape
    target = df[target_col]
    is_classification = (detect_task_type(target) == "classification")

    if is_classification:
        k = target.nunique()
        recommendations.append({
            "model": "logistic_regression",
            "name": "Régression Logistique",
            "reason": f"Classification {'binaire' if k == 2 else 'multi-classes'}, interprétable",
            "priority": "high",
        })
        if n >= 100:
            recommendations.append({
                "model": "random_forest",
                "name": "Random Forest",
                "reason": "Robuste, gère les non-linéarités, peu de tuning nécessaire",
                "priority": "high",
            })
        if n >= 500:
            recommendations.append({
                "model": "xgboost",
                "name": "XGBoost",
                "reason": "Performant sur datasets de taille moyenne/grande",
                "priority": "medium",
            })
    else:
        recommendations.append({
            "model": "linear_regression",
            "name": "Régression Linéaire",
            "reason": "Baseline interprétable, vérifier les résidus",
            "priority": "high",
        })
        if p > 5:
            recommendations.append({
                "model": "ridge",
                "name": "Ridge (L2)",
                "reason": f"{p} features détectées, régularisation recommandée",
                "priority": "high",
            })
            recommendations.append({
                "model": "lasso",
                "name": "Lasso (L1)",
                "reason": "Sélection automatique de variables + régularisation",
                "priority": "high",
            })
        if n >= 100:
            recommendations.append({
                "model": "random_forest",
                "name": "Random Forest Regressor",
                "reason": "Capture les non-linéarités sans hypothèses paramétriques",
                "priority": "medium",
            })
        if n >= 500:
            recommendations.append({
                "model": "xgboost",
                "name": "XGBoost Regressor",
                "reason": "État de l'art sur données tabulaires",
                "priority": "medium",
            })

    return recommendations


def get_methodology_warnings(analysis_type: str, results: dict) -> list[dict]:
    """Génère des avertissements méthodologiques contextuels."""
    warnings = []

    if analysis_type == "correlation":
        warnings.append(_advisory(
            SEVERITY_METHOD, "causality",
            "Corrélation ≠ Causalité",
            "Une corrélation significative n'implique pas une relation causale.",
            "Envisagez des designs expérimentaux ou des analyses de médiation.",
        ))
        if results.get("significant_pairs"):
            n_sig = len(results["significant_pairs"])
            n_total = len(results.get("columns", [])) * (len(results.get("columns", [])) - 1) // 2
            if n_total > 10 and n_sig > n_total * 0.5:
                warnings.append(_advisory(
                    SEVERITY_WARNING, "multiple_testing",
                    "Comparaisons multiples",
                    f"{n_sig}/{n_total} paires significatives. Risque d'erreur de type I élevé.",
                    "Appliquez une correction de Bonferroni ou de Benjamini-Hochberg.",
                ))

    if analysis_type == "modeling":
        train_size = results.get("data_split", {}).get("train_size", 0)
        test_size = results.get("data_split", {}).get("test_size", 0)
        if train_size > 0 and test_size < 30:
            warnings.append(_advisory(
                SEVERITY_WARNING, "test_set_size",
                "Jeu de test très petit",
                f"Seulement {test_size} observations dans le jeu de test.",
                "Les métriques de performance peuvent être instables. Utilisez la validation croisée.",
            ))

    if analysis_type == "timeseries":
        if results.get("stationarity", {}).get("is_stationary") is False:
            warnings.append(_advisory(
                SEVERITY_WARNING, "stationarity",
                "Série non stationnaire",
                "La série n'est pas stationnaire. Les résultats ARIMA peuvent être infiables.",
                "Vérifiez la différenciation ou utilisez des modèles adaptés (SARIMA, VECM).",
            ))

    return warnings
