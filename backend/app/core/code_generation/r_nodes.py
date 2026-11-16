"""
Traduction des noeuds du canvas en blocs de code R.

Regles identiques au generateur Python :
- Chaque bloc declare ses packages necessaires
- Les identifiants passent par des litteraux echappes
- Les parametres du noeud sont lus et valides
- Un noeud non pris en charge signale son incompatibilite
"""

from __future__ import annotations

from typing import Any

from app.core.code_generation.emitter import CodeBlock, r_literal
from app.core.code_generation.r_nodes_analysis import (
    emit_classification,
    emit_cluster,
    emit_correlation,
    emit_descriptive_categorical,
    emit_descriptive_numeric,
    emit_explainability,
    emit_manifold,
    emit_pca,
    emit_regression,
    emit_vif,
)
from app.core.code_generation.r_nodes_base import (
    STATS,
    TIDY,
    columns_helper as _columns,
    loader,
    numeric_subset_helper as _numeric_subset,
    target_helper as _target,
)
from app.core.code_generation.r_nodes_econometrics import (
    emit_causal,
    emit_cointegration,
    emit_hypothesis,
    emit_multivariate_timeseries,
    emit_stationarity,
    emit_survival,
    emit_timeseries,
)
from app.core.code_generation.r_nodes_prep import (
    emit_cleaning,
    emit_transform,
    emit_typing,
)
from app.core.code_generation.r_node_builders import (
    emit_chart,
    emit_insights,
    emit_output,
    emit_r_code,
    emit_sql,
)

_HANDLERS = {
    "typing": emit_typing,
    "cleaning": emit_cleaning, "clean": emit_cleaning,
    "transform": emit_transform, "transform_recommend": emit_transform,
    "stationarization_transform": emit_transform,
    "descriptiveNumeric": emit_descriptive_numeric, "descriptive": emit_descriptive_numeric,
    "descriptiveCategorical": emit_descriptive_categorical,
    "correlation": emit_correlation, "correlations": emit_correlation,
    "vif": emit_vif,
    "pca": emit_pca, "manifold": emit_manifold, "cluster": emit_cluster, "clustering": emit_cluster,
    "regression": emit_regression, "classification": emit_classification, "model": emit_regression,
    "explainability": emit_explainability,
    "testStationarity": emit_stationarity, "stationarity": emit_stationarity,
    "timeseries_stationarity": emit_stationarity,
    "cointegration": emit_cointegration, "timeseries_cointegration": emit_cointegration,
    "timeseries": emit_timeseries, "timeseries_forecast": emit_timeseries,
    "multivariateTimeseries": emit_multivariate_timeseries,
    "timeseries_multivariate": emit_multivariate_timeseries,
    "survival": emit_survival, "causal": emit_causal, "hypothesis": emit_hypothesis,
    "sql": emit_sql, "python": emit_r_code, "chart": emit_chart,
    "insights": emit_insights, "output": emit_output, "report": emit_output,
}

SUPPORTED_NODE_TYPES = sorted(_HANDLERS)


def emit(node_type: str, params: dict[str, Any], dataset_name: str) -> CodeBlock:
    """Bloc de code R pour un noeud. `supported=False` si non traduisible."""
    handler = _HANDLERS.get(node_type)
    if handler is None:
        return CodeBlock(
            body=[
                f"# NON TRADUIT : le noeud '{node_type}' n'a pas d'equivalent R.",
                f"stop({r_literal(f'Noeud non traduit : {node_type}')})",
            ],
            supported=False,
            note=f"aucune traduction R pour '{node_type}'",
        )
    return handler(params)


__all__ = [
    "emit",
    "loader",
    "SUPPORTED_NODE_TYPES",
    "TIDY",
    "STATS",
    "_columns",
    "_target",
    "_numeric_subset",
]
