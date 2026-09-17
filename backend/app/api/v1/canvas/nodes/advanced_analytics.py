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
    """Calcule l'estimation Kaplan-Meier, test Log-Rank et Régression de Cox."""
    df = dataset_manager.get_df(dataset_id)
    if df is None or df.empty:
        return {"status": "error", "message": "Dataset introuvable ou vide"}

    from app.core.survival_analysis import run_survival_analysis

    return run_survival_analysis(
        df=df,
        duration_col=node_data.get("durationCol"),
        event_col=node_data.get("eventCol"),
        group_col=node_data.get("groupCol"),
    )


# ═══════════════════════════════════════════════════════════════════
# 2. Inférence Causale (DiD, 2SLS & PSM)
# ═══════════════════════════════════════════════════════════════════

def execute_causal(node_data: dict[str, Any], dataset_id: int) -> dict[str, Any]:
    """Exécute l'estimation Diff-in-Diff (DiD), 2SLS ou Propensity Score Matching (PSM)."""
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

    if method == "psm":
        from app.core.causal_inference import run_propensity_score_matching
        covs = node_data.get("covariates")
        if isinstance(covs, str):
            covs = [c.strip() for c in covs.split(",") if c.strip()]
        caliper = float(node_data.get("caliper") or 0.2)
        return run_propensity_score_matching(
            df=df,
            treatment_col=treatment_col,
            outcome_col=outcome_col,
            covariates=covs,
            caliper=caliper,
        )

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
        if len(sub) < 10:
            return {"status": "error", "message": "Trop peu d'observations completes pour la 2SLS"}

        import statsmodels.api as sm
        from statsmodels.sandbox.regression.gmm import IV2SLS

        y = sub[outcome_col]
        # La constante est indispensable : sans elle, 2SLS estime un rapport de
        # moments non centres et le coefficient n'a pas d'interpretation.
        X = sm.add_constant(sub[[treatment_col]], has_constant="add")
        Z = sm.add_constant(sub[[instrument_col]], has_constant="add")

        iv_mod = IV2SLS(y, X, Z).fit()
        coef = float(iv_mod.params[treatment_col])
        p_val = float(iv_mod.pvalues[treatment_col])

        # Premiere etape : un instrument faible rend l'estimation 2SLS moins
        # fiable que les MCO qu'elle est censee corriger.
        premiere = sm.OLS(sub[treatment_col],
                          sm.add_constant(sub[[instrument_col]], has_constant="add")).fit()
        f_premiere = float(premiere.fvalue) if premiere.fvalue is not None else None

        mco = sm.OLS(y, X).fit()
        coef_mco = float(mco.params[treatment_col])

        return {
            "status": "success",
            "message": (f"Régression 2SLS (Coef = {coef:.4f}, p = {p_val:.4f}) — "
                        f"MCO non instrumentées : {coef_mco:.4f}"),
            "method": "Two-Stage Least Squares (2SLS)",
            "outcome_column": outcome_col,
            "treatment_column": treatment_col,
            "instrument_column": instrument_col,
            "coefficient": round(coef, 4),
            "p_value": round(p_val, 4),
            "is_significant": bool(p_val < 0.05),
            "ols_coefficient": round(coef_mco, 4),
            "endogeneity_gap": round(coef_mco - coef, 4),
            "first_stage_f": round(f_premiere, 2) if f_premiere is not None else None,
            "weak_instrument": bool(f_premiere is not None and f_premiere < 10),
            "first_stage_r2": round(float(premiere.rsquared), 4),
            "n_observations": int(len(sub)),
        }


# ═══════════════════════════════════════════════════════════════════
# 3. Projection Manifold & Density (t-SNE & DBSCAN)
# ═══════════════════════════════════════════════════════════════════

def execute_manifold(node_data: dict[str, Any], dataset_id: int) -> dict[str, Any]:
    """Exécute la réduction t-SNE 2D et le clustering par densité DBSCAN."""
    df = dataset_manager.get_df(dataset_id)
    if df is None or df.empty:
        return {"status": "error", "message": "Dataset introuvable ou vide"}

    from app.core.analysis_scope import variables_analysables

    analysables = variables_analysables(df)
    num_cols = analysables.columns.tolist()
    if len(num_cols) < 2:
        return {"status": "error", "message": "Au moins 2 variables numériques requises pour la projection"}

    sub = analysables.dropna().copy()
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

    from app.core.volatility import estimer_garch, rendements

    serie = df[value_col].dropna().values
    rets = rendements(serie)

    if len(rets) < 30:
        return {"status": "error",
                "message": "Au moins 30 rendements sont requis pour estimer un GARCH(1,1)"}

    ajustement = estimer_garch(rets)
    volatilite = ajustement["volatilite_conditionnelle"]
    persistance = ajustement["alpha"] + ajustement["beta"]

    return {
        "status": "success",
        "message": (f"GARCH(1,1) sur '{value_col}' — {ajustement['methode']}, "
                    f"persistance {persistance:.3f}"),
        "variable": value_col,
        "n_returns": len(rets),
        "estimation_method": ajustement["methode"],
        "is_estimated": ajustement["estime"],
        "log_likelihood": (round(ajustement["log_vraisemblance"], 2)
                           if ajustement["log_vraisemblance"] is not None else None),
        "unconditional_volatility": round(float(np.sqrt(ajustement["variance_inconditionnelle"])), 6),
        "mean_conditional_volatility": round(float(np.mean(volatilite)), 6),
        "garch_parameters": {
            "omega (alpha0)": round(float(ajustement["omega"]), 8),
            "alpha1 (arch)": round(float(ajustement["alpha"]), 4),
            "beta1 (garch)": round(float(ajustement["beta"]), 4),
            "persistence": round(float(persistance), 4),
        },
        "p_values": ajustement.get("p_values"),
        "volatility_series": [round(float(v), 6) for v in volatilite[:200]],
    }
