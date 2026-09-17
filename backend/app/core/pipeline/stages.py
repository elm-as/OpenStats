"""
Orchestrateur des etapes d'analyse.

Deroule la methodologie complete, de la comprehension du probleme a la
presentation, avec la boucle correction/re-diagnostic entre les etapes 7 et 8 :

    1 comprendre le probleme      7 transformations  ─┐
    2 comprendre les donnees      8 re-diagnostic  ───┘ (boucle tant qu'utile)
    3 nettoyage / qualite         9 modelisation
    4 analyse univariee          10 validation
    5 analyse bivariee           11 interpretation
    6 diagnostics                12 presentation

Chaque etape produit un `StageResult` : des tableaux, des specifications de
graphiques et une conclusion en clair. Les specifications de graphiques sont
consommees telles quelles par les composants Plotly du frontend.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Iterator

import numpy as np
import pandas as pd

from app.core.statistical_attempt import attempt

from app.core.pipeline.diagnostics import diagnose, summarize
from app.core.pipeline.remediation import run_correction_loop
from app.core.pipeline.schema import (
    Schema, analysable_columns, apply_schema, normalize_declared, sort_by_time,
)

MAX_CHART_CATEGORIES = 14
MAX_SCATTER_POINTS = 1200


@dataclass
class StageResult:
    """Sortie d'une etape : de quoi afficher un onglet complet."""

    key: str
    index: int
    title: str
    status: str = "success"              # success | skipped | error
    headline: str = ""
    tables: list[dict[str, Any]] = field(default_factory=list)
    charts: list[dict[str, Any]] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
    data: dict[str, Any] = field(default_factory=dict)
    duration_ms: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "key": self.key, "index": self.index, "title": self.title,
            "status": self.status, "headline": self.headline,
            "tables": self.tables, "charts": self.charts, "notes": self.notes,
            "data": self.data, "duration_ms": self.duration_ms,
        }


def _chart(kind: str, title: str, **payload: Any) -> dict[str, Any]:
    """Specification de graphique, rendue cote frontend par les composants viz/."""
    return {"kind": kind, "title": title, **payload}


# Schema courant de la session : renseigne par `run_pipeline`, il fait autorite
# sur l'inference automatique pour toutes les etapes.
_SCHEMA: Schema | None = None


def _numeric_columns(df: pd.DataFrame) -> list[str]:
    if _SCHEMA is not None:
        return [c for c in df.columns if _SCHEMA.kinds.get(c) == "numeric"]
    return [c for c in df.columns
            if pd.api.types.is_numeric_dtype(df[c]) and df[c].nunique(dropna=True) > 2]


def _categorical_columns(df: pd.DataFrame) -> list[str]:
    if _SCHEMA is not None:
        return [c for c in df.columns if _SCHEMA.kinds.get(c) == "categorical"]
    return [c for c in df.columns
            if not pd.api.types.is_numeric_dtype(df[c]) or df[c].nunique(dropna=True) <= 2]


def _temporal_columns(df: pd.DataFrame) -> list[str]:
    if _SCHEMA is not None:
        return [c for c in df.columns if _SCHEMA.kinds.get(c) == "temporal"]
    return [c for c in df.columns if pd.api.types.is_datetime64_any_dtype(df[c])]


def _kinds() -> dict[str, str] | None:
    """Typage declare de la session, transmis aux diagnostics."""
    return _SCHEMA.kinds if _SCHEMA is not None else None


def _safe(value: Any) -> Any:
    if value is None or (isinstance(value, float) and (np.isnan(value) or np.isinf(value))):
        return None
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        v = float(value)
        return None if (np.isnan(v) or np.isinf(v)) else round(v, 6)
    return value


# ── Etape 1 : comprendre le probleme ─────────────────────────────────────

