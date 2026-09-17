import warnings
import numpy as np
import pandas as pd
from typing import Any

from statsmodels.tsa.seasonal import seasonal_decompose
from statsmodels.tsa.holtwinters import ExponentialSmoothing
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.statespace.sarimax import SARIMAX

from app.core.timeseries.residual_diagnostics import _sf, _sanitize
from app.core.timeseries.series_preparation import _detect_seasonal_period, _prepare_series

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


from app.core.timeseries.arima_models import _auto_arima_order, fit_arima  # noqa: E402

from app.core.timeseries.sarima_models import _auto_sarima_order, fit_sarima



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


def _ordre_effectif(
    series: pd.Series,
    ar_order: int | None,
    diff_order: int | None,
    ma_order: int | None,
) -> tuple[int, int, int] | None:
    """Ordre ARIMA a utiliser : chaque composante fournie prime sur l'automatique.

    Renseigner seulement la differenciation laisse donc l'AR et le MA
    selectionnes par AIC, au lieu d'imposer un ordre complet arbitraire.
    """
    fournis = (ar_order, diff_order, ma_order)
    if all(v is None for v in fournis):
        return None
    auto = _auto_arima_order(series)
    return tuple(int(f) if f is not None else a for a, f in zip(auto, fournis))


def _valider_previsions(series, models, period, ordre_impose,
                        horizon=None, n_origines=None):
    """Rejoue chaque modele en conditions reelles, contre une reference naive."""
    from app.core.timeseries.backtest import valider_par_origine_glissante

    def _valeurs(resultat):
        valeurs = ((resultat or {}).get("forecast") or {}).get("values")
        return None if not valeurs else valeurs

    # L'ordre est choisi une seule fois, sur la premiere moitie de la serie :
    # le relancer a chaque origine multiplierait le cout par le nombre
    # d'origines, et selectionner l'ordre sur la serie entiere ferait entrer
    # l'avenir dans l'ajustement.
    ordre = ordre_impose or _auto_arima_order(series.iloc[:max(30, len(series) // 2)])

    ajusteurs = {}
    if "arima" in models:
        ajusteurs["arima"] = lambda h, n: _valeurs(
            fit_arima(h, order=ordre, forecast_steps=n))
    if "sarima" in models:
        ajusteurs["sarima"] = lambda h, n: _valeurs(
            fit_sarima(h, order=ordre, forecast_steps=n, period=period))
    if "exponential_smoothing" in models:
        ajusteurs["exponential_smoothing"] = lambda h, n: _valeurs(
            fit_exponential_smoothing(h, forecast_steps=n))

    if not ajusteurs:
        return {"status": "insuffisant", "raison": "Aucun modèle validable."}

    return valider_par_origine_glissante(
        series, ajusteurs, periode=max(1, period),
        horizon=horizon or max(3, period),
        n_origines=n_origines or 4,
    )


def run_timeseries_analysis(
    df: pd.DataFrame,
    date_col: str,
    value_col: str,
    models: list[str] | None = None,
    forecast_steps: int = 10,
    ar_order: int | None = None,
    diff_order: int | None = None,
    ma_order: int | None = None,
    seasonal_period: int | None = None,
    backtest: bool = True,
    backtest_horizon: int | None = None,
    backtest_origins: int | None = None,
) -> dict[str, Any]:
    """Analyse complète d'une série temporelle."""
    series = _prepare_series(df, date_col, value_col)

    if len(series) < 10:
        return {"error": "Série trop courte (minimum 10 observations requises)"}

    period = int(seasonal_period) if seasonal_period else _detect_seasonal_period(series)
    ordre_impose = _ordre_effectif(series, ar_order, diff_order, ma_order)

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
        "arima_order_forced": list(ordre_impose) if ordre_impose else None,
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
        model_results["arima"] = fit_arima(
            series, order=ordre_impose, forecast_steps=forecast_steps)

    if "sarima" in models:
        model_results["sarima"] = fit_sarima(
            series, order=ordre_impose, forecast_steps=forecast_steps, period=period)

    if "exponential_smoothing" in models:
        model_results["exponential_smoothing"] = fit_exponential_smoothing(
            series, forecast_steps=forecast_steps
        )

    if "prophet" in models:
        model_results["prophet"] = fit_prophet(series, forecast_steps=forecast_steps)

    results["models"] = model_results
    results["backtest"] = (
        _valider_previsions(series, models, period, ordre_impose,
                            backtest_horizon, backtest_origins)
        if backtest else {"status": "desactive",
                          "raison": "Validation hors échantillon désactivée dans le nœud."}
    )

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

    # Le classement suit l'erreur hors echantillon quand elle est disponible :
    # l'AIC mesure l'ajustement au passe, pas la qualite des previsions.
    backtest = results.get("backtest") or {}
    classement_hors_echantillon = backtest.get("classement") or []
    if classement_hors_echantillon:
        rang = {cle: i for i, cle in enumerate(classement_hors_echantillon)}
        ranking.sort(key=lambda x: (rang.get(x["key"], len(rang)), x["aic"]))
        results["selection_criterion"] = "erreur de prévision hors échantillon (origine glissante)"
    else:
        results["selection_criterion"] = "AIC (ajustement dans l'échantillon)"

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
