import warnings
import numpy as np
import pandas as pd
from typing import Any

from statsmodels.tsa.statespace.sarimax import SARIMAX

from app.core.timeseries.residual_diagnostics import _sf
from app.core.timeseries.series_preparation import _detect_seasonal_period


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
