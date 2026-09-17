"""
Assemblage du script Python complet a partir d'un canvas ou d'une recette.

Utilise l'assembleur commun (`emitter.assemble`) : ordre topologique, imports
collectes, litteraux echappes, noeuds non traduits signales explicitement.
"""

from __future__ import annotations

from typing import Any

from app.core.code_generation.emitter import Assembled, assemble
from app.core.code_generation.python_nodes import emit, loader

HEADER = [
    "# " + "=" * 74,
    "# SCRIPT PYTHON REPRODUCTIBLE - OPENSTATS",
    "# Genere automatiquement depuis le canvas d'analyse.",
    "# " + "=" * 74,
    "",
]

FOOTER = [
    "# " + "=" * 74,
    "# Fin du script",
    "# " + "=" * 74,
]

BASE_IMPORTS = ["import pandas as pd", "import numpy as np"]


def generate_python_script(nodes: list[dict[str, Any]],
                           edges: list[dict[str, Any]] | None = None,
                           dataset_name: str = "dataset.csv",
                           strict: bool = False) -> Assembled:
    """Script Python complet. Renvoie le code et le diagnostic de traduction."""
    return assemble(
        nodes, edges, dataset_name,
        emit=emit, loader=loader,
        base_imports=BASE_IMPORTS,
        header=HEADER, footer=FOOTER,
        comment="#", strict=strict,
    )


def generate_python_code(nodes: list[dict[str, Any]],
                         edges: list[dict[str, Any]] | None = None,
                         dataset_name: str = "dataset.csv") -> str:
    """Variante ne renvoyant que le code, pour les appelants existants."""
    return generate_python_script(nodes, edges, dataset_name).code
