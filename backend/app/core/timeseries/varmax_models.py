import warnings
import numpy as np
import pandas as pd
from typing import Any
from statsmodels.tsa.statespace.varmax import VARMAX as _VARMAX

from app.core.timeseries.residual_diagnostics import (
    _sf, _compute_residual_diagnostics
)
from app.core.timeseries.series_preparation import _build_forecast_dates

from app.core.timeseries.var_models import _normalize_var_trend, _select_var_order


def fit_varmax(
    data: pd.DataFrame,
    max_lags: int = 10,
    forecast_steps: int = 10,
    forecast_dates: list[str] | None = None,
    compute_irf: bool = True,
    irf_periods: int = 20,
    data_regime: str = "levels",
    var_trend: str = "c",
) -> dict[str, Any]:
    """VARMAX en représentation état-espace."""
    try:
        cols = data.columns.tolist()
        k = len(cols)

        if k > 6:
            return {
                "error": "VARMAX est lent pour > 6 variables. Utilisez VAR ou BVAR.",
                "model": "VARMAX",
            }

        lag_order = _select_var_order(data, max_lags)

        trend_map = {"c": "c", "ct": "ct", "n": "n", "ctt": "ct"}
        ss_trend = trend_map.get(_normalize_var_trend(var_trend), "c")

        model = _VARMAX(data, order=(lag_order, 0), trend=ss_trend)
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            fit = model.fit(disp=False, maxiter=200)

        idx_hist = [d.isoformat() for d in data.index]

        fitted_vals = fit.fittedvalues
        fitted_dict = {}
        for c in cols:
            if c in fitted_vals.columns:
                fitted_dict[c] = [_sf(v) for v in fitted_vals[c]]
            else:
                fitted_dict[c] = [_sf(v) for v in fitted_vals.iloc[:, cols.index(c)]]

        fc = fit.forecast(steps=forecast_steps)
        fc_dates = _build_forecast_dates(data.index, forecast_steps, forecast_dates)
        forecast_dict = {}
        for i_c, c in enumerate(cols):
            if c in fc.columns:
                forecast_dict[c] = [_sf(v) for v in fc[c]]
            else:
                forecast_dict[c] = [_sf(v) for v in fc.iloc[:, i_c]]

        result_dict: dict[str, Any] = {
            "model": "VARMAX",
            "data_regime": data_regime,
            "var_trend": _normalize_var_trend(var_trend),
            "lag_order": lag_order,
            "aic": _sf(fit.aic),
            "bic": _sf(fit.bic),
            "hqic": _sf(fit.hqic) if hasattr(fit, "hqic") else None,
            "variables": cols,
            "n_observations": len(data),
            "history": {
                "dates": idx_hist,
                "series": {c: [_sf(v) for v in data[c]] for c in cols},
                "fitted": fitted_dict,
                "fitted_dates": [d.isoformat() for d in fitted_vals.index],
            },
            "forecast": {
                "dates": [d.isoformat() for d in fc_dates],
                "series": forecast_dict,
            },
        }

        if compute_irf:
            try:
                irf = fit.impulse_responses(irf_periods, orthogonalized=True)
                irf_data = {}
                for i_imp, impulse in enumerate(cols):
                    irf_data[impulse] = {}
                    for j_resp, response in enumerate(cols):
                        try:
                            if irf.ndim == 3:
                                vals = [_sf(irf[s, j_resp, i_imp]) for s in range(irf_periods + 1)]
                            else:
                                col_idx = i_imp * k + j_resp
                                vals = [_sf(irf.iloc[s, col_idx]) for s in range(min(irf_periods + 1, len(irf)))]
                        except (IndexError, KeyError):
                            vals = []
                        irf_data[impulse][response] = vals

                sigma_u = {}
                try:
                    resid = fit.resid
                    for j, c in enumerate(cols):
                        if c in resid.columns:
                            sigma_u[c] = _sf(float(resid[c].std()))
                        else:
                            sigma_u[c] = _sf(float(resid.iloc[:, j].std()))
                except Exception:
                    for c in cols:
                        sigma_u[c] = _sf(float(data[c].std()))

                desc_stats = {}
                for c in cols:
                    s = data[c]
                    desc_stats[c] = {
                        "mean": _sf(float(s.mean())),
                        "std": _sf(float(s.std())),
                        "min": _sf(float(s.min())),
                        "max": _sf(float(s.max())),
                    }

                result_dict["irf"] = {
                    "periods": irf_periods,
                    "data": irf_data,
                    "variables": cols,
                    "sigma_u": sigma_u,
                    "descriptive_stats": desc_stats,
                }
            except Exception as e:
                result_dict["irf"] = {"error": str(e)}

        try:
            varmax_resid = fit.resid
            result_dict["diagnostics"] = _compute_residual_diagnostics(
                varmax_resid, columns=cols
            )
        except Exception as e:
            result_dict["diagnostics"] = {"error": str(e)}

        return result_dict

    except Exception as e:
        return {"error": str(e), "model": "VARMAX"}
