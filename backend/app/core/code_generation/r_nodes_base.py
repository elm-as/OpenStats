"""
Constantes, aides et chargement du jeu de donnees pour la generation de code R.
"""

from __future__ import annotations

from typing import Any

from app.core.code_generation.emitter import CodeBlock, r_cols, r_literal

TIDY = "library(tidyverse)"
STATS = "library(stats)"


def loader(dataset_name: str) -> CodeBlock:
    """Chargement selon l'extension reelle du fichier."""
    extension = dataset_name.rsplit(".", 1)[-1].lower() if "." in dataset_name else "csv"
    name = r_literal(dataset_name)

    if extension in ("xlsx", "xls"):
        call, package = f"readxl::read_excel({name})", "library(readxl)"
    elif extension == "parquet":
        call, package = f"arrow::read_parquet({name})", "library(arrow)"
    elif extension == "json":
        call, package = f"jsonlite::fromJSON({name}) %>% as_tibble()", "library(jsonlite)"
    elif extension == "tsv":
        call, package = f"readr::read_tsv({name})", "library(readr)"
    else:
        call, package = f"readr::read_csv({name})", "library(readr)"

    return CodeBlock(
        imports=[TIDY, package],
        body=[
            "# Chargement du jeu de donnees",
            f"df <- {call}",
            'cat(sprintf("Dataset : %d lignes, %d colonnes\\n", nrow(df), ncol(df)))',
        ],
    )


def columns_helper(params: dict[str, Any], *keys: str) -> list[str]:
    """Extrait une liste de colonnes depuis les cles fournies."""
    for key in keys:
        value = params.get(key)
        if isinstance(value, list) and value:
            return [str(v) for v in value]
        if isinstance(value, str) and value:
            return [value]
    return []


def target_helper(params: dict[str, Any]) -> str | None:
    """Extrait le nom de la variable cible."""
    for key in ("targetCol", "target_col", "target", "value_col", "valueCol"):
        value = params.get(key)
        if isinstance(value, str) and value:
            return value
    return None


def numeric_subset_helper(params: dict[str, Any]) -> str:
    """Expression R pour selectionner les colonnes numeriques."""
    cols = columns_helper(params, "columns")
    if cols:
        return f"df[, {r_cols(cols)}, drop = FALSE]"
    return "df %>% select(where(is.numeric))"
