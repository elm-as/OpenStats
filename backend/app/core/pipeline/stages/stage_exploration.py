"""
Etapes d'exploration initiale du pipeline methodologique.

Etape 1 : Comprendre le probleme (cadrage, cible, type de probleme)
Etape 2 : Comprendre les donnees (types, modalites, valeurs manquantes)
Etape 3 : Nettoyage et qualite (diagnostic initial bloquant)
Etape 4 : Analyse univariee (distributions, asymetrie, aplatissement)
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from app.core.pipeline.diagnostics import diagnose, summarize
from app.core.pipeline.stages.stage_base import (
    MAX_CHART_CATEGORIES,
    StageResult,
    _categorical_columns,
    _chart,
    _kinds,
    _numeric_columns,
    _safe,
    _temporal_columns,
    get_current_schema,
)


def stage_problem(df: pd.DataFrame, target: str | None, task_hint: str | None) -> StageResult:
    schema = get_current_schema()
    numeric = _numeric_columns(df)
    categorical = _categorical_columns(df)
    temporal = _temporal_columns(df)
    identifiers = schema.identifiers if schema else []

    if target and target in df.columns:
        series = df[target].dropna()
        unique = series.nunique()
        if task_hint and task_hint != "auto":
            problem = task_hint
        elif temporal and pd.api.types.is_numeric_dtype(series) and unique > 12:
            problem = "forecast"
        elif unique == 2:
            problem = "classification_binaire"
        elif not pd.api.types.is_numeric_dtype(series) or unique <= 12:
            problem = "classification_multiclasse"
        else:
            problem = "regression"
        headline = f"Objectif : expliquer « {target} » — problème de {problem.replace('_', ' ')}."
    else:
        problem = "exploration"
        headline = "Aucune cible désignée : exploration de la structure du jeu de données."

    return StageResult(
        key="problem",
        index=1,
        title="Comprendre le problème",
        headline=headline,
        tables=[
            {
                "title": "Cadrage",
                "columns": ["Élément", "Valeur"],
                "rows": [
                    ["Observations", f"{len(df):,}".replace(",", " ")],
                    ["Variables", str(df.shape[1])],
                    ["Variable cible", target or "—"],
                    ["Type de problème", problem.replace("_", " ")],
                    ["Variables numériques", str(len(numeric))],
                    ["Variables qualitatives", str(len(categorical))],
                    ["Axe temporel", ", ".join(temporal) if temporal else "aucun"],
                    ["Identifiants exclus", ", ".join(identifiers) if identifiers else "aucun"],
                ],
            }
        ],
        data={
            "problem_type": problem,
            "target": target,
            "numeric": numeric,
            "categorical": categorical,
            "temporal": temporal,
            "identifiers": identifiers,
            "schema": schema.to_dict() if schema else {},
            "is_timeseries": bool(temporal),
        },
    )


def stage_understand(df: pd.DataFrame) -> StageResult:
    schema = get_current_schema()
    rows = []
    for col in df.columns:
        series = df[col]
        valid = series.dropna()
        kind = (
            "numérique"
            if pd.api.types.is_numeric_dtype(series)
            else "date"
            if pd.api.types.is_datetime64_any_dtype(series)
            else "qualitative"
        )
        example = valid.iloc[0] if len(valid) else None
        declared = schema.declared.get(col) if schema else None
        origin = {
            "numeric": "numérique",
            "categorical": "qualitative",
            "temporal": "temporel",
            "identifier": "identifiant",
        }.get(declared or "", "déduit")
        rows.append([
            col,
            kind,
            origin,
            f"{series.isna().mean():.1%}",
            int(valid.nunique()),
            str(_safe(example))[:26] if example is not None else "—",
        ])

    memory_mb = df.memory_usage(deep=True).sum() / 1_048_576

    return StageResult(
        key="understand",
        index=2,
        title="Comprendre les données",
        headline=f"{df.shape[1]} variables sur {len(df):,} observations "
        f"({memory_mb:.1f} Mo en mémoire).".replace(",", " "),
        tables=[
            {
                "title": "Dictionnaire des variables",
                "columns": [
                    "Variable",
                    "Type observé",
                    "Type déclaré",
                    "Manquants",
                    "Modalités",
                    "Exemple",
                ],
                "rows": rows,
            }
        ],
        charts=[
            _chart(
                "missing_matrix",
                "Valeurs manquantes par variable",
                labels=list(df.columns),
                values=[round(float(df[c].isna().mean()), 4) for c in df.columns],
            )
        ],
        data={"memory_mb": round(memory_mb, 2)},
    )


def stage_quality(df: pd.DataFrame, target: str | None, is_timeseries: bool) -> StageResult:
    issues = diagnose(df, target=target, is_timeseries=is_timeseries, kinds=_kinds())
    counts = summarize(issues)

    return StageResult(
        key="quality",
        index=3,
        title="Nettoyage & qualité",
        headline=(
            f"{counts['count']} problème(s) de qualité détecté(s), "
            f"dont {counts['blocking']} bloquant(s) pour la modélisation."
            if issues
            else "Aucun problème de qualité détecté."
        ),
        tables=(
            [
                {
                    "title": "État des lieux",
                    "columns": ["Problème", "Variables", "Gravité", "Bloquant"],
                    "rows": [
                        [
                            i.title,
                            ", ".join(i.columns[:3]),
                            round(float(i.severity), 2),
                            "oui" if i.blocks_modeling else "non",
                        ]
                        for i in issues
                    ],
                }
            ]
            if issues
            else []
        ),
        data={"summary": counts, "issues": [i.to_dict() for i in issues]},
    )


def stage_univariate(df: pd.DataFrame) -> StageResult:
    from scipy import stats as sps

    numeric = _numeric_columns(df)
    categorical = [
        c for c in _categorical_columns(df) if df[c].nunique(dropna=True) <= MAX_CHART_CATEGORIES
    ]

    numeric_rows = []
    charts = []

    for col in numeric[:20]:
        series = pd.to_numeric(df[col], errors="coerce").dropna()
        if series.empty:
            continue
        # scipy exige au moins 3 points et une variance non nulle ; en
        # dessous, les moments d'ordre 3 et 4 ne sont pas definis.
        shaped = len(series) >= 3 and series.nunique() > 1
        skew = float(sps.skew(series)) if shaped else 0.0
        kurt = float(sps.kurtosis(series)) if shaped else 0.0
        numeric_rows.append([
            col,
            int(len(series)),
            _safe(series.mean()),
            _safe(series.std()),
            _safe(series.min()),
            _safe(series.quantile(0.5)),
            _safe(series.max()),
            round(skew, 3),
            round(kurt, 3),
        ])
        if len(charts) < 8:
            counts, edges = np.histogram(series, bins=min(30, max(8, len(series) // 12)))
            charts.append(
                _chart(
                    "histogram",
                    f"Distribution de {col}",
                    column=col,
                    bins=[round(float(e), 6) for e in edges.tolist()],
                    counts=[int(c) for c in counts.tolist()],
                    mean=_safe(series.mean()),
                    median=_safe(series.median()),
                )
            )

    categorical_rows = []
    for col in categorical[:15]:
        counts = df[col].value_counts(dropna=True)
        if counts.empty:
            continue
        top = counts.index[0]
        categorical_rows.append([
            col,
            int(counts.size),
            str(top)[:24],
            f"{counts.iloc[0] / counts.sum():.1%}",
        ])
        if len(charts) < 12:
            head = counts.head(MAX_CHART_CATEGORIES)
            charts.append(
                _chart(
                    "bar",
                    f"Répartition de {col}",
                    column=col,
                    labels=[str(k)[:28] for k in head.index],
                    values=[int(v) for v in head.values],
                )
            )

    tables = []
    if numeric_rows:
        tables.append({
            "title": "Variables numériques",
            "columns": [
                "Variable",
                "n",
                "Moyenne",
                "Écart-type",
                "Min",
                "Médiane",
                "Max",
                "Asymétrie",
                "Aplatissement",
            ],
            "rows": numeric_rows,
        })
    if categorical_rows:
        tables.append({
            "title": "Variables qualitatives",
            "columns": ["Variable", "Modalités", "Modalité dominante", "Part"],
            "rows": categorical_rows,
        })

    return StageResult(
        key="univariate",
        index=4,
        title="Analyse univariée",
        headline=(
            f"{len(numeric_rows)} variable(s) numérique(s) et "
            f"{len(categorical_rows)} qualitative(s) décrites."
        ),
        tables=tables,
        charts=charts,
    )
