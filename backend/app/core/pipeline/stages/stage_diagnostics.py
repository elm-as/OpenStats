"""
Etapes de croisement, diagnostics statistiques et boucle de remédiation.

Etape 5 : Analyse bivariee / multivariee (correlations, nuages, boites a moustaches)
Etape 6 : Diagnostic complet des problemes statistiques (multicolinearite, heteroscedasticite, outliers...)
Etape 7/8 : Corrections et boucle de re-diagnostic
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

from app.core.pipeline.diagnostics import diagnose, summarize
from app.core.pipeline.remediation import run_correction_loop
from app.core.pipeline.stages.stage_base import (
    MAX_CHART_CATEGORIES,
    MAX_SCATTER_POINTS,
    StageResult,
    _categorical_columns,
    _chart,
    _kinds,
    _numeric_columns,
    _safe,
)


def stage_bivariate(df: pd.DataFrame, target: str | None) -> StageResult:
    from scipy import stats as sps

    numeric = _numeric_columns(df)
    charts: list[dict[str, Any]] = []
    tables: list[dict[str, Any]] = []
    notes: list[str] = []

    if len(numeric) >= 2:
        corr = df[numeric].corr()
        charts.append(
            _chart(
                "heatmap",
                "Matrice de corrélation",
                labels=numeric,
                matrix=[[_safe(corr.loc[a, b]) for b in numeric] for a in numeric],
            )
        )

        pairs = []
        for i, a in enumerate(numeric):
            for b in numeric[i + 1 :]:
                sub = df[[a, b]].replace([np.inf, -np.inf], np.nan).dropna()
                if len(sub) < 4:
                    continue
                # Une paire constante n'a pas de correlation definie : on la saute.
                if sub[a].nunique() < 2 or sub[b].nunique() < 2:
                    continue
                r, p = sps.pearsonr(sub[a], sub[b])
                pairs.append([a, b, round(float(r), 4), _safe(p), len(sub)])
        pairs.sort(key=lambda row: -abs(row[2]))
        if pairs:
            tables.append({
                "title": "Corrélations les plus fortes",
                "columns": ["Variable A", "Variable B", "r", "p-value", "n"],
                "rows": pairs[:20],
            })

    # Relations avec la cible : nuage de points ou boites a moustaches.
    if target and target in df.columns and pd.api.types.is_numeric_dtype(df[target]):
        others = [c for c in numeric if c != target]
        ranked = sorted(
            others,
            key=lambda c: (
                -abs(df[[c, target]].dropna().corr().iloc[0, 1])
                if df[[c, target]].dropna().shape[0] > 3
                else 0
            ),
        )
        for col in ranked[:4]:
            sub = df[[col, target]].replace([np.inf, -np.inf], np.nan).dropna()
            if len(sub) < 4:
                continue
            if len(sub) > MAX_SCATTER_POINTS:
                sub = sub.sample(MAX_SCATTER_POINTS, random_state=0)
                notes.append(
                    f"Nuage {col}/{target} : {MAX_SCATTER_POINTS} points échantillonnés."
                )
            charts.append(
                _chart(
                    "scatter",
                    f"{target} en fonction de {col}",
                    x_col=col,
                    y_col=target,
                    x=[_safe(v) for v in sub[col]],
                    y=[_safe(v) for v in sub[target]],
                )
            )

        # La cible est exclue des variables de regroupement : la croiser avec
        # elle-meme produit un DataFrame a colonnes dupliquees, que groupby
        # refuse.
        splitters = [c for c in _categorical_columns(df) if c != target][:3]
        for col in splitters:
            if df[col].nunique(dropna=True) > MAX_CHART_CATEGORIES:
                continue
            groups = [
                (str(name), [_safe(v) for v in group[target].dropna()])
                for name, group in df[[col, target]].dropna().groupby(col, observed=True)
            ]
            groups = [(name, values) for name, values in groups if len(values) >= 5]
            if len(groups) >= 2:
                charts.append(
                    _chart(
                        "box",
                        f"{target} selon {col}",
                        group_col=col,
                        value_col=target,
                        groups=[{"name": name, "values": values} for name, values in groups],
                    )
                )

    return StageResult(
        key="bivariate",
        index=5,
        title="Analyse bivariée & multivariée",
        headline=(
            f"{len(numeric)} variables numériques croisées"
            + (f", relations avec « {target} » mises en évidence." if target else ".")
        ),
        tables=tables,
        charts=charts,
        notes=notes,
    )


def stage_diagnostics(df: pd.DataFrame, target: str | None, is_timeseries: bool) -> StageResult:
    issues = diagnose(df, target=target, is_timeseries=is_timeseries, kinds=_kinds())
    counts = summarize(issues)

    return StageResult(
        key="diagnostics",
        index=6,
        title="Diagnostic des problèmes",
        headline=(
            f"{counts['count']} problème(s) identifié(s) — "
            f"gravité cumulée {counts['severity_total']:.2f}."
            if issues
            else "Aucun problème statistique bloquant."
        ),
        tables=(
            [
                {
                    "title": "Problèmes détectés et remèdes proposés",
                    "columns": [
                        "Problème",
                        "Variables",
                        "Mesure",
                        "Gravité",
                        "Remède proposé",
                    ],
                    "rows": [
                        [
                            i.title,
                            ", ".join(i.columns[:3]),
                            (
                                f"{i.metric:.4g} ({i.metric_label})"
                                if i.metric is not None
                                else "—"
                            ),
                            f"{i.severity:.2f}",
                            i.remedies[0].label if i.remedies else "aucun",
                        ]
                        for i in issues
                    ],
                }
            ]
            if issues
            else []
        ),
        charts=(
            [
                _chart(
                    "severity_bar",
                    "Gravité par problème",
                    labels=[i.title[:44] for i in issues[:12]],
                    values=[round(i.severity, 3) for i in issues[:12]],
                )
            ]
            if issues
            else []
        ),
        data={"summary": counts, "issues": [i.to_dict() for i in issues]},
    )


def stage_correction(
    df: pd.DataFrame,
    target: str | None,
    is_timeseries: bool,
    max_iterations: int,
    allow_aggressive: bool,
) -> tuple[StageResult, pd.DataFrame]:
    report, corrected = run_correction_loop(
        df,
        target=target,
        is_timeseries=is_timeseries,
        max_iterations=max_iterations,
        allow_aggressive=allow_aggressive,
        kinds=_kinds(),
    )

    kept = [it for it in report["iterations"] if it["kept"]]
    rows = []
    for iteration in report["iterations"]:
        for applied in iteration["applied"]:
            rows.append([
                str(iteration["index"]),
                applied["label"],
                ", ".join(applied["columns"][:3]),
                (
                    "appliqué"
                    if iteration["kept"] and applied["ok"]
                    else ("annulé" if applied["ok"] else "échec")
                ),
                applied["message"],
            ])

    return (
        StageResult(
            key="correction",
            index=7,
            title="Transformations & re-diagnostic",
            headline=(
                f"{len(kept)} itération(s) retenue(s) : gravité "
                f"{report['initial']['severity_total']:.2f} → "
                f"{report['final']['severity_total']:.2f}. {report['stop_reason']}."
            ),
            tables=(
                [
                    {
                        "title": "Corrections tentées, itération par itération",
                        "columns": ["Itération", "Correction", "Variables", "Statut", "Effet"],
                        "rows": rows,
                    }
                ]
                if rows
                else []
            ),
            charts=(
                [
                    _chart(
                        "severity_progress",
                        "Gravité cumulée au fil des itérations",
                        labels=["initial"]
                        + [f"itér. {it['index']}" for it in report["iterations"]],
                        values=[round(report["initial"]["severity_total"], 3)]
                        + [round(it["severity_after"], 3) for it in report["iterations"]],
                    )
                ]
                if report["iterations"]
                else []
            ),
            notes=[f"Arrêt : {report['stop_reason']}."],
            data=report,
        ),
        corrected,
    )
