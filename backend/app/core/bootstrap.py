"""
Module Bootstrap pour l'estimation d'intervalles de confiance.
Fournit des fonctions génériques et spécialisées pour calculer
des IC sur n'importe quelle statistique via rééchantillonnage.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from typing import Callable


def bootstrap_statistic(
    data: np.ndarray,
    stat_func: Callable[[np.ndarray], float],
    n_bootstrap: int = 1000,
    ci: float = 0.95,
    seed: int = 42,
) -> dict:
    """
    Bootstrap générique pour n'importe quelle statistique scalaire.

    Args:
        data: tableau 1D de données
        stat_func: fonction qui prend un array et retourne un scalaire
        n_bootstrap: nombre de rééchantillonnages
        ci: niveau de confiance (défaut 0.95)
        seed: graine pour reproductibilité

    Returns:
        dict avec point_estimate, ci_lower, ci_upper, ci_level, se, distribution
    """
    rng = np.random.RandomState(seed)
    n = len(data)
    point_estimate = float(stat_func(data))

    boot_stats = np.empty(n_bootstrap)
    for i in range(n_bootstrap):
        sample = data[rng.randint(0, n, size=n)]
        boot_stats[i] = stat_func(sample)

    alpha = 1 - ci
    ci_lower = float(np.nanpercentile(boot_stats, 100 * alpha / 2))
    ci_upper = float(np.nanpercentile(boot_stats, 100 * (1 - alpha / 2)))
    se = float(np.nanstd(boot_stats))

    return {
        "point_estimate": point_estimate,
        "ci_lower": ci_lower,
        "ci_upper": ci_upper,
        "ci_level": ci,
        "se": se,
        "method": "bootstrap_percentile",
    }


def bootstrap_correlation(
    df: pd.DataFrame,
    method: str = "pearson",
    n_bootstrap: int = 1000,
    ci: float = 0.95,
    seed: int = 42,
) -> dict:
    """
    Calcule les IC bootstrap sur la matrice de corrélation.

    Returns:
        dict avec matrix (point estimates), ci_lower, ci_upper (matrices)
    """
    numeric = df.select_dtypes(include="number").dropna()
    cols = numeric.columns.tolist()
    n = len(numeric)
    rng = np.random.RandomState(seed)

    values = numeric.values
    point_corr = np.corrcoef(values, rowvar=False) if method == "pearson" else _rank_corr(values)

    boot_corrs = np.empty((n_bootstrap, len(cols), len(cols)))
    for b in range(n_bootstrap):
        idx = rng.randint(0, n, size=n)
        sample = values[idx]
        if method == "pearson":
            boot_corrs[b] = np.corrcoef(sample, rowvar=False)
        else:
            boot_corrs[b] = _rank_corr(sample)

    alpha = 1 - ci
    ci_lower = np.nanpercentile(boot_corrs, 100 * alpha / 2, axis=0)
    ci_upper = np.nanpercentile(boot_corrs, 100 * (1 - alpha / 2), axis=0)

    def _to_dict_matrix(m):
        return {c: {c2: round(float(m[i, j]), 4) for j, c2 in enumerate(cols)} for i, c in enumerate(cols)}

    return {
        "columns": cols,
        "matrix": _to_dict_matrix(point_corr),
        "ci_lower": _to_dict_matrix(ci_lower),
        "ci_upper": _to_dict_matrix(ci_upper),
        "ci_level": ci,
        "n_bootstrap": n_bootstrap,
        "method": f"{method}_bootstrap",
    }


def _rank_corr(values: np.ndarray) -> np.ndarray:
    """Spearman via rangs."""
    from scipy.stats import rankdata
    ranked = np.apply_along_axis(rankdata, 0, values)
    return np.corrcoef(ranked, rowvar=False)


def bootstrap_regression_coefs(
    X: np.ndarray,
    y: np.ndarray,
    model_class,
    n_bootstrap: int = 500,
    ci: float = 0.95,
    seed: int = 42,
    feature_names: list[str] | None = None,
) -> dict:
    """
    IC bootstrap sur les coefficients de régression.

    Args:
        X: matrice des features (n_samples, n_features)
        y: vecteur cible
        model_class: classe sklearn (ex: LinearRegression)
        n_bootstrap: nombre de rééchantillonnages
        ci: niveau de confiance
        feature_names: noms des features

    Returns:
        dict avec coefficients, ci_lower, ci_upper par feature
    """
    rng = np.random.RandomState(seed)
    n = X.shape[0]
    n_features = X.shape[1]
    names = feature_names or [f"x{i}" for i in range(n_features)]

    # Point estimate
    model = model_class()
    model.fit(X, y)
    point_coefs = model.coef_ if hasattr(model, "coef_") else np.zeros(n_features)
    if point_coefs.ndim > 1:
        point_coefs = point_coefs.flatten()

    boot_coefs = np.empty((n_bootstrap, n_features))
    for b in range(n_bootstrap):
        idx = rng.randint(0, n, size=n)
        m = model_class()
        m.fit(X[idx], y[idx])
        c = m.coef_ if hasattr(m, "coef_") else np.zeros(n_features)
        boot_coefs[b] = c.flatten() if c.ndim > 1 else c

    alpha = 1 - ci
    result = {}
    for i, name in enumerate(names):
        result[name] = {
            "coefficient": round(float(point_coefs[i]), 6),
            "ci_lower": round(float(np.nanpercentile(boot_coefs[:, i], 100 * alpha / 2)), 6),
            "ci_upper": round(float(np.nanpercentile(boot_coefs[:, i], 100 * (1 - alpha / 2))), 6),
            "se": round(float(np.nanstd(boot_coefs[:, i])), 6),
        }

    return {
        "coefficients": result,
        "ci_level": ci,
        "n_bootstrap": n_bootstrap,
        "method": "bootstrap_percentile",
    }


def bootstrap_metric(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    metric_func: Callable,
    n_bootstrap: int = 1000,
    ci: float = 0.95,
    seed: int = 42,
) -> dict:
    """
    IC bootstrap sur une métrique de performance.

    Args:
        y_true, y_pred: vecteurs réalité/prédiction
        metric_func: ex: sklearn.metrics.r2_score
        n_bootstrap: rééchantillonnages
        ci: niveau de confiance
    """
    rng = np.random.RandomState(seed)
    n = len(y_true)
    point = float(metric_func(y_true, y_pred))

    boot_metrics = np.empty(n_bootstrap)
    for b in range(n_bootstrap):
        idx = rng.randint(0, n, size=n)
        boot_metrics[b] = metric_func(y_true[idx], y_pred[idx])

    alpha = 1 - ci
    return {
        "point_estimate": round(point, 6),
        "ci_lower": round(float(np.nanpercentile(boot_metrics, 100 * alpha / 2)), 6),
        "ci_upper": round(float(np.nanpercentile(boot_metrics, 100 * (1 - alpha / 2))), 6),
        "se": round(float(np.nanstd(boot_metrics)), 6),
        "ci_level": ci,
        "method": "bootstrap_percentile",
    }


def bootstrap_pca_loadings(
    df: pd.DataFrame,
    n_components: int = 2,
    columns: list[str] | None = None,
    n_bootstrap: int = 500,
    ci: float = 0.95,
    seed: int = 42,
) -> dict:
    """
    IC bootstrap sur les loadings et la variance expliquée de l'ACP.

    Returns:
        dict avec loadings (point + CI), explained_variance (point + CI)
    """
    from sklearn.decomposition import PCA
    from sklearn.preprocessing import StandardScaler

    rng = np.random.RandomState(seed)

    if columns:
        data = df[columns].select_dtypes(include="number").dropna()
    else:
        data = df.select_dtypes(include="number").dropna()

    cols = data.columns.tolist()
    n = len(data)
    values = StandardScaler().fit_transform(data.values)
    n_comp = min(n_components, len(cols), n)

    # Point estimate
    pca = PCA(n_components=n_comp)
    pca.fit(values)
    point_loadings = pca.components_  # (n_comp, n_features)
    point_var = pca.explained_variance_ratio_

    boot_loadings = np.empty((n_bootstrap, n_comp, len(cols)))
    boot_var = np.empty((n_bootstrap, n_comp))

    for b in range(n_bootstrap):
        idx = rng.randint(0, n, size=n)
        sample = values[idx]
        p = PCA(n_components=n_comp)
        p.fit(sample)
        # Aligner les signes pour la comparabilité
        for c in range(n_comp):
            if np.dot(p.components_[c], point_loadings[c]) < 0:
                p.components_[c] *= -1
        boot_loadings[b] = p.components_
        boot_var[b] = p.explained_variance_ratio_

    alpha = 1 - ci
    loadings_result = {}
    for c in range(n_comp):
        comp_name = f"PC{c + 1}"
        loadings_result[comp_name] = {}
        for j, col in enumerate(cols):
            loadings_result[comp_name][col] = {
                "loading": round(float(point_loadings[c, j]), 4),
                "ci_lower": round(float(np.nanpercentile(boot_loadings[:, c, j], 100 * alpha / 2)), 4),
                "ci_upper": round(float(np.nanpercentile(boot_loadings[:, c, j], 100 * (1 - alpha / 2))), 4),
            }

    variance_result = {}
    for c in range(n_comp):
        variance_result[f"PC{c + 1}"] = {
            "explained_variance_ratio": round(float(point_var[c]), 4),
            "ci_lower": round(float(np.nanpercentile(boot_var[:, c], 100 * alpha / 2)), 4),
            "ci_upper": round(float(np.nanpercentile(boot_var[:, c], 100 * (1 - alpha / 2))), 4),
        }

    return {
        "loadings": loadings_result,
        "explained_variance": variance_result,
        "ci_level": ci,
        "n_bootstrap": n_bootstrap,
        "method": "bootstrap_percentile",
    }


def bootstrap_descriptive(
    series: pd.Series,
    n_bootstrap: int = 1000,
    ci: float = 0.95,
    seed: int = 42,
) -> dict:
    """
    IC bootstrap sur moyenne, médiane, écart-type d'une série numérique.
    """
    data = series.dropna().values
    if len(data) < 10:
        return {}

    result = {}
    for stat_name, func in [
        ("mean", np.mean),
        ("median", np.median),
        ("std", np.std),
    ]:
        r = bootstrap_statistic(data, func, n_bootstrap=n_bootstrap, ci=ci, seed=seed)
        result[stat_name] = {
            "point_estimate": round(r["point_estimate"], 6),
            "ci_lower": round(r["ci_lower"], 6),
            "ci_upper": round(r["ci_upper"], 6),
            "se": round(r["se"], 6),
        }

    return {
        "bootstrap_ci": result,
        "ci_level": ci,
        "n_bootstrap": n_bootstrap,
        "n_obs": len(data),
    }
