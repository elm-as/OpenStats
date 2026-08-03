"""
Nœud de visualisation.
"""

from app.services.dataset_service import dataset_manager
from app.api.v1.analysis._helpers import build_chart_data
from ._shared import _sanitize

def execute_visualization(data, dataset_id):
    chart_type = data.get("chartType", "auto")
    x_col = data.get("xCol", "")
    y_col = data.get("yCol", "")
    y_cols = data.get("yCols", [])
    group_col = data.get("groupCol", "")
    color_col = data.get("colorCol", "")
    size_col = data.get("sizeCol", "")
    chart_title = data.get("title", "")
    log_scale = data.get("logScale", False)
    top_n = int(data.get("topN", 20))
    aggregation = data.get("aggregation", "mean")

    df = dataset_manager.get_df(dataset_id)
    if chart_type == "auto":
        numeric_cols = df.select_dtypes("number").columns.tolist()
        cat_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()
        if len(numeric_cols) >= 2:
            chart_type = "scatter"
            x_col = x_col or numeric_cols[0]
            y_col = y_col or numeric_cols[1]
        elif cat_cols and numeric_cols:
            chart_type = "bar"
            x_col = x_col or cat_cols[0]
            y_col = y_col or numeric_cols[0]
        elif cat_cols:
            chart_type = "pie"
            x_col = x_col or cat_cols[0]

    if not y_cols and y_col:
        y_cols = [y_col]

    try:
        chart_data = build_chart_data(
            df=df,
            chart_type=chart_type,
            x_col=x_col,
            y_cols=y_cols,
            group_col=group_col,
            aggregation=aggregation,
            top_n=top_n if top_n > 0 else 500,
            color_col=color_col,
            size_col=size_col,
            chart_title=chart_title,
            log_y=log_scale
        )
        return {
            "status": "success",
            "message": f"Graphique '{chart_type}' généré avec succès",
            "result": _sanitize(chart_data),
        }
    except Exception as e:
        return {
            "status": "error",
            "error": f"Erreur lors de la génération du graphique: {str(e)}",
            "message": f"Erreur lors de la génération du graphique: {str(e)}",
        }

