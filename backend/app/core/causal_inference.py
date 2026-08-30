"""
Module d'inférence causale :
- Diff-in-Diff (Difference-in-Differences)
- Variables Instrumentales (2SLS)
- Propensity Score Matching (PSM) avec diagnostic de balance (Love plot)
"""

from __future__ import annotations

import logging
from typing import Any
import numpy as np
import pandas as pd
from scipy import stats
from sklearn.linear_model import LogisticRegression
from sklearn.neighbors import NearestNeighbors

logger = logging.getLogger(__name__)


def compute_standardized_mean_difference(
    x_treat: np.ndarray,
    x_ctrl: np.ndarray,
) -> float:
    """Calcule la différence moyenne standardisée (SMD) entre deux groupes."""
    mean_t, mean_c = np.mean(x_treat), np.mean(x_ctrl)
    var_t, var_c = np.var(x_treat, ddof=1), np.var(x_ctrl, ddof=1)
    pooled_sd = np.sqrt(max(1e-8, (var_t + var_c) / 2.0))
    return float(round((mean_t - mean_c) / pooled_sd, 4))


def run_propensity_score_matching(
    df: pd.DataFrame,
    treatment_col: str,
    outcome_col: str,
    covariates: list[str] | None = None,
    caliper: float = 0.2,
) -> dict[str, Any]:
    """
    Appariement sur score de propension (PSM 1:1 au plus proche voisin).
    """
    num_df = df.select_dtypes(include=[np.number])
    if covariates:
        valid_covs = [c for c in covariates if c in num_df.columns and c not in (treatment_col, outcome_col)]
    else:
        valid_covs = [c for c in num_df.columns if c not in (treatment_col, outcome_col)][:8]

    if not valid_covs:
        return {"status": "error", "message": "Au moins une covariable numérique est requise pour le PSM."}

    sub = df[[treatment_col, outcome_col] + valid_covs].dropna().copy()
    treat = sub[treatment_col].values
    if len(np.unique(treat)) != 2:
        return {"status": "error", "message": "La variable de traitement doit comporter exactement 2 valeurs (0/1)."}

    # 1. Estimation du score de propension par régression logistique
    X_covs = sub[valid_covs].values
    clf = LogisticRegression(max_iter=500, random_state=42)
    try:
        clf.fit(X_covs, treat)
        propensity_scores = clf.predict_proba(X_covs)[:, 1]
    except Exception as e:
        logger.exception("Erreur lors de l'ajustement du score de propension: %s", e)
        return {"status": "error", "message": f"Erreur calcul score de propension: {e}"}

    sub["_propensity"] = propensity_scores

    treated_idx = sub[sub[treatment_col] == 1].index
    control_idx = sub[sub[treatment_col] == 0].index

    if len(treated_idx) < 3 or len(control_idx) < 3:
        return {"status": "error", "message": "Effectif insuffisant dans les groupes traité ou témoin."}

    ps_treated = sub.loc[treated_idx, "_propensity"].values.reshape(-1, 1)
    ps_control = sub.loc[control_idx, "_propensity"].values.reshape(-1, 1)

    # Caliper basé sur l'écart-type du logit du score de propension
    ps_std = np.std(propensity_scores)
    max_distance = caliper * (ps_std if ps_std > 0 else 0.2)

    # 2. Appariement 1:1 au plus proche voisin
    nn = NearestNeighbors(n_neighbors=1, metric="euclidean")
    nn.fit(ps_control)
    distances, indices = nn.kneighbors(ps_treated)

    matched_pairs = []
    matched_treat_y = []
    matched_ctrl_y = []
    matched_ctrl_indices = []

    for t_i, (dist, c_i) in enumerate(zip(distances, indices)):
        if dist[0] <= max_distance:
            orig_t = treated_idx[t_i]
            orig_c = control_idx[c_i[0]]
            matched_pairs.append((orig_t, orig_c))
            matched_treat_y.append(sub.loc[orig_t, outcome_col])
            matched_ctrl_y.append(sub.loc[orig_c, outcome_col])
            matched_ctrl_indices.append(orig_c)

    n_matched = len(matched_pairs)
    if n_matched < 2:
        return {
            "status": "error",
            "message": "Nombre d'appariements sous l'étrier trop faible. Essayez d'augmenter le caliper.",
        }

    # 3. Calcul de l'ATT (Average Treatment Effect on the Treated)
    diffs = np.array(matched_treat_y) - np.array(matched_ctrl_y)
    att = float(np.mean(diffs))
    se_att = float(np.std(diffs, ddof=1) / np.sqrt(n_matched))
    t_stat = att / se_att if se_att > 0 else 0.0
    p_val = float(2 * (1 - stats.t.cdf(abs(t_stat), df=n_matched - 1)))

    # 4. Diagnostic de balance (Love Plot: SMD avant vs après matching)
    matched_treat_sub = sub.loc[[p[0] for p in matched_pairs]]
    matched_ctrl_sub = sub.loc[[p[1] for p in matched_pairs]]
    unmatched_treat_sub = sub[sub[treatment_col] == 1]
    unmatched_ctrl_sub = sub[sub[treatment_col] == 0]

    love_plot_data = []
    for cov in valid_covs:
        smd_before = compute_standardized_mean_difference(
            unmatched_treat_sub[cov].values, unmatched_ctrl_sub[cov].values
        )
        smd_after = compute_standardized_mean_difference(
            matched_treat_sub[cov].values, matched_ctrl_sub[cov].values
        )
        love_plot_data.append({
            "covariate": cov,
            "smd_before": smd_before,
            "smd_after": smd_after,
            "balanced": abs(smd_after) < 0.1,
        })

    # 5. Distribution des scores de propension (Histogramme pour Common Support)
    hist_treat, bins_treat = np.histogram(sub.loc[treated_idx, "_propensity"], bins=15, range=(0, 1))
    hist_ctrl, _ = np.histogram(sub.loc[control_idx, "_propensity"], bins=15, range=(0, 1))

    return {
        "status": "success",
        "method": "Propensity Score Matching (PSM)",
        "treatment_column": treatment_col,
        "outcome_column": outcome_col,
        "covariates": valid_covs,
        "n_treated_total": len(treated_idx),
        "n_control_total": len(control_idx),
        "n_matched_pairs": n_matched,
        "att": round(att, 4),
        "std_error": round(se_att, 4),
        "t_statistic": round(t_stat, 3),
        "p_value": round(p_val, 5),
        "is_significant": p_val < 0.05,
        "ci_95": [round(att - 1.96 * se_att, 4), round(att + 1.96 * se_att, 4)],
        "love_plot": love_plot_data,
        "common_support": {
            "bin_edges": [round(float(b), 3) for b in bins_treat],
            "counts_treated": [int(c) for c in hist_treat],
            "counts_control": [int(c) for c in hist_ctrl],
        },
    }
