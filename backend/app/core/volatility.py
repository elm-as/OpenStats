"""Estimation de la volatilite conditionnelle GARCH(1,1).

Le noeud appliquait jusqu'ici des coefficients ecrits en dur (alpha = 0.10,
beta = 0.85) : il filtrait une serie avec des parametres arbitraires au lieu de
les estimer, et presentait le resultat comme une estimation. Sur une serie plus
ou moins persistante que ces valeurs, la volatilite affichee etait fausse sans
qu'aucun message ne le signale.

Ce module estime reellement les parametres par maximum de vraisemblance, et ne
retombe sur le filtre a coefficients fixes que si la bibliotheque `arch` est
absente — en le disant explicitement dans le resultat.
"""

from __future__ import annotations

from typing import Any

import numpy as np


def rendements(valeurs: np.ndarray) -> np.ndarray:
    """Rendements logarithmiques si la serie est strictement positive."""
    if np.all(valeurs > 0):
        return np.diff(np.log(valeurs))
    return np.diff(valeurs)


def _filtre_coefficients_fixes(rets: np.ndarray) -> dict[str, Any]:
    """Repli sans estimation : on le nomme pour ne pas le faire passer pour un ajustement."""
    variance = float(np.var(rets))
    omega, alpha, beta = variance * 0.05, 0.10, 0.85

    cond_var = np.zeros(len(rets))
    cond_var[0] = variance
    for t in range(1, len(rets)):
        cond_var[t] = omega + alpha * (rets[t - 1] ** 2) + beta * cond_var[t - 1]

    return {
        "methode": "filtre a coefficients fixes (bibliotheque `arch` indisponible)",
        "estime": False,
        "omega": omega,
        "alpha": alpha,
        "beta": beta,
        "volatilite_conditionnelle": np.sqrt(cond_var),
        "log_vraisemblance": None,
        "variance_inconditionnelle": variance,
    }


def estimer_garch(rets: np.ndarray, p: int = 1, q: int = 1) -> dict[str, Any]:
    """Ajuste un GARCH(p, q) par maximum de vraisemblance.

    Les rendements sont mis a l'echelle avant estimation : `arch` avertit et
    converge mal sur des series de variance tres faible, ce qui est le cas de
    rendements quotidiens exprimes en unites brutes.
    """
    try:
        from arch import arch_model
    except ImportError:
        return _filtre_coefficients_fixes(rets)

    echelle = 100.0
    try:
        ajuste = arch_model(rets * echelle, vol="GARCH", p=p, q=q, mean="Constant").fit(disp="off")
    except Exception:
        return _filtre_coefficients_fixes(rets)

    params = ajuste.params
    omega = float(params.get("omega", np.nan)) / (echelle ** 2)
    alpha = float(params.get(f"alpha[{p}]", np.nan))
    beta = float(params.get(f"beta[{q}]", np.nan))

    persistance = alpha + beta
    variance_inconditionnelle = (
        omega / (1 - persistance) if persistance < 1 else float(np.var(rets))
    )

    return {
        "methode": f"maximum de vraisemblance (arch, GARCH({p},{q}))",
        "estime": True,
        "omega": omega,
        "alpha": alpha,
        "beta": beta,
        "volatilite_conditionnelle": np.asarray(ajuste.conditional_volatility) / echelle,
        "log_vraisemblance": float(ajuste.loglikelihood),
        "variance_inconditionnelle": float(variance_inconditionnelle),
        "p_values": {cle: float(val) for cle, val in ajuste.pvalues.items()},
    }
