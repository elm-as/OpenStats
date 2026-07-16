"""
Narrators : transforment les résultats numériques en Insights narratifs.

Chaque fonction prend en entrée un résultat d'analyse (dict) et renvoie
une liste d'`Insight` exploitable par l'UI ou les rapports.
"""

from app.core.interpretation.narrators.descriptive import (
    narrate_descriptive,
    narrate_correlations,
    narrate_vif,
)
from app.core.interpretation.narrators.tests import narrate_hypothesis_test
from app.core.interpretation.narrators.modeling import narrate_modeling
from app.core.interpretation.narrators.timeseries import (
    narrate_timeseries,
    narrate_multivariate_timeseries,
)
from app.core.interpretation.narrators.dimensionality import (
    narrate_pca,
    narrate_ca,
    narrate_mca,
)
from app.core.interpretation.narrators.diagnostics import narrate_diagnostics

__all__ = [
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
