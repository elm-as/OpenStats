import warnings
import numpy as np
import pandas as pd
from typing import Any

from statsmodels.tsa.seasonal import seasonal_decompose
from statsmodels.tsa.holtwinters import ExponentialSmoothing
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.statespace.sarimax import SARIMAX

from app.core.timeseries.helpers import (
    _sf, _sanitize, _detect_seasonal_period,
    _prepare_series
)
from app.core.timeseries.stationarity import test_stationarity


def decompose_series(
    series: pd.Series,
    model: str = "additive",
    period: int | None = None,
) -> dict[str, Any]:
    """Décomposition saisonnière (additive ou multiplicative)."""
    if period is None:
        period = _detect_seasonal_period(series)

    if period <= 1 or len(series) < 2 * period:
        return {"error": "Série trop courte ou fréquence insuffisante pour la décomposition"}

    if model == "multiplicative" and (series <= 0).any():
        model = "additive"

    try:
        decomp = seasonal_decompose(series, model=model, period=period)
        idx = [d.isoformat() for d in series.index]
        return {
            "model": model,
            "period": period,
            "dates": idx,
            "observed": [_sf(v) for v in decomp.observed],
            "trend": [_sf(v) for v in decomp.trend],
            "seasonal": [_sf(v) for v in decomp.seasonal],
            "residual": [_sf(v) for v in decomp.resid],
        }
    except Exception as e:
        return {"error": str(e)}


def _auto_arima_order(series: pd.Series, max_p: int = 3, max_d: int = 2, max_q: int = 3) -> tuple[int, int, int]:
    """Sélection automatique de l'ordre ARIMA par AIC (grille limitée)."""
    best_aic = np.inf
    best_order = (1, 1, 1)

    for d in range(max_d + 1):
        for p in range(max_p + 1):
            for q in range(max_q + 1):
                if p == 0 and q == 0:
                    continue
                try:
                    with warnings.catch_warnings():
                        warnings.simplefilter("ignore")
                        model = ARIMA(series, order=(p, d, q))
                        fit = model.fit()
                        if fit.aic < best_aic:
                            best_aic = fit.aic
                            best_order = (p, d, q)
                except Exception:
                    continue

    return best_order


def fit_arima(
    series: pd.Series,
    order: tuple[int, int, int] | None = None,
    forecast_steps: int = 10,
) -> dict[str, Any]:
    """Ajuste un modèle ARIMA et produit des prévisions."""
    if order is None:
        order = _auto_arima_order(series)

    try:
        model = ARIMA(series, order=order)
        fit = model.fit()

        forecast_obj = fit.get_forecast(steps=forecast_steps)
        fc_mean = forecast_obj.predicted_mean
        fc_ci = forecast_obj.conf_int(alpha=0.05)

        idx_hist = [d.isoformat() for d in series.index]
        idx_fc = [d.isoformat() for d in fc_mean.index]

        return {
            "model": "ARIMA",
            "order": list(order),
            "aic": _sf(fit.aic),
            "bic": _sf(fit.bic),
            "history": {
                "dates": idx_hist,
                "values": [_sf(v) for v in series],
                "fitted": [_sf(v) for v in fit.fittedvalues],
            },
            "forecast": {
                "dates": idx_fc,
                "values": [_sf(v) for v in fc_mean],
                "lower_ci": [_sf(v) for v in fc_ci.iloc[:, 0]],
                "upper_ci": [_sf(v) for v in fc_ci.iloc[:, 1]],
            },
            "residuals_mean": _sf(fit.resid.mean()),
            "residuals_std": _sf(fit.resid.std()),
        }
    except Exception as e:
        return {"error": str(e), "model": "ARIMA", "order": list(order) if order else None}


