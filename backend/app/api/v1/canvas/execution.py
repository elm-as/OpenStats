"""
Point d'entrée d'exécution globale synchrone/parallèle du pipeline Canvas.
"""

from __future__ import annotations

import gc
import logging
from concurrent.futures import ThreadPoolExecutor, wait, FIRST_COMPLETED
import threading
from flask import request, jsonify, current_app

from app.api.v1 import api_v1_bp
from app.api.v1.canvas.graph import _has_prep_ancestor
from app.api.v1.canvas.nodes import execute_node, _sanitize

logger = logging.getLogger(__name__)


@api_v1_bp.route("/canvas/run_pipeline", methods=["POST"])
def run_canvas_pipeline():
    """
    Exécute un pipeline Canvas complet en utilisant un graphe de dépendances (DAG)
    et ThreadPoolExecutor pour paralléliser les branches indépendantes.
    """
    body = request.get_json()
    if not body:
        return jsonify({"success": False, "error": "Body JSON requis"}), 400

    nodes = body.get("nodes", [])
    edges = body.get("edges", [])

    if not nodes:
        return jsonify({"success": False, "error": "Aucun nœud dans le pipeline"}), 400

    node_map = {n["id"]: n for n in nodes}
    in_degrees = {n["id"]: 0 for n in nodes}
    children = {n["id"]: [] for n in nodes}
    parents = {n["id"]: [] for n in nodes}

    for e in edges:
        src, tgt = e["source"], e["target"]
        if src in in_degrees and tgt in in_degrees:
            children[src].append(tgt)
            parents[tgt].append(src)
            in_degrees[tgt] += 1

    results = {}
    dataset_id_map = {}
    rerun_nodes = set()

    app = current_app._get_current_object()
    dataset_id_map_lock = threading.Lock()
    results_lock = threading.Lock()
    rerun_lock = threading.Lock()

    def _has_rerun_ancestor(nid):
        stack = list(parents.get(nid, []))
        visited = set()
        while stack:
            curr = stack.pop()
            if curr in visited:
                continue
            visited.add(curr)
            with rerun_lock:
                if curr in rerun_nodes:
                    return True
            stack.extend(parents.get(curr, []))
        return False

    def process_node(node_id):
        with app.app_context():
            node = node_map.get(node_id)
            if not node:
                logger.warning("Canvas pipeline: nœud '%s' introuvable dans le graphe", node_id)
                with results_lock:
                    results[node_id] = {"status": "error", "message": f"Nœud '{node_id}' introuvable"}
                return node_id

            node_type = node.get("type", "")
            node_data = node.get("data", {})
            clean_data = {k: v for k, v in node_data.items() if k not in ("onChange", "onDelete")}
            clean_data["_cleaned"] = _has_prep_ancestor(node_id, parents, node_map)

            can_use_cache = ("runResult" in clean_data and clean_data["runResult"]) and not _has_rerun_ancestor(node_id)
            if can_use_cache:
                logger.info("Canvas pipeline: nœud '%s' ignoré car résultat déjà en cache", node_id)
                result = clean_data["runResult"]
                with results_lock:
                    results[node_id] = result
                with dataset_id_map_lock:
                    resolved_id = result.get("dataset_id") if isinstance(result, dict) else None
                    if node_type == "dataset" and resolved_id:
                        dataset_id_map[node_id] = resolved_id
                    elif resolved_id:
                        dataset_id_map[node_id] = resolved_id
                return node_id

            dataset_id = None
            if node_type != "dataset":
                parent_ids = parents.get(node_id, [])
                with dataset_id_map_lock:
                    for pid in parent_ids:
                        if pid in dataset_id_map:
                            dataset_id = dataset_id_map[pid]
                            break

            logger.info("Canvas pipeline: exécution nœud '%s' (type=%s, dataset_id=%s)", node_id, node_type, dataset_id)
            with rerun_lock:
                rerun_nodes.add(node_id)

            result = execute_node(node_type, clean_data, dataset_id)
            if isinstance(result, dict) and result.get("status") == "error":
                logger.warning("Canvas pipeline: nœud '%s' en erreur: %s", node_id, result.get("error") or result.get("message"))

            with results_lock:
                results[node_id] = result

            with dataset_id_map_lock:
                resolved_id = result.get("dataset_id") if isinstance(result, dict) else None
                if resolved_id:
                    dataset_id_map[node_id] = resolved_id
                elif dataset_id:
                    dataset_id_map[node_id] = dataset_id

            gc.collect()
            return node_id

    ready = [nid for nid, d in in_degrees.items() if d == 0]
    futures = {}
    with ThreadPoolExecutor(max_workers=2) as executor:
        for nid in ready:
            futures[executor.submit(process_node, nid)] = nid

        while futures:
            done, _ = wait(futures.keys(), return_when=FIRST_COMPLETED)
            for f in done:
                nid = futures.pop(f)
                try:
                    f.result()
                except Exception as e:
                    logger.exception("Canvas pipeline: exception non capturée pour le nœud '%s'", nid)
                    with results_lock:
                        results[nid] = {"status": "error", "message": str(e)}

                for child in children.get(nid, []):
                    in_degrees[child] -= 1
                    if in_degrees[child] == 0:
                        futures[executor.submit(process_node, child)] = child

    return jsonify({
        "success": True,
        "node_count": len(nodes),
        "executed": len(results),
        "results": _sanitize(results),
    })
