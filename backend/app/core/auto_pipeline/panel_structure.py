"""Reconnait un panel : plusieurs entites observees sur plusieurs periodes.

La regle precedente exigeait une colonne identifiant, au sens « cardinalite
proche du nombre de lignes ». Or dans un panel c'est exactement l'inverse :
60 agences sur 48 mois donnent une colonne d'entite a 60 modalites pour
2 880 lignes. Le panel etait donc pris pour une serie temporelle, et
l'application empilait les entites pour leur appliquer un ARIMA.

Le test retenu est celui des manuels : le couple (entite, periode) identifie
la ligne de maniere unique, et chaque entite est vue plusieurs fois.
"""

from __future__ import annotations

import pandas as pd

# Au-dela, la colonne ressemble plus a un identifiant de ligne qu'a une entite.
PART_MODALITES_MAX = 0.5
PERIODES_MINIMALES = 2


def detecter_panel(
    df: pd.DataFrame,
    colonnes_temporelles: list[str],
    candidats_entite: list[str],
) -> tuple[str, str] | None:
    """Rend (colonne d'entite, colonne temporelle) si le jeu est un panel.

    Renvoie None pour une coupe transversale ou une serie temporelle simple.
    """
    if not colonnes_temporelles or not candidats_entite or df.empty:
        return None

    for col_temps in colonnes_temporelles:
        if df[col_temps].nunique(dropna=True) < PERIODES_MINIMALES:
            continue

        for col_entite in candidats_entite:
            if col_entite == col_temps:
                continue

            modalites = df[col_entite].nunique(dropna=True)
            if modalites < 2 or modalites > PART_MODALITES_MAX * len(df):
                continue

            couple = df[[col_entite, col_temps]].dropna()
            if len(couple) < len(df) * 0.9 or couple.duplicated().any():
                continue

            periodes_par_entite = couple.groupby(col_entite)[col_temps].nunique()
            if periodes_par_entite.min() >= PERIODES_MINIMALES:
                return col_entite, col_temps

    return None


def decrire_panel(df: pd.DataFrame, col_entite: str, col_temps: str) -> dict:
    """Resume la forme du panel : nombre d'entites, de periodes, et equilibre."""
    periodes_par_entite = df.groupby(col_entite)[col_temps].nunique()
    return {
        "entity_column": col_entite,
        "time_column": col_temps,
        "n_entities": int(df[col_entite].nunique()),
        "n_periods": int(df[col_temps].nunique()),
        "is_balanced": bool(periodes_par_entite.nunique() == 1),
        "min_periods_per_entity": int(periodes_par_entite.min()),
    }
