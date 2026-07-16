"""
Module d'analyse statistique : descriptives, corrélations, tests d'hypothèses.
Phase 3 de la spécification.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats
from typing import Any


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

    corr = numeric_df.corr(method=method)

    # Identifier les corrélations significatives (|r| > 0.5)
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
        "matrix": corr.round(4).to_dict(),
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


# ── Tests d'hypothèses ────────────────────────────────────────────────

def run_normality_test(series: pd.Series) -> dict:
    """Test de normalité de Shapiro-Wilk."""
    clean = series.dropna()
    if len(clean) < 3 or len(clean) > 5000:
        # Shapiro-Wilk limité à 5000 obs ; utiliser un sous-échantillon
        clean = clean.sample(min(5000, len(clean)), random_state=42)

    stat, p_value = stats.shapiro(clean)
    return {
        "test": "Shapiro-Wilk",
        "statistic": _sf(stat),
        "p_value": _sf(p_value),
        "is_normal": p_value > 0.05,
        "interpretation": "Distribution normale" if p_value > 0.05 else "Distribution non-normale",
    }


def run_hypothesis_test(
    df: pd.DataFrame,
    test_type: str,
    group_col: str | None = None,
    value_col: str | None = None,
    col1: str | None = None,
    col2: str | None = None,
) -> dict:
    """
    Sélection automatique et exécution du test statistique adapté.
    test_type: "compare_means", "compare_proportions", "correlation", "independence"
    """
    result = {"test_type": test_type}

    if test_type == "compare_means" and group_col and value_col:
        result.update(_compare_means(df, group_col, value_col))

    elif test_type == "correlation" and col1 and col2:
        result.update(_test_correlation(df, col1, col2))

    elif test_type == "independence" and col1 and col2:
        result.update(_test_independence(df, col1, col2))

    return result


def _compare_means(df: pd.DataFrame, group_col: str, value_col: str) -> dict:
    """Compare les moyennes entre groupes avec sélection automatique du test."""
    groups = df.groupby(group_col)[value_col].apply(lambda x: x.dropna().values)
    group_list = [g for g in groups if len(g) >= 2]
    n_groups = len(group_list)

    if n_groups < 2:
        return {"error": "Il faut au moins 2 groupes avec des données suffisantes"}

    # Test de normalité sur chaque groupe
    all_normal = all(
        stats.shapiro(g[:5000] if len(g) > 5000 else g)[1] > 0.05
        for g in group_list
    )

    if n_groups == 2:
        # Test de Levene pour homoscédasticité
        _, levene_p = stats.levene(*group_list)
        equal_var = levene_p > 0.05

        if all_normal:
            stat, p_value = stats.ttest_ind(*group_list, equal_var=equal_var)
            test_name = "T-test de Student" + (" (Welch)" if not equal_var else "")
            # Taille d'effet : d de Cohen
            d = _cohen_d(group_list[0], group_list[1])
            effect_size = {"d_cohen": _sf(d), "interpretation": _interpret_cohen_d(d)}
        else:
            stat, p_value = stats.mannwhitneyu(*group_list, alternative="two-sided")
            test_name = "Test U de Mann-Whitney"
            n1, n2 = len(group_list[0]), len(group_list[1])
            r = 1 - (2 * stat) / (n1 * n2)
            effect_size = {"r": _sf(r), "interpretation": _correlation_strength(r)}
    else:
        if all_normal:
            stat, p_value = stats.f_oneway(*group_list)
            test_name = "ANOVA à un facteur"
            # Eta-carré
            all_values = np.concatenate(group_list)
            grand_mean = all_values.mean()
            ss_between = sum(len(g) * (g.mean() - grand_mean) ** 2 for g in group_list)
            ss_total = ((all_values - grand_mean) ** 2).sum()
            eta2 = ss_between / ss_total if ss_total > 0 else 0
            effect_size = {"eta_squared": _sf(eta2), "interpretation": _interpret_eta2(eta2)}
        else:
            stat, p_value = stats.kruskal(*group_list)
            test_name = "Test de Kruskal-Wallis"
            n = sum(len(g) for g in group_list)
            eta2_h = (stat - n_groups + 1) / (n - n_groups)
            effect_size = {"eta_squared_h": _sf(eta2_h)}

    return {
        "test": test_name,
        "statistic": _sf(stat),
        "p_value": _sf(p_value),
        "significant": bool(p_value < 0.05),
        "normality_assumed": all_normal,
        "effect_size": effect_size,
        "interpretation": _interpret_p_value(p_value, test_name),
    }


def _test_correlation(df: pd.DataFrame, col1: str, col2: str) -> dict:
    """Test de corrélation entre deux variables continues."""
    clean = df[[col1, col2]].dropna()
    if len(clean) < 3:
        return {"error": "Données insuffisantes"}

    # Vérifier normalité pour choisir Pearson vs Spearman
    _, p1 = stats.shapiro(clean[col1].values[:5000])
    _, p2 = stats.shapiro(clean[col2].values[:5000])
    both_normal = p1 > 0.05 and p2 > 0.05

    if both_normal:
        r, p_value = stats.pearsonr(clean[col1], clean[col2])
        test_name = "Corrélation de Pearson"
    else:
        r, p_value = stats.spearmanr(clean[col1], clean[col2])
        test_name = "Corrélation de Spearman"

    return {
        "test": test_name,
        "coefficient": _sf(r),
        "p_value": _sf(p_value),
        "significant": bool(p_value < 0.05),
        "strength": _correlation_strength(r),
        "effect_size": {"r": _sf(r), "interpretation": _correlation_strength(r)},
    }


def _test_independence(df: pd.DataFrame, col1: str, col2: str) -> dict:
    """Test d'indépendance Chi-carré pour deux variables catégorielles."""
    contingency = pd.crosstab(df[col1], df[col2])

    # Vérifier fréquences théoriques >= 5
    chi2, p_value, dof, expected = stats.chi2_contingency(contingency)
    min_expected = expected.min()

    if min_expected < 5 and contingency.shape == (2, 2):
        # Test exact de Fisher pour tables 2x2
        _, p_value = stats.fisher_exact(contingency)
        test_name = "Test exact de Fisher"
    else:
        test_name = "Chi-carré d'indépendance"

    # V de Cramér
    n = contingency.sum().sum()
    min_dim = min(contingency.shape[0] - 1, contingency.shape[1] - 1)
    cramers_v = np.sqrt(chi2 / (n * min_dim)) if min_dim > 0 and n > 0 else 0

    return {
        "test": test_name,
        "statistic": _sf(chi2),
        "p_value": _sf(p_value),
        "degrees_of_freedom": int(dof),
        "significant": bool(p_value < 0.05),
        "min_expected_frequency": _sf(min_expected),
        "effect_size": {"cramers_v": _sf(cramers_v), "interpretation": _interpret_cramers_v(cramers_v)},
    }


