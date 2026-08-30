"""
Schémas de données pour les étapes et recettes de pipeline.
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any


@dataclass
class PipelineStep:
    """Une étape d'un pipeline."""

    key: str  # identifiant unique
    operation: str  # clean | descriptive | correlation | vif | transform | model | timeseries | pca | report
    label: str  # label affichable
    rationale: str  # pourquoi cette étape
    params: dict[str, Any] = field(default_factory=dict)
    optional: bool = False

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class PipelineRecipe:
    """Pipeline complet pour un dataset."""

    title: str
    description: str
    problem_type: str
    target: str | None
    steps: list[PipelineStep] = field(default_factory=list)
    estimated_duration_sec: int = 0
    confidence: str = "high"  # high | medium | low

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["steps"] = [s.to_dict() if hasattr(s, "to_dict") else s for s in self.steps]
        return d
