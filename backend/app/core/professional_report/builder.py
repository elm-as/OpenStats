"""
Construit le contenu structuré d'un rapport à partir des résultats
d'un dataset (analyses + insights).

Le ReportContent est format-agnostique : les générateurs PDF/DOCX/PPTX
le consomment.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass
class ReportSection:
    """Une section du rapport."""

    title: str
    body: str = ""  # texte principal
    bullets: list[str] = field(default_factory=list)
    table: dict[str, Any] | None = None  # {"headers": [...], "rows": [[...]]}
    insights: list[dict[str, Any]] = field(default_factory=list)
    subsections: list["ReportSection"] = field(default_factory=list)


@dataclass
class ReportContent:
    """Contenu complet d'un rapport."""

    title: str
    subtitle: str
    author: str = "OpenStats — Analyseur Automatique"
    date: str = ""
    executive_summary: str = ""
    key_findings: list[str] = field(default_factory=list)
    sections: list[ReportSection] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)


# ── Builder ──────────────────────────────────────────────────────────────


class ReportBuilder:
    """Construit un ReportContent à partir des analyses d'un dataset."""

    def __init__(self, dataset_name: str = "Dataset"):
        self.dataset_name = dataset_name
        self.content = ReportContent(
            title=f"Rapport d'analyse — {dataset_name}",
            subtitle="Analyse statistique automatisée",
            date=datetime.now().strftime("%d %B %Y"),
        )

    def with_executive_summary(self, text: str) -> "ReportBuilder":
        self.content.executive_summary = text
        return self

    def with_insights(self, insights: list[dict[str, Any]]) -> "ReportBuilder":
        """Construit le résumé exécutif + key findings à partir des insights."""
        if not insights:
            return self

        # Top 5 insights par sévérité
        priority_order = {"critical": 0, "warning": 1, "success": 2, "methodological": 3, "info": 4}
        sorted_ins = sorted(insights, key=lambda i: (priority_order.get(i.get("severity", "info"), 5), -i.get("score", 0)))

        # Key findings (titres des top 5)
        self.content.key_findings = [
            f"{_severity_icon(ins.get('severity'))} {ins.get('title', '')}"
            for ins in sorted_ins[:5]
        ]

        # Section "Insights principaux"
        sec = ReportSection(
            title="Insights principaux",
            body="L'analyseur automatique a généré les insights suivants à partir des données disponibles. Ils sont triés par ordre de priorité décroissante.",
            insights=sorted_ins[:15],  # top 15
        )
        self.content.sections.append(sec)

        # Résumé exécutif auto si vide
        if not self.content.executive_summary:
            critical = [i for i in insights if i.get("severity") == "critical"]
            warnings = [i for i in insights if i.get("severity") == "warning"]
            success = [i for i in insights if i.get("severity") == "success"]
            parts = []
            if critical:
                parts.append(f"**{len(critical)} alerte(s) critique(s)** identifiée(s) nécessitant une attention immédiate")
            if warnings:
                parts.append(f"{len(warnings)} point(s) d'attention à surveiller")
            if success:
                parts.append(f"{len(success)} constat(s) positif(s)")

            self.content.executive_summary = (
                "L'analyse automatisée du dataset a produit "
                + " ; ".join(parts) + "."
                if parts else
                "L'analyse exploratoire est disponible dans les sections suivantes."
            )

        return self

    def with_profile(self, profile: dict[str, Any] | None) -> "ReportBuilder":
        """Ajoute une section profil du dataset."""
        if not profile:
            return self

        n_rows = profile.get("n_rows", 0)
        n_cols = profile.get("n_cols", 0)
        n_num = len(profile.get("numeric_cols", []))
        n_cat = len(profile.get("categorical_cols", []))
        n_temp = len(profile.get("temporal_cols", []))

        sec = ReportSection(
            title="Profil du dataset",
            body=(
                f"Le dataset comporte **{n_rows:,} observations** réparties sur **{n_cols} variables** : "
                f"{n_num} numérique(s), {n_cat} catégorielle(s), {n_temp} temporelle(s)."
            ).replace(",", " "),
            bullets=profile.get("notes", []) or [],
        )

        if profile.get("suggested_target"):
            sec.bullets.append(
                f"Variable cible suggérée : {profile['suggested_target']} "
                f"(score de confiance : {profile.get('target_score', 0):.0f}/100)"
            )
        if profile.get("problem_type"):
            sec.bullets.append(f"Type de problème détecté : {profile['problem_type']}")

        self.content.sections.append(sec)
        return self

    def with_methodology(self, recipe: dict[str, Any] | None) -> "ReportBuilder":
        """Section méthodologie à partir d'une recipe de pipeline."""
        if not recipe:
            return self

        steps = recipe.get("steps", [])
        if not steps:
            return self

        sec = ReportSection(
            title="Méthodologie",
            body=(
                "Le pipeline d'analyse appliqué comporte les étapes suivantes, "
                "sélectionnées automatiquement en fonction du profil du dataset."
            ),
            bullets=[
                f"**{i+1}. {s.get('label', s.get('key', '?'))}** — {s.get('rationale', '')}"
                for i, s in enumerate(steps) if not s.get("optional", False)
            ],
        )
        self.content.sections.append(sec)
        return self

    def with_descriptive(self, stats: dict[str, Any] | None) -> "ReportBuilder":
        """Section statistiques descriptives."""
        if not stats:
            return self

        rows = []
        for col, s in list(stats.items())[:20]:
            if not isinstance(s, dict) or s.get("type") != "numeric":
                continue
            rows.append([
                col,
                _fmt(s.get("mean")),
                _fmt(s.get("median")),
                _fmt(s.get("std")),
                _fmt(s.get("skewness")),
                _fmt(s.get("null_rate"), pct=True),
            ])

        if rows:
            sec = ReportSection(
                title="Statistiques descriptives",
                body="Vue d'ensemble des distributions des variables numériques :",
                table={
                    "headers": ["Variable", "Moyenne", "Médiane", "Écart-type", "Asymétrie", "Manquants"],
                    "rows": rows,
                },
            )
            self.content.sections.append(sec)
        return self

    def with_modeling(self, model_results: dict[str, Any] | None) -> "ReportBuilder":
        """Section modélisation."""
        if not model_results:
            return self

        task = model_results.get("task_type") or model_results.get("task")
        all_models = model_results.get("models") or model_results.get("comparison") or []
        best = model_results.get("best_model") or {}

        if not best and all_models:
            key = "r2" if task == "regression" else "accuracy"
            try:
                best = max(all_models, key=lambda m: (m.get("test_metrics") or m.get("metrics") or {}).get(key, -1))
            except (TypeError, ValueError):
                best = all_models[0]

        bullets = []
        if best:
            metrics = best.get("test_metrics") or best.get("metrics") or {}
            name = best.get("name") or best.get("model_key") or "Meilleur modèle"
            bullets.append(f"**Meilleur modèle** : {name}")
            for k, v in metrics.items():
                try:
                    bullets.append(f"{k.upper()} = {_fmt(v)}")
                except Exception:
                    pass

        rows = []
        for m in (all_models or []):
            metrics = m.get("test_metrics") or m.get("metrics") or {}
            rows.append([
                m.get("name") or m.get("model_key") or "?",
                _fmt(metrics.get("r2") if task == "regression" else metrics.get("accuracy")),
                _fmt(metrics.get("rmse") if task == "regression" else metrics.get("f1")),
                _fmt(metrics.get("mae") if task == "regression" else metrics.get("roc_auc")),
            ])

        sec = ReportSection(
            title="Modélisation prédictive",
            body=f"Tâche détectée : {task or 'modélisation'}. {len(all_models)} modèles ont été comparés.",
            bullets=bullets,
            table={
                "headers": ["Modèle", "R² / Acc.", "RMSE / F1", "MAE / AUC"],
                "rows": rows,
            } if rows else None,
        )
        self.content.sections.append(sec)
        return self

    def with_recommendations(self, insights: list[dict[str, Any]]) -> "ReportBuilder":
        """Extraction des suggestions d'action depuis les insights."""
        if not insights:
            return self

        suggestions = [
            (i.get("suggestion") or "").strip()
            for i in insights
            if i.get("suggestion")
        ]
        suggestions = [s for s in suggestions if s]
        # Dédupliquer
        seen = set()
        unique = []
        for s in suggestions:
            if s not in seen:
                seen.add(s)
                unique.append(s)

        if unique:
            sec = ReportSection(
                title="Recommandations",
                body="Actions concrètes suggérées par l'analyse :",
                bullets=unique[:15],
            )
            self.content.sections.append(sec)
        return self

    def build(self) -> ReportContent:
        return self.content


# ── Helpers ──────────────────────────────────────────────────────────────


def _fmt(v: Any, pct: bool = False) -> str:
    if v is None:
        return "—"
    try:
        f = float(v)
        if pct:
            return f"{f * 100:.1f}%" if abs(f) <= 1.5 else f"{f:.1f}%"
        if abs(f) >= 1e6 or (abs(f) < 1e-3 and f != 0):
            return f"{f:.2e}"
        if f == int(f):
            return f"{int(f):,}".replace(",", " ")
        return f"{f:.3f}"
    except (TypeError, ValueError):
        return str(v)


def _severity_icon(severity: str | None) -> str:
    return {
        "critical": "🔴",
        "warning": "🟡",
        "success": "🟢",
        "methodological": "🟣",
        "info": "🔵",
    }.get(severity or "info", "▸")


# ── Convenience function ─────────────────────────────────────────────────


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
