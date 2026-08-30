"""
Package Canvas de l'API v1 (Graphe de flux et exécution).
Découpé en sous-modules pour respecter la limite de 350 lignes :
- graph : algorithmes de graphe (tri topologique, recherche d'ancêtres)
- execution : exécution du pipeline via ThreadPoolExecutor DAG
- streaming : diffusion des événements SSE en temps réel
- generation : génération automatique depuis recette et partage de canvas
- export_routes : export de code reproductible et rapport PDF
"""

from __future__ import annotations

from app.api.v1.canvas.graph import _topo_sort, _has_prep_ancestor
from app.api.v1.canvas.generation import generate_canvas_from_recipe

# Enregistrement des routes sur api_v1_bp
from app.api.v1.canvas import execution  # noqa: F401
from app.api.v1.canvas import streaming  # noqa: F401
from app.api.v1.canvas import generation  # noqa: F401
from app.api.v1.canvas import export_routes  # noqa: F401

__all__ = [
    "_topo_sort",
    "_has_prep_ancestor",
    "generate_canvas_from_recipe",
]

