"""
Moteur de recommandations automatiques de transformations guidées par les diagnostics statistiques.
"""

from __future__ import annotations

from typing import Any
import numpy as np
import pandas as pd


def _recommend_skew_for_col(col: str, skew: float) -> dict[str, Any] | None:
    if skew > 2:
        return {
            "column": col,
            "issue": "skewness_positive",
            "issue_label": "Forte asymétrie positive",
            "detail": f"Skewness = {skew:.2f} (> 2)",
            "severity": "high",
            "suggested_transforms": ["log", "log1p", "boxcox", "sqrt"],
            "category": "distribution",
        }
    if skew > 1:
        return {
            "column": col,
            "issue": "skewness_moderate",
            "issue_label": "Asymétrie positive modérée",
            "detail": f"Skewness = {skew:.2f} (> 1)",
            "severity": "medium",
            "suggested_transforms": ["sqrt", "log1p", "yeo_johnson"],
            "category": "distribution",
        }
    if skew < -2:
        return {
            "column": col,
            "issue": "skewness_negative",
            "issue_label": "Forte asymétrie négative",
            "detail": f"Skewness = {skew:.2f} (< -2)",
            "severity": "high",
            "suggested_transforms": ["square", "yeo_johnson"],
            "category": "distribution",
        }
    if skew < -1:
        return {
            "column": col,
            "issue": "skewness_negative",
            "issue_label": "Asymétrie négative modérée",
            "detail": f"Skewness = {skew:.2f} (< -1)",
            "severity": "medium",
            "suggested_transforms": ["square", "yeo_johnson"],
            "category": "distribution",
        }
    return None


def _collect_distribution_and_outliers(df: pd.DataFrame, numeric_cols: list[str]) -> list[dict[str, Any]]:
    recs: list[dict[str, Any]] = []
    for col in numeric_cols:
        skew = df[col].skew()
        if not pd.isna(skew):
            item = _recommend_skew_for_col(col, float(skew))
            if item:
                recs.append(item)

        kurt = df[col].kurtosis()
        if not pd.isna(kurt) and kurt > 7:
            recs.append({
                "column": col,
                "issue": "heavy_tails",
                "issue_label": "Queues épaisses (leptokurtique)",
                "detail": f"Kurtosis = {kurt:.2f} (> 7, excès important)",
                "severity": "medium",
                "suggested_transforms": ["winsorize", "log", "rank"],
                "category": "distribution",
            })

        q1, q3 = df[col].quantile(0.25), df[col].quantile(0.75)
        iqr = q3 - q1
        if iqr == 0:
            continue
        n_outliers = ((df[col] < q1 - 1.5 * iqr) | (df[col] > q3 + 1.5 * iqr)).sum()
        pct = n_outliers / max(len(df), 1) * 100
        if pct > 5:
            recs.append({
                "column": col,
                "issue": "outliers",
                "issue_label": "Outliers détectés",
                "detail": f"{n_outliers} outliers ({pct:.1f}% des données, méthode IQR)",
                "severity": "high" if pct > 15 else "medium",
                "suggested_transforms": ["winsorize", "robust_scale", "rank", "log"],
                "category": "outliers",
            })
    return recs


def _collect_scale_recs(df: pd.DataFrame, numeric_cols: list[str]) -> list[dict[str, Any]]:
    if len(numeric_cols) < 2:
        return []
    valid_stds = df[numeric_cols].std().dropna()
    if len(valid_stds) < 2 or valid_stds.min() <= 0:
        return []
    ratio = valid_stds.max() / valid_stds.min()
    if ratio <= 100:
        return []
    return [
        {
            "column": col,
            "issue": "scale_difference",
            "issue_label": "Échelles très différentes",
            "detail": f"Ratio max/min des écarts-types = {ratio:.0f}. Peut biaiser PCA, KNN, SVM, régressions.",
            "severity": "medium",
            "suggested_transforms": ["standardize", "minmax", "robust_scale"],
            "category": "scale",
        }
        for col in numeric_cols
    ]


