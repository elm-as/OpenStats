"""
Moteur d'exploration adaptative.

Contrairement a l'auto-pipeline historique (recette figee construite avant tout
resultat), ce moteur decide de la suite en fonction de ce qu'il vient de trouver.
"""

from app.core.exploration.catalog import CATALOG, admissible_probes, ready_probes
from app.core.exploration.context import ExplorationContext, build_context
from app.core.exploration.engine import explore, explore_stream, ExplorationResult
from app.core.exploration.finding import Finding, rank_findings

__all__ = [
    "CATALOG",
    "ExplorationContext",
    "ExplorationResult",
    "Finding",
    "admissible_probes",
    "build_context",
    "explore",
    "explore_stream",
    "rank_findings",
    "ready_probes",
]
