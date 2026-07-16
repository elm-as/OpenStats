"""
Routes — Statistiques descriptives, corrélations et analyse complète.
"""

from flask import request, jsonify
from app.api.v1 import api_v1_bp
from app.services.dataset_service import dataset_manager


@api_v1_bp.route("/datasets/<dataset_id>/analysis", methods=["POST"])
def run_analysis(dataset_id):
    """Lance l'analyse statistique complète (descriptive + corrélations + VIF).
    Body JSON optionnel : {"bootstrap_ci": true, "n_bootstrap": 1000}
    """
    data = request.get_json(silent=True) or {}
    bootstrap_ci = data.get("bootstrap_ci", False)
    n_bootstrap = data.get("n_bootstrap", 1000)

    try:
        results = dataset_manager.analyze(
            dataset_id,
            bootstrap_ci=bootstrap_ci,
            n_bootstrap=n_bootstrap,
        )
        return jsonify(results)
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_v1_bp.route("/datasets/<dataset_id>/analysis/descriptive", methods=["GET"])
def get_descriptive_stats(dataset_id):
    """Retourne les statistiques descriptives."""
    ds = dataset_manager.get(dataset_id)
    if ds is None:
        return jsonify({"error": "Dataset introuvable"}), 404

    results = ds.get("analysis_results", {}).get("descriptive_stats")
    if not results:
        from app.core.analysis import compute_descriptive_stats
        df = dataset_manager.get_df(dataset_id)
        results = compute_descriptive_stats(df)

    return jsonify(results)


@api_v1_bp.route("/datasets/<dataset_id>/analysis/correlations", methods=["GET"])
def get_correlations(dataset_id):
    """Retourne les matrices de corrélation."""
    method = request.args.get("method", "pearson")
    ds = dataset_manager.get(dataset_id)
    if ds is None:
        return jsonify({"error": "Dataset introuvable"}), 404

    from app.core.analysis import compute_correlation_matrix
    df = dataset_manager.get_df(dataset_id)
    result = compute_correlation_matrix(df, method=method)
    return jsonify(result)