def _collect_analysis_recs(analysis_results: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not analysis_results:
        return []
    recs: list[dict[str, Any]] = []
    for v in analysis_results.get("vif", []):
        if isinstance(v, dict) and v.get("multicollinearity") == "severe":
            recs.append({
                "column": v["variable"],
                "issue": "multicollinearity",
                "issue_label": "Multicolinéarité sévère",
                "detail": f"VIF = {v['vif']:.1f} (> 10). Variable fortement corrélée avec les autres.",
                "severity": "high",
                "suggested_transforms": ["standardize"],
                "category": "correlation",
                "note": "Envisagez aussi l'exclusion de cette variable ou une PCA.",
            })
    pairs = analysis_results.get("correlations", {}).get("pearson", {}).get("significant_pairs", [])
    for pair in pairs:
        if isinstance(pair, dict) and abs(pair.get("coefficient", 0)) > 0.9:
            recs.append({
                "column": pair["var1"],
                "issue": "high_correlation",
                "issue_label": "Corrélation très forte",
                "detail": f"|r| = {abs(pair['coefficient']):.3f} avec {pair['var2']}. Redondance probable.",
                "severity": "medium",
                "suggested_transforms": ["standardize"],
                "category": "correlation",
                "note": f"Envisagez d'exclure {pair['var1']} ou {pair['var2']}.",
            })
    return recs


def _collect_timeseries_recs(df: pd.DataFrame, ts_results: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not ts_results:
        return []
    value_col = ts_results.get("value_col", "")
    if not value_col:
        return []
    recs: list[dict[str, Any]] = []
    stationarity = ts_results.get("stationarity", {})
    if not stationarity.get("is_stationary", True):
        recs.append({
            "column": value_col,
            "issue": "non_stationary",
            "issue_label": "Série non stationnaire",
            "detail": stationarity.get("conclusion", "La série n'est pas stationnaire."),
            "severity": "high",
            "suggested_transforms": ["diff", "detrend", "log"],
            "category": "timeseries",
        })
    decomp = ts_results.get("decomposition")
    seasonal = decomp.get("seasonal", []) if decomp else []
    if decomp and decomp.get("period", 1) > 1 and any(v is not None and abs(v) > 0 for v in seasonal):
        recs.append({
            "column": value_col,
            "issue": "seasonality",
            "issue_label": "Saisonnalité détectée",
            "detail": f"Période saisonnière = {decomp['period']}",
            "severity": "medium",
            "suggested_transforms": ["seasonal_diff", "diff"],
            "category": "timeseries",
        })
    _append_autocorr_rec(df, value_col, recs)
    return recs


def _append_autocorr_rec(df: pd.DataFrame, value_col: str, recs: list[dict[str, Any]]) -> None:
    if value_col not in df.columns or len(df[value_col].dropna()) < 10:
        return
    try:
        autocorr_1 = df[value_col].dropna().autocorr(lag=1)
    except Exception:
        return
    if pd.notna(autocorr_1) and abs(autocorr_1) > 0.4:
        recs.append({
            "column": value_col,
            "issue": "autocorrelation",
            "issue_label": "Forte mémoire temporelle (Autocorrélation)",
            "detail": f"Autocorrélation d'ordre 1 = {autocorr_1:.2f}. Un retard (Lag) ou une moyenne mobile captera la dynamique sérielle.",
            "severity": "medium",
            "suggested_transforms": ["lag", "rolling_mean", "diff"],
            "category": "timeseries",
        })


def recommend_transforms(
    df: pd.DataFrame,
    analysis_results: dict[str, Any] | None = None,
    timeseries_results: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Analyse les données et résultats pour recommander des transformations pertinentes."""
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    recommendations = (
        _collect_distribution_and_outliers(df, numeric_cols)
        + _collect_scale_recs(df, numeric_cols)
        + _collect_analysis_recs(analysis_results)
        + _collect_timeseries_recs(df, timeseries_results)
    )
    seen: set[tuple[str, str]] = set()
    unique_recs: list[dict[str, Any]] = []
    for rec in recommendations:
        key = (rec["column"], rec["issue"])
        if key not in seen:
            seen.add(key)
            unique_recs.append(rec)
    severity_order = {"high": 0, "medium": 1, "low": 2}
    unique_recs.sort(key=lambda r: (severity_order.get(r["severity"], 9), r["column"]))
    return unique_recs
