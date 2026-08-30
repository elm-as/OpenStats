"""
Point d'entrée de streaming SSE en temps réel pour l'exécution du pipeline Canvas.
"""

from __future__ import annotations

import gc
import json
import logging
import queue
import time
import threading
from concurrent.futures import ThreadPoolExecutor, wait, FIRST_COMPLETED
from flask import request, jsonify, current_app, Response, stream_with_context

from app.api.v1 import api_v1_bp
from app.api.v1.canvas.graph import _has_prep_ancestor
from app.api.v1.canvas.nodes import execute_node, _sanitize

logger = logging.getLogger(__name__)


@api_v1_bp.route("/canvas/stream_pipeline", methods=["POST"])
def stream_canvas_pipeline():
    """
    Exécute un pipeline Canvas complet en diffusant les événements SSE en temps réel :
    - Début de nœud
    - Logs de sous-étapes
    - Fin de nœud avec résultat immédiat
    - Clôture du pipeline
    """
    body = request.get_json()
    if not body or not body.get("nodes"):
        return jsonify({"success": False, "error": "Body JSON requis avec au moins un nœud"}), 400

    nodes = body.get("nodes", [])
    edges = body.get("edges", [])

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

    event_queue: queue.Queue = queue.Queue()
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
                event_queue.put({"type": "node_error", "node_id": node_id, "error": "Nœud introuvable"})
                return node_id

            node_type = node.get("type", "")
            node_data = node.get("data", {})
            clean_data = {k: v for k, v in node_data.items() if k not in ("onChange", "onDelete")}
            clean_data["_cleaned"] = _has_prep_ancestor(node_id, parents, node_map)

            can_use_cache = ("runResult" in clean_data and clean_data["runResult"]) and not _has_rerun_ancestor(node_id)
            if can_use_cache:
                logger.info("Canvas pipeline: nœud '%s' ignoré car résultat déjà en cache", node_id)
                result = clean_data["runResult"]
                event_queue.put({"type": "node_start", "node_id": node_id})
                event_queue.put({"type": "node_log", "node_id": node_id, "message": "Résultat en cache utilisé ⚡"})
                event_queue.put({
                    "type": "node_complete",
                    "node_id": node_id,
                    "status": "success",
                    "message": "Chargé depuis le cache",
                    "result": result,
                })
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

            event_queue.put({
                "type": "node_start",
                "node_id": node_id,
                "node_type": node_type,
                "dataset_id": dataset_id,
                "time": time.strftime("%H:%M:%S"),
            })
            event_queue.put({
                "type": "node_log",
                "node_id": node_id,
                "message": f"Démarrage du bloc {node_type} (ID: {node_id})...",
                "level": "info",
                "time": time.strftime("%H:%M:%S"),
            })

            result = execute_node(node_type, clean_data, dataset_id)

            if isinstance(result, dict) and result.get("status") == "error":
                event_queue.put({
                    "type": "node_error",
                    "node_id": node_id,
                    "error": result.get("error") or result.get("message") or "Erreur inconnue",
                    "time": time.strftime("%H:%M:%S"),
                })
            else:
                sanitized_res = _sanitize(result)
                with results_lock:
                    results[node_id] = sanitized_res

                event_queue.put({
                    "type": "node_complete",
                    "node_id": node_id,
                    "status": result.get("status", "success"),
                    "message": result.get("message", "Exécution terminée"),
                    "result": sanitized_res.get("result") if isinstance(sanitized_res, dict) else sanitized_res,
                    "time": time.strftime("%H:%M:%S"),
                })

            with dataset_id_map_lock:
                resolved_id = result.get("dataset_id") if isinstance(result, dict) else None
                if resolved_id:
                    dataset_id_map[node_id] = resolved_id
                elif dataset_id:
                    dataset_id_map[node_id] = dataset_id

            gc.collect()
            return node_id

    def generate_events():
        def worker_dag():
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
                            event_queue.put({
                                "type": "node_error",
                                "node_id": nid,
                                "error": str(e),
                                "time": time.strftime("%H:%M:%S"),
                            })

                        for child in children.get(nid, []):
                            in_degrees[child] -= 1
                            if in_degrees[child] == 0:
                                futures[executor.submit(process_node, child)] = child

            event_queue.put({"type": "pipeline_complete", "time": time.strftime("%H:%M:%S")})

        t = threading.Thread(target=worker_dag)
        t.start()

        while True:
            try:
                msg = event_queue.get(timeout=2.0)
                yield f"data: {json.dumps(msg)}\n\n"
                if msg.get("type") == "pipeline_complete":
                    break
            except queue.Empty:
                yield ": keep-alive\n\n"

    return Response(stream_with_context(generate_events()), content_type="text/event-stream")
