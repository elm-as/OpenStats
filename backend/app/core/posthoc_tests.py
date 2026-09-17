"""Tests post-hoc : quelles moyennes different, une fois l'ANOVA significative.

Une ANOVA significative dit qu'au moins deux groupes different, jamais
lesquels. Comparer ensuite les groupes deux a deux sans correction gonfle le
risque de faux positif : avec quatre groupes, six comparaisons, la probabilite
de declarer au moins une difference a tort atteint ~26 % au seuil de 5 %.

Le choix du test depend de l'homogeneite des variances, verifiee par Levene :
- variances comparables -> Tukey HSD, qui controle le risque global ;
- variances inegales -> Games-Howell, qui n'exige pas cette hypothese.
"""

from __future__ import annotations

import itertools
from typing import Any

import numpy as np
import pandas as pd
from scipy import stats


def _taille_effet_cohen(a: np.ndarray, b: np.ndarray) -> float:
    """d de Cohen : ecart des moyennes rapporte a l'ecart-type commun."""
    n1, n2 = len(a), len(b)
    if n1 < 2 or n2 < 2:
        return float("nan")
    variance_commune = ((n1 - 1) * a.var(ddof=1) + (n2 - 1) * b.var(ddof=1)) / (n1 + n2 - 2)
    if variance_commune <= 0:
        return float("nan")
    return float((a.mean() - b.mean()) / np.sqrt(variance_commune))


def _games_howell(groupes: dict[str, np.ndarray]) -> list[dict[str, Any]]:
    """Comparaisons par paires sans hypothese d'egalite des variances."""
    lignes = []
    noms = list(groupes)
    k = len(noms)

    for g1, g2 in itertools.combinations(noms, 2):
        a, b = groupes[g1], groupes[g2]
        n1, n2 = len(a), len(b)
        v1, v2 = a.var(ddof=1), b.var(ddof=1)
        if n1 < 2 or n2 < 2 or (v1 == 0 and v2 == 0):
            continue

        ecart = float(a.mean() - b.mean())
        erreur = np.sqrt(v1 / n1 + v2 / n2)
        if erreur == 0:
            continue

        # Degres de liberte de Welch-Satterthwaite.
        ddl = (v1 / n1 + v2 / n2) ** 2 / (
            (v1 / n1) ** 2 / (n1 - 1) + (v2 / n2) ** 2 / (n2 - 1))
        t = abs(ecart) / erreur
        # La statistique se lit sur la loi de l'etendue studentisee.
        p = float(stats.studentized_range.sf(t * np.sqrt(2), k, ddl))

        lignes.append({
            "groupe_1": g1,
            "groupe_2": g2,
            "difference": round(ecart, 6),
            "p_value": round(min(1.0, p), 6),
            "significant": bool(p < 0.05),
            "cohen_d": round(_taille_effet_cohen(a, b), 4),
            "degres_liberte": round(float(ddl), 2),
        })
    return lignes


def _tukey(groupes: dict[str, np.ndarray]) -> list[dict[str, Any]]:
    """Tukey HSD via statsmodels, qui controle le risque sur l'ensemble des paires."""
    from statsmodels.stats.multicomp import pairwise_tukeyhsd

    valeurs = np.concatenate([v for v in groupes.values()])
    etiquettes = np.concatenate([[nom] * len(v) for nom, v in groupes.items()])
    resultat = pairwise_tukeyhsd(valeurs, etiquettes, alpha=0.05)

    lignes = []
    for ligne in resultat.summary().data[1:]:
        g1, g2, diff, p_adj, borne_basse, borne_haute, rejet = ligne
        lignes.append({
            "groupe_1": str(g1),
            "groupe_2": str(g2),
            "difference": round(float(diff), 6),
            "p_value": round(float(p_adj), 6),
            "significant": bool(rejet),
            "ic_95": [round(float(borne_basse), 4), round(float(borne_haute), 4)],
            "cohen_d": round(_taille_effet_cohen(groupes[str(g1)], groupes[str(g2)]), 4),
        })
    return lignes


def comparer_groupes(df: pd.DataFrame, group_col: str, value_col: str) -> dict[str, Any]:
    """Compare toutes les paires de groupes, avec le test adapte aux variances."""
    donnees = df[[group_col, value_col]].dropna()
    groupes = {
        str(nom): pd.to_numeric(sous[value_col], errors="coerce").dropna().to_numpy()
        for nom, sous in donnees.groupby(group_col)
    }
    groupes = {nom: v for nom, v in groupes.items() if len(v) >= 2}

    if len(groupes) < 2:
        return {"status": "error", "error": "Au moins deux groupes de 2 observations sont requis"}

    try:
        _, p_levene = stats.levene(*groupes.values())
    except Exception:
        p_levene = float("nan")
    variances_homogenes = bool(np.isfinite(p_levene) and p_levene >= 0.05)

    try:
        paires = _tukey(groupes) if variances_homogenes else _games_howell(groupes)
    except Exception as e:
        return {"status": "error", "error": f"Échec du test post-hoc : {e}"}

    significatives = [p for p in paires if p["significant"]]
    test = "Tukey HSD" if variances_homogenes else "Games-Howell"

    return {
        "status": "success",
        "test": test,
        "group_column": group_col,
        "value_column": value_col,
        "levene_p_value": round(float(p_levene), 6) if np.isfinite(p_levene) else None,
        "variances_homogenes": variances_homogenes,
        "n_groupes": len(groupes),
        "n_comparaisons": len(paires),
        "comparaisons": sorted(paires, key=lambda p: p["p_value"]),
        "n_significatives": len(significatives),
        "interpretation": (
            f"{test} retenu ({'variances comparables' if variances_homogenes else 'variances inégales'}, "
            f"Levene p = {round(float(p_levene), 4) if np.isfinite(p_levene) else 'n/a'}) : "
            f"{len(significatives)} paire(s) significative(s) sur {len(paires)}, "
            "risque global contrôlé."
        ),
    }