def _auto_sarima_order(
    series: pd.Series,
    seasonal_period: int,
    max_p: int = 2, max_d: int = 1, max_q: int = 2,
    max_P: int = 1, max_D: int = 1, max_Q: int = 1,
) -> tuple[tuple[int, int, int], tuple[int, int, int, int]]:
    """Sélection automatique des ordres SARIMA par AIC (grille réduite)."""
    best_aic = np.inf
    best_order = (1, 1, 0)
    best_seasonal = (1, 0, 0, seasonal_period)

    candidates = [
        ((1, 1, 0), (1, 0, 0, seasonal_period)),
        ((0, 1, 1), (0, 1, 1, seasonal_period)),
        ((1, 1, 1), (1, 0, 1, seasonal_period)),
        ((1, 1, 1), (1, 1, 1, seasonal_period)),
        ((2, 1, 0), (1, 0, 0, seasonal_period)),
        ((0, 1, 2), (0, 1, 1, seasonal_period)),
        ((1, 0, 1), (1, 0, 1, seasonal_period)),
        ((2, 1, 1), (1, 0, 0, seasonal_period)),
        ((1, 1, 0), (0, 1, 1, seasonal_period)),
        ((0, 1, 1), (1, 0, 0, seasonal_period)),
        ((1, 0, 0), (1, 1, 0, seasonal_period)),
        ((2, 1, 1), (0, 1, 1, seasonal_period)),
    ]

    for order, seasonal in candidates:
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                model = SARIMAX(
                    series,
                    order=order,
                    seasonal_order=seasonal,
                    enforce_stationarity=False,
                    enforce_invertibility=False,
                )
                fit = model.fit(disp=False, maxiter=50)
                if fit.aic < best_aic:
                    best_aic = fit.aic
                    best_order = order
                    best_seasonal = seasonal
        except Exception:
            continue

    return best_order, best_seasonal


def fit_sarima(
    series: pd.Series,
    order: tuple[int, int, int] | None = None,
    seasonal_order: tuple[int, int, int, int] | None = None,
    forecast_steps: int = 10,
) -> dict[str, Any]:
    """Ajuste un modèle SARIMA et produit des prévisions."""
    period = _detect_seasonal_period(series)

    if period <= 1:
        return {"error": "Pas de saisonnalité détectée. Utilisez ARIMA.", "model": "SARIMA"}

    if order is None or seasonal_order is None:
        order, seasonal_order = _auto_sarima_order(series, period)

    try:
        model = SARIMAX(
            series,
            order=order,
            seasonal_order=seasonal_order,
            enforce_stationarity=False,
            enforce_invertibility=False,
        )
        fit = model.fit(disp=False)

        forecast_obj = fit.get_forecast(steps=forecast_steps)
        fc_mean = forecast_obj.predicted_mean
        fc_ci = forecast_obj.conf_int(alpha=0.05)

        idx_hist = [d.isoformat() for d in series.index]
        idx_fc = [d.isoformat() for d in fc_mean.index]

        return {
            "model": "SARIMA",
            "order": list(order),
            "seasonal_order": list(seasonal_order),
            "aic": _sf(fit.aic),
            "bic": _sf(fit.bic),
            "history": {
                "dates": idx_hist,
                "values": [_sf(v) for v in series],
                "fitted": [_sf(v) for v in fit.fittedvalues],
            },
            "forecast": {
                "dates": idx_fc,
                "values": [_sf(v) for v in fc_mean],
                "lower_ci": [_sf(v) for v in fc_ci.iloc[:, 0]],
                "upper_ci": [_sf(v) for v in fc_ci.iloc[:, 1]],
            },
            "residuals_mean": _sf(fit.resid.mean()),
            "residuals_std": _sf(fit.resid.std()),
        }
    except Exception as e:
        return {
            "error": str(e),
            "model": "SARIMA",
            "order": list(order) if order else None,
            "seasonal_order": list(seasonal_order) if seasonal_order else None,
        }


def fit_exponential_smoothing(
    series: pd.Series,
    seasonal: str | None = None,
    forecast_steps: int = 10,
) -> dict[str, Any]:
    """Holt-Winters Exponential Smoothing."""
    period = _detect_seasonal_period(series)

    if seasonal is None:
        if period > 1 and len(series) >= 2 * period:
            seasonal = "add"
            if (series > 0).all():
                seasonal = "mul"
        else:
            seasonal = None

    try:
        if seasonal and period > 1 and len(series) >= 2 * period:
            model = ExponentialSmoothing(
                series,
                trend="add",
                seasonal=seasonal,
                seasonal_periods=period,
            )
        else:
            model = ExponentialSmoothing(series, trend="add", seasonal=None)

        fit = model.fit(optimized=True)
        fc = fit.forecast(forecast_steps)
        idx_hist = [d.isoformat() for d in series.index]
        idx_fc = [d.isoformat() for d in fc.index]

        return {
            "model": "Holt-Winters",
            "seasonal": seasonal,
            "seasonal_period": period if seasonal else None,
            "aic": _sf(fit.aic),
            "bic": _sf(fit.bic),
            "sse": _sf(fit.sse),
            "history": {
                "dates": idx_hist,
                "values": [_sf(v) for v in series],
                "fitted": [_sf(v) for v in fit.fittedvalues],
            },
            "forecast": {
                "dates": idx_fc,
                "values": [_sf(v) for v in fc],
                "lower_ci": None,
                "upper_ci": None,
            },
            "smoothing_params": {
                "alpha": _sf(fit.params.get("smoothing_level")),
                "beta": _sf(fit.params.get("smoothing_trend")),
                "gamma": _sf(fit.params.get("smoothing_seasonal")),
            },
        }
    except Exception as e:
        return {"error": str(e), "model": "Holt-Winters"}


