"""
Routes — Analyses factorielles (ACP, AFC, ACM).
"""

from flask import request, jsonify
from app.api.v1 import api_v1_bp
from app.services.dataset_service import dataset_manager
from app.schemas import PCASchema, CASchema, MCASchema, validate_payload


@api_v1_bp.route("/datasets/<dataset_id>/factor-analysis/pca", methods=["POST"])
def run_pca_route(dataset_id):
    """Exécute une ACP (Analyse en Composantes Principales).
    Body JSON : {"columns": ["col1", "col2", ...], "n_components": 5}
    """
    ds = dataset_manager.get(dataset_id)
    if ds is None:
        return jsonify({"error": "Dataset introuvable"}), 404

    data, err = validate_payload(PCASchema, request.get_json())
    if err:
        return jsonify(err), 400

    from app.core.factor_analysis import run_pca
    df = dataset_manager.get_df(dataset_id)

    try:
        result = run_pca(df, columns=data.get("columns"), n_components=data.get("n_components"))
        dataset_manager.store_ad_hoc_analysis(
            dataset_id=dataset_id,
            analysis_type="pca",
            parameters={
                "columns": data.get("columns"),
                "n_components": data.get("n_components"),
            },
            results=result,
            cache_key="pca_results",
        )
        return jsonify(result)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_v1_bp.route("/datasets/<dataset_id>/factor-analysis/ca", methods=["POST"])
def run_ca_route(dataset_id):
    """Exécute une AFC (Analyse Factorielle des Correspondances).
    Body JSON : {"row_col": "var1", "col_col": "var2", "n_components": 5}
    """
    ds = dataset_manager.get(dataset_id)
    if ds is None:
        return jsonify({"error": "Dataset introuvable"}), 404

    data, err = validate_payload(CASchema, request.get_json())
    if err:
        return jsonify(err), 400

    from app.core.factor_analysis import run_ca
    df = dataset_manager.get_df(dataset_id, respect_exclusions=False)

    try:
        result = run_ca(df, data["row_col"], data["col_col"], n_components=data.get("n_components"))
        dataset_manager.store_ad_hoc_analysis(
            dataset_id=dataset_id,
            analysis_type="ca",
            parameters={
                "row_col": data["row_col"],
                "col_col": data["col_col"],
                "n_components": data.get("n_components"),
            },
            results=result,
            cache_key="ca_results",
        )
        return jsonify(result)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_v1_bp.route("/datasets/<dataset_id>/factor-analysis/mca", methods=["POST"])
def run_mca_route(dataset_id):
    """Exécute une ACM (Analyse des Correspondances Multiples).
    Body JSON : {"columns": ["cat1", "cat2", ...], "n_components": 5}
    """
    ds = dataset_manager.get(dataset_id)
    if ds is None:
        return jsonify({"error": "Dataset introuvable"}), 404

    data, err = validate_payload(MCASchema, request.get_json())
    if err:
        return jsonify(err), 400

    from app.core.factor_analysis import run_mca
    df = dataset_manager.get_df(dataset_id, respect_exclusions=False)

    try:
        result = run_mca(df, columns=data.get("columns"), n_components=data.get("n_components"))
        dataset_manager.store_ad_hoc_analysis(
            dataset_id=dataset_id,
            analysis_type="mca",
            parameters={
                "columns": data.get("columns"),
                "n_components": data.get("n_components"),
            },
            results=result,
            cache_key="mca_results",
        )
        return jsonify(result)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500
