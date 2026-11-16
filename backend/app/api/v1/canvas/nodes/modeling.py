"""
Nœuds de modélisation (Clustering, Régression, Classification, Panel, Comptage).

Façade réexportant les exécuteurs spécialisés pour préserver les contrats d'API.
"""

from __future__ import annotations

from app.api.v1.canvas.nodes.modeling_clustering import (
    execute_clustering,
    execute_hierarchical_clustering,
)
from app.api.v1.canvas.nodes.modeling_econometrics import (
    execute_count_model,
    execute_panel,
)
from app.api.v1.canvas.nodes.modeling_supervised import (
    execute_classification,
    execute_explainability,
    execute_regression,
)

__all__ = [
    "execute_clustering",
    "execute_hierarchical_clustering",
    "execute_regression",
    "execute_classification",
    "execute_explainability",
    "execute_panel",
    "execute_count_model",
]
