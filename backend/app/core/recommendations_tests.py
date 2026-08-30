"""
Recommandations de tests statistiques d'hypothèses et vérification automatique des présupposés.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats


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
    """Vérifie automatiquement les hypothèses d'un test avant son exécution."""
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


def recommend_tests(df: pd.DataFrame, col1: str, col2: str | None = None) -> list[dict]:
    """Recommande les tests statistiques adaptés aux variables."""
    recommendations = []
    s1 = df[col1]
    is_numeric_1 = pd.api.types.is_numeric_dtype(s1)
    n = len(s1.dropna())

    if col2 is None:
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

    elif is_numeric_1 != is_numeric_2:
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
