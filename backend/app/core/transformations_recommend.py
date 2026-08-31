"""
Moteur de recommandations automatiques de transformations guidées par les diagnostics statistiques.
"""

from __future__ import annotations

from typing import Any
import numpy as np
import pandas as pd


def recommend_transforms(
    df: pd.DataFrame,
    analysis_results: dict[str, Any] | None = None,
    timeseries_results: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """
    Analyse les données et les résultats statistiques pour recommander
    des transformations pertinentes.
    """
    recommendations: list[dict[str, Any]] = []
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()

    # 1. Asymétrie (skewness)
    for col in numeric_cols:
        skew = df[col].skew()
        if pd.isna(skew):
            continue

        if skew > 2:
            recommendations.append({
                "column": col,
                "issue": "skewness_positive",
                "issue_label": "Forte asymétrie positive",
                "detail": f"Skewness = {skew:.2f} (> 2)",
                "severity": "high",
                "suggested_transforms": ["log", "log1p", "boxcox", "sqrt"],
                "category": "distribution",
            })
        elif skew > 1:
            recommendations.append({
                "column": col,
                "issue": "skewness_moderate",
                "issue_label": "Asymétrie positive modérée",
                "detail": f"Skewness = {skew:.2f} (> 1)",
                "severity": "medium",
                "suggested_transforms": ["sqrt", "log1p", "yeo_johnson"],
                "category": "distribution",
            })
        elif skew < -2:
            recommendations.append({
                "column": col,
                "issue": "skewness_negative",
                "issue_label": "Forte asymétrie négative",
                "detail": f"Skewness = {skew:.2f} (< -2)",
                "severity": "high",
                "suggested_transforms": ["square", "yeo_johnson"],
                "category": "distribution",
            })
        elif skew < -1:
            recommendations.append({
                "column": col,
                "issue": "skewness_negative",
                "issue_label": "Asymétrie négative modérée",
                "detail": f"Skewness = {skew:.2f} (< -1)",
                "severity": "medium",
                "suggested_transforms": ["square", "yeo_johnson"],
                "category": "distribution",
            })

    # 2. Kurtosis (queues épaisses)
    for col in numeric_cols:
        kurt = df[col].kurtosis()
        if pd.isna(kurt):
            continue
        if kurt > 7:
            recommendations.append({
                "column": col,
                "issue": "heavy_tails",
                "issue_label": "Queues épaisses (leptokurtique)",
                "detail": f"Kurtosis = {kurt:.2f} (> 7, excès important)",
                "severity": "medium",
                "suggested_transforms": ["winsorize", "log", "rank"],
                "category": "distribution",
            })

    # 3. Outliers (IQR)
    for col in numeric_cols:
        q1 = df[col].quantile(0.25)
        q3 = df[col].quantile(0.75)
        iqr = q3 - q1
        if iqr == 0:
            continue
        n_outliers = ((df[col] < q1 - 1.5 * iqr) | (df[col] > q3 + 1.5 * iqr)).sum()
        pct = n_outliers / len(df) * 100
        if pct > 5:
            recommendations.append({
                "column": col,
                "issue": "outliers",
                "issue_label": "Outliers détectés",
                "detail": f"{n_outliers} outliers ({pct:.1f}% des données, méthode IQR)",
                "severity": "high" if pct > 15 else "medium",
                "suggested_transforms": ["winsorize", "robust_scale", "rank", "log"],
                "category": "outliers",
            })

    # 4. Échelles très différentes
    if len(numeric_cols) >= 2:
        stds = df[numeric_cols].std()
        valid_stds = stds.dropna()
        if len(valid_stds) >= 2 and valid_stds.min() > 0:
            ratio = valid_stds.max() / valid_stds.min()
            if ratio > 100:
                for col in numeric_cols:
                    recommendations.append({
                        "column": col,
                        "issue": "scale_difference",
                        "issue_label": "Échelles très différentes",
                        "detail": f"Ratio max/min des écarts-types = {ratio:.0f}. Peut biaiser PCA, KNN, SVM, régressions.",
                        "severity": "medium",
                        "suggested_transforms": ["standardize", "minmax", "robust_scale"],
                        "category": "scale",
                    })

    # 5. Multicolinéarité (VIF)
    if analysis_results:
        vif_data = analysis_results.get("vif", [])
        for v in vif_data:
            if isinstance(v, dict) and v.get("multicollinearity") == "severe":
                recommendations.append({
                    "column": v["variable"],
                    "issue": "multicollinearity",
                    "issue_label": "Multicolinéarité sévère",
                    "detail": f"VIF = {v['vif']:.1f} (> 10). Variable fortement corrélée avec les autres.",
                    "severity": "high",
                    "suggested_transforms": ["standardize"],
                    "category": "correlation",
                    "note": "Envisagez aussi l'exclusion de cette variable ou une PCA.",
                })

    # 6. Forte corrélation
    if analysis_results:
        corr = analysis_results.get("correlations", {})
        pearson = corr.get("pearson", {})
        pairs = pearson.get("significant_pairs", [])
        for pair in pairs:
            if isinstance(pair, dict) and abs(pair.get("coefficient", 0)) > 0.9:
                recommendations.append({
                    "column": pair["var1"],
                    "issue": "high_correlation",
                    "issue_label": "Corrélation très forte",
                    "detail": f"|r| = {abs(pair['coefficient']):.3f} avec {pair['var2']}. Redondance probable.",
                    "severity": "medium",
                    "suggested_transforms": ["standardize"],
                    "category": "correlation",
                    "note": f"Envisagez d'exclure {pair['var1']} ou {pair['var2']}.",
                })

    # 7. Stationnarité (séries temporelles)
    if timeseries_results:
        stationarity = timeseries_results.get("stationarity", {})
        is_stationary = stationarity.get("is_stationary", True)
        value_col = timeseries_results.get("value_col", "")

        if not is_stationary and value_col:
            recommendations.append({
                "column": value_col,
                "issue": "non_stationary",
                "issue_label": "Série non stationnaire",
                "detail": stationarity.get("conclusion", "La série n'est pas stationnaire."),
                "severity": "high",
                "suggested_transforms": ["diff", "detrend", "log"],
                "category": "timeseries",
            })

        decomp = timeseries_results.get("decomposition")
        if decomp and decomp.get("period", 1) > 1 and value_col:
            seasonal = decomp.get("seasonal", [])
            if seasonal and any(v is not None and abs(v) > 0 for v in seasonal):
                recommendations.append({
                    "column": value_col,
                    "issue": "seasonality",
                    "issue_label": "Saisonnalité détectée",
                    "detail": f"Période saisonnière = {decomp['period']}",
                    "severity": "medium",
                    "suggested_transforms": ["seasonal_diff", "diff"],
                    "category": "timeseries",
                })

        # Recommandation de mémoire sérielle (lags / rolling)
        if value_col and len(df[value_col].dropna()) >= 10:
            s_clean = df[value_col].dropna()
            try:
                autocorr_1 = s_clean.autocorr(lag=1)
                if pd.notna(autocorr_1) and abs(autocorr_1) > 0.4:
                    recommendations.append({
                        "column": value_col,
                        "issue": "autocorrelation",
                        "issue_label": "Forte mémoire temporelle (Autocorrélation)",
                        "detail": f"Autocorrélation d'ordre 1 = {autocorr_1:.2f}. Un retard (Lag) ou une moyenne mobile captera la dynamique sérielle.",
                        "severity": "medium",
                        "suggested_transforms": ["lag", "rolling_mean", "diff"],
                        "category": "timeseries",
                    })
            except Exception:
                pass

    seen = set()
    unique_recs = []
    for r in recommendations:
        key = (r["column"], r["issue"])
        if key not in seen:
            seen.add(key)
            unique_recs.append(r)

    severity_order = {"high": 0, "medium": 1, "low": 2}
    unique_recs.sort(key=lambda r: (severity_order.get(r["severity"], 9), r["column"]))

    return unique_recs
