"""
Routes — Tests d'hypothèses, stationnarité et séries temporelles.
"""

from flask import request, jsonify
from app.api.v1 import api_v1_bp
from app.services.dataset_service import dataset_manager
from app.schemas import HypothesisTestSchema, TimeSeriesSchema, MultivariateTimeSeriesSchema, validate_payload


@api_v1_bp.route("/datasets/<dataset_id>/analysis/stationarity", methods=["POST"])
def run_stationarity(dataset_id):
    """Teste la stationnarité d'une colonne numérique (ADF + KPSS).
    Body JSON : { "col": "nom_colonne" }
    """
    body = request.get_json(silent=True) or {}
    col = body.get("col")
    if not col:
        return jsonify({"error": "Paramètre 'col' requis"}), 400

    df = dataset_manager.get_df(dataset_id)
    if df is None:
        return jsonify({"error": "Dataset introuvable"}), 404
    if col not in df.columns:
        return jsonify({"error": f"Colonne '{col}' introuvable"}), 400

    series = df[col].dropna()
    if len(series) < 8:
        return jsonify({"error": "Série trop courte pour les tests de stationnarité (min 8 obs)"}), 400

    try:
        from app.core.timeseries import test_stationarity
        result = test_stationarity(series)
        result["column"] = col
        result["n_obs"] = int(len(series))
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_v1_bp.route("/datasets/<dataset_id>/analysis/test", methods=["POST"])
def run_test(dataset_id):
    """Exécute un test d'hypothèse.

    Body JSON :
    {
        "test_type": "compare_means" | "correlation" | "independence",
        "group_col": "...",
        "value_col": "...",
        "col1": "...",
        "col2": "..."
    }
    """
    data, err = validate_payload(HypothesisTestSchema, request.get_json())
    if err:
        return jsonify(err), 400

    try:
        result = dataset_manager.run_test(dataset_id, data)
        cache = dataset_manager._get_cache(dataset_id)
        cache.setdefault("test_results", []).append(result)
        return jsonify(result)
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_v1_bp.route("/datasets/<dataset_id>/timeseries", methods=["POST"])
def run_timeseries(dataset_id):
    """Lance une analyse de série temporelle.

    Body JSON :
    {
        "date_col": "date",
        "value_col": "ventes",
        "models": ["arima", "sarima", "exponential_smoothing"],
        "forecast_steps": 10
    }
    """
    data, err = validate_payload(TimeSeriesSchema, request.get_json())
    if err:
        return jsonify(err), 400

    try:
        results = dataset_manager.run_timeseries(
            dataset_id=dataset_id,
            date_col=data["date_col"],
            value_col=data["value_col"],
            models=data.get("models"),
            forecast_steps=data["forecast_steps"],
        )
        return jsonify(results)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_v1_bp.route("/datasets/<dataset_id>/timeseries/multivariate", methods=["POST"])
def run_multivariate_timeseries(dataset_id):
    """Lance une analyse de séries temporelles multivariées (VAR / VECM).

    Body JSON :
    {
        "date_col": "date",
        "value_cols": ["ventes", "prix", "stock"],
        "models": ["var", "vecm"],
        "forecast_steps": 10,
        "granger_max_lag": 4,
        "forced_model": "var",
        "var_data_mode": "auto",
        "var_trend": "ct",
        "granger_data_mode": "auto"
    }
    """
    data, err = validate_payload(MultivariateTimeSeriesSchema, request.get_json())
    if err:
        return jsonify(err), 400

    try:
        results = dataset_manager.run_multivariate_timeseries(
            dataset_id=dataset_id,
            date_col=data["date_col"],
            value_cols=data["value_cols"],
            models=data.get("models"),
            forecast_steps=data["forecast_steps"],
            granger_max_lag=data["granger_max_lag"],
            forced_model=data.get("forced_model"),
            var_data_mode=data["var_data_mode"],
            var_trend=data["var_trend"],
            granger_data_mode=data["granger_data_mode"],
            forecast_dates=data.get("forecast_dates"),
            target_col=data.get("target_col"),
            bvar_lambda1=data.get("bvar_lambda1", 0.2),
            bvar_lambda2=data.get("bvar_lambda2", 0.5),
            max_lag=data.get("max_lag", 12),
            ic_criterion=data.get("ic_criterion", "aic"),
            irf_periods=data.get("irf_periods", 20),
            fevd_periods=data.get("fevd_periods", 20),
            confidence_level=data.get("confidence_level", 0.95),
            bootstrap_irf=data.get("bootstrap_irf", False),
            irf_orth=data.get("irf_orth", True),
            vecm_det_order=data.get("vecm_det_order", 0),
            max_diff_order=data.get("max_diff_order", 2),
        )
        return jsonify(results)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500
