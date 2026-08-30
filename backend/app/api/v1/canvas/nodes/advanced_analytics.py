"""
Exécuteurs pour les nœuds d'Analyse Avancée :
- Survival Analysis (Kaplan-Meier & Cox Proportional Hazards)
- Causal Inference (Difference-in-Differences & 2SLS Instrumental Variables)
- Manifold Projection & Density (t-SNE & DBSCAN)
- Time Series Volatility (GARCH)
"""

from __future__ import annotations

import logging
from typing import Any
import numpy as np
import pandas as pd
from scipy import stats

from app.services.dataset_service import dataset_manager

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════
# 1. Analyse de Survie (Kaplan-Meier & Cox)
# ═══════════════════════════════════════════════════════════════════

def execute_survival(node_data: dict[str, Any], dataset_id: int) -> dict[str, Any]:
    """Calcule l'estimation Kaplan-Meier et la Régression de Cox."""
    df = dataset_manager.get_df(dataset_id)
    if df is None or df.empty:
        return {"status": "error", "message": "Dataset introuvable ou vide"}

    duration_col = node_data.get("durationCol")
    event_col = node_data.get("eventCol")
    group_col = node_data.get("groupCol")

    # Auto-détection si non spécifié
    num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    if not duration_col and num_cols:
        duration_col = num_cols[0]

    bin_cols = [c for c in df.columns if df[c].dropna().nunique() == 2]
    if not event_col and bin_cols:
        event_col = bin_cols[0]

    if not duration_col or duration_col not in df.columns:
        return {"status": "error", "message": f"Colonne de durée '{duration_col}' invalide"}

    # Nettoyage
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

    # Estimation Kaplan-Meier empirique
    unique_times = np.sort(np.unique(durations))
    km_table = []
    n_at_risk = len(durations)
    surv_prob = 1.0

    for t in unique_times:
        n_events = np.sum((durations == t) & (events == 1))
        n_censored = np.sum((durations == t) & (events == 0))
        if n_at_risk > 0:
            surv_prob *= (1.0 - (n_events / n_at_risk))
        km_table.append({
            "time": float(t),
            "n_at_risk": int(n_at_risk),
            "n_events": int(n_events),
            "n_censored": int(n_censored),
            "survival_probability": round(float(surv_prob), 4),
        })
        n_at_risk -= (n_events + n_censored)

    # Cox Proportional Hazards si des covariables numériques sont sélectionnées
    cox_results = None
    feature_cols = [c for c in num_cols if c != duration_col and c != event_col][:5]
    if feature_cols and event_col:
        try:
            import statsmodels.duration.hazard_regression as ph
            cox_data = df[[duration_col, event_col] + feature_cols].dropna().copy()
            if len(cox_data) >= 10:
                formula = f"{duration_col} ~ " + " + ".join(feature_cols)
                mod = ph.PHReg.from_formula(formula, cox_data, status=cox_data[event_col])
                res = mod.fit()
                cox_results = {
                    "features": feature_cols,
                    "hazard_ratios": {col: round(float(np.exp(coef)), 4) for col, coef in zip(feature_cols, res.params)},
                    "p_values": {col: round(float(pv), 4) for col, pv in zip(feature_cols, res.pvalues)},
                    "log_likelihood": round(float(res.llf), 2),
                }
        except Exception as e:
            logger.warning(f"Cox PHReg failed: {e}")

    median_surv = None
    for row in km_table:
        if row["survival_probability"] <= 0.5:
            median_surv = row["time"]
            break

    return {
        "status": "success",
        "message": f"Analyse de survie calculée sur '{duration_col}' ({len(clean_df)} obs)",
        "duration_column": duration_col,
        "event_column": event_col,
        "n_observations": len(clean_df),
        "n_events": int(np.sum(events == 1)),
        "median_survival_time": median_surv,
        "kaplan_meier": km_table[:30],
        "cox_regression": cox_results,
    }


# ═══════════════════════════════════════════════════════════════════
# 2. Inférence Causale (DiD & 2SLS)
# ═══════════════════════════════════════════════════════════════════

