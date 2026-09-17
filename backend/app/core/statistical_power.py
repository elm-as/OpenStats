"""Puissance statistique et effet minimal detectable.

« Non significatif » ne veut pas dire « pas d'effet » : cela peut vouloir dire
« echantillon trop petit pour le voir ». Sans la puissance, les deux cas sont
indiscernables, et c'est la confusion la plus courante en lecture de resultats.

Ce module repond a trois questions :
- quelle puissance avait le test que je viens de faire ?
- quel est le plus petit effet que mon echantillon permettait de detecter ?
- combien d'observations faudrait-il pour detecter l'effet vise ?
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

PUISSANCE_VISEE = 0.80
SEUIL = 0.05


def _interpretation_ampleur(d: float) -> str:
    """Reperes usuels de Cohen pour un d."""
    taille = abs(d)
    if taille < 0.2:
        return "négligeable"
    if taille < 0.5:
        return "petit"
    if taille < 0.8:
        return "moyen"
    return "grand"


def analyser_puissance_deux_groupes(
    df: pd.DataFrame,
    group_col: str,
    value_col: str,
    puissance_visee: float = PUISSANCE_VISEE,
    alpha: float = SEUIL,
) -> dict[str, Any]:
    """Puissance atteinte, effet minimal detectable et taille requise."""
    from statsmodels.stats.power import TTestIndPower

    donnees = df[[group_col, value_col]].dropna()
    groupes = {
        str(nom): pd.to_numeric(sous[value_col], errors="coerce").dropna().to_numpy()
        for nom, sous in donnees.groupby(group_col)
    }
    groupes = {nom: v for nom, v in groupes.items() if len(v) >= 2}

    if len(groupes) != 2:
        return {"status": "error",
                "error": f"Deux groupes exactement sont requis (trouvé : {len(groupes)})"}

    (nom_a, a), (nom_b, b) = groupes.items()
    n1, n2 = len(a), len(b)
    variance_commune = ((n1 - 1) * a.var(ddof=1) + (n2 - 1) * b.var(ddof=1)) / (n1 + n2 - 2)
    if variance_commune <= 0:
        return {"status": "error", "error": "Variance nulle : la puissance n'est pas définie"}

    d_observe = float((a.mean() - b.mean()) / np.sqrt(variance_commune))
    analyse = TTestIndPower()
    ratio = n2 / n1

    puissance = float(analyse.power(effect_size=abs(d_observe), nobs1=n1,
                                    alpha=alpha, ratio=ratio))
    try:
        d_minimal = float(analyse.solve_power(nobs1=n1, alpha=alpha,
                                              power=puissance_visee, ratio=ratio))
    except Exception:
        d_minimal = float("nan")
    try:
        n_requis = float(analyse.solve_power(effect_size=abs(d_observe) or 0.01,
                                             alpha=alpha, power=puissance_visee, ratio=ratio))
    except Exception:
        n_requis = float("nan")

    ecart_type = float(np.sqrt(variance_commune))
    return {
        "status": "success",
        "group_column": group_col,
        "value_column": value_col,
        "groupes": {nom_a: n1, nom_b: n2},
        "effet_observe_d": round(d_observe, 4),
        "ampleur": _interpretation_ampleur(d_observe),
        "ecart_observe": round(float(a.mean() - b.mean()), 4),
        "puissance_atteinte": round(puissance, 4),
        "puissance_visee": puissance_visee,
        "effet_minimal_detectable_d": round(d_minimal, 4) if np.isfinite(d_minimal) else None,
        "effet_minimal_detectable_unites": (
            round(d_minimal * ecart_type, 4) if np.isfinite(d_minimal) else None),
        "n_requis_par_groupe": int(np.ceil(n_requis)) if np.isfinite(n_requis) else None,
        "interpretation": (
            f"Avec {n1} et {n2} observations, le test détecte un écart de "
            f"{round(d_minimal * ecart_type, 2) if np.isfinite(d_minimal) else '?'} "
            f"unités avec {int(puissance_visee * 100)} % de chances. "
            + (f"L'écart observé ({round(float(a.mean() - b.mean()), 2)}) est "
               f"{_interpretation_ampleur(d_observe)}, puissance atteinte "
               f"{round(puissance * 100, 1)} %."
               if puissance >= puissance_visee else
               f"La puissance atteinte n'est que de {round(puissance * 100, 1)} % : "
               f"un résultat non significatif ne permet pas de conclure à l'absence d'effet. "
               f"Il faudrait ~{int(np.ceil(n_requis)) if np.isfinite(n_requis) else '?'} "
               "observations par groupe.")
        ),
    }


def taille_echantillon_requise(
    effet_vise: float,
    puissance_visee: float = PUISSANCE_VISEE,
    alpha: float = SEUIL,
) -> dict[str, Any]:
    """Combien d'observations par groupe pour detecter un effet donne."""
    from statsmodels.stats.power import TTestIndPower

    if effet_vise <= 0:
        return {"status": "error", "error": "L'effet visé doit être strictement positif"}

    n = float(TTestIndPower().solve_power(effect_size=effet_vise, alpha=alpha,
                                          power=puissance_visee, ratio=1.0))
    return {
        "status": "success",
        "effet_vise_d": effet_vise,
        "ampleur": _interpretation_ampleur(effet_vise),
        "puissance_visee": puissance_visee,
        "alpha": alpha,
        "n_par_groupe": int(np.ceil(n)),
        "n_total": int(np.ceil(n) * 2),
    }
