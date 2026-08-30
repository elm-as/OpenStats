"""
Module d'analyse de survie avancée :
- Estimation Kaplan-Meier avec intervalle de confiance de Greenwood (95%)
- Courbes comparatives multi-groupes
- Test du Log-Rank (Mantel-Cox) pour la comparaison de survie
- Modèle de régression de Cox à risques proportionnels
"""

from __future__ import annotations

import logging
from typing import Any
import numpy as np
import pandas as pd
from scipy import stats

logger = logging.getLogger(__name__)


def compute_kaplan_meier_table(
    durations: np.ndarray,
    events: np.ndarray,
) -> list[dict[str, Any]]:
    """
    Calcule la table de survie Kaplan-Meier avec variance de Greenwood et IC 95%.
    """
    unique_times = np.sort(np.unique(durations))
    km_table: list[dict[str, Any]] = []
    n_at_risk = len(durations)
    surv_prob = 1.0
    greenwood_sum = 0.0

    # Point initial t=0
    km_table.append({
        "time": 0.0,
        "n_at_risk": int(n_at_risk),
        "n_events": 0,
        "n_censored": 0,
        "survival_probability": 1.0,
        "ci_lower": 1.0,
        "ci_upper": 1.0,
    })

    for t in unique_times:
        d = int(np.sum((durations == t) & (events == 1)))
        c = int(np.sum((durations == t) & (events == 0)))

        if n_at_risk > 0:
            if n_at_risk > d:
                surv_prob *= (1.0 - (d / n_at_risk))
                greenwood_sum += d / (n_at_risk * (n_at_risk - d))
            else:
                surv_prob = 0.0

            se = surv_prob * np.sqrt(max(0.0, greenwood_sum))
            ci_lower = max(0.0, round(float(surv_prob - 1.96 * se), 4))
            ci_upper = min(1.0, round(float(surv_prob + 1.96 * se), 4))
        else:
            ci_lower = 0.0
            ci_upper = 0.0

        km_table.append({
            "time": float(t),
            "n_at_risk": int(n_at_risk),
            "n_events": d,
            "n_censored": c,
            "survival_probability": round(float(surv_prob), 4),
            "ci_lower": ci_lower,
            "ci_upper": ci_upper,
        })
        n_at_risk -= (d + c)

    return km_table


def compute_log_rank_test(
    df: pd.DataFrame,
    duration_col: str,
    event_col: str,
    group_col: str,
) -> dict[str, Any] | None:
    """
    Exécute le test du Log-Rank (Mantel-Cox) entre 2 groupes.
    """
    clean = df[[duration_col, event_col, group_col]].dropna()
    groups = clean[group_col].unique()
    if len(groups) != 2:
        return None

    g1_label, g2_label = str(groups[0]), str(groups[1])
    d1 = clean[clean[group_col] == groups[0]][duration_col].values
    e1 = clean[clean[group_col] == groups[0]][event_col].values
    d2 = clean[clean[group_col] == groups[1]][duration_col].values
    e2 = clean[clean[group_col] == groups[1]][event_col].values

    all_times = np.sort(np.unique(np.concatenate([d1, d2])))
    observed_g1 = 0.0
    expected_g1 = 0.0
    variance_g1 = 0.0

    for t in all_times:
        n1 = np.sum(d1 >= t)
        n2 = np.sum(d2 >= t)
        d1_t = np.sum((d1 == t) & (e1 == 1))
        d2_t = np.sum((d2 == t) & (e2 == 1))

        n_tot = n1 + n2
        d_tot = d1_t + d2_t

        if n_tot > 1 and d_tot > 0:
            exp_1 = n1 * (d_tot / n_tot)
            var_1 = (n1 * n2 * d_tot * (n_tot - d_tot)) / (n_tot**2 * (n_tot - 1))
            observed_g1 += d1_t
            expected_g1 += exp_1
            variance_g1 += var_1

    if variance_g1 <= 0:
        return None

    z_score = (observed_g1 - expected_g1) / np.sqrt(variance_g1)
    chi2_stat = float(z_score**2)
    p_val = float(1.0 - stats.chi2.cdf(chi2_stat, df=1))

    return {
        "group1": g1_label,
        "group2": g2_label,
        "observed_events_g1": int(observed_g1),
        "expected_events_g1": round(float(expected_g1), 2),
        "chi2_statistic": round(chi2_stat, 4),
        "p_value": round(p_val, 5),
        "significant": p_val < 0.05,
    }