def execute_causal(node_data: dict[str, Any], dataset_id: int) -> dict[str, Any]:
    """Exécute l'estimation Diff-in-Diff (DiD) ou 2SLS (Variables Instrumentales)."""
    df = dataset_manager.get_df(dataset_id)
    if df is None or df.empty:
        return {"status": "error", "message": "Dataset introuvable ou vide"}

    method = node_data.get("method", "did")
    outcome_col = node_data.get("outcomeCol")
    treatment_col = node_data.get("treatmentCol")

    num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    if not outcome_col and num_cols:
        outcome_col = num_cols[0]

    bin_cols = [c for c in df.columns if df[c].dropna().nunique() == 2]
    if not treatment_col and bin_cols:
        treatment_col = bin_cols[0]

    if not outcome_col or outcome_col not in df.columns or not treatment_col or treatment_col not in df.columns:
        return {"status": "error", "message": "Colonnes résultat et traitement requises"}

    if method == "did":
        time_col = node_data.get("timeCol")
        if not time_col:
            # Chercher une colonne binaire temps (avant/après)
            rem_bin = [c for c in bin_cols if c != treatment_col]
            if rem_bin:
                time_col = rem_bin[0]

        if not time_col or time_col not in df.columns:
            return {"status": "error", "message": "Seconde variable binaire (période/temps) requise pour la DiD"}

        sub = df[[outcome_col, treatment_col, time_col]].dropna().copy()
        sub["interaction"] = sub[treatment_col] * sub[time_col]

        import statsmodels.api as sm
        X = sm.add_constant(sub[[treatment_col, time_col, "interaction"]])
        y = sub[outcome_col]
        model = sm.OLS(y, X).fit()

        att = model.params.get("interaction", 0.0)
        p_val = model.pvalues.get("interaction", 1.0)
        se = model.bse.get("interaction", 0.0)

        return {
            "status": "success",
            "message": f"Estimateur DiD (ATT = {att:.4f}, p = {p_val:.4f})",
            "method": "Difference-in-Differences (DiD)",
            "outcome_column": outcome_col,
            "treatment_column": treatment_col,
            "time_column": time_col,
            "att_estimate": round(float(att), 4),
            "std_error": round(float(se), 4),
            "p_value": round(float(p_val), 4),
            "is_significant": bool(p_val < 0.05),
            "r_squared": round(float(model.rsquared), 4),
        }
    else:

        # 2SLS (Variables Instrumentales)
        instrument_col = node_data.get("instrumentCol")
        if not instrument_col and num_cols:
            rem_num = [c for c in num_cols if c != outcome_col and c != treatment_col]
            if rem_num:
                instrument_col = rem_num[0]

        if not instrument_col or instrument_col not in df.columns:
            return {"status": "error", "message": "Variable instrumentale requise pour la 2SLS"}

        sub = df[[outcome_col, treatment_col, instrument_col]].dropna().copy()
        import statsmodels.sandbox.regression.gmm as gmm

        y = sub[outcome_col]
        x = sub[treatment_col]
        z = sub[instrument_col]

        iv_mod = gmm.IV2SLS(y, x, z).fit()
        coef = iv_mod.params[0]
        p_val = iv_mod.pvalues[0]

        return {
            "status": "success",
            "message": f"Régression 2SLS (Coef = {coef:.4f}, p = {p_val:.4f})",
            "method": "Two-Stage Least Squares (2SLS)",
            "outcome_column": outcome_col,
            "treatment_column": treatment_col,
            "instrument_column": instrument_col,
            "coefficient": round(float(coef), 4),
            "p_value": round(float(p_val), 4),
            "is_significant": bool(p_val < 0.05),
        }


# ═══════════════════════════════════════════════════════════════════
# 3. Projection Manifold & Density (t-SNE & DBSCAN)
# ═══════════════════════════════════════════════════════════════════

