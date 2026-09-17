"""
Nœud de visualisation.
"""

from app.services.dataset_service import dataset_manager
from app.api.v1.analysis.chart_data_builder import build_chart_data
from ._shared import _sanitize, lire_booleen, lire_entier, lire_texte

def execute_visualization(data, dataset_id):
    chart_type = data.get("chartType", "auto") or "auto"
    x_col = data.get("xCol", "")
    y_col = data.get("yCol", "")
    y_cols = data.get("yCols", [])
    group_col = data.get("groupCol", "")
    color_col = data.get("colorCol", "")
    size_col = data.get("sizeCol", "")
    chart_title = data.get("title", "")
    log_scale = lire_booleen(data, "logScale")
    # `topN` arrive en chaine vide quand le champ est laisse tel quel : un
    # int() direct levait une exception avalee par le try plus bas.
    top_n = lire_entier(data, "topN", 20)
    # Ce reglage existe dans l'interface depuis le debut ; il n'etait pas lu,
    # et son absence faisait echouer chaque graphique du canvas.
    aggregation = lire_texte(data, "aggregation", "none")
    cleaned = data.get("_cleaned", True)
    df = dataset_manager.get_df(dataset_id, cleaned=cleaned)
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

