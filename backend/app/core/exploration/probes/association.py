"""
Sondes d'association entre la cible et ses covariables.

Distingue explicitement l'association linéaire (Pearson) de l'association
non linéaire (information mutuelle élevée alors que |r| est faible) : c'est
cette seconde qui déclenche les sondes d'interaction et de segmentation.
"""

from __future__ import annotations

import pandas as pd

from app.core.exploration.context import ExplorationContext
from app.core.exploration.covariates import pearson_corr
from app.core.exploration.finding import Finding, effect_adverb

TOP_K = 8
NONLINEAR_MI_FLOOR = 0.25
NONLINEAR_R_CEILING = 0.25


def probe_target_association(ctx: ExplorationContext) -> list[Finding]:
    """Teste la liaison de chaque covariable numérique avec une cible numérique."""
    findings: list[Finding] = []
    mi_by_col = dict(ctx.ranked_covariates)

    for col in ctx.top_covariates(TOP_K, kinds=("numeric",)):
        r, p, n = pearson_corr(ctx.df, col, ctx.target)  # type: ignore[arg-type]
        mi = mi_by_col.get(col, 0.0)

        if abs(r) >= 0.2:
            findings.append(Finding(
                kind="association_lineaire",
                variables=(col, ctx.target),  # type: ignore[arg-type]
                effect_size=r,
                effect_metric="r de Pearson",
                headline=f"{col} est corrélée {effect_adverb(r)} à {ctx.target} (r = {r:+.2f})",
                detail=(f"Relation {'croissante' if r > 0 else 'décroissante'} sur {n} observations "
                        f"complètes. Chaque écart-type de {col} déplace {ctx.target} "
                        f"de {abs(r):.2f} écart-type."),
                p_value=p,
                n=n,
                establishes=("association_lineaire",) + (("colinearite_possible",) if abs(r) > 0.9 else ()),
                payload={"r": round(r, 4), "mi": mi},
                probe="association",
            ))

        # Signal fort en information mutuelle mais faible en corrélation :
        # la relation existe mais n'est pas linéaire.
        if mi >= NONLINEAR_MI_FLOOR and abs(r) < NONLINEAR_R_CEILING:
            findings.append(Finding(
                kind="association_non_lineaire",
                variables=(col, ctx.target),  # type: ignore[arg-type]
                effect_size=mi,
                effect_metric="information mutuelle normalisée",
                headline=f"{col} explique {ctx.target} de façon non linéaire (IM = {mi:.2f}, r = {r:+.2f})",
                detail=("L'information mutuelle est élevée alors que la corrélation est quasi nulle : "
                        "la relation existe mais une régression linéaire la manquerait. "
                        "Piste : terme quadratique, découpage en classes, ou modèle à base d'arbres."),
                p_value=None,
                n=len(ctx.df),
                establishes=("non_linearite",),
                payload={"r": round(r, 4), "mi": mi},
                probe="association",
            ))

    return findings


def probe_redundancy(ctx: ExplorationContext) -> list[Finding]:
    """Repère les paires de covariables quasi interchangeables (redondance)."""
    findings: list[Finding] = []
    cols = ctx.top_covariates(6, kinds=("numeric",))

    for i, a in enumerate(cols):
        for b in cols[i + 1:]:
            r, p, n = pearson_corr(ctx.df, a, b)
            if abs(r) >= 0.9:
                findings.append(Finding(
                    kind="redondance",
                    variables=(a, b),
                    effect_size=abs(r),
                    effect_metric="r de Pearson",
                    headline=f"{a} et {b} portent presque la même information (r = {r:+.2f})",
                    detail=("Deux prédicteurs quasi interchangeables : les garder tous les deux "
                            "instabilise les coefficients d'une régression. En retenir un, "
                            "ou passer par une composante principale."),
                    p_value=p,
                    n=n,
                    establishes=("multicolinearite",),
                    payload={"r": round(r, 4)},
                    probe="association",
                ))

    return findings
