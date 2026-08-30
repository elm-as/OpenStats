from typing import Any

try:
    from statsmodels.tsa.ardl import ARDL as _ARDL
    _HAS_ARDL = True
except ImportError:
    _HAS_ARDL = False


def _assess_model_suitability(
    n_obs: int,
    n_vars: int,
    integration_diagnostics: dict[str, Any],
    johansen: dict[str, Any],
    all_stationary: bool,
) -> dict[str, dict[str, Any]]:
    """Évalue la pertinence des différents modèles selon les propriétés statistiques."""
    mixed = integration_diagnostics.get("mixed_orders", False)
    all_i0 = integration_diagnostics.get("all_i0", False)
    all_i1 = integration_diagnostics.get("all_i1", False)
    vecm_ok = johansen.get("vecm_eligible", False)
    min_obs_var = n_vars * 5 + 10

    suits: dict[str, dict[str, Any]] = {}

    suits["var"] = {
        "suitable": n_obs >= min_obs_var,
        "recommended": n_obs >= min_obs_var and (all_stationary or all_i1 or not mixed),
        "reason": (
            "Modèle de référence pour séries multivariées."
            if n_obs >= min_obs_var
            else f"Échantillon trop petit ({n_obs} obs pour {n_vars} vars, min ~{min_obs_var})."
        ),
    }

    suits["vecm"] = {
        "suitable": vecm_ok and n_obs >= min_obs_var,
        "recommended": vecm_ok,
        "reason": (
            "Recommandé : toutes les séries I(1) avec cointégration détectée."
            if vecm_ok
            else (
                "Non applicable : les conditions I(1) homogènes et cointégration ne sont pas remplies."
                if not all_i1
                else "Pas de cointégration détectée par Johansen."
            )
        ),
    }

    suits["ardl"] = {
        "suitable": _HAS_ARDL and n_vars >= 2 and n_obs >= 15,
        "recommended": mixed or (not all_i1 and not all_i0 and n_obs >= 15),
        "reason": (
            "Fortement recommandé pour ordres d'intégration mixtes I(0)/I(1) "
            "(Pesaran, Shin & Smith, 2001)."
            if mixed
            else "Alternative valide quand le cadre VAR/VECM classique n'est pas optimal."
        ),
    }

    suits["bvar"] = {
        "suitable": n_obs >= 10,
        "recommended": n_obs < 50 or n_obs < n_vars * 10,
        "reason": (
            f"Recommandé : petit échantillon ({n_obs} obs). "
            "Le prior Minnesota régularise les estimations."
            if n_obs < 50
            else "Utilisable comme alternative régularisée au VAR classique."
        ),
    }

    n_pairs = n_vars * (n_vars - 1) // 2
    suits["pairwise_var"] = {
        "suitable": n_vars >= 3 and n_obs >= 15,
        "recommended": n_vars >= 4 and n_obs < n_vars * 15,
        "reason": (
            f"Recommandé : {n_vars} variables et seulement {n_obs} obs. "
            f"Analyse bivariée ({n_pairs} paires) économise les degrés de liberté."
            if n_vars >= 4 and n_obs < n_vars * 15
            else f"Disponible comme analyse complémentaire ({n_pairs} paires)."
        ),
    }

    suits["varmax"] = {
        "suitable": n_vars <= 6 and n_obs >= 30,
        "recommended": False,
        "reason": (
            "Représentation état-espace plus flexible. "
            + ("Limité à ≤ 6 variables." if n_vars > 6 else "Disponible.")
            + (" Échantillon trop petit." if n_obs < 30 else "")
        ),
    }

    return suits
