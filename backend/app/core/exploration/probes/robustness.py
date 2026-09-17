"""Sondes de robustesse : ce qui pourrait invalider une conclusion.

Les sondes existantes cherchent des relations. Celles-ci cherchent ce qui
fragilise une relation deja trouvee :

- une poignee d'observations qui porte a elle seule le resultat ;
- une rupture dans le temps, qui rend une relation moyenne trompeuse ;
- une heterogeneite entre sous-groupes, ou l'effet global masque des effets
  opposes.

Une conclusion qui tient sur trois points ou sur une seule periode n'est pas
une conclusion : elle demande a etre signalee au meme titre qu'un resultat.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from app.core.exploration.context import ExplorationContext
from app.core.exploration.finding import Finding
from app.core.statistical_attempt import attempt

# Une observation pese trop si sa distance de Cook depasse ce repere usuel.
SEUIL_COOK = 1.0
MIN_OBSERVATIONS = 30
MIN_TAILLE_SOUS_GROUPE = 20


def probe_influential_points(ctx: ExplorationContext) -> list[Finding]:
    """Observations qui, a elles seules, orientent la regression sur la cible."""
    import statsmodels.api as sm

    cible = ctx.target
    covariables = ctx.top_covariates(5, kinds=("numeric",))
    if not covariables or ctx.n_rows < MIN_OBSERVATIONS:
        return []

    donnees = ctx.df[[cible] + list(covariables)].dropna()
    if len(donnees) < MIN_OBSERVATIONS:
        return []

    essai = attempt(
        lambda: sm.OLS(donnees[cible].astype(float),
                       sm.add_constant(donnees[list(covariables)].astype(float))).fit()
    )
    if not essai:
        return []

    influence = essai.value.get_influence()
    cook = influence.cooks_distance[0]
    seuil_relatif = 4.0 / len(donnees)
    au_dessus = int(np.sum(cook > max(SEUIL_COOK, seuil_relatif)))
    part = au_dessus / len(donnees)

    if au_dessus == 0:
        return []

    pires = np.argsort(cook)[-3:][::-1]
    return [Finding(
        kind="observations_influentes",
        variables=(cible,),
        effect_size=float(part),
        effect_metric="part d'observations influentes",
        headline=(f"{au_dessus} observation(s) pèsent anormalement sur la relation "
                  f"entre {cible} et ses prédicteurs"),
        detail=("Retirer ces points changerait sensiblement les coefficients. "
                "Une conclusion qui repose sur quelques lignes doit être vérifiée "
                "avant d'être présentée."),
        n=len(donnees),
        establishes=("resultat_fragile",),
        payload={
            "distance_cook_max": round(float(np.max(cook)), 4),
            "seuil": round(float(max(SEUIL_COOK, seuil_relatif)), 5),
            "lignes_les_plus_influentes": [int(donnees.index[i]) for i in pires],
        },
        probe="influential_points",
    )]


def probe_structural_break(ctx: ExplorationContext) -> list[Finding]:
    """Rupture de niveau dans le temps sur la cible."""
    from app.core.timeseries.structural_break import compute_chow_test

    cible = ctx.target
    temporelles = [c for c in ctx.df.columns
                   if str(c).lower() in ("date", "periode", "période", "time", "mois")]
    covariables = list(ctx.top_covariates(3, kinds=("numeric",)))
    if not covariables or ctx.n_rows < 40:
        return []

    date_col = temporelles[0] if temporelles else None
    essai = attempt(lambda: compute_chow_test(ctx.df, cible, covariables, date_col=date_col))
    if not essai or not isinstance(essai.value, dict):
        return []

    resultat = essai.value
    p_value = resultat.get("p_value")
    if p_value is None or p_value >= 0.05:
        return []

    return [Finding(
        kind="rupture_structurelle",
        variables=(cible,),
        effect_size=float(resultat.get("f_statistic") or 0.0),
        effect_metric="F de Chow",
        headline=(f"La relation sur {cible} change à partir de "
                  f"{resultat.get('break_label') or resultat.get('break_index')}"),
        detail=("Les coefficients estimés avant et après cette date diffèrent "
                "significativement : un modèle unique sur toute la période moyenne "
                "deux régimes distincts."),
        p_value=float(p_value),
        n=int(resultat.get("sample_size") or ctx.n_rows),
        establishes=("regimes_multiples", "resultat_fragile"),
        payload={"point_de_rupture": resultat.get("break_label"),
                 "f_statistic": resultat.get("f_statistic")},
        probe="structural_break",
    )]


def probe_subgroup_heterogeneity(ctx: ExplorationContext) -> list[Finding]:
    """La relation cible-predicteur tient-elle dans tous les sous-groupes ?"""
    cible = ctx.target
    numeriques = list(ctx.top_covariates(3, kinds=("numeric",)))
    categorielles = list(ctx.top_covariates(3, kinds=("categorical",)))
    if not numeriques or not categorielles:
        return []

    findings: list[Finding] = []
    for segmenteur in categorielles:
        for predicteur in numeriques:
            correlations = {}
            for modalite, sous in ctx.df.groupby(segmenteur, observed=True):
                paire = sous[[predicteur, cible]].dropna()
                if len(paire) < MIN_TAILLE_SOUS_GROUPE:
                    continue
                r = paire[predicteur].corr(paire[cible])
                if pd.notna(r):
                    correlations[str(modalite)] = float(r)

            if len(correlations) < 2:
                continue

            valeurs = list(correlations.values())
            amplitude = max(valeurs) - min(valeurs)
            change_de_signe = min(valeurs) < -0.1 and max(valeurs) > 0.1
            if amplitude < 0.4 and not change_de_signe:
                continue

            findings.append(Finding(
                kind="heterogeneite_sous_groupes",
                variables=(predicteur, cible, segmenteur),
                effect_size=float(amplitude),
                effect_metric="amplitude des corrélations",
                headline=(f"La relation {predicteur} → {cible} varie fortement selon "
                          f"{segmenteur}" + (" et change de signe" if change_de_signe else "")),
                detail=("Une relation moyenne calculée sur l'ensemble masque des "
                        "comportements différents selon le groupe."),
                n=int(ctx.n_rows),
                establishes=("relation_conditionnelle", "resultat_fragile"),
                payload={"correlations_par_groupe": {k: round(v, 4)
                                                     for k, v in correlations.items()}},
                probe="subgroup_heterogeneity",
            ))
    return findings[:3]