# ── Utilitaires ───────────────────────────────────────────────────────

def _cohen_d(group1: np.ndarray, group2: np.ndarray) -> float:
    n1, n2 = len(group1), len(group2)
    var1, var2 = group1.var(ddof=1), group2.var(ddof=1)
    pooled_std = np.sqrt(((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2))
    return (group1.mean() - group2.mean()) / pooled_std if pooled_std > 0 else 0


def _interpret_cohen_d(d: float) -> str:
    d = abs(d)
    if d < 0.2:
        return "négligeable"
    if d < 0.5:
        return "faible"
    if d < 0.8:
        return "modéré"
    return "grand"


def _interpret_eta2(eta2: float) -> str:
    if eta2 < 0.01:
        return "négligeable"
    if eta2 < 0.06:
        return "faible"
    if eta2 < 0.14:
        return "modéré"
    return "grand"


def _interpret_cramers_v(v: float) -> str:
    if v < 0.1:
        return "négligeable"
    if v < 0.3:
        return "faible"
    if v < 0.5:
        return "modéré"
    return "fort"


def _correlation_strength(r: float) -> str:
    r = abs(r)
    if r < 0.1:
        return "négligeable"
    if r < 0.3:
        return "faible"
    if r < 0.5:
        return "modéré"
    return "fort"


def _interpret_p_value(p: float, test_name: str) -> str:
    if p < 0.001:
        return f"Différence très hautement significative ({test_name}, p < 0.001)"
    if p < 0.01:
        return f"Différence hautement significative ({test_name}, p < 0.01)"
    if p < 0.05:
        return f"Différence significative ({test_name}, p < 0.05)"
    return f"Différence non significative ({test_name}, p = {_sf(p)})"


def _sf(val) -> float | None:
    """Safe float conversion."""
    if val is None or (isinstance(val, float) and np.isnan(val)):
        return None
    return round(float(val), 6)
