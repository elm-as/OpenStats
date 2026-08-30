"""
Diagnostics automatiques de qualité et d'intégrité statistique des jeux de données.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

SEVERITY_CRITICAL = "critical"
SEVERITY_WARNING = "warning"
SEVERITY_INFO = "info"
SEVERITY_METHOD = "methodological"


def _advisory(severity: str, category: str, title: str, message: str, suggestion: str | None = None) -> dict:
    """Structure standardisée d'une recommandation ou d'un avertissement."""
    return {
        "severity": severity,
        "category": category,
        "title": title,
        "message": message,
        "suggestion": suggestion,
    }


def diagnose_dataset(df: pd.DataFrame, profile: dict | None = None) -> list[dict]:
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
