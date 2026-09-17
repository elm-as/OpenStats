"""
Routes du pipeline methodologique iteratif.

  POST /datasets/<id>/methodology         execution bloquante (JSON complet)
  POST /datasets/<id>/methodology/stream  execution diffusee (SSE, une etape a la fois)
  POST /datasets/<id>/methodology/apply   applique les corrections retenues et
                                          enregistre une nouvelle version du dataset
"""

from __future__ import annotations

import json
import logging
import queue
import threading

from flask import Response, jsonify, request, stream_with_context
from sqlalchemy.exc import SQLAlchemyError

from app.api.v1 import api_v1_bp
from app.api.v1.analysis.chart_data_builder import _sanitize_for_json
from app.core.statistical_attempt import describe
from app.services.dataset_service import dataset_manager

logger = logging.getLogger(__name__)

MAX_ITERATIONS_CAP = 10


def _load(dataset_id: str):
    meta = dataset_manager.get(dataset_id)
    if meta is None:
        return None, None, (jsonify({"error": "Dataset introuvable"}), 404)
    df = dataset_manager.get_df(dataset_id)
    if df is None or df.empty:
        return None, None, (jsonify({"error": "Dataset vide"}), 404)
    return meta, df, None


def _profiling(meta) -> dict:
    """Typage declare par l'utilisateur, a transmettre au pipeline."""
    return {
        "type_overrides": (meta or {}).get("type_overrides") or {},
        "stored_profile": (meta or {}).get("profile") or {},
    }


def _options(body: dict):
    target = body.get("target") or None
    task_hint = body.get("task_type") or None
    try:
        iterations = int(body.get("max_iterations", 5))
    except (TypeError, ValueError):
        iterations = 5
    return {
        "target": target,
        "task_hint": task_hint,
        "max_iterations": max(1, min(MAX_ITERATIONS_CAP, iterations)),
        "allow_aggressive": bool(body.get("allow_aggressive", True)),
    }


@api_v1_bp.route("/datasets/<dataset_id>/methodology", methods=["POST"])
def run_methodology(dataset_id: str):
    """Deroule la methodologie complete et renvoie toutes les etapes."""
    meta, df, error = _load(dataset_id)
    if error:
        return error

    from app.core.pipeline.stages import run_pipeline

    options = {**_options(request.get_json(silent=True) or {}), **_profiling(meta)}
    payload = None
    for event in run_pipeline(df, **options):
        if event["type"] == "complete":
            payload = event

    return jsonify(_sanitize_for_json({"success": True, "result": payload}))


@api_v1_bp.route("/datasets/<dataset_id>/methodology/stream", methods=["POST"])
def stream_methodology(dataset_id: str):
    """Diffuse chaque etape des qu'elle est terminee : la progression est visible."""
    meta, df, error = _load(dataset_id)
    if error:
        return error

    options = {**_options(request.get_json(silent=True) or {}), **_profiling(meta)}
    events: queue.Queue = queue.Queue()
    SENTINEL = object()

    def worker():
        from app.core.pipeline.stages import run_pipeline
        try:
            for event in run_pipeline(df, **options):
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


@api_v1_bp.route("/datasets/<dataset_id>/methodology/canvas", methods=["POST"])
def methodology_to_canvas(dataset_id: str):
    """Convertit une analyse methodique en graphe de canvas editable.

    Le corps porte le resultat renvoye par `/methodology` (ou son flux). Le
    graphe obtenu est ensuite exportable en Python ou en R comme n'importe quel
    canvas.
    """
    meta, df, error = _load(dataset_id)
    if error:
        return error

    from app.core.pipeline.to_canvas import build_canvas

    body = request.get_json(silent=True) or {}
    result = body.get("result")
    if not isinstance(result, dict) or not result.get("stages"):
        return jsonify({"error": "Resultat d'analyse manquant ou invalide"}), 400

    graph = build_canvas(result, dataset_id=dataset_id,
                         dataset_name=(meta or {}).get("name") or "dataset.csv")
    return jsonify(_sanitize_for_json({"success": True, **graph}))


