"""
Moteur d'interprétation automatique.

Transforme des résultats numériques en INSIGHTS narratifs exploitables.
Chaque module métier (analysis, modeling, timeseries, ...) possède son narrator.
"""

from app.core.interpretation.base import (
    Insight,
    Severity,
    Confidence,
    InsightCategory,
    insight,
)
from app.core.interpretation.narrators import (
    narrate_descriptive,
    narrate_correlations,
    narrate_vif,
    narrate_hypothesis_test,
    narrate_modeling,
    narrate_timeseries,
    narrate_multivariate_timeseries,
    narrate_pca,
    narrate_ca,
    narrate_mca,
    narrate_diagnostics,
)

__all__ = [
    "Insight",
    "Severity",
    "Confidence",
    "InsightCategory",
    "insight",
    "narrate_descriptive",
    "narrate_correlations",
    "narrate_vif",
    "narrate_hypothesis_test",
    "narrate_modeling",
    "narrate_timeseries",
    "narrate_multivariate_timeseries",
    "narrate_pca",
    "narrate_ca",
    "narrate_mca",
    "narrate_diagnostics",
]
