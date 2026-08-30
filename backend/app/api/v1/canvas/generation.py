"""
Génération automatique de pipeline Canvas et partage public de graphes.
"""

from __future__ import annotations

import json
import os
import uuid
import logging
from flask import request, jsonify

from app.api.v1 import api_v1_bp

logger = logging.getLogger(__name__)


@api_v1_bp.route("/canvas/share", methods=["POST"])
def share_canvas():
    """Crée un lien public en lecture seule pour un canvas."""
    body = request.get_json()
    if not body:
        return jsonify({"error": "Body requis"}), 400

    share_id = str(uuid.uuid4())
    share_dir = os.path.join(os.getcwd(), "data", "shares")
    os.makedirs(share_dir, exist_ok=True)

    file_path = os.path.join(share_dir, f"{share_id}.json")
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(body, f)

    return jsonify({"success": True, "share_id": share_id, "url": f"/share/{share_id}"})


@api_v1_bp.route("/canvas/share/<share_id>", methods=["GET"])
def get_shared_canvas(share_id: str):
    """Récupère un canvas partagé."""
    if not share_id.replace("-", "").isalnum():
        return jsonify({"error": "Invalid share ID"}), 400

    share_dir = os.path.join(os.getcwd(), "data", "shares")
    file_path = os.path.join(share_dir, f"{share_id}.json")
    if not os.path.exists(file_path):
        return jsonify({"error": "Lien introuvable ou expiré"}), 404

    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    return jsonify({"success": True, "data": data})