def stage_problem(df: pd.DataFrame, target: str | None, task_hint: str | None) -> StageResult:
    numeric = _numeric_columns(df)
    categorical = _categorical_columns(df)
    temporal = _temporal_columns(df)
    identifiers = _SCHEMA.identifiers if _SCHEMA else []

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
        key="problem", index=1, title="Comprendre le problème",
        headline=headline,
        tables=[{
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
        }],
        data={"problem_type": problem, "target": target,
              "numeric": numeric, "categorical": categorical, "temporal": temporal,
              "identifiers": identifiers,
              "schema": _SCHEMA.to_dict() if _SCHEMA else {},
              "is_timeseries": bool(temporal)},
    )


# ── Etape 2 : comprendre les donnees ─────────────────────────────────────

def stage_understand(df: pd.DataFrame) -> StageResult:
    rows = []
    for col in df.columns:
        series = df[col]
        valid = series.dropna()
        kind = ("numérique" if pd.api.types.is_numeric_dtype(series)
                else "date" if pd.api.types.is_datetime64_any_dtype(series)
                else "qualitative")
        example = valid.iloc[0] if len(valid) else None
        declared = (_SCHEMA.declared.get(col) if _SCHEMA else None)
        origin = {
            "numeric": "numérique", "categorical": "qualitative",
            "temporal": "temporel", "identifier": "identifiant",
        }.get(declared or "", "déduit")
        rows.append([
            col, kind, origin, f"{series.isna().mean():.1%}", str(valid.nunique()),
            str(_safe(example))[:26] if example is not None else "—",
        ])

    memory_mb = df.memory_usage(deep=True).sum() / 1_048_576

    return StageResult(
        key="understand", index=2, title="Comprendre les données",
        headline=f"{df.shape[1]} variables sur {len(df):,} observations "
                 f"({memory_mb:.1f} Mo en mémoire).".replace(",", " "),
        tables=[{
            "title": "Dictionnaire des variables",
            "columns": ["Variable", "Type observé", "Type déclaré", "Manquants",
                        "Modalités", "Exemple"],
            "rows": rows,
        }],
        charts=[_chart("missing_matrix", "Valeurs manquantes par variable",
                       labels=list(df.columns),
                       values=[round(float(df[c].isna().mean()), 4) for c in df.columns])],
        data={"memory_mb": round(memory_mb, 2)},
    )


# ── Etape 3 : nettoyage / qualite ────────────────────────────────────────

def stage_quality(df: pd.DataFrame, target: str | None, is_timeseries: bool) -> StageResult:
    issues = diagnose(df, target=target, is_timeseries=is_timeseries, kinds=_kinds())
    counts = summarize(issues)

    return StageResult(
        key="quality", index=3, title="Nettoyage & qualité",
        headline=(f"{counts['count']} problème(s) de qualité détecté(s), "
                  f"dont {counts['blocking']} bloquant(s) pour la modélisation."
                  if issues else "Aucun problème de qualité détecté."),
        tables=[{
            "title": "État des lieux",
            "columns": ["Problème", "Variables", "Gravité", "Bloquant"],
            "rows": [[i.title, ", ".join(i.columns[:3]), f"{i.severity:.2f}",
                      "oui" if i.blocks_modeling else "non"] for i in issues],
        }] if issues else [],
        data={"summary": counts, "issues": [i.to_dict() for i in issues]},
    )


# ── Etape 4 : analyse univariee ──────────────────────────────────────────

