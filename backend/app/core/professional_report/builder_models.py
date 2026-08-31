"""
Modèles de données dataclass pour la construction de rapports professionnels.
"""

from __future__ import annotations

from dataclasses import dataclass, field
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
