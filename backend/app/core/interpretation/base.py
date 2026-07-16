"""
Modèle de données d'un Insight.

Un Insight est une phrase exploitable produite à partir de résultats statistiques.
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Any


class Severity(str, Enum):
    """Sévérité d'un insight."""

    CRITICAL = "critical"   # Action urgente requise
    WARNING = "warning"     # Attention nécessaire
    INFO = "info"           # Information neutre
    SUCCESS = "success"     # Constat positif
    METHODOLOGICAL = "methodological"  # Suggestion méthodologique


class Confidence(str, Enum):
    """Niveau de confiance de l'insight."""

    HIGH = "high"       # Test statistique significatif, échantillon suffisant
    MEDIUM = "medium"   # Indicatif
    LOW = "low"         # Hypothèse, à vérifier


class InsightCategory(str, Enum):
    """Catégorie thématique."""

    DISTRIBUTION = "distribution"
    CORRELATION = "correlation"
    MULTICOLLINEARITY = "multicollinearity"
    OUTLIERS = "outliers"
    MISSING = "missing"
    STATIONARITY = "stationarity"
    SEASONALITY = "seasonality"
    HETEROSCEDASTICITY = "heteroscedasticity"
    NORMALITY = "normality"
    MODEL_QUALITY = "model_quality"
    MODEL_COMPARISON = "model_comparison"
    FEATURE_IMPORTANCE = "feature_importance"
    HYPOTHESIS = "hypothesis"
    DIMENSIONALITY = "dimensionality"
    DATA_QUALITY = "data_quality"
    RECOMMENDATION = "recommendation"
    GENERAL = "general"


@dataclass
class Insight:
    """Un insight = une phrase actionnable.

    Attributes:
        title: Titre court (max ~60 chars).
        message: Phrase principale, narrative.
        severity: Niveau d'alerte.
        category: Catégorie thématique.
        confidence: Niveau de confiance.
        suggestion: Action recommandée (optionnel).
        evidence: Chiffres clés utilisés (optionnel, dict).
        variables: Variables impliquées (optionnel).
        score: Score de priorité 0-100 (plus élevé = plus important).
        tags: Tags libres pour filtrage.
    """

    title: str
    message: str
    severity: Severity = Severity.INFO
    category: InsightCategory = InsightCategory.GENERAL
    confidence: Confidence = Confidence.MEDIUM
    suggestion: str | None = None
    evidence: dict[str, Any] = field(default_factory=dict)
    variables: list[str] = field(default_factory=list)
    score: float = 50.0
    tags: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["severity"] = self.severity.value
        d["category"] = self.category.value
        d["confidence"] = self.confidence.value
        return d


# ── Helper factory ────────────────────────────────────────────────────


def insight(
    title: str,
    message: str,
    severity: Severity | str = Severity.INFO,
    category: InsightCategory | str = InsightCategory.GENERAL,
    confidence: Confidence | str = Confidence.MEDIUM,
    suggestion: str | None = None,
    evidence: dict[str, Any] | None = None,
    variables: list[str] | None = None,
    score: float | None = None,
    tags: list[str] | None = None,
) -> Insight:
    """Crée un Insight avec auto-scoring si non fourni."""
    sev = Severity(severity) if isinstance(severity, str) else severity
    cat = InsightCategory(category) if isinstance(category, str) else category
    conf = Confidence(confidence) if isinstance(confidence, str) else confidence

    if score is None:
        # Auto-score basé sur sévérité + confiance
        sev_score = {
            Severity.CRITICAL: 90,
            Severity.WARNING: 70,
            Severity.METHODOLOGICAL: 55,
            Severity.INFO: 40,
            Severity.SUCCESS: 50,
        }[sev]
        conf_bonus = {Confidence.HIGH: 10, Confidence.MEDIUM: 5, Confidence.LOW: 0}[conf]
        score = sev_score + conf_bonus

    return Insight(
        title=title,
        message=message,
        severity=sev,
        category=cat,
        confidence=conf,
        suggestion=suggestion,
        evidence=evidence or {},
        variables=variables or [],
        score=float(score),
        tags=tags or [],
    )


def sort_insights(insights: list[Insight]) -> list[Insight]:
    """Trie par score décroissant puis par sévérité."""
    sev_order = {
        Severity.CRITICAL: 0,
        Severity.WARNING: 1,
        Severity.METHODOLOGICAL: 2,
        Severity.SUCCESS: 3,
        Severity.INFO: 4,
    }
    return sorted(insights, key=lambda i: (sev_order[i.severity], -i.score))


def insights_to_dict(insights: list[Insight]) -> list[dict[str, Any]]:
    """Sérialise une liste d'insights."""
    return [i.to_dict() for i in sort_insights(insights)]
