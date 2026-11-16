"""
Traduction des noeuds du canvas en blocs de code Python.

Point d'entree unifie : chaque bloc declare ses imports et ses instructions Python
en s'appuyant sur les modules specialises :
- python_nodes_prep : typage, nettoyage, transformations
- python_nodes_analysis : statistiques descriptives, correlations, VIF, modelisation et explicabilite
- python_nodes_econometrics : tests de stationnarite, cointegration, series temporelles, causalite
- python_node_builders : SQL DuckDB, blocs Python personnalises, visualisations et exports
"""

from __future__ import annotations

from typing import Any

from app.core.code_generation.emitter import CodeBlock, py_literal
from app.core.code_generation.python_nodes_prep import (
    PANDAS,
    emit_cleaning,
    emit_transform,
    emit_typing,
)
from app.core.code_generation.python_nodes_analysis import (
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
from app.core.code_generation.python_nodes_econometrics import (
    emit_causal,
    emit_cointegration,
    emit_hypothesis,
    emit_multivariate_timeseries,
    emit_stationarity,
    emit_survival,
    emit_timeseries,
)
from app.core.code_generation.python_node_builders import (
    emit_chart,
    emit_insights,
    emit_output,
    emit_python,
    emit_sql,
)


def loader(dataset_name: str) -> CodeBlock:
    """Chargement du jeu de donnees, selon l'extension reelle du fichier."""
    extension = (
        dataset_name.rsplit(".", 1)[-1].lower() if "." in dataset_name else "csv"
    )
    name = py_literal(dataset_name)

    if extension in ("xlsx", "xls"):
        call, extra = (
            f"pd.read_excel({name})",
            "import openpyxl  # moteur de lecture Excel",
        )
    elif extension == "parquet":
        call, extra = f"pd.read_parquet({name})", "import pyarrow  # moteur Parquet"
    elif extension == "json":
        call, extra = f"pd.read_json({name})", ""
    elif extension == "tsv":
        call, extra = f"pd.read_csv({name}, sep='\\t')", ""
    else:
        call, extra = f"pd.read_csv({name})", ""

    return CodeBlock(
        imports=[PANDAS] + ([extra] if extra else []),
        body=[
            "# Chargement du jeu de donnees",
            f"df = {call}",
            "print(f'Dataset : {df.shape[0]} lignes, {df.shape[1]} colonnes')",
        ],
    )


def emit(node_type: str, params: dict[str, Any], dataset_name: str) -> CodeBlock:
    """Bloc de code Python pour un noeud. `supported=False` si non traduisible."""
    handler = _HANDLERS.get(node_type)
    if handler is None:
        return CodeBlock(
            body=[
                f"# NON TRADUIT : le noeud '{node_type}' n'a pas d'equivalent Python.",
                (
                    f"raise NotImplementedError({py_literal(f'Noeud non traduit : {node_type}')})"
                ),
            ],
            supported=False,
            note=f"aucune traduction Python pour '{node_type}'",
        )
    return handler(params)


_HANDLERS = {
    "typing": emit_typing,
    "cleaning": emit_cleaning,
    "clean": emit_cleaning,
    "transform": emit_transform,
    "transform_recommend": emit_transform,
    "stationarization_transform": emit_transform,
    "descriptiveNumeric": emit_descriptive_numeric,
    "descriptive": emit_descriptive_numeric,
    "descriptiveCategorical": emit_descriptive_categorical,
    "correlation": emit_correlation,
    "correlations": emit_correlation,
    "vif": emit_vif,
    "pca": emit_pca,
    "manifold": emit_manifold,
    "cluster": emit_cluster,
    "clustering": emit_cluster,
    "regression": emit_regression,
    "classification": emit_classification,
    "model": emit_regression,
    "explainability": emit_explainability,
    "testStationarity": emit_stationarity,
    "stationarity": emit_stationarity,
    "timeseries_stationarity": emit_stationarity,
    "cointegration": emit_cointegration,
    "timeseries_cointegration": emit_cointegration,
    "timeseries": emit_timeseries,
    "timeseries_forecast": emit_timeseries,
    "multivariateTimeseries": emit_multivariate_timeseries,
    "timeseries_multivariate": emit_multivariate_timeseries,
    "survival": emit_survival,
    "causal": emit_causal,
    "hypothesis": emit_hypothesis,
    "sql": emit_sql,
    "python": emit_python,
    "chart": emit_chart,
    "insights": emit_insights,
    "output": emit_output,
    "report": emit_output,
}

SUPPORTED_NODE_TYPES = sorted(_HANDLERS)
