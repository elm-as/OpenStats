from typing import Any


def build_methodological_pivot(
    forced_model: str | None,
    var_data_mode: str,
    granger_data_mode: str,
    var_trend: str,
    var_regime: str,
    granger_regime: str,
    diff_orders: dict[str, int],
    vecm_eligible: bool,
    integration_diagnostics: dict[str, Any],
    all_stationary: bool,
    johansen: dict[str, Any],
) -> dict[str, Any]:
    """Construit le bloc de synthèse méthodologique."""
    if integration_diagnostics.get("mixed_orders"):
        pivot_reason = (
            "Ordres d'intégration hétérogènes détectés : le signal Johansen est traité "
            "comme exploratoire et les analyses dynamiques basculent vers des séries stationarisées."
        )
    elif johansen.get("assumption_valid") is False and integration_diagnostics.get("all_i0"):
        pivot_reason = (
            "Toutes les séries sont déjà stationnaires I(0) : le cadre VECM est écarté et "
            "un VAR en niveaux reste privilégié."
        )
    elif vecm_eligible:
        pivot_reason = (
            "Toutes les séries semblent I(1) et une cointégration exploitable est détectée : "
            "le niveau est conservé pour VECM et le diagnostic dynamique."
        )
    elif not all_stationary and (var_regime == "diff" or granger_regime == "diff"):
        pivot_reason = (
            "Séries non stationnaires sans cointégration exploitable : application en différences "
            "pour limiter les corrélations fallacieuses."
        )
    else:
        pivot_reason = "Régime en niveaux conservé (stationnarité suffisante)."

    return {
        "forced_model": forced_model,
        "var_data_mode": var_data_mode,
        "granger_data_mode": granger_data_mode,
        "var_trend": var_trend,
        "applied_var_regime": var_regime,
        "applied_granger_regime": granger_regime,
        "diff_orders": diff_orders,
        "vecm_eligible": vecm_eligible,
        "integration_interpretation": integration_diagnostics.get("interpretation"),
        "reason": pivot_reason,
    }


def build_pipeline_recommendations(
    integration_diagnostics: dict[str, Any],
    has_coint: bool,
    all_stationary: bool,
    model_results: dict[str, Any],
    ardl_target: str,
    n_obs: int,
    n_vars: int,
    forced_model: str | None,
) -> str:
    """Rédige les recommandations textuelles du pipeline multivarié."""
    reco_parts = []
    if integration_diagnostics.get("mixed_orders"):
        reco_parts.append(
            "Ordres d'intégration hétérogènes détectés. Johansen/VECM ne constituent pas "
            "une preuve robuste de relation de long terme dans cette configuration."
        )
        if "ardl" in model_results and "error" not in model_results.get("ardl", {}):
            bt = model_results["ardl"].get("bounds_test", {})
            if bt and bt.get("cointegration_detected"):
                reco_parts.append(
                    "Le Bounds Test ARDL (Pesaran et al.) détecte une relation de long terme "
                    f"malgré les ordres mixtes → ARDL recommandé pour la variable {ardl_target}."
                )
            else:
                reco_parts.append(
                    "Le Bounds Test ARDL ne détecte pas de relation de long terme. "
                    "Privilégiez un VAR sur séries stationarisées."
                )
        else:
            reco_parts.append(
                "ARDL (Pesaran, Shin & Smith, 2001) est l'alternative de référence "
                "pour les ordres d'intégration mixtes I(0)/I(1)."
            )
    elif integration_diagnostics.get("all_i0"):
        reco_parts.append(
            "Toutes les séries sont stationnaires I(0) : le modèle VAR en niveaux est approprié."
        )
    elif has_coint:
        reco_parts.append(
            "Cointégration détectée : le modèle VECM est recommandé pour capturer "
            "les relations de long terme entre les variables."
        )
    elif all_stationary:
        reco_parts.append(
            "Toutes les séries sont stationnaires : le modèle VAR en niveaux est approprié."
        )
    else:
        reco_parts.append(
            "Séries non-stationnaires sans cointégration : le modèle VAR en différences "
            "est recommandé."
        )

    if n_obs < 50:
        if "bvar" in model_results and "error" not in model_results.get("bvar", {}):
            reco_parts.append(
                f"Petit échantillon ({n_obs} obs) : le BVAR avec prior Minnesota "
                "offre des estimations plus stables grâce à la régularisation."
            )
        else:
            reco_parts.append(
                f"Petit échantillon ({n_obs} obs) : envisagez le BVAR (prior Minnesota) "
                "pour des estimations régularisées."
            )

    if n_vars >= 4 and n_obs < n_vars * 15:
        reco_parts.append(
            f"Avec {n_vars} variables et {n_obs} obs, le Pairwise VAR "
            "bivarié permet d'analyser chaque paire sans saturer les degrés de liberté."
        )

    recommendation = " ".join(reco_parts)

    forced_model_applied = bool(
        forced_model
        and forced_model in model_results
        and "error" not in model_results[forced_model]
    )

    if forced_model and not forced_model_applied:
        recommendation += (
            f" Le forçage {forced_model.upper()} a été ignoré car les conditions "
            "requises ne sont pas satisfaites."
        )
    elif forced_model_applied:
        recommendation += (
            f" Forçage utilisateur actif : {forced_model.upper()} utilisé prioritairement "
            "malgré la recommandation automatique."
        )

    return recommendation
