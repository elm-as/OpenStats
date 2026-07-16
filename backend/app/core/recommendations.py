"""
Moteur de recommandations méthodologiques.
Diagnostics automatiques, recommandations de tests, vérification d'hypothèses.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats
from typing import Any


# ── Types de sévérité ─────────────────────────────────────────

SEVERITY_CRITICAL = "critical"
SEVERITY_WARNING = "warning"
SEVERITY_INFO = "info"
SEVERITY_METHOD = "methodological"


def _advisory(severity: str, category: str, title: str, message: str, suggestion: str = None) -> dict:
    return {
        "severity": severity,
        "category": category,
        "title": title,
        "message": message,
        "suggestion": suggestion,
    }


# ── Diagnostics dataset ──────────────────────────────────────

def diagnose_dataset(df: pd.DataFrame, profile: dict = None) -> list[dict]:
    """
    Diagnostics automatiques sur un dataset.
    Retourne une liste d'alertes classées par sévérité.
    """
    advisories = []
    n_rows, n_cols = df.shape

    # Taille d'échantillon
    if n_rows < 30:
        advisories.append(_advisory(
            SEVERITY_CRITICAL, "sample_size",
            "Échantillon très petit",
            f"Seulement {n_rows} observations. La fiabilité des analyses statistiques est très limitée.",
            "Envisagez de collecter davantage de données ou d'utiliser des méthodes non paramétriques.",
        ))
    elif n_rows < 100:
        advisories.append(_advisory(
            SEVERITY_WARNING, "sample_size",
            "Échantillon modeste",
            f"{n_rows} observations. Certaines analyses avancées (SHAP, bootstrap) peuvent manquer de puissance.",
        ))

    # Ratio observations/variables
    numeric_cols = df.select_dtypes(include="number").columns
    if len(numeric_cols) > 0 and n_rows / len(numeric_cols) < 10:
        advisories.append(_advisory(
            SEVERITY_WARNING, "dimensionality",
            "Ratio observations/variables faible",
            f"Ratio = {n_rows/len(numeric_cols):.0f}:1. Risque de surajustement élevé.",
            "Envisagez la sélection de variables (PCA, Lasso) ou la collecte de données supplémentaires.",
        ))

    # Taux de valeurs manquantes
    null_rate = df.isnull().mean()
    high_null_cols = null_rate[null_rate > 0.3].index.tolist()
    if high_null_cols:
        advisories.append(_advisory(
            SEVERITY_WARNING, "missing_data",
            "Colonnes avec beaucoup de valeurs manquantes",
            f"{len(high_null_cols)} colonne(s) avec >30% de valeurs manquantes : {', '.join(high_null_cols[:5])}",
            "Appliquez le nettoyage (imputation ou suppression) avant l'analyse.",
        ))

    very_high_null = null_rate[null_rate > 0.7].index.tolist()
    if very_high_null:
        advisories.append(_advisory(
            SEVERITY_CRITICAL, "missing_data",
            "Colonnes quasi-vides",
            f"{len(very_high_null)} colonne(s) avec >70% de valeurs manquantes : {', '.join(very_high_null[:5])}",
            "Envisagez d'exclure ces colonnes de l'analyse.",
        ))

    # Colonnes constantes
    constant_cols = [c for c in df.columns if df[c].nunique() <= 1]
    if constant_cols:
        advisories.append(_advisory(
            SEVERITY_INFO, "constant_columns",
            "Colonnes constantes détectées",
            f"{len(constant_cols)} colonne(s) sans variation : {', '.join(constant_cols[:5])}",
            "Ces colonnes n'apportent aucune information et peuvent être exclues.",
        ))

    # Doublons
    dup_count = df.duplicated().sum()
    if dup_count > 0:
        dup_pct = dup_count / n_rows * 100
        sev = SEVERITY_CRITICAL if dup_pct > 20 else SEVERITY_WARNING
        advisories.append(_advisory(
            sev, "duplicates",
            "Doublons détectés",
            f"{dup_count} lignes dupliquées ({dup_pct:.1f}%).",
            "Appliquez la déduplication dans le pipeline de nettoyage.",
        ))

    # Multicolinéarité (VIF rapide)
    num_df = df[numeric_cols].dropna()
    if num_df.shape[1] >= 2 and num_df.shape[0] > num_df.shape[1]:
        try:
            corr = num_df.corr().abs()
            np.fill_diagonal(corr.values, 0)
            high_corr = []
            for i in range(len(corr.columns)):
                for j in range(i + 1, len(corr.columns)):
                    if corr.iloc[i, j] > 0.9:
                        high_corr.append((corr.columns[i], corr.columns[j], corr.iloc[i, j]))
            if high_corr:
                pairs = [f"{a}-{b} ({r:.2f})" for a, b, r in high_corr[:3]]
                advisories.append(_advisory(
                    SEVERITY_WARNING, "multicollinearity",
                    "Forte multicolinéarité détectée",
                    f"Corrélations >0.9 : {', '.join(pairs)}",
                    "Envisagez Ridge, Lasso ou la suppression de variables redondantes.",
                ))
        except Exception:
            pass

    # Distributions asymétriques
    for col in numeric_cols:
        try:
            skew = df[col].dropna().skew()
            if abs(skew) > 2:
                advisories.append(_advisory(
                    SEVERITY_INFO, "skewness",
                    f"Distribution fortement asymétrique : {col}",
                    f"Asymétrie = {skew:.2f}. La distribution est {'à droite' if skew > 0 else 'à gauche'}.",
                    "Envisagez une transformation log, Box-Cox ou racine carrée.",
                ))
        except Exception:
            pass

    return advisories


# ── Recommandations de tests ─────────────────────────────────

def recommend_tests(df: pd.DataFrame, col1: str, col2: str = None) -> list[dict]:
    """
    Recommande les tests statistiques adaptés aux variables.
    """
    recommendations = []
    s1 = df[col1]
    is_numeric_1 = pd.api.types.is_numeric_dtype(s1)
    n = len(s1.dropna())

    if col2 is None:
        # Test sur une seule variable
        if is_numeric_1:
            if n >= 30:
                recommendations.append({
                    "test": "t_test_one_sample",
                    "name": "Test t (une moyenne)",
                    "reason": f"Variable numérique, n={n} ≥ 30",
                    "assumptions": ["Normalité approximative (n≥30, CLT applicable)"],
                })
            recommendations.append({
                "test": "shapiro_wilk",
                "name": "Test de Shapiro-Wilk",
                "reason": "Vérifier la normalité",
                "assumptions": [f"n={n}, recommandé si n < 5000"],
            })
        return recommendations

    s2 = df[col2]
    is_numeric_2 = pd.api.types.is_numeric_dtype(s2)

    if is_numeric_1 and is_numeric_2:
        # Deux numériques → corrélation
        recommendations.append({
            "test": "correlation",
            "name": "Test de corrélation (Pearson)",
            "reason": "Deux variables numériques continues",
            "assumptions": ["Normalité bivariée", "Relation linéaire"],
        })
        recommendations.append({
            "test": "correlation_spearman",
            "name": "Test de corrélation (Spearman)",
            "reason": "Alternative non paramétrique, robuste aux distributions non normales",
            "assumptions": ["Relation monotone", "Variables ordinales ou continues"],
        })

    elif is_numeric_1 and not is_numeric_2 or not is_numeric_1 and is_numeric_2:
        # Numérique vs catégorielle → comparaison de moyennes
        cat_col = col2 if is_numeric_1 else col1
        k = df[cat_col].nunique()

        if k == 2:
            if n >= 30:
                recommendations.append({
                    "test": "means_comparison",
                    "name": "Test t de Student (indépendant)",
                    "reason": f"2 groupes, n={n} ≥ 30",
                    "assumptions": ["Normalité", "Homogénéité des variances"],
                })
            recommendations.append({
                "test": "mann_whitney",
                "name": "Test U de Mann-Whitney",
                "reason": "Alternative non paramétrique au test t",
                "assumptions": ["Distributions de même forme dans les 2 groupes"],
            })
        elif k > 2:
            recommendations.append({
                "test": "anova",
                "name": "ANOVA à un facteur",
                "reason": f"{k} groupes",
                "assumptions": ["Normalité dans chaque groupe", "Homogénéité des variances"],
            })
            recommendations.append({
                "test": "kruskal_wallis",
                "name": "Test de Kruskal-Wallis",
                "reason": "Alternative non paramétrique à l'ANOVA",
                "assumptions": ["Distributions de même forme"],
            })

    else:
        # Deux catégorielles → indépendance
        recommendations.append({
            "test": "independence",
            "name": "Test du Chi² d'indépendance",
            "reason": "Deux variables catégorielles",
            "assumptions": ["Effectifs théoriques ≥ 5 dans chaque cellule"],
        })
        recommendations.append({
            "test": "fisher_exact",
            "name": "Test exact de Fisher",
            "reason": "Alternative pour petits échantillons (tableau 2×2)",
            "assumptions": ["Tableau de contingence 2×2"],
        })

    return recommendations


# ── Vérification d'hypothèses ────────────────────────────────

def check_normality(series: pd.Series) -> dict:
    """Vérifie la normalité d'une série."""
    data = series.dropna().values
    n = len(data)
    if n < 8:
        return {"test": "shapiro", "passed": None, "message": "Échantillon trop petit", "p_value": None}

    if n <= 5000:
        stat, p = stats.shapiro(data)
        test_name = "shapiro"
    else:
        stat, p = stats.kstest(data, "norm", args=(np.mean(data), np.std(data)))
        test_name = "kolmogorov_smirnov"

    return {
        "test": test_name,
        "statistic": round(float(stat), 4),
        "p_value": round(float(p), 4),
        "passed": bool(p > 0.05),
        "message": "Distribution compatible avec la normalité" if p > 0.05
                   else "Distribution significativement non normale",
    }


