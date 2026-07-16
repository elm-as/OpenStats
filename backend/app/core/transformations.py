"""
Module de transformations de données guidées par les résultats statistiques.
Chaque transformation peut être appliquée colonne par colonne ou globalement.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from typing import Any


# ── Catalogue des transformations ──────────────────────────────────────

TRANSFORM_CATALOG: dict[str, dict[str, Any]] = {
    "log": {
        "label": "Transformation logarithmique (log₁₀)",
        "description": "Réduit l'asymétrie positive et stabilise la variance. Nécessite des valeurs strictement positives.",
        "applies_to": "numeric",
        "fixes": ["skewness_positive", "heteroscedasticity", "non_stationary_variance"],
    },
    "log1p": {
        "label": "Transformation log(1+x)",
        "description": "Comme log mais accepte les zéros. Utile pour les données de comptage.",
        "applies_to": "numeric",
        "fixes": ["skewness_positive", "heteroscedasticity"],
    },
    "sqrt": {
        "label": "Racine carrée",
        "description": "Réduit l'asymétrie positive de façon plus modérée que le log.",
        "applies_to": "numeric",
        "fixes": ["skewness_moderate", "heteroscedasticity"],
    },
    "reciprocal": {
        "label": "Inverse (1/x)",
        "description": "Transformation forte, inverse les valeurs. Nécessite des valeurs non nulles.",
        "applies_to": "numeric",
        "fixes": ["skewness_positive_extreme"],
    },
    "square": {
        "label": "Carré (x²)",
        "description": "Corrige l'asymétrie négative.",
        "applies_to": "numeric",
        "fixes": ["skewness_negative"],
    },
    "boxcox": {
        "label": "Box-Cox",
        "description": "Trouve automatiquement la meilleure puissance pour normaliser. Nécessite des valeurs strictement positives.",
        "applies_to": "numeric",
        "fixes": ["skewness_positive", "skewness_negative", "non_normal"],
    },
    "yeo_johnson": {
        "label": "Yeo-Johnson",
        "description": "Comme Box-Cox mais accepte les valeurs négatives et nulles.",
        "applies_to": "numeric",
        "fixes": ["skewness_positive", "skewness_negative", "non_normal"],
    },
    "standardize": {
        "label": "Standardisation (Z-score)",
        "description": "Centre (μ=0) et réduit (σ=1). Préserve la forme de la distribution.",
        "applies_to": "numeric",
        "fixes": ["scale_difference", "multicollinearity_scale"],
    },
    "minmax": {
        "label": "Normalisation Min-Max [0, 1]",
        "description": "Met à l'échelle entre 0 et 1. Sensible aux outliers.",
        "applies_to": "numeric",
        "fixes": ["scale_difference"],
    },
    "robust_scale": {
        "label": "Mise à l'échelle robuste (médiane / IQR)",
        "description": "Utilise la médiane et l'IQR au lieu de la moyenne et l'écart-type. Résistant aux outliers.",
        "applies_to": "numeric",
        "fixes": ["scale_difference", "outliers"],
    },
    "diff": {
        "label": "Différenciation (Δ = xₜ − xₜ₋₁)",
        "description": "Élimine la tendance d'une série temporelle. Rend la série stationnaire.",
        "applies_to": "numeric",
        "fixes": ["non_stationary", "trend"],
    },
    "diff2": {
        "label": "Différenciation d'ordre 2",
        "description": "Double différenciation pour les tendances quadratiques.",
        "applies_to": "numeric",
        "fixes": ["non_stationary_strong"],
    },
    "seasonal_diff": {
        "label": "Différenciation saisonnière (Δₛ = xₜ − xₜ₋ₛ)",
        "description": "Supprime la composante saisonnière. La période est détectée automatiquement.",
        "applies_to": "numeric",
        "fixes": ["seasonality"],
    },
    "detrend": {
        "label": "Suppression de tendance linéaire",
        "description": "Ajuste une droite de régression et soustrait la tendance.",
        "applies_to": "numeric",
        "fixes": ["trend", "non_stationary"],
    },
    "winsorize": {
        "label": "Winsorisation (1er–99e percentile)",
        "description": "Remplace les valeurs extrêmes par les percentiles limites.",
        "applies_to": "numeric",
        "fixes": ["outliers"],
    },
    "rank": {
        "label": "Transformation en rangs",
        "description": "Remplace les valeurs par leur rang. Élimine l'effet des outliers et rend la distribution uniforme.",
        "applies_to": "numeric",
        "fixes": ["outliers", "non_normal", "skewness_positive", "skewness_negative"],
    },
}


# ── Moteur d'application des transformations ──────────────────────────

def apply_transform(
    series: pd.Series,
    transform_key: str,
    params: dict[str, Any] | None = None,
) -> tuple[pd.Series, dict[str, Any]]:
    """
    Applique une transformation à une Series pandas.
    Retourne (series_transformée, metadata).
    """
    params = params or {}
    meta: dict[str, Any] = {"transform": transform_key, "column": series.name}

    if transform_key == "log":
        if (series <= 0).any():
            # Décaler pour rendre positif
            shift = abs(series.min()) + 1
            meta["shift"] = float(shift)
            result = np.log10(series + shift)
        else:
            result = np.log10(series)

    elif transform_key == "log1p":
        if (series < 0).any():
            shift = abs(series.min()) + 1
            meta["shift"] = float(shift)
            result = np.log1p(series + shift)
        else:
            result = np.log1p(series)

    elif transform_key == "sqrt":
        if (series < 0).any():
            shift = abs(series.min())
            meta["shift"] = float(shift)
            result = np.sqrt(series + shift)
        else:
            result = np.sqrt(series)

    elif transform_key == "reciprocal":
        safe = series.replace(0, np.nan)
        result = 1.0 / safe

    elif transform_key == "square":
        result = series ** 2

    elif transform_key == "boxcox":
        from scipy.stats import boxcox as _boxcox
        vals = series.dropna()
        if (vals <= 0).any():
            shift = abs(vals.min()) + 1
            meta["shift"] = float(shift)
            vals = vals + shift
        transformed, lam = _boxcox(vals.values)
        meta["lambda"] = float(lam)
        result = pd.Series(np.nan, index=series.index, name=series.name)
        result.loc[vals.index] = transformed

    elif transform_key == "yeo_johnson":
        from scipy.stats import yeojohnson
        vals = series.dropna()
        transformed, lam = yeojohnson(vals.values)
        meta["lambda"] = float(lam)
        result = pd.Series(np.nan, index=series.index, name=series.name)
        result.loc[vals.index] = transformed

    elif transform_key == "standardize":
        mu = series.mean()
        sigma = series.std()
        meta["mean"] = float(mu) if pd.notna(mu) else 0
        meta["std"] = float(sigma) if pd.notna(sigma) and sigma != 0 else 1
        result = (series - mu) / (sigma if sigma != 0 else 1)

    elif transform_key == "minmax":
        vmin = series.min()
        vmax = series.max()
        meta["min"] = float(vmin) if pd.notna(vmin) else 0
        meta["max"] = float(vmax) if pd.notna(vmax) else 1
        rng = vmax - vmin
        result = (series - vmin) / (rng if rng != 0 else 1)

    elif transform_key == "robust_scale":
        med = series.median()
        q1 = series.quantile(0.25)
        q3 = series.quantile(0.75)
        iqr = q3 - q1
        meta["median"] = float(med) if pd.notna(med) else 0
        meta["iqr"] = float(iqr) if pd.notna(iqr) else 1
        result = (series - med) / (iqr if iqr != 0 else 1)

    elif transform_key == "diff":
        order = params.get("order", 1)
        result = series.diff(periods=int(order))

    elif transform_key == "diff2":
        result = series.diff().diff()

    elif transform_key == "seasonal_diff":
        period = params.get("period", 12)
        result = series.diff(periods=int(period))

    elif transform_key == "detrend":
        from scipy.signal import detrend as _detrend
        vals = series.dropna()
        detrended = _detrend(vals.values, type="linear")
        result = pd.Series(np.nan, index=series.index, name=series.name)
        result.loc[vals.index] = detrended

    elif transform_key == "winsorize":
        lower = params.get("lower", 0.01)
        upper = params.get("upper", 0.99)
        q_lo = series.quantile(lower)
        q_hi = series.quantile(upper)
        meta["lower_bound"] = float(q_lo) if pd.notna(q_lo) else None
        meta["upper_bound"] = float(q_hi) if pd.notna(q_hi) else None
        result = series.clip(lower=q_lo, upper=q_hi)

    elif transform_key == "rank":
        result = series.rank(method="average", na_option="keep")

    else:
        raise ValueError(f"Transformation inconnue : {transform_key}")

    result.name = series.name
    return result, meta


def apply_transforms_to_df(
    df: pd.DataFrame,
    transforms: list[dict[str, Any]],
) -> tuple[pd.DataFrame, list[dict[str, Any]]]:
    """
    Applique une liste de transformations à un DataFrame.
    Chaque item : {"column": str, "transform": str, "params": {...}}
    Retourne (df_transformé, logs).
    """
    df_out = df.copy()
    logs = []

    for t in transforms:
        col = t["column"]
        key = t["transform"]
        params = t.get("params", {})

        if col not in df_out.columns:
            logs.append({"column": col, "transform": key, "error": f"Colonne '{col}' introuvable"})
            continue

        info = TRANSFORM_CATALOG.get(key)
        if info is None:
            logs.append({"column": col, "transform": key, "error": f"Transformation '{key}' inconnue"})
            continue

        try:
            original_stats = {
                "mean": _safe_float(df_out[col].mean()),
                "std": _safe_float(df_out[col].std()),
                "skewness": _safe_float(df_out[col].skew()),
                "min": _safe_float(df_out[col].min()),
                "max": _safe_float(df_out[col].max()),
            }

            transformed, meta = apply_transform(df_out[col], key, params)
            new_col_name = t.get("new_column", f"{col}_{key}")
            df_out[new_col_name] = transformed

            new_stats = {
                "mean": _safe_float(df_out[new_col_name].mean()),
                "std": _safe_float(df_out[new_col_name].std()),
                "skewness": _safe_float(df_out[new_col_name].skew()),
                "min": _safe_float(df_out[new_col_name].min()),
                "max": _safe_float(df_out[new_col_name].max()),
            }

            logs.append({
                "column": col,
                "new_column": new_col_name,
                "transform": key,
                "label": info["label"],
                "meta": meta,
                "before": original_stats,
                "after": new_stats,
                "success": True,
            })
        except Exception as e:
            logs.append({
                "column": col,
                "transform": key,
                "error": str(e),
                "success": False,
            })

    return df_out, logs


# ── Recommandations automatiques ──────────────────────────────────────

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

    # ── 1. Asymétrie (skewness) ──
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

    # ── 2. Kurtosis (queues épaisses) ──
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

    # ── 3. Outliers (IQR) ──
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

    # ── 4. Échelles très différentes ──
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

    # ── 5. Multicolinéarité (VIF) ──
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

    # ── 6. Forte corrélation ──
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

    # ── 7. Stationnarité (séries temporelles) ──
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

        # Saisonnalité
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

    # Dédupliquer (une seule recommandation par (colonne, issue))
    seen = set()
    unique_recs = []
    for r in recommendations:
        key = (r["column"], r["issue"])
        if key not in seen:
            seen.add(key)
            unique_recs.append(r)

    # Trier par sévérité puis colonne
    severity_order = {"high": 0, "medium": 1, "low": 2}
    unique_recs.sort(key=lambda r: (severity_order.get(r["severity"], 9), r["column"]))

    return unique_recs


def get_transform_catalog() -> list[dict[str, Any]]:
    """Retourne le catalogue des transformations disponibles."""
    return [
        {"key": k, **{kk: vv for kk, vv in v.items()}}
        for k, v in TRANSFORM_CATALOG.items()
    ]


def _safe_float(v) -> float | None:
    if v is None or (isinstance(v, float) and (np.isnan(v) or np.isinf(v))):
        return None
    try:
        f = float(v)
        return round(f, 6) if not (np.isnan(f) or np.isinf(f)) else None
    except (TypeError, ValueError):
        return None