@api_v1_bp.route("/datasets/<dataset_id>/methodology/apply", methods=["POST"])
def apply_methodology(dataset_id: str):
    """Applique une liste de corrections choisies et enregistre le resultat.

    Permet a l'utilisateur de reprendre la main : il peut ne retenir qu'une
    partie des transformations proposees par la boucle.
    """
    meta, df, error = _load(dataset_id)
    if error:
        return error

    from app.core.pipeline.diagnostics import Remedy
    from app.core.pipeline.remediation import apply_remedy

    body = request.get_json(silent=True) or {}
    target = body.get("target") or None
    remedies = body.get("remedies") or []
    if not isinstance(remedies, list) or not remedies:
        return jsonify({"error": "Aucune correction fournie"}), 400

    working = df
    applied = []
    for raw in remedies:
        if not isinstance(raw, dict) or not raw.get("action"):
            continue
        remedy = Remedy(
            action=str(raw["action"]),
            columns=tuple(raw.get("columns") or []),
            label=str(raw.get("label") or raw["action"]),
            rationale=str(raw.get("rationale") or ""),
            params=raw.get("params") or {},
            aggressive=bool(raw.get("aggressive", False)),
        )
        working, trace = apply_remedy(working, remedy, protected=target)
        applied.append(trace.to_dict())

    saved = None
    if body.get("save_as_version", True):
        try:
            saved = _persist_version(dataset_id, working, applied, body.get("label"))
        except (SQLAlchemyError, OSError) as exc:
            logger.exception("Enregistrement de la version impossible")
            return jsonify({"error": f"Enregistrement impossible : {exc}"}), 500

    return jsonify(_sanitize_for_json({
        "success": True,
        "applied": applied,
        "version": saved,
        "shape": {"rows": len(working), "columns": working.shape[1]},
        "columns": list(working.columns),
    }))


def _persist_version(dataset_id: str, df, applied: list, label: str | None) -> dict:
    """Enregistre le dataframe corrige comme nouvelle version du dataset.

    Reprend le mecanisme deja utilise par la route de transformations : nouvelle
    entree DatasetVersion, ecriture parquet, profil recalcule, cache invalide.
    """
    from app.extensions import db
    from app.models.dataset import DatasetVersion
    from app.services.storage_service import storage
    from app.core.profiling import profile_dataframe

    model = dataset_manager.get_dataset_model(dataset_id)
    next_version = max((v.version_number for v in model.versions), default=0) + 1
    parquet_path = storage.save_dataframe(df, dataset_id, version=next_version)
    profile = profile_dataframe(df)

    version = DatasetVersion(
        dataset_id=dataset_id,
        version_number=next_version,
        label=label or "methodology",
        description=f"Corrections methodologiques ({len(applied)} operations)",
        parquet_path=parquet_path,
        rows=df.shape[0],
        columns=df.shape[1],
        operations_log=[{"action": a["action"], "columns": a["columns"],
                         "label": a["label"], "ok": a["ok"]} for a in applied],
        profile_snapshot=profile,
    )
    db.session.add(version)
    model.rows = df.shape[0]
    model.columns = df.shape[1]
    model.profile = profile
    db.session.commit()

    # Le cache doit refleter la nouvelle version, sinon les ecrans suivants
    # continueraient de travailler sur les donnees d'avant correction.
    # Un echec ici n'annule pas l'enregistrement, mais ne doit pas passer
    # inapercu : l'utilisateur verrait des chiffres perimes.
    try:
        dataset_manager._get_cache(dataset_id).pop("df", None)
    except (AttributeError, KeyError) as exc:
        logger.warning("Cache du dataset %s non invalide (%s) : les ecrans "
                       "peuvent afficher la version precedente.", dataset_id, describe(exc))

    return {"version_number": next_version, "rows": df.shape[0], "columns": df.shape[1]}