def check_homoscedasticity(df: pd.DataFrame, group_col: str, value_col: str) -> dict:
    """Test de Levene pour l'homogénéité des variances."""
    groups = [g[value_col].dropna().values for _, g in df.groupby(group_col) if len(g[value_col].dropna()) >= 2]
    if len(groups) < 2:
        return {"test": "levene", "passed": None, "message": "Pas assez de groupes"}

    stat, p = stats.levene(*groups)
    return {
        "test": "levene",
        "statistic": round(float(stat), 4),
        "p_value": round(float(p), 4),
        "passed": bool(p > 0.05),
        "message": "Variances homogènes" if p > 0.05 else "Variances significativement différentes",
    }


def check_assumptions_for_test(df: pd.DataFrame, test_type: str, params: dict) -> list[dict]:
    """
    Vérifie automatiquement les hypothèses d'un test avant son exécution.
    """
    checks = []

    if test_type in ("means_comparison", "t_test"):
        value_col = params.get("value_col")
        group_col = params.get("group_col")
        if value_col and group_col:
            checks.append({"assumption": "Normalité", **check_normality(df[value_col])})
            checks.append({"assumption": "Homogénéité des variances", **check_homoscedasticity(df, group_col, value_col)})

    elif test_type == "correlation":
        col1 = params.get("col1")
        col2 = params.get("col2")
        if col1:
            checks.append({"assumption": f"Normalité de {col1}", **check_normality(df[col1])})
        if col2:
            checks.append({"assumption": f"Normalité de {col2}", **check_normality(df[col2])})

    elif test_type == "anova":
        value_col = params.get("value_col")
        group_col = params.get("group_col")
        if value_col and group_col:
            for name, group in df.groupby(group_col):
                if len(group) >= 8:
                    checks.append({
                        "assumption": f"Normalité (groupe {name})",
                        **check_normality(group[value_col]),
                    })
            checks.append({"assumption": "Homogénéité des variances", **check_homoscedasticity(df, group_col, value_col)})

    return checks


# ── Recommandations de modèles ───────────────────────────────

def recommend_models(df: pd.DataFrame, target_col: str) -> list[dict]:
    """Recommande les modèles adaptés au dataset et à la variable cible."""
    recommendations = []
    n, p = df.shape
    target = df[target_col]
    is_classification = not pd.api.types.is_numeric_dtype(target) or target.nunique() <= 10

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


# ── Avertissements méthodologiques ───────────────────────────

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
