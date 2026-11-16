"""
Etape 9 : Modelisation statistique et comparaison des modeles.

Compare les modeles applicables et retient le meilleur candidat.
Le score est systematiquement rapporte a une reference naive (baseline).
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

from app.core.statistical_attempt import attempt
from app.core.pipeline.stages.stage_base import (
    MAX_SCATTER_POINTS,
    StageResult,
    _chart,
    _safe,
    _temporal_columns,
)
from app.core.pipeline.stages.stage_forecast import stage_forecast

_IRRELEVANT = "ne s'applique pas à ce type de problème"


def stage_modeling(
    df: pd.DataFrame,
    target: str | None,
    problem: str,
    modeling_flags: list[str],
    budget_sec: float = 90.0,
) -> StageResult:
    """Compare les modeles applicables et retient le meilleur."""
    from app.core.pipeline.models import compare_models, fit_best, recommend

    if not target or target not in df.columns:
        return StageResult(
            key="modeling",
            index=9,
            title="Modélisation",
            status="skipped",
            headline="Aucune cible désignée : pas de modélisation.",
        )

    temporal = _temporal_columns(df)
    is_timeseries = bool(temporal)

    if problem == "forecast":
        return stage_forecast(
            df, target, temporal, max(budget_sec, 240.0), _candidates_table
        )

    features = [c for c in df.columns if c != target and c not in temporal]
    frame = df[features + [target]].copy()
    for col in features:
        if not pd.api.types.is_numeric_dtype(frame[col]):
            frame[col] = pd.Categorical(frame[col]).codes
    if problem != "regression" and not pd.api.types.is_numeric_dtype(frame[target]):
        frame[target] = pd.Categorical(frame[target]).codes
    elif problem == "regression" and not pd.api.types.is_numeric_dtype(frame[target]):
        from app.core.statistical_types import safe_convert_numeric
        frame[target], _ = safe_convert_numeric(frame[target], col_name=target)
    frame = frame.apply(pd.to_numeric, errors="coerce")
    frame = frame.replace([np.inf, -np.inf], np.nan).dropna()

    reco = recommend(problem, len(frame), len(features), is_timeseries)

    if len(frame) < 30 or not features:
        return StageResult(
            key="modeling",
            index=9,
            title="Modélisation",
            status="skipped",
            headline=(
                "Trop peu d'observations complètes pour entraîner un modèle."
                if features
                else "Aucune variable explicative disponible."
            ),
            tables=[_candidates_table(reco)],
            data={"recommendation": reco},
        )

    X = frame[features]
    y = frame[target]
    if problem != "regression":
        y = pd.Series(pd.Categorical(y).codes, index=y.index)

    comparison = compare_models(
        X, y, problem, is_timeseries=is_timeseries, budget_sec=budget_sec
    )
    if comparison.get("error"):
        return StageResult(
            key="modeling",
            index=9,
            title="Modélisation",
            status="skipped",
            headline=comparison["error"],
            tables=[_candidates_table(reco)],
            data={"recommendation": reco, "comparison": comparison},
        )

    best = comparison.get("best")
    charts: list[dict[str, Any]] = []
    notes: list[str] = []

    if best:
        gain = best["gain_vs_baseline"]
        useful = gain > 0.02
        headline = (
            f"{best['label']} arrive en tête — {comparison['metric']} = "
            f"{best['score']:.3f} (± {best['std']:.3f}), "
            f"{'soit ' if useful else 'seulement '}{gain:+.3f} "
            f"par rapport à la référence {comparison['baseline_label']} "
            f"({comparison['baseline']:.3f})."
        )
        if not useful:
            notes.append(
                "Aucun modèle ne dépasse nettement la référence naïve : les variables "
                "disponibles n'expliquent pas la cible."
            )

        charts.append(
            _chart(
                "model_comparison",
                f"Comparaison des modèles — {comparison['metric']}",
                labels=[r["label"] for r in comparison["results"] if r["status"] == "ok"],
                values=[r["score"] for r in comparison["results"] if r["status"] == "ok"],
                baseline=comparison["baseline"],
                baseline_label=comparison["baseline_label"],
                metric=comparison["metric"],
            )
        )

        estimator = fit_best(X, y, best["key"], len(frame), len(features))
        if estimator is not None:
            charts += _model_charts(estimator, X, y, features, problem)
    else:
        headline = "Aucun modèle n'a pu être évalué sur ces données."

    if "robust_se" in modeling_flags:
        notes.append(
            "Hétéroscédasticité détectée : utiliser des erreurs standard robustes "
            "(HC1) pour tout test sur les coefficients."
        )
    notes.append(f"Validation : {comparison['validation']}.")

    return StageResult(
        key="modeling",
        index=9,
        title="Modélisation",
        headline=headline,
        tables=[_comparison_table(comparison), _candidates_table(reco)],
        charts=charts,
        notes=notes,
        data={
            "recommendation": reco,
            "comparison": comparison,
            "best": best["label"] if best else None,
            "best_key": best["key"] if best else None,
            "score": best["score"] if best else None,
            "baseline": comparison["baseline"],
            "gain_vs_baseline": best["gain_vs_baseline"] if best else None,
            "metric": comparison["metric"],
            "n_features": len(features),
            "n_rows": len(frame),
        },
    )


def _comparison_table(comparison: dict[str, Any]) -> dict[str, Any]:
    rows = []
    for entry in comparison["results"]:
        if entry["status"] == "ok":
            rows.append([
                entry["label"],
                entry["family"],
                round(entry["score"], 4),
                round(entry["std"], 4),
                f"{entry['gain_vs_baseline']:+.4f}",
                "évalué",
            ])
        else:
            rows.append([
                entry["label"],
                entry["family"],
                "—",
                "—",
                "—",
                entry.get("reason", entry["status"]),
            ])
    rows.append([
        f"Référence ({comparison['baseline_label']})",
        "reference",
        round(comparison["baseline"], 4),
        "—",
        "0.0000",
        "référence",
    ])
    return {
        "title": f"Comparaison des modèles — {comparison['metric']}",
        "columns": [
            "Modèle",
            "Famille",
            comparison["metric"],
            "Écart-type",
            "Gain vs référence",
            "Statut",
        ],
        "rows": rows,
    }


def _candidates_table(reco: dict[str, Any]) -> dict[str, Any]:
    """Ce qui est applicable, ce qui ne l'est pas, et pourquoi."""
    rows = []
    for entry in reco["candidates"]:
        if entry["reason"] == _IRRELEVANT:
            continue
        rows.append([
            entry["label"],
            entry["family"],
            "oui" if entry["applicable"] else "non",
            "recommandé" if entry["key"] in reco["recommended"] else "",
            entry["reason"] or entry.get("strengths", ""),
        ])
    return {
        "title": "Modèles envisageables sur ce jeu de données",
        "columns": ["Modèle", "Famille", "Applicable", "Recommandé", "Motif"],
        "rows": rows,
    }


