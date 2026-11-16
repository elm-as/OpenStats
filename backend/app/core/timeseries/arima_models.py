"""Modele ARIMA : selection d'ordre et ajustement.

Module symetrique de `sarima_models` : la partie non saisonniere y vit
separement pour que `univariate` reste un chef d'orchestre et non un fourre-tout
de modeles.
"""

from __future__ import annotations

import warnings
from typing import Any

import numpy as np
import pandas as pd
from statsmodels.tsa.arima.model import ARIMA

from app.core.timeseries.residual_diagnostics import _sf


def _estimate_diff_order(series: pd.Series, max_d: int) -> int:
    """Estime l'ordre d'intégration d via tests de stationnarité avant sélection ARMA."""
    if max_d <= 0 or len(series) < 12:
        return 0
    try:
        from app.core.timeseries.stationarity import test_stationarity
        cur = series.dropna()
        for d in range(max_d + 1):
            if d > 0:
                cur = cur.diff().dropna()
            if len(cur) < 10:
                return d
            verdict = test_stationarity(cur)
            if verdict.get("is_stationary"):
                return d
        return min(max_d, 1)
    except Exception:
        return min(max_d, 1)


def _auto_arima_order(series: pd.Series, max_p: int = 2, max_d: int = 2, max_q: int = 2) -> tuple[int, int, int]:
    """Sélection rapide et rigoureuse de l'ordre ARIMA (d fixé par stationnarité, (p, q) par AIC)."""
    best_aic = np.inf
    d = _estimate_diff_order(series, max_d)
    best_order = (1, d, 1)

    for p in range(max_p + 1):
        for q in range(max_q + 1):
            if p == 0 and q == 0:
                continue
            try:
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore")
                    fit = ARIMA(series, order=(p, d, q)).fit()
                    if np.isfinite(fit.aic) and fit.aic < best_aic:
                        best_aic = float(fit.aic)
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
