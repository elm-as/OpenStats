"""
Sondes sans cible : exploration libre.

Quand l'utilisateur ne designe aucune variable a expliquer, la question devient
« quelle structure ce jeu de donnees contient-il ? ». On cherche alors les
paires liees, les axes de variance et les problemes de qualite qui rendraient
toute analyse ulterieure trompeuse.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from app.core import measurements
from app.core.statistical_attempt import attempt
from app.core.exploration.context import ExplorationContext
from app.core.exploration.finding import Finding, effect_adverb
from app.core.exploration.probes.statistical import safe_corr

MAX_PAIRS = 40
MIN_ROWS_PCA = 25


def probe_pairwise_structure(ctx: ExplorationContext) -> list[Finding]:
    """Paires de variables numeriques liees, en l'absence de cible designee.

    Les p-values sont produites telles quelles : c'est la correction FDR de fin
    de session qui absorbe la multiplicite des paires testees.
    """
    findings: list[Finding] = []
    columns = ctx.numeric_cols[:12]
    tested = 0

    for i, a in enumerate(columns):
        for b in columns[i + 1:]:
            if tested >= MAX_PAIRS:
                return findings
            tested += 1

            r, p, n = safe_corr(ctx.df[a], ctx.df[b])
            if abs(r) < 0.35 or n < 10:
                continue

            findings.append(Finding(
                kind="association_lineaire",
                variables=(a, b),
                effect_size=r,
                effect_metric="r de Pearson",
                headline=f"{a} et {b} varient {effect_adverb(r)} ensemble (r = {r:+.2f})",
                detail=(f"Relation {'croissante' if r > 0 else 'decroissante'} sur {n} observations. "
                        "Sans variable cible designee, ce lien est une piste : il ne dit pas "
                        "laquelle des deux explique l'autre."),
                p_value=p,
                n=n,
                establishes=("association_lineaire",) + (("multicolinearite",) if abs(r) > 0.9 else ()),
                payload={"r": round(r, 4), "pairs_tested": tested},
                probe="pairwise_structure",
            ))

    return findings


def probe_variance_axes(ctx: ExplorationContext) -> list[Finding]:
    """Concentration de la variance : quelques axes resument-ils le dataset ?"""
    from sklearn.decomposition import PCA
    from sklearn.preprocessing import StandardScaler

    columns = ctx.numeric_cols[:15]
    if len(columns) < 3:
        return []

    frame = ctx.df[columns].apply(pd.to_numeric, errors="coerce")
    frame = frame.replace([np.inf, -np.inf], np.nan).dropna()
    if len(frame) < MIN_ROWS_PCA or frame.shape[1] < 3:
        return []

    decomposition = attempt(lambda: PCA().fit(StandardScaler().fit_transform(frame)))
    if not decomposition:
        ctx.notes.append(f"ACP non calculable : {decomposition.reason}")
        return []

    ratios = decomposition.value.explained_variance_ratio_
    first_two = float(ratios[:2].sum())
    if first_two < 0.6:
        return []

    n_for_90 = int(np.searchsorted(np.cumsum(ratios), 0.9) + 1)
    return [Finding(
        kind="axes_de_variance",
        variables=tuple(columns),
        effect_size=first_two,
        effect_metric="variance cumulee des 2 premiers axes",
        headline=(f"2 axes resument {first_two:.0%} de l'information portee par "
                  f"{len(columns)} variables"),
        detail=(f"Analyse en composantes principales sur donnees centrees-reduites : "
                f"{n_for_90} composantes suffisent a retenir 90 % de la variance. "
                "Les variables sont donc largement redondantes, ce qui plaide pour une "
                "reduction de dimension avant toute modelisation."),
        p_value=None,
        n=len(frame),
        establishes=("axes_de_variance", "multicolinearite"),
        payload={"explained_variance_ratio": [round(float(v), 4) for v in ratios[:6]],
                 "components_for_90pct": n_for_90},
        probe="variance_axes",
    )]


def probe_data_quality(ctx: ExplorationContext) -> list[Finding]:
    """Doublons, colonnes quasi constantes et lacunes : ce qui fausserait la suite."""
    findings: list[Finding] = []
    df = ctx.df
    n_rows = len(df)
    if n_rows == 0:
        return findings

    duplicates, duplicate_ratio = measurements.duplicate_rows(df)
    if duplicates and duplicate_ratio >= 0.02:
        findings.append(Finding(
            kind="doublons",
            variables=tuple(df.columns[:4]),
            effect_size=min(1.0, duplicate_ratio * 5),
            effect_metric="part de lignes dupliquees",
            headline=f"{duplicates} lignes en double ({duplicate_ratio:.1%} du dataset)",
            detail=("Des observations repetees gonflent artificiellement la taille d'echantillon : "
                    "les p-values deviennent trop petites et les intervalles trop etroits. "
                    "A dedoublonner avant tout test."),
            p_value=None,
            n=n_rows,
            establishes=("doublons",),
            payload={"duplicate_rows": duplicates},
            probe="data_quality",
        ))

    missing = measurements.missing_rates(df)
    severe = {col: rate for col, rate in missing.items() if rate > 0.3}
    if severe:
        worst = max(severe, key=severe.get)
        listing = ", ".join(f"{c} ({r:.0%})" for c, r in
                            sorted(severe.items(), key=lambda kv: -kv[1])[:4])
        findings.append(Finding(
            kind="lacunes",
            variables=tuple(severe.keys()),
            effect_size=min(1.0, severe[worst]),
            effect_metric="taux de valeurs manquantes",
            headline=f"{len(severe)} colonne(s) a plus de 30 % de valeurs manquantes",
            detail=(f"Colonnes concernees : {listing}. Une suppression des lignes incompletes "
                    "amputerait fortement l'echantillon, et l'imputation par la moyenne "
                    "sous-estimerait la variance. A traiter explicitement."),
            p_value=None,
            n=n_rows,
            establishes=("lacunes",),
            payload={"missing_rates": {c: round(r, 4) for c, r in sorted(
                missing.items(), key=lambda kv: -kv[1])[:10]}},
            probe="data_quality",
        ))

    constant = [col for col in measurements.constant_columns(df) if df[col].notna().any()]
    if constant:
        findings.append(Finding(
            kind="colonnes_constantes",
            variables=tuple(constant),
            effect_size=0.3,
            effect_metric="nombre de colonnes sans variance",
            headline=f"{len(constant)} colonne(s) sans aucune variation : {', '.join(constant[:4])}",
            detail=("Une colonne constante ne peut expliquer quoi que ce soit et fait echouer "
                    "certains calculs (division par une variance nulle). A retirer du peripetre."),
            p_value=None,
            n=n_rows,
            establishes=("colonnes_constantes",),
            payload={"columns": constant},
            probe="data_quality",
        ))

    return findings
