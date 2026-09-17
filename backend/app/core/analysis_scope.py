"""Quelles colonnes entrent dans une analyse multivariee, et lesquelles non.

Un index temporel et un identifiant technique sont des reperes, pas des
variables : les laisser entrer dans une ACP ou un clustering fabrique un axe
ou un groupe qui ne dit rien d'autre que « le temps passe » ou « les lignes
sont numerotees ».

La regle existait deja, mais seulement dans la matrice de correlation. Ce
module en fait l'autorite unique pour tous les moteurs multivaries.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from app.core.auto_pipeline.heuristics import _is_id_like, _is_temporal


def colonnes_reperes(df: pd.DataFrame) -> tuple[list[str], list[str]]:
    """Separe les reperes du jeu : (identifiants, colonnes temporelles)."""
    numeriques = df.select_dtypes(include=[np.number])
    identifiants = [c for c in numeriques.columns if _is_id_like(numeriques[c], col_name=c)]
    temporelles = [
        c for c in numeriques.columns
        if c not in identifiants and _is_temporal(numeriques[c], name=c)
    ]
    return identifiants, temporelles


def variables_analysables(df: pd.DataFrame, minimum: int = 2) -> pd.DataFrame:
    """Colonnes numeriques debarrassees des identifiants et des index temporels.

    Si le retrait laisse moins de `minimum` colonnes, on rend l'ensemble
    numerique complet : mieux vaut une analyse discutable qu'une erreur pour
    un jeu qui ne contient qu'une date et une mesure.
    """
    numeriques = df.select_dtypes(include=[np.number])
    identifiants, temporelles = colonnes_reperes(df)
    retenues = [c for c in numeriques.columns if c not in identifiants and c not in temporelles]
    if len(retenues) < minimum:
        return numeriques
    return numeriques[retenues]
