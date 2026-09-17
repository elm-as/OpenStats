"""
Définition de la structure de données du profil sémantique d'un jeu de données.
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any


@dataclass
class DatasetProfile:
    """Profil sémantique d'un dataset."""

    n_rows: int = 0
    n_cols: int = 0
    column_types: dict[str, str] = field(default_factory=dict)
    numeric_cols: list[str] = field(default_factory=list)
    categorical_cols: list[str] = field(default_factory=list)
    binary_cols: list[str] = field(default_factory=list)
    temporal_cols: list[str] = field(default_factory=list)
    id_cols: list[str] = field(default_factory=list)
    discrete_cols: list[str] = field(default_factory=list)

    suggested_target: str | None = None
    target_score: float = 0.0
    problem_type: str = "exploration"

    has_temporal: bool = False
    is_timeseries: bool = False
    is_panel: bool = False
    panel_structure: dict = field(default_factory=dict)
    is_cross_section: bool = True

    duplicate_rows: int = 0
    duplicate_ratio: float = 0.0
    overall_null_rate: float = 0.0
    high_missing_cols: list[str] = field(default_factory=list)
    near_constant_cols: list[str] = field(default_factory=list)

    flags: list[str] = field(default_factory=list)
    candidate_targets: list[dict[str, Any]] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)

    integration_orders: dict[str, dict[str, Any]] = field(default_factory=dict)
    stationarity_summary: str = "unknown"
    cointegration_likely: bool = False

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