@api_v1_bp.route("/canvas/generate_from_recipe", methods=["GET", "POST", "OPTIONS"])
@api_v1_bp.route("/datasets/<dataset_id>/auto-pipeline/canvas", methods=["GET", "POST", "OPTIONS"])
def generate_canvas_from_recipe(dataset_id=None):
    """Génère un graphe Canvas ReactFlow (nœuds + arêtes) prêt à l'emploi d'après le profil du dataset."""
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200
    body = request.get_json(silent=True) or {}
    dataset_id = dataset_id or body.get("dataset_id") or request.args.get("dataset_id")
    target = body.get("target") or request.args.get("target")

    if not dataset_id:
        return jsonify({"error": "dataset_id requis"}), 400

    from app.services.dataset_service import dataset_manager
    from app.core.auto_pipeline import detect_dataset_profile, build_recipe
    from app.core.auto_pipeline.recipe import PipelineRecipe, PipelineStep

    df = dataset_manager.get_df(dataset_id)
    ds_info = dataset_manager.get(dataset_id) or {}
    type_overrides = ds_info.get("type_overrides") or getattr(ds_info, "type_overrides", {}) or {}
    stored_profile = ds_info.get("profile") or getattr(ds_info, "profile", {}) or {}
    profile = detect_dataset_profile(df, user_hint_target=target, type_overrides=type_overrides, ds_profile=stored_profile)

    if body.get("recipe") and isinstance(body.get("recipe"), dict) and "steps" in body.get("recipe"):
        raw_r = body["recipe"]
        raw_steps = [PipelineStep(**s) if isinstance(s, dict) else s for s in raw_r.get("steps", [])]
        recipe = PipelineRecipe(
            title=raw_r.get("title", "Pipeline personnalisé"),
            description=raw_r.get("description", ""),
            problem_type=raw_r.get("problem_type", profile.problem_type),
            target=raw_r.get("target", target),
            steps=raw_steps,
            estimated_duration_sec=raw_r.get("estimated_duration_sec", 30),
            confidence=raw_r.get("confidence", "high"),
        )
    else:
        task_type = body.get("task_type") or request.args.get("task_type")
        selected_analyses = body.get("selected_analyses")
        recipe = build_recipe(profile, target=target, task_type=task_type, selected_analyses=selected_analyses)

    problem = recipe.problem_type
    effective_target = recipe.target or target or ""

    nodes = [
        {
            "id": "node_dataset",
            "type": "dataset",
            "position": {"x": 50, "y": 250},
            "data": {
                "label": "Dataset Source",
                "dataset_id": dataset_id,
                "file": dataset_id,
                "importMode": "existing",
            },
        }
    ]

    STEP_NODE_MAP = {
        "clean": {"type": "cleaning", "label": "Nettoyage Automatique", "layer": 1, "y": 250},
        "descriptive": {"type": "descriptiveNumeric", "label": "Statistiques Descriptives", "layer": 2, "y": 80},
        "correlations": {"type": "correlation", "label": "Matrice de Corrélation", "layer": 2, "y": 180},
        "vif": {"type": "vif", "label": "VIF & Multicolinéarité", "layer": 2, "y": 280},
        "timeseries_stationarity": {"type": "testStationarity", "label": "Tests de Stationnarité (ADF/KPSS)", "layer": 2, "y": 200},
        "stationarity": {"type": "testStationarity", "label": "Tests de Stationnarité (ADF/KPSS)", "layer": 2, "y": 200},
        "timeseries_cointegration": {"type": "cointegration", "label": "Test de Cointégration (Johansen)", "layer": 2, "y": 300},
        "cointegration": {"type": "cointegration", "label": "Test de Cointégration (Johansen)", "layer": 2, "y": 300},
        "stationarization_transform": {"type": "transform", "label": "Stationnarisation & Différenciation", "layer": 2, "y": 380},
        "transform": {"type": "transform", "label": "Transformations & Normalisation", "layer": 2, "y": 380},
        "transform_recommend": {"type": "transform", "label": "Recommandations de transformation", "layer": 2, "y": 380},
        "pca": {"type": "pca", "label": "ACP — Réduction de dimensions", "layer": 2, "y": 480},
        "manifold": {"type": "manifold", "label": "Projection t-SNE / UMAP", "layer": 2, "y": 580},
        "survival": {"type": "survival", "label": "Analyse de Survie (Kaplan-Meier & Cox)", "layer": 3, "y": 150},
        "causal": {"type": "causal", "label": "Inférence Causale (DiD / PSM)", "layer": 3, "y": 350},
        "timeseries": {"type": "timeseries", "label": "Prévision Temporelle (ARIMA)", "layer": 3, "y": 200},
        "timeseries_forecast": {"type": "timeseries", "label": "Prévision Temporelle (ARIMA)", "layer": 3, "y": 200},
        "timeseries_multivariate": {"type": "multivariateTimeseries", "label": "Prévision Multi-variée (VAR)", "layer": 3, "y": 320},
        "model": {"type": "classification" if "classification" in problem else "regression", "label": f"Modélisation ({problem})", "layer": 3, "y": 250},
        "explainability": {"type": "explainability", "label": "Explicabilité SHAP", "layer": 4, "y": 150},
        "insights": {"type": "insights", "label": "Insights & Diagnostiques IA", "layer": 4, "y": 330},
        "report": {"type": "output", "label": "Rapport PDF/DOCX Automatique", "layer": 5, "y": 250},
    }

    edges = []
    layer_x_base = {0: 50, 1: 320, 2: 600, 3: 900, 4: 1180, 5: 1460}
    layer_y_offsets: dict[int, int] = {}
    node_id_map: dict[str, str] = {"dataset": "node_dataset"}
    seen_node_types: set[str] = set()

    for step in recipe.steps:
        s_key = step.key
        s_op = getattr(step, "operation", s_key)
        step_config = STEP_NODE_MAP.get(s_key) or STEP_NODE_MAP.get(s_op, {"type": s_op, "label": step.label, "layer": 2, "y": 250})
        node_type = step_config["type"]

        if node_type in seen_node_types and node_type in ("cleaning", "transform", "pca", "manifold", "insights", "output", "testStationarity", "cointegration"):
            continue
        seen_node_types.add(node_type)

        node_id = f"node_{s_key}"
        node_id_map[s_key] = node_id
        node_id_map[node_type] = node_id
        layer = step_config.get("layer", 2)
        base_x = layer_x_base.get(layer, 600 + layer * 280)
        base_y = step_config.get("y", 250)

        current_y_count = layer_y_offsets.get(layer, 0)
        layer_y_offsets[layer] = current_y_count + 1
        y_pos = base_y + (current_y_count * 100 if current_y_count > 0 else 0)

        data_payload = {
            "label": step_config["label"],
            "targetCol": effective_target,
            "mode": "auto",
        }
        if step.params:
            data_payload.update(step.params)
        if step_config["type"] == "output":
            data_payload["format"] = "pdf"

        nodes.append({
            "id": node_id,
            "type": node_type,
            "position": {"x": base_x, "y": y_pos},
            "data": data_payload,
        })

        if layer == 1:
            source_id = "node_dataset"
        elif layer == 2:
            source_id = node_id_map.get("clean", node_id_map.get("cleaning", "node_dataset"))
        elif layer == 3:
            source_id = node_id_map.get("transform", node_id_map.get("clean", node_id_map.get("cleaning", "node_dataset")))
        elif layer == 4:
            source_id = node_id_map.get("model", node_id_map.get("timeseries", node_id_map.get("multivariateTimeseries", node_id_map.get("clean", "node_dataset"))))
        elif layer == 5:
            source_id = node_id_map.get("insights", node_id_map.get("explainability", node_id_map.get("model", "node_dataset")))
        else:
            source_id = "node_dataset"

        edges.append({
            "id": f"e_{source_id}_{node_id}",
            "source": source_id,
            "target": node_id,
        })

    return jsonify({
        "success": True,
        "title": recipe.title,
        "nodes": nodes,
        "edges": edges,
    })
