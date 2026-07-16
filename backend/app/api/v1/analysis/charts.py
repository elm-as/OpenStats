"""
Route — Données formatées pour la construction de graphiques.
"""

from flask import request, jsonify
from app.api.v1 import api_v1_bp
from app.services.dataset_service import dataset_manager
from app.api.v1.analysis._helpers import build_chart_data


@api_v1_bp.route("/datasets/<dataset_id>/chart-data", methods=["POST"])
def get_chart_data(dataset_id):
    """Retourne les données formatées pour un graphique.

    Body JSON :
    {
        "chart_type": "line" | "bar" | "pie" | "scatter" | "area" | "stacked_bar",
        "x_col": "...",
        "y_cols": ["col1"],
        "group_col": "...",
        "aggregation": "mean",
        "time_granularity": "auto",
        "top_n": 20
    }
    """
    data = request.get_json()
    if not data or "chart_type" not in data:
        return jsonify({"error": "chart_type requis"}), 400

    ds = dataset_manager.get(dataset_id)
    if ds is None:
        return jsonify({"error": "Dataset introuvable"}), 404

    df = dataset_manager.get_df(dataset_id)

    try:
        result = build_chart_data(
            df,
            chart_type=data["chart_type"],
            x_col=data.get("x_col"),
            y_cols=data.get("y_cols", []),
            group_col=data.get("group_col"),
            aggregation=data.get("aggregation", "mean"),
            top_n=data.get("top_n", 20),
            time_granularity=data.get("time_granularity"),
            color_col=data.get("color_col"),
            size_col=data.get("size_col"),
            chart_title=data.get("chart_title"),
            log_y=data.get("log_y", False),
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