def run_timeseries_analysis(
    df: pd.DataFrame,
    date_col: str,
    value_col: str,
    models: list[str] | None = None,
    forecast_steps: int = 10,
) -> dict[str, Any]:
    """Analyse complète d'une série temporelle."""
    series = _prepare_series(df, date_col, value_col)

    if len(series) < 10:
        return {"error": "Série trop courte (minimum 10 observations requises)"}

    period = _detect_seasonal_period(series)

    results: dict[str, Any] = {
        "date_col": date_col,
        "value_col": value_col,
        "n_observations": len(series),
        "date_range": {
            "start": series.index[0].isoformat(),
            "end": series.index[-1].isoformat(),
        },
        "frequency": series.index.freq.freqstr if series.index.freq else "unknown",
        "seasonal_period": period,
    }

    results["stationarity"] = test_stationarity(series)

    if period > 1 and len(series) >= 2 * period:
        results["decomposition"] = decompose_series(series, period=period)
    else:
        results["decomposition"] = None

    if models is None:
        models = ["arima", "exponential_smoothing", "prophet"]
        if period > 1 and len(series) >= 2 * period:
            models.append("sarima")

    models = [
        "exponential_smoothing" if m.lower() in ("holtwinters", "holt_winters", "holt-winters", "hw")
        else m.lower()
        for m in models
    ]

    model_results = {}

    if "arima" in models:
        model_results["arima"] = fit_arima(series, forecast_steps=forecast_steps)

    if "sarima" in models:
        model_results["sarima"] = fit_sarima(series, forecast_steps=forecast_steps)

    if "exponential_smoothing" in models:
        model_results["exponential_smoothing"] = fit_exponential_smoothing(
            series, forecast_steps=forecast_steps
        )

    if "prophet" in models:
        model_results["prophet"] = fit_prophet(series, forecast_steps=forecast_steps)

    results["models"] = model_results

    ranking = []
    for key, res in model_results.items():
        if "error" not in res and res.get("aic") is not None:
            ranking.append({
                "model": res.get("model", key),
                "key": key,
                "aic": res["aic"],
                "bic": res.get("bic"),
            })
        elif "error" not in res and key == "prophet":
            # Prophet doesn't return AIC in the same way, we can put it at the end or calculate pseudo-AIC
            ranking.append({
                "model": res.get("model", key),
                "key": key,
                "aic": float("inf"), # Ou un score MSE
                "bic": float("inf"),
            })

    ranking.sort(key=lambda x: x["aic"])
    results["ranking"] = ranking
    results["best_model"] = ranking[0]["key"] if ranking else None

    return _sanitize(results)

def fit_prophet(
    series: pd.Series,
    forecast_steps: int = 10,
) -> dict[str, Any]:
    """Ajuste un modèle Prophet et produit des prévisions."""
    try:
        from prophet import Prophet
    except ImportError:
        return {"error": "Prophet n'est pas installé."}

    try:
        df = pd.DataFrame({"ds": series.index, "y": series.values})
        model = Prophet()
        model.fit(df)

        freq = pd.infer_freq(series.index)
        if not freq:
            freq = 'D'
            
        future = model.make_future_dataframe(periods=forecast_steps, freq=freq)
        forecast = model.predict(future)

        future_forecast = forecast.tail(forecast_steps)
        
        idx_hist = [d.isoformat() for d in series.index]
        idx_fc = [d.isoformat() for d in future_forecast['ds']]

        return {
            "model": "Prophet",
            "history": {
                "dates": idx_hist,
                "values": [_sf(v) for v in series],
                "fitted": [_sf(v) for v in forecast['yhat'][:-forecast_steps]],
            },
            "forecast": {
                "dates": idx_fc,
                "mean": [_sf(v) for v in future_forecast['yhat']],
                "lower": [_sf(v) for v in future_forecast['yhat_lower']],
                "upper": [_sf(v) for v in future_forecast['yhat_upper']],
            },
        }
    except Exception as e:
        return {"error": f"Erreur Prophet : {str(e)}"}