def stage_univariate(df: pd.DataFrame) -> StageResult:
    from scipy import stats as sps

    numeric = _numeric_columns(df)
    categorical = [c for c in _categorical_columns(df)
                   if df[c].nunique(dropna=True) <= MAX_CHART_CATEGORIES]

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
            col, str(len(series)), _safe(series.mean()), _safe(series.std()),
            _safe(series.min()), _safe(series.quantile(0.5)), _safe(series.max()),
            round(skew, 3), round(kurt, 3),
        ])
        if len(charts) < 8:
            counts, edges = np.histogram(series, bins=min(30, max(8, len(series) // 12)))
            charts.append(_chart(
                "histogram", f"Distribution de {col}",
                column=col,
                bins=[round(float(e), 6) for e in edges.tolist()],
                counts=[int(c) for c in counts.tolist()],
                mean=_safe(series.mean()), median=_safe(series.median()),
            ))

    categorical_rows = []
    for col in categorical[:15]:
        counts = df[col].value_counts(dropna=True)
        if counts.empty:
            continue
        top = counts.index[0]
        categorical_rows.append([
            col, str(counts.size), str(top)[:24],
            f"{counts.iloc[0] / counts.sum():.1%}",
        ])
        if len(charts) < 12:
            head = counts.head(MAX_CHART_CATEGORIES)
            charts.append(_chart(
                "bar", f"Répartition de {col}",
                column=col,
                labels=[str(k)[:28] for k in head.index],
                values=[int(v) for v in head.values],
            ))

    tables = []
    if numeric_rows:
        tables.append({
            "title": "Variables numériques",
            "columns": ["Variable", "n", "Moyenne", "Écart-type", "Min", "Médiane", "Max",
                        "Asymétrie", "Aplatissement"],
            "rows": numeric_rows,
        })
    if categorical_rows:
        tables.append({
            "title": "Variables qualitatives",
            "columns": ["Variable", "Modalités", "Modalité dominante", "Part"],
            "rows": categorical_rows,
        })

    return StageResult(
        key="univariate", index=4, title="Analyse univariée",
        headline=f"{len(numeric_rows)} variable(s) numérique(s) et "
                 f"{len(categorical_rows)} qualitative(s) décrites.",
        tables=tables, charts=charts,
    )


# ── Etape 5 : analyse bivariee / multivariee ─────────────────────────────

def stage_bivariate(df: pd.DataFrame, target: str | None) -> StageResult:
    from scipy import stats as sps

    numeric = _numeric_columns(df)
    charts: list[dict[str, Any]] = []
    tables: list[dict[str, Any]] = []
    notes: list[str] = []

    if len(numeric) >= 2:
        corr = df[numeric].corr()
        charts.append(_chart(
            "heatmap", "Matrice de corrélation",
            labels=numeric,
            matrix=[[_safe(corr.loc[a, b]) for b in numeric] for a in numeric],
        ))

        pairs = []
        for i, a in enumerate(numeric):
            for b in numeric[i + 1:]:
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
            key=lambda c: -abs(df[[c, target]].dropna().corr().iloc[0, 1])
            if df[[c, target]].dropna().shape[0] > 3 else 0,
        )
        for col in ranked[:4]:
            sub = df[[col, target]].replace([np.inf, -np.inf], np.nan).dropna()
            if len(sub) < 4:
                continue
            if len(sub) > MAX_SCATTER_POINTS:
                sub = sub.sample(MAX_SCATTER_POINTS, random_state=0)
                notes.append(f"Nuage {col}/{target} : {MAX_SCATTER_POINTS} points échantillonnés.")
            charts.append(_chart(
                "scatter", f"{target} en fonction de {col}",
                x_col=col, y_col=target,
                x=[_safe(v) for v in sub[col]], y=[_safe(v) for v in sub[target]],
            ))

        # La cible est exclue des variables de regroupement : la croiser avec
        # elle-meme produit un DataFrame a colonnes dupliquees, que groupby
        # refuse.
        splitters = [c for c in _categorical_columns(df) if c != target][:3]
        for col in splitters:
            if df[col].nunique(dropna=True) > MAX_CHART_CATEGORIES:
                continue
            groups = [(str(name), [_safe(v) for v in group[target].dropna()])
                      for name, group in df[[col, target]].dropna().groupby(col, observed=True)]
            groups = [(name, values) for name, values in groups if len(values) >= 5]
            if len(groups) >= 2:
                charts.append(_chart(
                    "box", f"{target} selon {col}",
                    group_col=col, value_col=target,
                    groups=[{"name": name, "values": values} for name, values in groups],
                ))

    return StageResult(
        key="bivariate", index=5, title="Analyse bivariée & multivariée",
        headline=(f"{len(numeric)} variables numériques croisées"
                  + (f", relations avec « {target} » mises en évidence." if target else ".")),
        tables=tables, charts=charts, notes=notes,
    )


# ── Etapes 6, 7 et 8 : diagnostic, transformations, re-diagnostic ────────

def stage_diagnostics(df: pd.DataFrame, target: str | None, is_timeseries: bool) -> StageResult:
    issues = diagnose(df, target=target, is_timeseries=is_timeseries, kinds=_kinds())
    counts = summarize(issues)

    return StageResult(
        key="diagnostics", index=6, title="Diagnostic des problèmes",
        headline=(f"{counts['count']} problème(s) identifié(s) — "
                  f"gravité cumulée {counts['severity_total']:.2f}."
                  if issues else "Aucun problème statistique bloquant."),
        tables=[{
            "title": "Problèmes détectés et remèdes proposés",
            "columns": ["Problème", "Variables", "Mesure", "Gravité", "Remède proposé"],
            "rows": [[
                i.title, ", ".join(i.columns[:3]),
                f"{i.metric:.4g} ({i.metric_label})" if i.metric is not None else "—",
                f"{i.severity:.2f}",
                i.remedies[0].label if i.remedies else "aucun",
            ] for i in issues],
        }] if issues else [],
        charts=[_chart("severity_bar", "Gravité par problème",
                       labels=[i.title[:44] for i in issues[:12]],
                       values=[round(i.severity, 3) for i in issues[:12]])] if issues else [],
        data={"summary": counts, "issues": [i.to_dict() for i in issues]},
    )


def stage_correction(df: pd.DataFrame, target: str | None, is_timeseries: bool,
                     max_iterations: int, allow_aggressive: bool) -> tuple[StageResult, pd.DataFrame]:
    report, corrected = run_correction_loop(
        df, target=target, is_timeseries=is_timeseries,
        max_iterations=max_iterations, allow_aggressive=allow_aggressive,
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
                "appliqué" if iteration["kept"] and applied["ok"]
                else ("annulé" if applied["ok"] else "échec"),
                applied["message"],
            ])

    return StageResult(
        key="correction", index=7, title="Transformations & re-diagnostic",
        headline=(f"{len(kept)} itération(s) retenue(s) : gravité "
                  f"{report['initial']['severity_total']:.2f} → "
                  f"{report['final']['severity_total']:.2f}. {report['stop_reason']}."),
        tables=[{
            "title": "Corrections tentées, itération par itération",
            "columns": ["Itération", "Correction", "Variables", "Statut", "Effet"],
            "rows": rows,
        }] if rows else [],
        charts=[_chart(
            "severity_progress", "Gravité cumulée au fil des itérations",
            labels=["initial"] + [f"itér. {it['index']}" for it in report["iterations"]],
            values=[round(report["initial"]["severity_total"], 3)]
                   + [round(it["severity_after"], 3) for it in report["iterations"]],
        )] if report["iterations"] else [],
        notes=[f"Arrêt : {report['stop_reason']}."],
        data=report,
    ), corrected


# ── Etapes 9 a 12 : modelisation, validation, interpretation ─────────────

def stage_modeling(df: pd.DataFrame, target: str | None, problem: str,
                   modeling_flags: list[str], budget_sec: float = 90.0) -> StageResult:
    """Compare les modeles applicables et retient le meilleur.

    Le score est toujours rapporte a une reference naive : sans elle, un R2 de
    0.3 peut aussi bien etre un bon resultat qu'un echec.
    """
    from app.core.pipeline.models import compare_models, fit_best, recommend

    if not target or target not in df.columns:
        return StageResult(key="modeling", index=9, title="Modélisation", status="skipped",
                           headline="Aucune cible désignée : pas de modélisation.")

    temporal = _temporal_columns(df)
    is_timeseries = bool(temporal)

    # Serie temporelle : la comparaison porte sur la serie, pas sur un tableau.
    # Le budget y est plus large : ARIMA et Prophet sont lents, et les ecarter
    # faute de temps priverait la comparaison de ses candidats les plus serieux.
    if problem == "forecast":
        return _stage_forecast(df, target, temporal, max(budget_sec, 240.0))

    features = [c for c in df.columns if c != target and c not in temporal]
    frame = df[features + [target]].copy()
    for col in features:
        if not pd.api.types.is_numeric_dtype(frame[col]):
            frame[col] = pd.Categorical(frame[col]).codes
    frame = frame.apply(pd.to_numeric, errors="coerce")
    frame = frame.replace([np.inf, -np.inf], np.nan).dropna()

    reco = recommend(problem, len(frame), len(features), is_timeseries)

    if len(frame) < 30 or not features:
        return StageResult(
            key="modeling", index=9, title="Modélisation", status="skipped",
            headline=("Trop peu d'observations complètes pour entraîner un modèle."
                      if features else "Aucune variable explicative disponible."),
            tables=[_candidates_table(reco)],
            data={"recommendation": reco},
        )

    X = frame[features]
    y = frame[target]
    if problem != "regression":
        y = pd.Series(pd.Categorical(y).codes, index=y.index)

    comparison = compare_models(X, y, problem, is_timeseries=is_timeseries,
                                budget_sec=budget_sec)
    if comparison.get("error"):
        return StageResult(key="modeling", index=9, title="Modélisation", status="skipped",
                           headline=comparison["error"],
                           tables=[_candidates_table(reco)],
                           data={"recommendation": reco, "comparison": comparison})

    best = comparison.get("best")
    charts: list[dict[str, Any]] = []
    notes: list[str] = []

    if best:
        gain = best["gain_vs_baseline"]
        useful = gain > 0.02
        headline = (f"{best['label']} arrive en tête — {comparison['metric']} = "
                    f"{best['score']:.3f} (± {best['std']:.3f}), "
                    f"{'soit ' if useful else 'seulement '}{gain:+.3f} "
                    f"par rapport à la référence {comparison['baseline_label']} "
                    f"({comparison['baseline']:.3f}).")
        if not useful:
            notes.append("Aucun modèle ne dépasse nettement la référence naïve : les variables "
                         "disponibles n'expliquent pas la cible.")

        charts.append(_chart(
            "model_comparison", f"Comparaison des modèles — {comparison['metric']}",
            labels=[r["label"] for r in comparison["results"] if r["status"] == "ok"],
            values=[r["score"] for r in comparison["results"] if r["status"] == "ok"],
            baseline=comparison["baseline"],
            baseline_label=comparison["baseline_label"],
            metric=comparison["metric"],
        ))

        estimator = fit_best(X, y, best["key"], len(frame), len(features))
        if estimator is not None:
            charts += _model_charts(estimator, X, y, features, problem)
    else:
        headline = "Aucun modèle n'a pu être évalué sur ces données."

    if "robust_se" in modeling_flags:
        notes.append("Hétéroscédasticité détectée : utiliser des erreurs standard robustes "
                     "(HC1) pour tout test sur les coefficients.")
    notes.append(f"Validation : {comparison['validation']}.")

    return StageResult(
        key="modeling", index=9, title="Modélisation",
        headline=headline,
        tables=[_comparison_table(comparison), _candidates_table(reco)],
        charts=charts, notes=notes,
        data={
            "recommendation": reco, "comparison": comparison,
            "best": best["label"] if best else None,
            "best_key": best["key"] if best else None,
            "score": best["score"] if best else None,
            "baseline": comparison["baseline"],
            "gain_vs_baseline": best["gain_vs_baseline"] if best else None,
            "metric": comparison["metric"],
            "n_features": len(features), "n_rows": len(frame),
        },
    )


def _stage_forecast(df: pd.DataFrame, target: str, temporal: list[str],
                    budget_sec: float) -> StageResult:
    """Comparaison de previsionnistes sur la serie cible."""
    from app.core.pipeline.models import recommend
    from app.core.pipeline.temporal_models import compare_temporal

    frame = df[[temporal[0], target]].dropna() if temporal else df[[target]].dropna()
    if temporal:
        frame = frame.sort_values(temporal[0])
        series = pd.Series(pd.to_numeric(frame[target], errors="coerce").to_numpy(),
                           index=pd.DatetimeIndex(frame[temporal[0]]))
    else:
        series = pd.to_numeric(frame[target], errors="coerce")
    series = series.dropna()

    reco = recommend("forecast", len(series), 1, True)
    comparison = compare_temporal(series, budget_sec=budget_sec)

    if comparison.get("error"):
        return StageResult(key="modeling", index=9, title="Modélisation", status="skipped",
                           headline=comparison["error"],
                           tables=[_candidates_table(reco)],
                           data={"recommendation": reco, "comparison": comparison})

    best = comparison.get("best")
    baseline = comparison.get("baseline")

    if best and comparison["beats_baseline"]:
        skill = best.get("skill_vs_naive", 0)
        headline = (f"{best['label']} arrive en tête — MAE = {best['mae']:.4g}, "
                    f"soit {skill:.0%} d'erreur en moins que la persistance "
                    f"({baseline:.4g}).")
    elif best:
        headline = (f"Aucun modèle ne bat la persistance (MAE = {baseline:.4g}) : "
                    "la série n'est pas prévisible au-delà de sa dernière valeur.")
    else:
        headline = "Aucun modèle de prévision n'a pu être évalué."

    charts = []
    ok_results = [r for r in comparison["results"] if r["status"] == "ok"]
    if ok_results:
        charts.append(_chart(
            "model_comparison", "Comparaison des prévisionnistes — MAE (plus bas = meilleur)",
            labels=[r["label"] for r in ok_results],
            values=[r["mae"] for r in ok_results],
            baseline=baseline, baseline_label="persistance",
            metric="MAE", lower_is_better=True,
        ))

    notes = [f"Validation : {comparison['validation']}.",
             f"Période saisonnière détectée : {comparison['seasonal_period']}."]

    return StageResult(
        key="modeling", index=9, title="Modélisation",
        headline=headline,
        tables=[_temporal_table(comparison), _candidates_table(reco)],
        charts=charts, notes=notes,
        data={
            "recommendation": reco, "comparison": comparison,
            "best": best["label"] if best else None,
            "best_key": best["key"] if best else None,
            "score": (best.get("skill_vs_naive") if best else None),
            "metric": "MAE", "baseline": baseline,
            "beats_baseline": comparison["beats_baseline"],
            "n_rows": comparison["n_points"], "n_features": 1,
        },
    )


def _comparison_table(comparison: dict[str, Any]) -> dict[str, Any]:
    rows = []
    for entry in comparison["results"]:
        if entry["status"] == "ok":
            rows.append([entry["label"], entry["family"], round(entry["score"], 4),
                         round(entry["std"], 4), f"{entry['gain_vs_baseline']:+.4f}", "évalué"])
        else:
            rows.append([entry["label"], entry["family"], "—", "—", "—",
                         entry.get("reason", entry["status"])])
    rows.append([f"Référence ({comparison['baseline_label']})", "reference",
                 round(comparison["baseline"], 4), "—", "0.0000", "référence"])
    return {
        "title": f"Comparaison des modèles — {comparison['metric']}",
        "columns": ["Modèle", "Famille", comparison["metric"], "Écart-type",
                    "Gain vs référence", "Statut"],
        "rows": rows,
    }


def _temporal_table(comparison: dict[str, Any]) -> dict[str, Any]:
    rows = []
    for entry in comparison["results"]:
        if entry["status"] == "ok":
            skill = entry.get("skill_vs_naive")
            rows.append([entry["label"], entry["family"], round(entry["mae"], 6),
                         round(entry["mae_std"], 6),
                         f"{skill:+.1%}" if skill is not None else "—", "évalué"])
        else:
            rows.append([entry["label"], entry["family"], "—", "—", "—",
                         entry.get("reason", entry["status"])])
    return {
        "title": "Comparaison des prévisionnistes — MAE (plus bas = meilleur)",
        "columns": ["Modèle", "Famille", "MAE", "Écart-type", "Gain vs persistance", "Statut"],
        "rows": rows,
    }


# Un modele ecarte parce qu'il vise un autre type de probleme n'apprend rien a
# l'utilisateur : on ne montre que ce qui aurait pu s'appliquer ici.
_IRRELEVANT = "ne s'applique pas à ce type de problème"


def _candidates_table(reco: dict[str, Any]) -> dict[str, Any]:
    """Ce qui est applicable, ce qui ne l'est pas, et pourquoi."""
    rows = []
    for entry in reco["candidates"]:
        if entry["reason"] == _IRRELEVANT:
            continue
        rows.append([
            entry["label"], entry["family"],
            "oui" if entry["applicable"] else "non",
            "recommandé" if entry["key"] in reco["recommended"] else "",
            entry["reason"] or entry.get("strengths", ""),
        ])
    return {
        "title": "Modèles envisageables sur ce jeu de données",
        "columns": ["Modèle", "Famille", "Applicable", "Recommandé", "Motif"],
        "rows": rows,
    }


def _model_charts(estimator, X, y, features: list[str], problem: str) -> list[dict[str, Any]]:
    """Importance des variables et residus du meilleur modele."""
    charts: list[dict[str, Any]] = []

    importances = getattr(estimator, "feature_importances_", None)
    if importances is None:
        coefficients = getattr(estimator, "coef_", None)
        if coefficients is not None:
            importances = np.abs(np.asarray(coefficients).ravel()[:len(features)])
    if importances is not None and len(importances) == len(features):
        ranked = sorted(zip(features, importances), key=lambda kv: -abs(float(kv[1])))[:15]
        charts.append(_chart("importance", "Poids des variables dans le meilleur modèle",
                             labels=[k for k, _ in ranked],
                             values=[round(float(v), 6) for _, v in ranked]))

    if problem == "regression":
        prediction = attempt(estimator.predict, X)
        if prediction:
            predicted = np.asarray(prediction.value, dtype=float)
            residuals = np.asarray(y, dtype=float) - predicted
            charts.append(_chart(
                "residuals", "Résidus du meilleur modèle",
                predicted=[_safe(v) for v in predicted[:MAX_SCATTER_POINTS]],
                residuals=[_safe(v) for v in residuals[:MAX_SCATTER_POINTS]]))

    return charts


def stage_validation(modeling: StageResult, correction: StageResult) -> StageResult:
    score = modeling.data.get("score")
    remaining = correction.data.get("final", {}).get("count", 0)
    blocking = correction.data.get("final", {}).get("blocking", 0)

    checks = [
        ["Score validé hors échantillon", "oui" if score is not None else "non",
         "Validation croisée : le score n'est pas gonflé par le réapprentissage."],
        ["Problèmes statistiques résiduels", str(remaining),
         "Chaque problème restant fragilise l'interprétation des coefficients."],
        ["Problèmes bloquants", str(blocking),
         "Un bloquant invalide les tests d'hypothèse du modèle."],
        ["Corrections réversibles", "oui",
         "Le jeu de données d'origine est conservé : chaque transformation peut être annulée."],
    ]

    healthy = blocking == 0 and score is not None
    return StageResult(
        key="validation", index=10, title="Validation",
        headline=("Modèle exploitable : aucun problème bloquant ne subsiste."
                  if healthy else "Résultats à interpréter avec prudence."),
        tables=[{"title": "Contrôles", "columns": ["Contrôle", "Valeur", "Pourquoi c'est important"],
                 "rows": checks}],
        data={"healthy": healthy},
    )


def stage_interpretation(stages: dict[str, StageResult], target: str | None) -> StageResult:
    correction = stages.get("correction")
    modeling = stages.get("modeling")
    points: list[str] = []

    if correction:
        initial = correction.data.get("initial", {}).get("severity_total", 0)
        final = correction.data.get("final", {}).get("severity_total", 0)
        removed = correction.data.get("columns_removed", [])
        if initial > final:
            points.append(f"La qualité du jeu de données a été améliorée : gravité cumulée "
                          f"{initial:.2f} → {final:.2f}.")
        if removed:
            points.append(f"Variables retirées car redondantes ou inexploitables : {', '.join(removed)}.")
        for issue in correction.data.get("remaining_issues", [])[:3]:
            points.append(f"Point de vigilance — {issue['title']}.")

    if modeling and modeling.data.get("score") is not None:
        score = modeling.data["score"]
        quality = "élevé" if score > 0.7 else "modéré" if score > 0.4 else "faible"
        points.append(f"Le pouvoir prédictif sur « {target} » est {quality} "
                      f"({modeling.data['best']}, score = {score:.3f}).")

    if not points:
        points.append("Aucun élément saillant : le jeu de données ne présente ni problème "
                      "majeur ni signal prédictif marqué.")

    return StageResult(
        key="interpretation", index=11, title="Interprétation",
        headline="Synthèse des enseignements.",
        tables=[{"title": "Enseignements", "columns": ["Constat"], "rows": [[p] for p in points]}],
        data={"points": points},
    )


# ── Execution complete ───────────────────────────────────────────────────

def run_pipeline(df: pd.DataFrame, target: str | None = None, task_hint: str | None = None,
                 max_iterations: int = 5, allow_aggressive: bool = True,
                 type_overrides: dict[str, Any] | None = None,
                 stored_profile: dict[str, Any] | None = None) -> Iterator[dict[str, Any]]:
    """Deroule la methodologie et emet un evenement par etape.

    Le typage declare par l'utilisateur (surcharges + profil d'import) fait
    autorite : les colonnes sont converties en consequence avant analyse.
    """
    global _SCHEMA
    started = time.time()
    stages: dict[str, StageResult] = {}

    declared = normalize_declared(type_overrides, stored_profile)
    working, schema = apply_schema(df, declared)
    _SCHEMA = schema
    working = sort_by_time(working, schema)
    # Les identifiants ne participent a aucune analyse.
    working = working[analysable_columns(working, schema)]

    def emit(result: StageResult, t0: float) -> dict[str, Any]:
        result.duration_ms = int((time.time() - t0) * 1000)
        stages[result.key] = result
        return {"type": "stage", "stage": result.to_dict()}

    yield {
        "type": "start", "total_stages": 11,
        "rows": len(working), "columns": working.shape[1],
        "schema": schema.to_dict(),
    }

    if schema.coerced or schema.failures:
        notes = []
        if schema.coerced:
            notes.append("Colonnes converties selon le type déclaré : "
                         + ", ".join(schema.coerced) + ".")
        if schema.failures:
            notes.append("Type déclaré inapplicable (contenu incompatible) : "
                         + ", ".join(schema.failures) + ".")
        yield {"type": "schema", "notes": notes, "schema": schema.to_dict()}

    t0 = time.time()
    problem = stage_problem(working, target, task_hint)
    yield emit(problem, t0)

    is_timeseries = bool(problem.data.get("is_timeseries"))
    problem_type = problem.data.get("problem_type", "exploration")

    t0 = time.time()
    yield emit(stage_understand(working), t0)

    t0 = time.time()
    yield emit(stage_quality(working, target, is_timeseries), t0)

    t0 = time.time()
    yield emit(stage_univariate(working), t0)

    t0 = time.time()
    yield emit(stage_bivariate(working, target), t0)

    t0 = time.time()
    yield emit(stage_diagnostics(working, target, is_timeseries), t0)

    t0 = time.time()
    correction, working = stage_correction(working, target, is_timeseries,
                                           max_iterations, allow_aggressive)
    yield emit(correction, t0)

    # Les etapes univariee et bivariee sont rejouees sur les donnees corrigees :
    # c'est ce qui rend l'effet des transformations visible.
    t0 = time.time()
    after = stage_univariate(working)
    after.key, after.index, after.title = "univariate_after", 8, "Analyse univariée (après correction)"
    after.headline = "Distributions après application des transformations retenues."
    yield emit(after, t0)

    t0 = time.time()
    modeling = stage_modeling(working, target, problem_type,
                              correction.data.get("modeling_flags", []))
    yield emit(modeling, t0)

    t0 = time.time()
    yield emit(stage_validation(modeling, correction), t0)

    t0 = time.time()
    yield emit(stage_interpretation(stages, target), t0)

    yield {
        "type": "complete",
        "elapsed_sec": round(time.time() - started, 2),
        "problem_type": problem_type,
        "target": target,
        "shape_before": {"rows": len(df), "columns": df.shape[1]},
        "shape_after": {"rows": len(working), "columns": working.shape[1]},
        "stages": [stages[k].to_dict() for k in stages],
    }
