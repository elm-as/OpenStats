"""
Générateur de scripts R complets pour pipelines multi-étapes.
"""

from typing import Any, Dict, List
from app.core.code_generation.r_generator import generate_node_r_code


def generate_pipeline_r_script(steps: List[Dict[str, Any]], dataset_name: str = "dataset.csv") -> str:
    """
    Génère un script R complet réexécutant l'ensemble du pipeline.

    :param steps: Liste des étapes avec 'type'/'operation' et 'params'/'data'.
    :param dataset_name: Nom du dataset source.
    :return: Code R exécutable complet sous forme de chaîne de caractères.
    """
    header = [
        "# " + "=" * 76,
        "# SCRIPT R REPRODUCTIBLE — OPENSTATS BYELMAS",
        f"# Dataset Source : {dataset_name}",
        "# Généré automatiquement pour la recherche et l'audit",
        "# " + "=" * 76,
        "",
        "library(tidyverse)",
        "library(stats)",
        "library(psych)",
        "library(corrplot)",
        "library(survival)",
        "library(randomForest)",
        "",
        "# 1. Chargement du jeu de données",
        f"df <- read_csv('{dataset_name}')",
        "glimpse(df)",
        "",
    ]

    body_blocks = []
    for idx, step in enumerate(steps, 1):
        stype = step.get("operation") or step.get("type") or "unknown"
        sdata = step.get("params") or step.get("data") or {}
        label = step.get("label") or stype

        if stype == "dataset":
            continue

        block = [
            f"# " + "-" * 60,
            f"# Étape {idx} : {label} ({stype})",
            f"# " + "-" * 60,
            generate_node_r_code(stype, sdata, dataset_name, include_imports=False),
            "",
        ]
        body_blocks.append("\n".join(block))

    footer = [
        "# " + "=" * 76,
        "# Fin du script R OpenStats byElmas",
        "# " + "=" * 76,
    ]

    return "\n".join(header + body_blocks + footer)
