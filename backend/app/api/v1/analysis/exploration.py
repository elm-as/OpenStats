"""
Routes de l'explorateur adaptatif.

Trois entrees :
  - GET  /datasets/<id>/explore/capabilities : ce qui est faisable, avant de lancer
  - POST /datasets/<id>/explore              : execution bloquante (JSON)
  - POST /datasets/<id>/explore/stream       : execution en flux SSE (temps reel)
"""

from __future__ import annotations

import json
import logging
import queue
import threading
import time

from flask import Response, jsonify, request, stream_with_context

from app.api.v1 import api_v1_bp
from app.api.v1.analysis.chart_data_builder import _sanitize_for_json
from app.services.dataset_service import dataset_manager

logger = logging.getLogger(__name__)

MAX_BUDGET_SEC = 300.0
DEFAULT_BUDGET_SEC = 45.0


def _load(dataset_id: str):
    """Charge (metadonnees, dataframe, types declares) ou renvoie une erreur HTTP."""
    meta = dataset_manager.get(dataset_id)
    if meta is None:
        return None, None, None, (jsonify({"error": "Dataset introuvable"}), 404)

    df = dataset_manager.get_df(dataset_id)
    if df is None or df.empty:
        return None, None, None, (jsonify({"error": "Dataset vide"}), 404)

    stored_profile = meta.get("profile") or {}
    overrides = meta.get("type_overrides") or {}
    declared: dict[str, str] = {}
    for entry in (stored_profile.get("dictionary") or []):
        if isinstance(entry, dict) and entry.get("nom_brut"):
            declared[entry["nom_brut"]] = str(entry.get("type_statistique", "")).lower()
    declared.update({k: str(v).lower() for k, v in overrides.items() if v and v != "auto"})

    return meta, df, _normalize_types(declared), None


def _normalize_types(declared: dict[str, str]) -> dict[str, str]:
    """Ramene les libelles de type du projet vers le vocabulaire de l'explorateur."""
    mapping = {
        "continu": "numeric", "numérique": "numeric", "numeric": "numeric", "float": "numeric",
        "discret": "numeric", "integer": "numeric", "int": "numeric",
        "binaire": "categorical", "binary": "categorical", "bool": "categorical",
        "catégoriel_nominal": "categorical", "catégoriel": "categorical",
        "categoriel": "categorical", "catégoriel_ordinal": "categorical",
        "categorical": "categorical", "texte": "categorical", "text": "categorical",
        "temporel": "temporal", "temporal": "temporal", "date": "temporal", "datetime": "temporal",
        "identifiant": "id", "id": "id",
    }
    return {col: mapping[value] for col, value in declared.items() if value in mapping}


def _budget(raw) -> float:
    try:
        return max(5.0, min(MAX_BUDGET_SEC, float(raw)))
    except (TypeError, ValueError):
        return DEFAULT_BUDGET_SEC


@api_v1_bp.route("/datasets/<dataset_id>/explore/capabilities", methods=["GET"])
def explore_capabilities(dataset_id: str):
    """Ce que l'explorateur peut faire sur ce dataset, pour une cible donnee.

    Repond avant tout calcul lourd : le front peut afficher le plan et le
    classement des covariables des que l'utilisateur choisit sa cible.
    """
    meta, df, declared, error = _load(dataset_id)
    if error:
        return error

    from app.core.exploration import admissible_probes, build_context
    from app.core.exploration.catalog import CATALOG

    target = request.args.get("target")
    ctx = build_context(df, target, declared)
    available = {spec.key for spec in admissible_probes(ctx)}

    probes = [{
        "key": spec.key,
        "label": spec.label,
        "explains": spec.explains,
        "admissible": spec.key in available,
        "gated": bool(spec.triggered_by),
        "triggered_by": sorted(spec.triggered_by),
        "estimated_cost_sec": round(spec.cost(ctx), 2),
    } for spec in CATALOG]

    payload = {
        "dataset_id": dataset_id,
        "target": ctx.target,
        "target_kind": ctx.target_kind,
        "n_rows": ctx.n_rows,
        "columns": {
            "numeric": ctx.numeric_cols,
            "categorical": ctx.categorical_cols,
            "temporal": ctx.temporal_cols,
        },
        "covariate_ranking": [{"column": c, "mutual_info": s} for c, s in ctx.ranked_covariates],
        "initial_facts": sorted(ctx.facts),
        "probes": probes,
        "n_admissible": len(available),
    }
    return jsonify(_sanitize_for_json(payload))


@api_v1_bp.route("/datasets/<dataset_id>/explore", methods=["POST"])
def explore_dataset(dataset_id: str):
    """Exploration complete, reponse unique. Toujours un resultat, meme si le budget est atteint."""
    meta, df, declared, error = _load(dataset_id)
    if error:
        return error

    from app.core.exploration import explore

    body = request.get_json(silent=True) or {}
    result = explore(df, body.get("target"), declared, budget_sec=_budget(body.get("budget_sec")))
    return jsonify(_sanitize_for_json({"success": True, "exploration": result}))


@api_v1_bp.route("/datasets/<dataset_id>/explore/stream", methods=["POST"])
def explore_dataset_stream(dataset_id: str):
    """Exploration diffusee en SSE : le front voit le raisonnement se derouler.

    Le dataframe est charge dans le contexte de requete puis passe au worker :
    le generateur SSE ne touche jamais au contexte Flask.
    """
    meta, df, declared, error = _load(dataset_id)
    if error:
        return error

    body = request.get_json(silent=True) or {}
    target = body.get("target")
    budget = _budget(body.get("budget_sec"))

    events: queue.Queue = queue.Queue()
    SENTINEL = object()

    def worker():
        from app.core.exploration import explore_stream
        try:
            for event in explore_stream(df, target, declared, budget_sec=budget):
                events.put(_sanitize_for_json(event))
        except Exception as exc:
            # Sommet d'un thread : sans interception, l'exception se perd
            # et le client attend indefiniment. La trace complete part
            # dans les journaux, le motif court part au client.
            logger.exception("Echec du pipeline diffuse")
            events.put({"type": "error", "error": f"{type(exc).__name__}: {exc}"})
        finally:
            events.put(SENTINEL)

    def generate():
        thread = threading.Thread(target=worker, daemon=True)
        thread.start()
        while True:
            try:
                event = events.get(timeout=2.0)
            except queue.Empty:
                yield ": keep-alive\n\n"
                continue
            if event is SENTINEL:
                break
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

    return Response(
        stream_with_context(generate()),
        content_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
