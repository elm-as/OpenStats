"""
Nœuds de séries temporelles (Univariées et Multivariées).
"""

from app.services.dataset_service import dataset_manager
from ._shared import _sanitize

def execute_timeseries(data, dataset_id):
    date_col = data.get("dateCol", "")
    value_col = data.get("valueCol", "")
    if not date_col or not value_col:
        return {"status": "error", "error": "Colonnes date et valeur requises"}
    forecast_steps = int(data.get("forecastSteps", 10))
    model_val = data.get("model", "auto")
    models = None if model_val == "auto" else [model_val]
    result = dataset_manager.run_timeseries(
        dataset_id=dataset_id,
        date_col=date_col,
        value_col=value_col,
        models=models,
        forecast_steps=forecast_steps,
    )
    return {
        "status": "success",
        "message": f"Série temporelle analysée ({value_col})",
        "result": _sanitize(result),
    }


def execute_multivariate_timeseries(data, dataset_id):
    date_col = data.get("dateCol", "")
    value_cols_str = data.get("valueCols", "")
    if not date_col or not value_cols_str:
        return {"status": "error", "error": "Colonne date et variables requises"}
    value_cols = [c.strip() for c in value_cols_str.split(",") if c.strip()]
    forced_model_val = data.get("forcedModel", "auto")
    forced_model = None if forced_model_val == "auto" else forced_model_val
    granger_max_lag = int(data.get("grangerMaxLag", 4))
    target_col = data.get("targetCol", "") or None
    result = dataset_manager.run_multivariate_timeseries(
        dataset_id=dataset_id,
        date_col=date_col,
        value_cols=value_cols,
        forecast_steps=int(data.get("forecastSteps", 10)),
        forced_model=forced_model,
        granger_max_lag=granger_max_lag,
        target_col=target_col,
    )
    return {
        "status": "success",
        "message": f"Séries temporelles multivariées analysées ({len(value_cols)} variables)",
        "result": _sanitize(result),
    }
