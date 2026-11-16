"""
Etapes 10 et 11 : Validation des contrôles méthodologiques et synthèse d'interprétation.
"""

from __future__ import annotations

from app.core.pipeline.stages.stage_base import StageResult


def stage_validation(modeling: StageResult, correction: StageResult) -> StageResult:
    """Contrôle la validité statistique hors-échantillon et les problèmes résiduels."""
    score = modeling.data.get("score")
    remaining = correction.data.get("final", {}).get("count", 0)
    blocking = correction.data.get("final", {}).get("blocking", 0)

    checks = [
        [
            "Score validé hors échantillon",
            "oui" if score is not None else "non",
            "Validation croisée : le score n'est pas gonflé par le réapprentissage.",
        ],
        [
            "Problèmes statistiques résiduels",
            str(remaining),
            "Chaque problème restant fragilise l'interprétation des coefficients.",
        ],
        [
            "Problèmes bloquants",
            str(blocking),
            "Un bloquant invalide les tests d'hypothèse du modèle.",
        ],
        [
            "Corrections réversibles",
            "oui",
            "Le jeu de données d'origine est conservé : chaque transformation peut être annulée.",
        ],
    ]

    healthy = blocking == 0 and score is not None
    return StageResult(
        key="validation",
        index=10,
        title="Validation",
        headline=(
            "Modèle exploitable : aucun problème bloquant ne subsiste."
            if healthy
            else "Résultats à interpréter avec prudence."
        ),
        tables=[
            {
                "title": "Contrôles",
                "columns": ["Contrôle", "Valeur", "Pourquoi c'est important"],
                "rows": checks,
            }
        ],
        data={"healthy": healthy},
    )


def stage_interpretation(stages: dict[str, StageResult], target: str | None) -> StageResult:
    """Synthèse des enseignements tirés de l'ensemble de la méthodologie."""
    correction = stages.get("correction")
    modeling = stages.get("modeling")
    points: list[str] = []

    if correction:
        initial = correction.data.get("initial", {}).get("severity_total", 0)
        final = correction.data.get("final", {}).get("severity_total", 0)
        removed = correction.data.get("columns_removed", [])
        if initial > final:
            points.append(
                f"La qualité du jeu de données a été améliorée : gravité cumulée "
                f"{initial:.2f} → {final:.2f}."
            )
        if removed:
            points.append(
                f"Variables retirées car redondantes ou inexploitables : {', '.join(removed)}."
            )
        for issue in correction.data.get("remaining_issues", [])[:3]:
            points.append(f"Point de vigilance — {issue['title']}.")

    if modeling and modeling.data.get("score") is not None:
        score = modeling.data["score"]
        quality = "élevé" if score > 0.7 else "modéré" if score > 0.4 else "faible"
        points.append(
            f"Le pouvoir prédictif sur « {target} » est {quality} "
            f"({modeling.data['best']}, score = {score:.3f})."
        )

    if not points:
        points.append(
            "Aucun élément saillant : le jeu de données ne présente ni problème "
            "majeur ni signal prédictif marqué."
        )

    return StageResult(
        key="interpretation",
        index=11,
        title="Interprétation",
        headline="Synthèse des enseignements.",
        tables=[{"title": "Enseignements", "columns": ["Constat"], "rows": [[p] for p in points]}],
        data={"points": points},
    )
