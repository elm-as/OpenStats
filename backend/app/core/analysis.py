"""
Module d'analyse statistique : descriptives, corrélations, tests d'hypothèses.
Phase 3 de la spécification.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats
from app.core.hypothesis_testing import (
    _sf,
    _correlation_strength,
    run_normality_test,
    run_hypothesis_test,
)
from app.core.auto_pipeline.heuristics import _is_temporal, _is_id_like


# ── Statistiques descriptives ──────────────────────────────────────────

def compute_descriptive_stats(df: pd.DataFrame, bootstrap_ci: bool = False, n_bootstrap: int = 1000) -> dict[str, Any]:
    """Calcule les statistiques descriptives complètes pour chaque variable.
    Si bootstrap_ci=True, ajoute des intervalles de confiance bootstrap sur mean/median/std.
    """
    results = {}

    for col in df.columns:
        series = df[col]
        col_stats = {"name": col, "dtype": str(series.dtype)}

        if _is_temporal(series, name=col):
            valid = series.dropna()
            col_stats.update({
                "type": "temporal",
                "count": int(valid.count()),
                "min": str(valid.min()) if not valid.empty else None,
                "max": str(valid.max()) if not valid.empty else None,
                "periods_count": int(valid.nunique()),
                "null_count": int(series.isna().sum()),
                "null_rate": _sf(series.isna().mean()),
            })
        elif _is_id_like(series, col_name=col):
            valid = series.dropna()
            col_stats.update({
                "type": "id",
                "count": int(valid.count()),
                "cardinality": int(valid.nunique()),
                "uniqueness_rate": _sf(valid.nunique() / max(len(valid), 1)),
                "null_count": int(series.isna().sum()),
                "null_rate": _sf(series.isna().mean()),
            })
        elif pd.api.types.is_numeric_dtype(series):
            valid = series.dropna()
            col_stats.update({
                "type": "numeric",
                "count": int(valid.count()),
                "mean": _sf(valid.mean()),
                "median": _sf(valid.median()),
                "mode": _sf(valid.mode().iloc[0]) if not valid.mode().empty else None,
                "std": _sf(valid.std()),
                "variance": _sf(valid.var()),
                "min": _sf(valid.min()),
                "max": _sf(valid.max()),
                "range": _sf(valid.max() - valid.min()),
                "q1": _sf(valid.quantile(0.25)),
                "q3": _sf(valid.quantile(0.75)),
                "iqr": _sf(valid.quantile(0.75) - valid.quantile(0.25)),
                "cv": _sf(valid.std() / valid.mean() * 100) if valid.mean() != 0 else None,
                "skewness": _sf(valid.skew()),
                "kurtosis": _sf(valid.kurtosis()),
                "null_count": int(series.isna().sum()),
                "null_rate": _sf(series.isna().mean()),
            })

            if bootstrap_ci and len(valid) >= 10:
                from app.core.bootstrap import bootstrap_descriptive
                col_stats["confidence_intervals"] = bootstrap_descriptive(
                    series, n_bootstrap=n_bootstrap
                )
        else:
            value_counts = series.value_counts()
            col_stats.update({
                "type": "categorical",
                "count": int(series.count()),
                "cardinality": int(series.nunique()),
                "mode": str(value_counts.index[0]) if not value_counts.empty else None,
                "mode_frequency": int(value_counts.iloc[0]) if not value_counts.empty else 0,
                "top_values": {str(k): int(v) for k, v in value_counts.head(10).items()},
                "null_count": int(series.isna().sum()),
                "null_rate": _sf(series.isna().mean()),
            })

        results[col] = col_stats

    return results


# ── Corrélations ───────────────────────────────────────────────────────

def compute_correlation_matrix(df: pd.DataFrame, method: str = "pearson", bootstrap_ci: bool = False, n_bootstrap: int = 500) -> dict:
    """
    Calcule la matrice de corrélation.
    method: "pearson" ou "spearman"
    Exclut les identifiants techniques et isole les tendances temporelles.
    """
    numeric_df = df.select_dtypes(include=[np.number])
    if numeric_df.empty:
        return {"matrix": {}, "columns": [], "method": method, "significant_pairs": [], "temporal_trends": []}

    id_cols = [c for c in numeric_df.columns if _is_id_like(numeric_df[c], col_name=c)]
    temporal_cols = [c for c in numeric_df.columns if _is_temporal(numeric_df[c], name=c)]

    feature_df = numeric_df.drop(columns=id_cols, errors="ignore")
    pure_numeric_cols = [c for c in feature_df.columns if c not in temporal_cols]

    temporal_trends = []
    if temporal_cols and pure_numeric_cols:
        t_col = temporal_cols[0]
        for c in pure_numeric_cols:
            s_clean = feature_df[[t_col, c]].dropna()
            if len(s_clean) >= 3:
                r_val = s_clean[t_col].corr(s_clean[c], method=method)
                if pd.notna(r_val):
                    temporal_trends.append({
                        "variable": c,
                        "time_col": t_col,
                        "coefficient": _sf(r_val),
                        "direction": "croissante" if r_val > 0.3 else "décroissante" if r_val < -0.3 else "stable",
                        "strength": _correlation_strength(r_val),
                    })

    corr_target_df = feature_df[pure_numeric_cols] if len(pure_numeric_cols) >= 2 else feature_df
    if corr_target_df.empty:
        corr_target_df = feature_df

    if method == "spearman" and len(corr_target_df) > 15000:
        sample_df = corr_target_df.sample(15000, random_state=42)
        corr = sample_df.corr(method=method)
    elif len(corr_target_df) > 30000:
        sample_df = corr_target_df.sample(30000, random_state=42)
        corr = sample_df.corr(method=method)
    else:
        corr = corr_target_df.corr(method=method)

    significant = []
    cols = corr.columns.tolist()
    for i in range(len(cols)):
        for j in range(i + 1, len(cols)):
            r = corr.iloc[i, j]
            if abs(r) > 0.3:
                significant.append({
                    "var1": cols[i],
                    "var2": cols[j],
                    "coefficient": _sf(r),
                    "strength": _correlation_strength(r),
                })

    result = {
        "matrix": corr.where(corr.notna(), None).round(4).to_dict(),
        "columns": cols,
        "method": method,
        "significant_pairs": sorted(significant, key=lambda x: abs(x["coefficient"]), reverse=True),
        "temporal_trends": temporal_trends,
    }

    if bootstrap_ci and len(corr_target_df) >= 20:
        from app.core.bootstrap import bootstrap_correlation
        ci_data = bootstrap_correlation(corr_target_df, method=method, n_bootstrap=n_bootstrap)
        result["ci_lower"] = ci_data["ci_lower"]
        result["ci_upper"] = ci_data["ci_upper"]
        result["ci_level"] = ci_data["ci_level"]

    return result


def compute_vif(df: pd.DataFrame) -> list[dict]:
    """Calcule le VIF (Variance Inflation Factor) pour chaque variable explicative.
    Exclut automatiquement les index temporels et identifiants pour éviter les fausses collinéarités."""
    from sklearn.linear_model import LinearRegression

    numeric_df = df.select_dtypes(include=[np.number]).dropna()
    if numeric_df.shape[1] < 2:
        return []

    id_cols = [c for c in numeric_df.columns if _is_id_like(numeric_df[c], col_name=c)]
    temporal_cols = [c for c in numeric_df.columns if _is_temporal(numeric_df[c], name=c)]
    drop_candidates = id_cols + temporal_cols
    remaining_cols = [c for c in numeric_df.columns if c not in drop_candidates]

    target_df = numeric_df[remaining_cols] if len(remaining_cols) >= 2 else numeric_df.drop(columns=id_cols, errors="ignore")
    if target_df.shape[1] < 2:
        return []

    if len(target_df) > 10000:
        target_df = target_df.sample(10000, random_state=42)

    vifs = []
    cols = target_df.columns.tolist()
    X = target_df.values

    for i, col in enumerate(cols):
        y = X[:, i]
        X_others = np.delete(X, i, axis=1)
        if X_others.shape[1] == 0:
            continue
        reg = LinearRegression().fit(X_others, y)
        r_squared = reg.score(X_others, y)
        vif = 1 / (1 - r_squared) if r_squared < 1 else float("inf")
        vifs.append({
            "variable": col,
            "vif": round(vif, 2),
            "multicollinearity": "severe" if vif > 10 else "moderate" if vif > 5 else "low",
        })

    return sorted(vifs, key=lambda x: x["vif"], reverse=True)





