"""
Diagnostics : detection typee des problemes d'un jeu de donnees.

Chaque probleme detecte connait ses remedes possibles. C'est ce couplage qui
permet a la boucle correction/re-diagnostic de fonctionner sans regles ad hoc :
l'etape 7 se contente de choisir parmi les remedes que l'etape 6 a proposes.

Les remedes s'appuient sur le catalogue de transformations existant
(`app.core.transformations_catalog`), pas sur une implementation parallele.
"""

from __future__ import annotations

import pandas as pd

from app.core.pipeline.diagnostics_detectors import (
    detect_constant_columns,
    detect_duplicates,
    detect_heteroskedasticity,
    detect_high_cardinality,
    detect_missing_values,
    detect_multicollinearity,
    detect_non_stationarity,
    detect_outliers,
    detect_skewness,
)
from app.core.pipeline.diagnostics_models import (
    THRESHOLDS,
    Issue,
    Remedy,
    severity_total,
    summarize,
)


def diagnose(df: pd.DataFrame, target: str | None = None,
             is_timeseries: bool = False,
             kinds: dict[str, str] | None = None,
             notes: list[str] | None = None) -> list[Issue]:
    """Passe complete de diagnostic. Renvoie les problemes tries par gravite.

    `kinds` porte le typage declare : une colonne declaree categorielle n'est
    pas diagnostiquee comme une grandeur numerique, meme si elle contient des
    nombres.
    """
    if kinds:
        numeric = [c for c in df.columns if kinds.get(c) == "numeric"]
    else:
        numeric = [c for c in df.columns
                   if pd.api.types.is_numeric_dtype(df[c]) and df[c].nunique(dropna=True) > 2]

    notes = notes if notes is not None else []

    issues: list[Issue] = []
    issues += detect_duplicates(df)
    issues += detect_constant_columns(df)
    issues += detect_high_cardinality(df)
    issues += detect_missing_values(df)
    issues += detect_outliers(df, numeric)
    issues += detect_skewness(df, numeric)
    issues += detect_multicollinearity(df, numeric, target)
    if is_timeseries:
        issues += detect_non_stationarity(df, numeric)
    if target and target in df.columns and target in numeric:
        issues += detect_heteroskedasticity(df, numeric, target, notes)

    return sorted(issues, key=lambda i: -i.severity)


__all__ = [
    "THRESHOLDS",
    "Remedy",
    "Issue",
    "diagnose",
    "severity_total",
    "summarize",
]
