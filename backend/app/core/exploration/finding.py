"""
Finding : unité de découverte produite par une sonde d'exploration.

Un Finding est ce qui permet au moteur de *décider*. Contrairement à un résultat
d'analyse (destiné à l'affichage), il porte une taille d'effet standardisée,
une p-value, et les faits qu'il établit — donc de quoi comparer, classer et
enchaîner.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field, asdict
from typing import Any


# Niveaux d'intensité d'effet, communs à toutes les sondes.
EFFECT_LABELS = ((0.5, "fort"), (0.3, "modéré"), (0.1, "faible"), (0.0, "négligeable"))

ADVERBS = {"fort": "fortement", "modéré": "modérément",
           "faible": "faiblement", "négligeable": "à peine"}


def label_effect(magnitude: float) -> str:
    """Traduit une taille d'effet standardisée (0-1) en intensité lisible."""
    m = abs(magnitude)
    for threshold, label in EFFECT_LABELS:
        if m >= threshold:
            return label
    return "négligeable"


def effect_adverb(magnitude: float) -> str:
    """Forme adverbiale de l'intensité, pour les phrases générées."""
    return ADVERBS[label_effect(magnitude)]


@dataclass
class Finding:
    """Une observation chiffrée, comparable aux autres et enchaînable."""

    kind: str
    variables: tuple[str, ...]
    effect_size: float
    effect_metric: str
    headline: str
    detail: str = ""
    p_value: float | None = None
    n: int = 0
    establishes: tuple[str, ...] = ()
    payload: dict[str, Any] = field(default_factory=dict)
    probe: str = ""
    q_value: float | None = None
    survives_fdr: bool | None = None

    @property
    def magnitude(self) -> float:
        """Taille d'effet ramenée dans [0, 1] pour comparer des métriques hétérogènes."""
        return min(1.0, abs(self.effect_size))

    @property
    def confidence(self) -> float:
        """Confiance dans [0, 1] : dérivée de la p-value quand elle existe, de n sinon."""
        if self.p_value is None:
            return min(1.0, self.n / 200.0) if self.n else 0.5
        p = max(self.p_value, 1e-12)
        return max(0.0, min(1.0, -math.log10(p) / 4.0))

    def interest(self, seen_variables: set[str]) -> float:
        """Score d'intérêt : effet × confiance × nouveauté.

        La nouveauté pénalise un finding portant sur des variables déjà couvertes,
        pour éviter qu'un groupe de variables colinéaires monopolise le classement.
        """
        overlap = sum(1 for v in self.variables if v in seen_variables)
        novelty = 1.0 / (1.0 + overlap)
        return round(self.magnitude * self.confidence * novelty, 4)

    def to_dict(self, seen_variables: set[str] | None = None) -> dict[str, Any]:
        data = asdict(self)
        data["variables"] = list(self.variables)
        data["establishes"] = list(self.establishes)
        data["magnitude"] = round(self.magnitude, 4)
        data["confidence"] = round(self.confidence, 4)
        data["effect_label"] = label_effect(self.effect_size)
        data["interest"] = self.interest(seen_variables or set())
        return data


def rank_findings(findings: list[Finding]) -> list[Finding]:
    """Classe les findings par intérêt décroissant en pénalisant la redondance.

    Le classement est glouton : à chaque tour on retient le finding le plus
    intéressant *compte tenu de ce qui est déjà retenu*, ce qui diversifie
    les variables couvertes au lieu d'empiler dix versions du même signal.
    """
    remaining = list(findings)
    seen: set[str] = set()
    ordered: list[Finding] = []

    while remaining:
        best = max(remaining, key=lambda f: f.interest(seen))
        remaining.remove(best)
        ordered.append(best)
        seen.update(best.variables)

    return ordered
