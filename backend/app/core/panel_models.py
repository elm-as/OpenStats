"""
Modèles économétriques pour données de panel :
- Pooled OLS (avec erreurs clusterisées par entité)
- Fixed Effects / Within (effets fixes individuels)
- Random Effects / GLS (effets aléatoires)
- Test de spécification de Hausman (FE vs RE)
"""

from __future__ import annotations

import logging
from typing import Any
import numpy as np
import pandas as pd
from scipy import stats
import statsmodels.api as sm

logger = logging.getLogger(__name__)


def _sf(val: Any) -> float | None:
    if val is None or (isinstance(val, float) and (np.isnan(val) or np.isinf(val))):
        return None
    return round(float(val), 6)


def fit_panel_models(
    df: pd.DataFrame,
    entity_col: str,
    time_col: str,
    target_col: str,
    covariates: list[str],
) -> dict[str, Any]:
    """
    Estime les modèles de panel Pooled OLS, Fixed Effects (Within) et Random Effects (GLS),
    puis exécute le test de spécification de Hausman.
    """
    valid_cols = [entity_col, time_col, target_col] + covariates
    sub = df[valid_cols].dropna().copy()

    if len(sub) < 15:
        return {"error": "Échantillon insuffisant pour une régression de panel (minimum 15 observations)."}

    # Tri par entité et temps
    sub = sub.sort_values(by=[entity_col, time_col]).reset_index(drop=True)
    n_obs = len(sub)
    n_entities = sub[entity_col].nunique()
    periods_per_entity = sub.groupby(entity_col)[time_col].count()
    is_balanced = bool(periods_per_entity.nunique() == 1)

    y = sub[target_col].astype(float)
    X = sub[covariates].astype(float)

    # ── 1. Pooled OLS ──────────────────────────────────────────────────────────
    X_pooled = sm.add_constant(X, has_constant="add")
    pooled_fit = sm.OLS(y, X_pooled).fit()
    # Erreurs-types clusterisées par entité
    try:
        pooled_cluster = pooled_fit.get_robustcov_results(cov_type="cluster", groups=sub[entity_col])
    except Exception:
        pooled_cluster = pooled_fit

    pooled_bse = np.asarray(pooled_cluster.bse)
    pooled_tvals = np.asarray(pooled_cluster.tvalues)
    pooled_pvals = np.asarray(pooled_cluster.pvalues)
    pooled_params = np.asarray(pooled_fit.params)

    pooled_coefs = []
    for i, col in enumerate(X_pooled.columns):
        p_val = float(pooled_pvals[i])
        pooled_coefs.append({
            "variable": col,
            "coefficient": _sf(pooled_params[i]),
            "std_error": _sf(pooled_bse[i]),
            "t_statistic": _sf(pooled_tvals[i]),
            "p_value": _sf(p_val),
            "significant": bool(p_val < 0.05),
        })

    # ── 2. Fixed Effects (Within Estimator) ───────────────────────────────────
    # Transformation intra (Demeaning)
    y_mean = sub.groupby(entity_col)[target_col].transform("mean")
    y_within = y - y_mean

    X_within = pd.DataFrame(index=sub.index)
    time_variant_covs = []
    for col in covariates:
        col_mean = sub.groupby(entity_col)[col].transform("mean")
        diff = X[col] - col_mean
        if diff.var() > 1e-10:
            X_within[col] = diff
            time_variant_covs.append(col)

    if X_within.empty:
        return {"error": "Aucune covariable ne varie au cours du temps au sein des entités (FE impossible)."}

    # Régression Within sans constante
    fe_fit = sm.OLS(y_within, X_within).fit()
    # Correction des degrés de liberté pour FE : df_resid = N*T - N - K
    df_fe_resid = max(1, n_obs - n_entities - len(time_variant_covs))
    sigma2_fe = float(np.sum(fe_fit.resid ** 2) / df_fe_resid)
    fe_cov_matrix = np.linalg.pinv(X_within.T @ X_within) * sigma2_fe
    fe_se = np.sqrt(np.diag(fe_cov_matrix))

    fe_coefs = []
    for i, col in enumerate(time_variant_covs):
        b = float(fe_fit.params[col])
        se = float(fe_se[i])
        t_stat = b / se if se > 0 else 0.0
        p_val = float(2 * (1 - stats.t.cdf(abs(t_stat), df=df_fe_resid)))
        fe_coefs.append({
            "variable": col,
            "coefficient": _sf(b),
            "std_error": _sf(se),
            "t_statistic": _sf(t_stat),
            "p_value": _sf(p_val),
            "significant": p_val < 0.05,
        })

    # ── 3. Random Effects (GLS Swamy-Arora) ───────────────────────────────────
    # Estimation de la variance inter (Between)
    y_between = sub.groupby(entity_col)[target_col].mean()
    X_between = sm.add_constant(sub.groupby(entity_col)[time_variant_covs].mean(), has_constant="add")
    between_fit = sm.OLS(y_between, X_between).fit()
    sigma2_between = float(np.sum(between_fit.resid ** 2) / max(1, n_entities - len(time_variant_covs) - 1))

    t_bar = float(periods_per_entity.mean())
    sigma2_u = max(0.0, (sigma2_between - sigma2_fe / t_bar))
    theta = float(1.0 - np.sqrt(sigma2_fe / max(1e-8, (sigma2_fe + t_bar * sigma2_u)))) if sigma2_fe + t_bar * sigma2_u > 0 else 0.0

    y_re = y - theta * y_mean
    X_re_dict = {}
    for col in time_variant_covs:
        col_mean = sub.groupby(entity_col)[col].transform("mean")
        X_re_dict[col] = X[col] - theta * col_mean
    X_re_dict["const"] = 1.0 - theta
    X_re = pd.DataFrame(X_re_dict, index=sub.index)

    re_fit = sm.OLS(y_re, X_re).fit()
    re_coefs = []
    for col in time_variant_covs:
        b = float(re_fit.params[col])
        se = float(re_fit.bse[col])
        t_stat = float(re_fit.tvalues[col])
        p_val = float(re_fit.pvalues[col])
        re_coefs.append({
            "variable": col,
            "coefficient": _sf(b),
            "std_error": _sf(se),
            "t_statistic": _sf(t_stat),
            "p_value": _sf(p_val),
            "significant": p_val < 0.05,
        })

    # ── 4. Test de Spécification de Hausman ──────────────────────────────────
    try:
        b_diff = np.array([fe_fit.params[c] - re_fit.params[c] for c in time_variant_covs])
        re_cov_sub = re_fit.cov_params().loc[time_variant_covs, time_variant_covs].values
        v_diff = fe_cov_matrix - re_cov_sub

        hausman_stat = float(b_diff.T @ np.linalg.pinv(v_diff) @ b_diff)
        hausman_stat = max(0.0, hausman_stat)
        df_hausman = len(time_variant_covs)
        hausman_p = float(1.0 - stats.chi2.cdf(hausman_stat, df=df_hausman))
        prefer_fe = hausman_p < 0.05
    except Exception as e:
        logger.warning("Erreur calcul test Hausman: %s", e)
        hausman_stat = 0.0
        hausman_p = 1.0
        prefer_fe = False

    return {
        "entity_column": entity_col,
        "time_column": time_col,
        "target_column": target_col,
        "n_observations": n_obs,
        "n_entities": n_entities,
        "is_balanced": is_balanced,
        "pooled_ols": {
            "coefficients": pooled_coefs,
            "r2": _sf(pooled_fit.rsquared),
            "r2_adjusted": _sf(pooled_fit.rsquared_adj),
            "f_statistic": _sf(pooled_fit.fvalue),
            "aic": _sf(pooled_fit.aic),
            "bic": _sf(pooled_fit.bic),
        },
        "fixed_effects": {
            "coefficients": fe_coefs,
            "r2_within": _sf(fe_fit.rsquared),
            "df_residuals": int(df_fe_resid),
            "sigma2_fe": _sf(sigma2_fe),
        },
        "random_effects": {
            "coefficients": re_coefs,
            "r2_overall": _sf(re_fit.rsquared),
            "theta_weight": _sf(theta),
            "sigma2_u": _sf(sigma2_u),
        },
        "hausman_test": {
            "statistic": _sf(hausman_stat),
            "p_value": _sf(hausman_p),
            "degrees_of_freedom": int(len(time_variant_covs)),
            "prefer_fixed_effects": bool(prefer_fe),
            "conclusion": (
                f"Rejet de H0 (p={_sf(hausman_p)}) : Les effets aléatoires sont corrélés avec les régresseurs. "
                "Le modèle à Effets Fixes (Within) est convergent et recommandé."
                if prefer_fe
                else f"H0 non rejetée (p={_sf(hausman_p)}) : Les effets aléatoires ne sont pas corrélés. "
                "Le modèle à Effets Aléatoires (GLS) est plus efficace."
            ),
        },
    }
