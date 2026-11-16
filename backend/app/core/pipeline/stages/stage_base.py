"""
Types et utilitaires fondamentaux des etapes d'analyse du pipeline.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import numpy as np
import pandas as pd

from app.core.pipeline.schema import Schema

MAX_CHART_CATEGORIES = 14
MAX_SCATTER_POINTS = 1200


@dataclass
class StageResult:
    """Sortie d'une etape : de quoi afficher un onglet complet."""

    key: str
    index: int
    title: str
    status: str = "success"  # success | skipped | error
    headline: str = ""
    tables: list[dict[str, Any]] = field(default_factory=list)
    charts: list[dict[str, Any]] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
    data: dict[str, Any] = field(default_factory=dict)
    duration_ms: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "key": self.key,
            "index": self.index,
            "title": self.title,
            "status": self.status,
            "headline": self.headline,
            "tables": self.tables,
            "charts": self.charts,
            "notes": self.notes,
            "data": self.data,
            "duration_ms": self.duration_ms,
        }


def _chart(kind: str, title: str, **payload: Any) -> dict[str, Any]:
    """Specification de graphique, rendue cote frontend par les composants viz/."""
    return {"kind": kind, "title": title, **payload}


# Schema courant de la session : renseigne par `run_pipeline`, il fait autorite
# sur l'inference automatique pour toutes les etapes.
_SCHEMA: Schema | None = None


def set_current_schema(schema: Schema | None) -> None:
    """Met a jour le schema actif de la session d'analyse."""
    global _SCHEMA
    _SCHEMA = schema


def get_current_schema() -> Schema | None:
    """Retourne le schema actif de la session d'analyse."""
    return _SCHEMA


def _numeric_columns(df: pd.DataFrame) -> list[str]:
    if _SCHEMA is not None:
        return [c for c in df.columns if _SCHEMA.kinds.get(c) == "numeric"]
    return [
        c
        for c in df.columns
        if pd.api.types.is_numeric_dtype(df[c]) and df[c].nunique(dropna=True) > 2
    ]


def _categorical_columns(df: pd.DataFrame) -> list[str]:
    if _SCHEMA is not None:
        return [c for c in df.columns if _SCHEMA.kinds.get(c) == "categorical"]
    return [
        c
        for c in df.columns
        if not pd.api.types.is_numeric_dtype(df[c]) or df[c].nunique(dropna=True) <= 2
    ]


def _temporal_columns(df: pd.DataFrame) -> list[str]:
    if _SCHEMA is not None:
        return [c for c in df.columns if _SCHEMA.kinds.get(c) == "temporal"]
    return [c for c in df.columns if pd.api.types.is_datetime64_any_dtype(df[c])]


def _kinds() -> dict[str, str] | None:
    """Typage declare de la session, transmis aux diagnostics."""
    return _SCHEMA.kinds if _SCHEMA is not None else None


def _safe(value: Any) -> Any:
    if value is None or (isinstance(value, float) and (np.isnan(value) or np.isinf(value))):
        return None
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        v = float(value)
        return None if (np.isnan(v) or np.isinf(v)) else round(v, 6)
    return value