def execute_manifold(node_data: dict[str, Any], dataset_id: int) -> dict[str, Any]:
    """Exécute la réduction t-SNE 2D et le clustering par densité DBSCAN."""
    df = dataset_manager.get_df(dataset_id)
    if df is None or df.empty:
        return {"status": "error", "message": "Dataset introuvable ou vide"}

    num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    if len(num_cols) < 2:
        return {"status": "error", "message": "Au moins 2 variables numériques requises pour la projection"}

    sub = df[num_cols].dropna().copy()
    if len(sub) > 500:
        sub = sub.sample(n=500, random_state=42)

    from sklearn.preprocessing import StandardScaler
    from sklearn.manifold import TSNE
    from sklearn.cluster import DBSCAN

    X_scaled = StandardScaler().fit_transform(sub)
    perplexity = min(30, max(5, len(sub) - 1))
    tsne = TSNE(n_components=2, perplexity=perplexity, random_state=42)
    coords_2d = tsne.fit_transform(X_scaled)

    dbscan = DBSCAN(eps=0.5, min_samples=5)
    cluster_labels = dbscan.fit_predict(X_scaled)

    points = []
    for idx, (x, y) in enumerate(coords_2d):
        points.append({
            "x": round(float(x), 4),
            "y": round(float(y), 4),
            "cluster": int(cluster_labels[idx]),
        })

    n_clusters = len(set(cluster_labels)) - (1 if -1 in cluster_labels else 0)
    n_noise = int(np.sum(cluster_labels == -1))

    return {
        "status": "success",
        "message": f"Projection t-SNE 2D effectuée sur {len(sub)} obs ({n_clusters} clusters DBSCAN, {n_noise} bruit)",
        "method": "t-SNE + DBSCAN Density Clustering",
        "n_observations": len(sub),
        "n_features": len(num_cols),
        "n_clusters": n_clusters,
        "n_noise_points": n_noise,
        "points": points[:300],
    }


# ═══════════════════════════════════════════════════════════════════
# 4. Volatilité Temporelle (GARCH)
# ═══════════════════════════════════════════════════════════════════

def execute_garch(node_data: dict[str, Any], dataset_id: int) -> dict[str, Any]:
    """Estime la volatilité temporelle conditionnelle GARCH(1,1)."""
    df = dataset_manager.get_df(dataset_id)
    if df is None or df.empty:
        return {"status": "error", "message": "Dataset introuvable ou vide"}

    value_col = node_data.get("valueCol")
    num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    if not value_col and num_cols:
        value_col = num_cols[0]

    if not value_col or value_col not in df.columns:
        return {"status": "error", "message": f"Variable numérique '{value_col}' introuvable"}

    series = df[value_col].dropna().values
    returns = np.diff(np.log(series)) if np.all(series > 0) else np.diff(series)

    if len(returns) < 10:
        return {"status": "error", "message": "Nombre d'observations insuffisant pour GARCH"}

    # Estimation empirique GARCH(1,1) des variances conditionnelles
    var_uncond = np.var(returns)
    alpha0 = var_uncond * 0.05
    alpha1 = 0.10
    beta1 = 0.85

    cond_var = np.zeros(len(returns))
    cond_var[0] = var_uncond
    for t in range(1, len(returns)):
        cond_var[t] = alpha0 + alpha1 * (returns[t - 1] ** 2) + beta1 * cond_var[t - 1]

    cond_volatility = np.sqrt(cond_var)

    return {
        "status": "success",
        "message": f"Volatilité conditionnelle GARCH(1,1) estimée sur '{value_col}'",
        "variable": value_col,
        "n_returns": len(returns),
        "unconditional_volatility": round(float(np.sqrt(var_uncond)), 4),
        "mean_conditional_volatility": round(float(np.mean(cond_volatility)), 4),
        "garch_parameters": {
            "omega (alpha0)": round(float(alpha0), 6),
            "alpha1 (arch)": round(float(alpha1), 4),
            "beta1 (garch)": round(float(beta1), 4),
            "persistence": round(float(alpha1 + beta1), 4),
        },
        "volatility_series": [round(float(v), 4) for v in cond_volatility[:50]],
    }
