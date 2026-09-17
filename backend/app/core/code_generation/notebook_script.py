"""
Generation de notebook Jupyter, sur la meme base que le script Python.

Le notebook n'est pas une troisieme implementation : il reutilise les blocs de
`python_nodes` et l'ordre topologique de `emitter`. Chaque cellule porte ses
propres imports, ce qui la rend executable independamment.
"""

from __future__ import annotations

from typing import Any

from app.core.code_generation.emitter import node_identity, topological_order
from app.core.code_generation.python_nodes import emit, loader

NBFORMAT = 4
NBFORMAT_MINOR = 5


def _markdown(lines: list[str]) -> dict[str, Any]:
    return {"cell_type": "markdown", "metadata": {}, "source": lines}


def _code(lines: list[str]) -> dict[str, Any]:
    return {"cell_type": "code", "execution_count": None, "metadata": {},
            "outputs": [], "source": lines}


def _as_source(lines: list[str]) -> list[str]:
    """Format Jupyter : chaque ligne conserve son retour, sauf la derniere."""
    if not lines:
        return []
    return [line + "\n" for line in lines[:-1]] + [lines[-1]]


def generate_notebook(nodes: list[dict[str, Any]],
                      edges: list[dict[str, Any]] | None = None,
                      dataset_name: str = "dataset.csv") -> dict[str, Any]:
    """Notebook Jupyter v4 reproduisant le canvas."""
    ordered = topological_order(nodes, edges)
    cells: list[dict[str, Any]] = [
        _markdown(_as_source([
            "# Pipeline d'analyse OpenStats",
            "",
            f"**Source** : `{dataset_name}`",
            "",
            "Genere depuis le canvas d'analyse. Les cellules suivent l'ordre du graphe.",
        ]))
    ]

    load_block = loader(dataset_name)
    cells.append(_code(_as_source(
        sorted(set(load_block.imports)) + [""] + load_block.body + ["", "df.head()"]
    )))

    unsupported: list[str] = []
    step = 0

    for node in ordered:
        node_type, params, label = node_identity(node)
        if node_type in ("dataset", "unknown") and step == 0:
            continue

        block = emit(node_type, params, dataset_name)
        if not block.supported:
            unsupported.append(node_type)
        if not block.body:
            continue

        step += 1
        heading = [f"## Etape {step} : {label}"]
        rationale = node.get("rationale") or block.note
        if rationale:
            heading += ["", f"_{rationale}_"]
        cells.append(_markdown(_as_source(heading)))

        source = (sorted(set(block.imports)) + [""] if block.imports else []) + block.body
        cells.append(_code(_as_source(source)))

    return {
        "cells": cells,
        "metadata": {
            "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
            "language_info": {"name": "python", "pygments_lexer": "ipython3"},
            "openstats": {"unsupported_nodes": sorted(set(unsupported))},
        },
        "nbformat": NBFORMAT,
        "nbformat_minor": NBFORMAT_MINOR,
    }
