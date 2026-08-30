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
    _cohen_d,
    _interpret_cohen_d,
    _interpret_eta2,
    _interpret_cramers_v,
    _interpret_p_value,
    run_normality_test,
    run_hypothesis_test,
    _compare_means,
    _test_correlation,
    _test_independence,
)


# ── Statistiques descriptives ──────────────────────────────────────────

def compute_descriptive_stats(df: pd.DataFrame, bootstrap_ci: bool = False, n_bootstrap: int = 1000) -> dict[str, Any]:
    """Calcule les statistiques descriptives complètes pour chaque variable.
    Si bootstrap_ci=True, ajoute des intervalles de confiance bootstrap sur mean/median/std.
    """
    results = {}

    for col in df.columns:
        series = df[col]
        col_stats = {"name": col, "dtype": str(series.dtype)}

        if pd.api.types.is_numeric_dtype(series):
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
    Si bootstrap_ci=True, ajoute les IC bootstrap.
    """
    numeric_df = df.select_dtypes(include=[np.number])
    if numeric_df.empty:
        return {"matrix": {}, "columns": [], "method": method}

    # Optimisation grands jeux de données (> 100k+ lignes) : sous-échantillonnage statistique
    if method == "spearman" and len(numeric_df) > 15000:
        sample_df = numeric_df.sample(15000, random_state=42)
        corr = sample_df.corr(method=method)
    elif len(numeric_df) > 30000:
        sample_df = numeric_df.sample(30000, random_state=42)
        corr = sample_df.corr(method=method)
    else:
        corr = numeric_df.corr(method=method)

    # Identifier les corrélations significatives (|r| > 0.3)
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
    }

    if bootstrap_ci and len(numeric_df) >= 20:
        from app.core.bootstrap import bootstrap_correlation
        ci_data = bootstrap_correlation(numeric_df, method=method, n_bootstrap=n_bootstrap)
        result["ci_lower"] = ci_data["ci_lower"]
        result["ci_upper"] = ci_data["ci_upper"]
        result["ci_level"] = ci_data["ci_level"]

    return result


def compute_vif(df: pd.DataFrame) -> list[dict]:
    """Calcule le VIF (Variance Inflation Factor) pour chaque variable."""
    from sklearn.linear_model import LinearRegression

    numeric_df = df.select_dtypes(include=[np.number]).dropna()
    if numeric_df.shape[1] < 2:
        return []

    # Optimisation pour grands jeux de données : 10k lignes suffisent pour un VIF exact à 2 décimales
    if len(numeric_df) > 10000:
        numeric_df = numeric_df.sample(10000, random_state=42)

    vifs = []
    cols = numeric_df.columns.tolist()
    X = numeric_df.values

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





