"""
Nœuds de séries temporelles (Univariées et Multivariées).
"""

from app.services.dataset_service import dataset_manager
from ._shared import _sanitize

def execute_timeseries(data, dataset_id):
    date_col = data.get("dateCol", "")
    value_col = data.get("valueCol", "")
    if not date_col or not value_col:
        return {"status": "error", "error": "Colonnes date et valeur requises pour l'analyse de séries temporelles"}

    df = dataset_manager.get_df(dataset_id)
    if df is None or df.empty:
        return {"status": "error", "error": "DataFrame vide ou introuvable"}
    missing = [c for c in [date_col, value_col] if c not in df.columns]
    if missing:
        return {"status": "error", "error": f"Colonnes introuvables: {', '.join(missing)}"}

    forecast_steps = int(data.get("forecastSteps", 10))
    model_val = data.get("model", "auto")
    models = None if model_val == "auto" else [model_val]
    try:
        result = dataset_manager.run_timeseries(
            dataset_id=dataset_id,
            date_col=date_col,
            value_col=value_col,
            models=models,
            forecast_steps=forecast_steps,
        )
    except Exception as e:
        return {"status": "error", "error": f"Erreur série temporelle: {str(e)}"}
    return {
        "status": "success",
        "message": f"Série temporelle analysée ({value_col})",
        "result": _sanitize(result),
    }


def execute_multivariate_timeseries(data, dataset_id):
    date_col = data.get("dateCol", "")
    value_cols_str = data.get("valueCols", "")
    if not date_col or not value_cols_str:
        return {"status": "error", "error": "Colonne date et variables requises pour les séries multivariées"}

    df = dataset_manager.get_df(dataset_id)
    if df is None or df.empty:
        return {"status": "error", "error": "DataFrame vide ou introuvable"}

    value_cols = [c.strip() for c in value_cols_str.split(",") if c.strip()]
    all_needed = [date_col] + value_cols
    missing = [c for c in all_needed if c not in df.columns]
    if missing:
        return {"status": "error", "error": f"Colonnes introuvables: {', '.join(missing)}"}
    if len(value_cols) < 2:
        return {"status": "error", "error": f"Au moins 2 variables requises pour l'analyse multivariée (trouvé: {len(value_cols)})"}

    forced_model_val = data.get("forcedModel", "auto")
    forced_model = None if forced_model_val == "auto" else forced_model_val
    granger_max_lag = int(data.get("grangerMaxLag", 4))
    target_col = data.get("targetCol", "") or None
    try:
        result = dataset_manager.run_multivariate_timeseries(
            dataset_id=dataset_id,
            date_col=date_col,
            value_cols=value_cols,
            forecast_steps=int(data.get("forecastSteps", 10)),
            forced_model=forced_model,
            granger_max_lag=granger_max_lag,
            target_col=target_col,
        )
    except Exception as e:
        return {"status": "error", "error": f"Erreur séries multivariées: {str(e)}"}
    return {
        "status": "success",
        "message": f"Séries temporelles multivariées analysées ({len(value_cols)} variables)",
        "result": _sanitize(result),
    }
