"""
Etape 9 (Variante temporelle) : Comparaison des prévisionnistes de séries temporelles.
"""

from __future__ import annotations

from typing import Any

import pandas as pd

from app.core.pipeline.stages.stage_base import (
    StageResult,
    _chart,
)


def stage_forecast(
    df: pd.DataFrame,
    target: str,
    temporal: list[str],
    budget_sec: float,
    candidates_table_fn: Any,
) -> StageResult:
    """Comparaison de prévisionnistes sur la série temporelle cible."""
    from app.core.pipeline.models import recommend
    from app.core.pipeline.temporal_models import compare_temporal

    frame = df[[temporal[0], target]].dropna() if temporal else df[[target]].dropna()
    if temporal:
        frame = frame.sort_values(temporal[0])
        series = pd.Series(
            pd.to_numeric(frame[target], errors="coerce").to_numpy(),
            index=pd.DatetimeIndex(frame[temporal[0]]),
        )
    else:
        series = pd.to_numeric(frame[target], errors="coerce")
    series = series.dropna()

    reco = recommend("forecast", len(series), 1, True)
    comparison = compare_temporal(series, budget_sec=budget_sec)

    if comparison.get("error"):
        return StageResult(
            key="modeling",
            index=9,
            title="Modélisation",
            status="skipped",
            headline=comparison["error"],
            tables=[candidates_table_fn(reco)],
            data={"recommendation": reco, "comparison": comparison},
        )

    best = comparison.get("best")
    baseline = comparison.get("baseline")

    if best and comparison["beats_baseline"]:
        skill = best.get("skill_vs_naive", 0)
        headline = (
            f"{best['label']} arrive en tête — MAE = {best['mae']:.4g}, "
            f"soit {skill:.0%} d'erreur en moins que la persistance "
            f"({baseline:.4g})."
        )
    elif best:
        headline = (
            f"Aucun modèle ne bat la persistance (MAE = {baseline:.4g}) : "
            "la série n'est pas prévisible au-delà de sa dernière valeur."
        )
    else:
        headline = "Aucun modèle de prévision n'a pu être évalué."

    charts = []
    ok_results = [r for r in comparison["results"] if r["status"] == "ok"]
    if ok_results:
        charts.append(
            _chart(
                "model_comparison",
                "Comparaison des prévisionnistes — MAE (plus bas = meilleur)",
                labels=[r["label"] for r in ok_results],
                values=[r["mae"] for r in ok_results],
                baseline=baseline,
                baseline_label="persistance",
                metric="MAE",
                lower_is_better=True,
            )
        )

    notes = [
        f"Validation : {comparison['validation']}.",
        f"Période saisonnière détectée : {comparison['seasonal_period']}.",
    ]

    return StageResult(
        key="modeling",
        index=9,
        title="Modélisation",
        headline=headline,
        tables=[_temporal_table(comparison), candidates_table_fn(reco)],
        charts=charts,
        notes=notes,
        data={
            "recommendation": reco,
            "comparison": comparison,
            "best": best["label"] if best else None,
            "best_key": best["key"] if best else None,
            "score": (best.get("skill_vs_naive") if best else None),
            "metric": "MAE",
            "baseline": baseline,
            "beats_baseline": comparison["beats_baseline"],
            "n_rows": comparison["n_points"],
            "n_features": 1,
        },
    )


def _temporal_table(comparison: dict[str, Any]) -> dict[str, Any]:
    rows = []
    for entry in comparison["results"]:
        if entry["status"] == "ok":
            skill = entry.get("skill_vs_naive")
            rows.append([
                entry["label"],
                entry["family"],
                round(entry["mae"], 6),
                round(entry["mae_std"], 6),
                f"{skill:+.1%}" if skill is not None else "—",
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
    return {
        "title": "Comparaison des prévisionnistes — MAE (plus bas = meilleur)",
        "columns": [
            "Modèle",
            "Famille",
            "MAE",
            "Écart-type",
            "Gain vs persistance",
            "Statut",
        ],
        "rows": rows,
    }
