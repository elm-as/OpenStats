"""
Detecteurs de qualite et de structure des donnees (doublons, constantes, identifiants, valeurs manquantes).
"""

from __future__ import annotations

import pandas as pd

from app.core import measurements
from app.core.pipeline.diagnostics_models import THRESHOLDS, Issue, Remedy


def detect_duplicates(df: pd.DataFrame) -> list[Issue]:
    """Detecte les doublons exacts de lignes."""
    if df.empty:
        return []
    count, ratio = measurements.duplicate_rows(df)
    if ratio < THRESHOLDS["duplicate_ratio"]:
        return []

    return [Issue(
        code="duplicates",
        columns=("<lignes>",),
        severity=min(1.0, ratio * 6),
        metric=ratio,
        metric_label="part de lignes dupliquees",
        title=f"{count} lignes dupliquees ({ratio:.1%})",
        detail=("Des observations repetees gonflent artificiellement la taille d'echantillon : "
                "les p-values deviennent trop petites et les intervalles trop etroits."),
        remedies=[Remedy(
            action="drop_duplicates", columns=("<lignes>",),
            label="Supprimer les lignes dupliquees",
            rationale=f"Retire {count} doublons exacts.",
        )],
    )]


def detect_constant_columns(df: pd.DataFrame) -> list[Issue]:
    """Detecte les colonnes de variance strictement nulle."""
    dead = measurements.constant_columns(df)
    if not dead:
        return []

    return [Issue(
        code="constant",
        columns=tuple(dead),
        severity=0.35,
        metric=len(dead),
        metric_label="colonnes sans variance",
        title=f"{len(dead)} colonne(s) sans aucune variation",
        detail=(f"{', '.join(dead[:5])} ne varie(nt) pas : ces colonnes ne peuvent rien expliquer "
                "et font echouer certains calculs (division par une variance nulle)."),
        remedies=[Remedy(
            action="drop_columns", columns=tuple(dead),
            label="Retirer les colonnes constantes",
            rationale="Aucune information exploitable.",
        )],
    )]


def detect_high_cardinality(df: pd.DataFrame) -> list[Issue]:
    """Colonnes textuelles quasi uniques : identifiants deguises en variables."""
    suspects = measurements.identifier_like_columns(
        df, uniqueness=THRESHOLDS["cardinality_ratio"])
    if not suspects:
        return []

    return [Issue(
        code="identifier_like",
        columns=tuple(suspects),
        severity=0.4,
        metric=len(suspects),
        metric_label="colonnes quasi uniques",
        title=f"{len(suspects)} colonne(s) se comportent comme des identifiants",
        detail=(f"{', '.join(suspects[:4])} : presque autant de modalites que de lignes. "
                "Utilisees comme predicteurs, elles provoquent du surapprentissage."),
        remedies=[Remedy(
            action="drop_columns", columns=tuple(suspects),
            label="Exclure les colonnes identifiantes",
            rationale="Sans pouvoir explicatif generalisable.",
        )],
    )]


def detect_missing_values(df: pd.DataFrame) -> list[Issue]:
    """Detecte le taux de valeurs manquantes par colonne."""
    issues: list[Issue] = []
    for col, ratio in measurements.missing_rates(df).items():
        if ratio < THRESHOLDS["missing_ratio"]:
            continue

        numeric = pd.api.types.is_numeric_dtype(df[col])
        remedies: list[Remedy] = []

        if ratio >= THRESHOLDS["missing_severe"]:
            remedies.append(Remedy(
                action="drop_columns", columns=(col,),
                label=f"Retirer {col}",
                rationale=f"{ratio:.0%} de valeurs manquantes : l'imputation inventerait l'essentiel.",
            ))

        remedies.append(Remedy(
            action="impute", columns=(col,),
            label=f"Imputer {col} par la {'mediane' if numeric else 'modalite la plus frequente'}",
            rationale="Conserve toutes les lignes ; sous-estime legerement la variance.",
            params={"strategy": "median" if numeric else "mode"},
        ))

        issues.append(Issue(
            code="missing",
            columns=(col,),
            severity=min(1.0, ratio * 2),
            metric=ratio,
            metric_label="taux de valeurs manquantes",
            title=f"{col} : {ratio:.1%} de valeurs manquantes",
            detail=("Supprimer les lignes incompletes amputerait l'echantillon ; "
                    "imputer sans le dire fausserait les intervalles de confiance."),
            remedies=remedies,
        ))

    return issues
