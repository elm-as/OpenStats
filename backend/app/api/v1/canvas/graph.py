"""
Fonctions utilitaires de graphe pour le pipeline de Canvas (tri topologique, filiation).
"""

from __future__ import annotations

from collections import deque, defaultdict
from typing import Any


def _topo_sort(nodes: list[dict], edges: list[dict]) -> list[str]:
    """Tri topologique des nœuds selon les arêtes."""
    adj = defaultdict(list)
    in_deg = {n["id"]: 0 for n in nodes}

    for e in edges:
        src, tgt = e["source"], e["target"]
        if src in in_deg and tgt in in_deg:
            adj[src].append(tgt)
            in_deg[tgt] += 1

    queue = deque([nid for nid, d in in_deg.items() if d == 0])
    order = []
    while queue:
        nid = queue.popleft()
        order.append(nid)
        for child in adj[nid]:
            in_deg[child] -= 1
            if in_deg[child] == 0:
                queue.append(child)

    remaining = [n["id"] for n in nodes if n["id"] not in order]
    order.extend(remaining)
    return order


def _has_prep_ancestor(node_id: str, parents: dict[str, list[str]], node_map: dict[str, Any]) -> bool:
    """Détermine si un nœud a un ancêtre de préparation/nettoyage dans son chemin d'arêtes."""
    PREP_TYPES = {"cleaning", "transform", "computeVariable"}
    visited = set()
    stack = list(parents.get(node_id, []))
    while stack:
        curr = stack.pop()
        if curr in visited:
            continue
        visited.add(curr)
        curr_type = node_map.get(curr, {}).get("type", "")
        if curr_type in PREP_TYPES:
            return True
        stack.extend(parents.get(curr, []))
    return False


def _resolve_cleaned_flag(
    node_id: str, parents: dict[str, list[str]], node_map: dict[str, Any]
) -> bool:
    """Utilise par défaut la dernière version nettoyée du dataset, alignée sur DatasetNode."""
    if _has_prep_ancestor(node_id, parents, node_map):
        return True
    visited = set()
    stack = [node_id, *parents.get(node_id, [])]
    while stack:
        curr = stack.pop()
        if curr in visited:
            continue
        visited.add(curr)
        node = node_map.get(curr, {})
        if node.get("type") == "dataset" and bool((node.get("data") or {}).get("useRaw")):
            return False
        stack.extend(parents.get(curr, []))
    return True
