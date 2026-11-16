"""
Modeles de donnees, seuils et agregats pour le pipeline de diagnostic.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any

# Seuils de declenchement. Regroupes ici pour rester ajustables d'un seul endroit.
THRESHOLDS = {
    "missing_ratio": 0.05,
    "missing_severe": 0.40,
    "outlier_ratio": 0.02,
    "skew": 1.0,
    "correlation": 0.90,
    "vif": 10.0,
    "adf_p": 0.05,
    "heteroskedastic_p": 0.05,
    "duplicate_ratio": 0.01,
    "cardinality_ratio": 0.95,
}


@dataclass
class Remedy:
    """Une correction applicable, exprimee dans le vocabulaire du catalogue existant."""

    action: str                       # cle de transformation, ou action structurelle
    columns: tuple[str, ...]
    label: str
    rationale: str
    params: dict[str, Any] = field(default_factory=dict)
    aggressive: bool = False          # modifie la semantique des variables

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["columns"] = list(self.columns)
        return data


@dataclass
class Issue:
    """Un probleme detecte, avec sa gravite et ses remedes candidats."""

    code: str
    columns: tuple[str, ...]
    severity: float                   # 0..1
    metric: float
    metric_label: str
    title: str
    detail: str
    remedies: list[Remedy] = field(default_factory=list)
    blocks_modeling: bool = False

    @property
    def key(self) -> str:
        """Identite stable d'un probleme, pour suivre sa resolution d'une iteration a l'autre."""
        return f"{self.code}::{','.join(sorted(self.columns))}"

    def to_dict(self) -> dict[str, Any]:
        return {
            "key": self.key,
            "code": self.code,
            "columns": list(self.columns),
            "severity": round(self.severity, 4),
            "metric": round(float(self.metric), 6) if self.metric is not None else None,
            "metric_label": self.metric_label,
            "title": self.title,
            "detail": self.detail,
            "blocks_modeling": self.blocks_modeling,
            "remedies": [r.to_dict() for r in self.remedies],
        }


def severity_total(issues: list[Issue]) -> float:
    """Gravite cumulee, utilisee comme critere de progression de la boucle."""
    return round(sum(i.severity for i in issues), 6)


def summarize(issues: list[Issue]) -> dict[str, Any]:
    """Resume synthetique de l'ensemble des problemes detectes."""
    by_code: dict[str, int] = {}
    for issue in issues:
        by_code[issue.code] = by_code.get(issue.code, 0) + 1
    return {
        "count": len(issues),
        "severity_total": severity_total(issues),
        "blocking": sum(1 for i in issues if i.blocks_modeling),
        "by_code": by_code,
    }