def fit_cox_model(
    df: pd.DataFrame,
    duration_col: str,
    event_col: str,
    feature_cols: list[str],
) -> dict[str, Any] | None:
    """
    Ajuste un modèle de Cox à risques proportionnels (statsmodels PHReg).
    """
    if not feature_cols:
        return None
    try:
        import statsmodels.duration.hazard_regression as ph
        cox_data = df[[duration_col, event_col] + feature_cols].dropna().copy()
        if len(cox_data) < 10:
            return None
        formula = f"{duration_col} ~ " + " + ".join(feature_cols)
        mod = ph.PHReg.from_formula(formula, cox_data, status=cox_data[event_col])
        res = mod.fit()
        return {
            "features": feature_cols,
            "hazard_ratios": {col: round(float(np.exp(coef)), 4) for col, coef in zip(feature_cols, res.params)},
            "p_values": {col: round(float(pv), 4) for col, pv in zip(feature_cols, res.pvalues)},
            "log_likelihood": round(float(res.llf), 2),
        }
    except Exception as e:
        logger.warning("Fit Cox PHReg failed: %s", e)
        return None


def run_survival_analysis(
    df: pd.DataFrame,
    duration_col: str | None = None,
    event_col: str | None = None,
    group_col: str | None = None,
) -> dict[str, Any]:
    """Point d'entrée principal pour l'analyse de survie."""
    if df is None or df.empty:
        return {"status": "error", "message": "Dataset introuvable ou vide"}

    num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    if not duration_col and num_cols:
        duration_col = num_cols[0]

    bin_cols = [c for c in df.columns if df[c].dropna().nunique() == 2]
    if not event_col and bin_cols:
        event_col = bin_cols[0]

    if not duration_col or duration_col not in df.columns:
        return {"status": "error", "message": f"Colonne de durée '{duration_col}' invalide"}

    sub_cols = [duration_col]
    if event_col and event_col in df.columns:
        sub_cols.append(event_col)
    if group_col and group_col in df.columns:
        sub_cols.append(group_col)

    clean_df = df[sub_cols].dropna().copy()
    if clean_df.empty:
        return {"status": "error", "message": "Aucune donnée valide après suppression des NaN"}

    durations = clean_df[duration_col].values
    events = clean_df[event_col].values if event_col and event_col in clean_df.columns else np.ones(len(clean_df))

    km_table = compute_kaplan_meier_table(durations, events)

    median_surv = None
    for row in km_table:
        if row["survival_probability"] <= 0.5:
            median_surv = row["time"]
            break

    # Group comparison if group_col exists
    group_curves = {}
    log_rank = None
    if group_col and group_col in clean_df.columns:
        for g_val, g_sub in clean_df.groupby(group_col):
            g_d = g_sub[duration_col].values
            g_e = g_sub[event_col].values if event_col and event_col in g_sub.columns else np.ones(len(g_sub))
            group_curves[str(g_val)] = compute_kaplan_meier_table(g_d, g_e)
        log_rank = compute_log_rank_test(clean_df, duration_col, event_col, group_col)

    # Cox
    feature_cols = [c for c in num_cols if c != duration_col and c != event_col][:5]
    cox_results = fit_cox_model(df, duration_col, event_col, feature_cols)

    return {
        "status": "success",
        "message": f"Analyse de survie calculée sur '{duration_col}' ({len(clean_df)} obs)",
        "duration_column": duration_col,
        "event_column": event_col,
        "group_column": group_col,
        "n_observations": len(clean_df),
        "n_events": int(np.sum(events == 1)),
        "median_survival_time": median_surv,
        "km_table": km_table,
        "group_curves": group_curves,
        "log_rank_test": log_rank,
        "cox_regression": cox_results,
    }
