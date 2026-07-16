"""
Routes API pour le pipeline de nettoyage.
"""

from flask import request, jsonify
from app.api.v1 import api_v1_bp
from app.services.dataset_service import dataset_manager
from app.schemas import CleaningPipelineSchema, validate_payload


@api_v1_bp.route("/datasets/<dataset_id>/clean", methods=["POST"])
def clean_dataset(dataset_id):
    """
    Applique le pipeline de nettoyage.
    Body JSON :
    {
        "pipeline": [
            {"step": "deduplication", "config": {}},
            {"step": "missing_values", "config": {"default_strategy": "median"}},
            {"step": "outliers", "config": {"method": "iqr", "treatment": "cap"}},
            {"step": "normalization", "config": {"method": "standard"}},
            {"step": "encoding", "config": {"default_method": "onehot"}}
        ]
    }
    """
    data, err = validate_payload(CleaningPipelineSchema, request.get_json())
    if err:
        return jsonify(err), 400

    try:
        result = dataset_manager.clean(dataset_id, data["pipeline"])
        return jsonify(result)
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_v1_bp.route("/datasets/<dataset_id>/clean/auto", methods=["POST"])
def auto_clean_dataset(dataset_id):
    """Pipeline de nettoyage automatique avec configuration par défaut."""
    ds = dataset_manager.get(dataset_id)
    if ds is None:
        return jsonify({"error": "Dataset introuvable"}), 404

    auto_pipeline = [
        {"step": "deduplication", "config": {}},
        {"step": "missing_values", "config": {"default_strategy": "median"}},
        {"step": "outliers", "config": {"method": "iqr", "treatment": "cap", "threshold": 1.5}},
    ]

    try:
        result = dataset_manager.clean(dataset_id, auto_pipeline)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
