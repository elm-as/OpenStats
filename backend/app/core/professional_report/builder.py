"""
Construit le contenu structuré d'un rapport à partir des résultats
d'un dataset (analyses + insights).

Le ReportContent est format-agnostique : les générateurs PDF/DOCX/PPTX
le consomment.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from app.core.professional_report.builder_models import ReportSection, ReportContent
from app.core.professional_report.builder_sections import (
    build_profile_section,
    build_methodology_section,
    build_descriptive_section,
    build_modeling_section,
)


class ReportBuilder:
    """Construit un ReportContent à partir des analyses d'un dataset."""

    def __init__(self, dataset_name: str = "Dataset"):
        self.dataset_name = dataset_name
        self.content = ReportContent(
            title=f"Rapport d'analyse — {dataset_name}",
            subtitle="Analyse statistique & économétrique approfondie",
            date=datetime.now().strftime("%d %B %Y"),
        )

    def with_executive_summary(self, text: str) -> "ReportBuilder":
        self.content.executive_summary = text
        return self

    def with_insights(self, insights: list[dict[str, Any]]) -> "ReportBuilder":
        """Construit le résumé exécutif + key findings à partir des insights."""
        if not insights:
            return self

        priority_order = {"critical": 0, "warning": 1, "success": 2, "methodological": 3, "info": 4}
        sorted_ins = sorted(insights, key=lambda i: (priority_order.get(i.get("severity", "info"), 5), -i.get("score", 0)))

        self.content.key_findings = [
            f"{_severity_icon(ins.get('severity'))} {ins.get('title', '')}"
            for ins in sorted_ins[:5]
        ]

        sec = ReportSection(
            title="Insights principaux",
            body="Observations majeures identifiées automatiquement sur le dataset :",
            insights=sorted_ins[:8],
        )
        self.content.sections.append(sec)

        if not self.content.executive_summary and sorted_ins:
            top = sorted_ins[0]
            self.content.executive_summary = (
                f"L'analyse automatique met en évidence un enjeu principal : **{top.get('title', '')}**. "
                f"{top.get('message', '')} "
                "L'analyse exploratoire est disponible dans les sections suivantes."
            )

        return self

    def with_profile(self, profile: dict[str, Any] | None) -> "ReportBuilder":
        sec = build_profile_section(profile)
        if sec:
            self.content.sections.append(sec)
        return self

    def with_methodology(self, recipe: dict[str, Any] | None) -> "ReportBuilder":
        sec = build_methodology_section(recipe)
        if sec:
            self.content.sections.append(sec)
        return self

    def with_descriptive(self, stats: dict[str, Any] | None) -> "ReportBuilder":
        sec = build_descriptive_section(stats)
        if sec:
            self.content.sections.append(sec)
        return self

    def with_modeling(self, model_results: dict[str, Any] | None) -> "ReportBuilder":
        sec = build_modeling_section(model_results)
        if sec:
            self.content.sections.append(sec)
        return self

    def with_recommendations(self, insights: list[dict[str, Any]]) -> "ReportBuilder":
        if not insights:
            return self

        suggestions = [
            (i.get("suggestion") or "").strip()
            for i in insights
            if i.get("suggestion")
        ]
        unique = []
        seen = set()
        for s in suggestions:
            if s and s not in seen:
                seen.add(s)
                unique.append(s)

        if unique:
            sec = ReportSection(
                title="Recommandations & Actions Stratégiques",
                body="Actions concrètes suggérées par l'analyse statistique et économétrique :",
                bullets=unique[:15],
            )
            self.content.sections.append(sec)
        return self

    def build(self) -> ReportContent:
        return self.content


def _severity_icon(severity: str | None) -> str:
    return {
        "critical": "🔴",
        "warning": "🟡",
        "success": "🟢",
        "methodological": "🟣",
        "info": "🔵",
    }.get(severity or "info", "▸")


def build_report_payload(
    dataset_name: str,
    profile: dict[str, Any] | None = None,
    recipe: dict[str, Any] | None = None,
    descriptive: dict[str, Any] | None = None,
    model_results: dict[str, Any] | None = None,
    insights: list[dict[str, Any]] | None = None,
) -> ReportContent:
    """Construit un ReportContent complet en une passe."""
    builder = ReportBuilder(dataset_name=dataset_name)

    if insights:
        builder.with_insights(insights)
    if profile:
        builder.with_profile(profile)
    if recipe:
        builder.with_methodology(recipe)
    if descriptive:
        builder.with_descriptive(descriptive)
    if model_results:
        builder.with_modeling(model_results)
    if insights:
        builder.with_recommendations(insights)

    return builder.build()
