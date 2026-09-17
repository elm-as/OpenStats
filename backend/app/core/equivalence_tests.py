"""Test d'equivalence (TOST) : demontrer une absence d'effet.

Un test classique non significatif ne prouve rien : il dit seulement qu'on n'a
pas vu de difference, ce qui arrive aussi bien quand il n'y en a pas que quand
l'echantillon est trop petit. Conclure « les deux groupes sont equivalents »
sur un p > 0.05 est l'erreur d'interpretation la plus repandue.

Le TOST inverse la charge de la preuve : on fixe d'abord la difference qu'on
juge negligeable, puis on teste si l'ecart reel tient entierement dans cette
marge. Rejeter les deux bornes, c'est demontrer l'equivalence.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from scipy import stats

SEUIL = 0.05
# A defaut de marge fournie, on prend un effet « petit » au sens de Cohen :
# en deca, la difference est generalement jugee sans portee pratique.
MARGE_PAR_DEFAUT_D = 0.2


def tester_equivalence(
    df: pd.DataFrame,
    group_col: str,
    value_col: str,
    marge: float | None = None,
    alpha: float = SEUIL,
) -> dict[str, Any]:
    """TOST sur deux groupes.

    `marge` est exprimee dans l'unite de la variable. Sans marge fournie, elle
    vaut 0.2 ecart-type : ce choix est explicite dans la reponse, car il
    conditionne entierement la conclusion.
    """
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
    ecart_type = float(np.sqrt(variance_commune))
    if ecart_type <= 0:
        return {"status": "error", "error": "Variance nulle : l'équivalence n'est pas testable"}

    marge_fournie = marge is not None and marge > 0
    marge_effective = float(marge) if marge_fournie else MARGE_PAR_DEFAUT_D * ecart_type

    difference = float(a.mean() - b.mean())
    erreur = float(np.sqrt(variance_commune * (1 / n1 + 1 / n2)))
    ddl = n1 + n2 - 2

    # Deux tests unilateraux : l'ecart est-il au-dessus de -marge, et en dessous de +marge ?
    t_bas = (difference + marge_effective) / erreur
    t_haut = (difference - marge_effective) / erreur
    p_bas = float(stats.t.sf(t_bas, ddl))
    p_haut = float(stats.t.cdf(t_haut, ddl))
    p_tost = max(p_bas, p_haut)
    equivalent = bool(p_tost < alpha)

    _, p_classique = stats.ttest_ind(a, b, equal_var=True)
    marge_erreur = float(stats.t.ppf(1 - alpha, ddl)) * erreur

    return {
        "status": "success",
        "group_column": group_col,
        "value_column": value_col,
        "groupes": {nom_a: n1, nom_b: n2},
        "difference_observee": round(difference, 6),
        "marge_equivalence": round(marge_effective, 6),
        "marge_fournie_par_utilisateur": marge_fournie,
        "ic_90": [round(difference - marge_erreur, 4), round(difference + marge_erreur, 4)],
        "p_value_tost": round(p_tost, 6),
        "p_value_test_classique": round(float(p_classique), 6),
        "equivalent": equivalent,
        "interpretation": (
            (f"Équivalence démontrée : l'écart ({round(difference, 3)}) tient entièrement "
             f"dans la marge de ±{round(marge_effective, 3)} (p = {round(p_tost, 4)})."
             if equivalent else
             f"Équivalence non démontrée : l'écart ({round(difference, 3)}) n'est pas "
             f"contenu de façon concluante dans la marge de ±{round(marge_effective, 3)} "
             f"(p = {round(p_tost, 4)}). Absence de preuve n'est pas preuve d'absence.")
            + ("" if marge_fournie else
               " Marge choisie par défaut à 0,2 écart-type : à fixer selon ce qui est "
               "négligeable dans votre contexte, car la conclusion en dépend.")
        ),
    }