def _model_charts(
    estimator: Any,
    X: pd.DataFrame,
    y: pd.Series,
    features: list[str],
    problem: str,
) -> list[dict[str, Any]]:
    """Importance des variables et residus du meilleur modele."""
    charts: list[dict[str, Any]] = []

    importances = getattr(estimator, "feature_importances_", None)
    if importances is None:
        coefficients = getattr(estimator, "coef_", None)
        if coefficients is not None:
            importances = np.abs(np.asarray(coefficients).ravel()[: len(features)])
    if importances is not None and len(importances) == len(features):
        ranked = sorted(zip(features, importances), key=lambda kv: -abs(float(kv[1])))[:15]
        charts.append(
            _chart(
                "importance",
                "Poids des variables dans le meilleur modèle",
                labels=[k for k, _ in ranked],
                values=[round(float(v), 6) for _, v in ranked],
            )
        )

    if problem == "regression":
        prediction = attempt(estimator.predict, X)
        if prediction:
            predicted = np.asarray(prediction.value, dtype=float)
            residuals = np.asarray(y, dtype=float) - predicted
            charts.append(
                _chart(
                    "residuals",
                    "Résidus du meilleur modèle",
                    predicted=[_safe(v) for v in predicted[:MAX_SCATTER_POINTS]],
                    residuals=[_safe(v) for v in residuals[:MAX_SCATTER_POINTS]],
                )
            )

    return charts
