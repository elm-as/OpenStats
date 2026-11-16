"""
Detecteurs specialises d'anomalies et de violations d'hypotheses pour le pipeline.

Façade réexportant les détecteurs de qualité et les détecteurs statistiques.
"""

from __future__ import annotations

from app.core.pipeline.diagnostics_detectors_quality import (
    detect_constant_columns,
    detect_duplicates,
    detect_high_cardinality,
    detect_missing_values,
)
from app.core.pipeline.diagnostics_detectors_statistical import (
    detect_heteroskedasticity,
    detect_multicollinearity,
    detect_non_stationarity,
    detect_outliers,
    detect_skewness,
)

__all__ = [
    "detect_duplicates",
    "detect_constant_columns",
    "detect_high_cardinality",
    "detect_missing_values",
    "detect_outliers",
    "detect_skewness",
    "detect_multicollinearity",
    "detect_non_stationarity",
    "detect_heteroskedasticity",
]
