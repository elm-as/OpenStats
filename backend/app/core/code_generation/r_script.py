"""
Assemblage du script R complet, sur l'assembleur commun.

Meme socle que le generateur Python : ordre topologique, packages collectes
depuis les noeuds, identifiants echappes, noeuds non traduits signales.
"""

from __future__ import annotations

from typing import Any

from app.core.code_generation.emitter import Assembled, assemble
from app.core.code_generation.r_nodes import emit, loader

HEADER = [
    "# " + "=" * 74,
    "# SCRIPT R REPRODUCTIBLE - OPENSTATS",
    "# Genere automatiquement depuis le canvas d'analyse.",
    "# " + "=" * 74,
    "",
]

FOOTER = [
    "# " + "=" * 74,
    "# Fin du script",
    "# " + "=" * 74,
]

BASE_IMPORTS = ["library(tidyverse)"]


def generate_r_script(nodes: list[dict[str, Any]],
                      edges: list[dict[str, Any]] | None = None,
                      dataset_name: str = "dataset.csv",
                      strict: bool = False) -> Assembled:
    """Script R complet. Renvoie le code et le diagnostic de traduction."""
    return assemble(
        nodes, edges, dataset_name,
        emit=emit, loader=loader,
        base_imports=BASE_IMPORTS,
        header=HEADER, footer=FOOTER,
        comment="#", strict=strict,
    )


def generate_r_code(nodes: list[dict[str, Any]],
                    edges: list[dict[str, Any]] | None = None,
                    dataset_name: str = "dataset.csv") -> str:
    """Variante ne renvoyant que le code."""
    return generate_r_script(nodes, edges, dataset_name).code
