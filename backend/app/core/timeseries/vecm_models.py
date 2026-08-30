import numpy as np
import pandas as pd
from typing import Any
from statsmodels.tsa.vector_ar.vecm import VECM

from app.core.timeseries.residual_diagnostics import (
    _sf, _compute_residual_diagnostics
)
from app.core.timeseries.series_preparation import _build_forecast_dates

from app.core.timeseries.tests_multivariate import test_johansen_cointegration
from app.core.timeseries.var_models import _select_var_order


def fit_vecm(
    data: pd.DataFrame,
    coint_rank: int | None = None,
    k_ar_diff: int | None = None,
    forecast_steps: int = 10,
    forecast_dates: list[str] | None = None,
    compute_irf: bool = True,
    irf_periods: int = 20,
    data_regime: str = "levels",
) -> dict[str, Any]:
    """Ajuste un modèle VECM et produit des prévisions multivariées."""
    try:
        cols = data.columns.tolist()

        if coint_rank is None:
            joh = test_johansen_cointegration(data)
            if "error" in joh:
                coint_rank = 1
            else:
                coint_rank = max(joh.get("cointegration_rank", 1), 1)

        if k_ar_diff is None:
            var_order = _select_var_order(data)
            k_ar_diff = max(var_order - 1, 1)

        model = VECM(data, k_ar_diff=k_ar_diff, coint_rank=coint_rank)
        fit = model.fit()

        idx_hist = [d.isoformat() for d in data.index]

        resid = fit.resid
        fitted_start = len(data) - len(resid)
        fitted_dates = data.index[fitted_start:]
        fitted_dict = {}
        for i, c in enumerate(cols):
            observed_slice = data[c].iloc[fitted_start:].values
            resid_col = resid[:, i]
            fitted_vals = observed_slice - resid_col
            fitted_dict[c] = [_sf(v) for v in fitted_vals]

        fc = fit.predict(steps=forecast_steps)
        fc_df = pd.DataFrame(fc, columns=cols)

        fc_dates = _build_forecast_dates(data.index, forecast_steps, forecast_dates)

        forecast_dict = {}
        for c in cols:
            forecast_dict[c] = [_sf(v) for v in fc_df[c]]

        coint_vectors = {}
        try:
            beta = fit.beta
            for i in range(coint_rank):
                coint_vectors[f"vector_{i+1}"] = {c: _sf(beta[j, i]) for j, c in enumerate(cols)}
        except Exception:
            pass

        result_dict: dict[str, Any] = {
            "model": "VECM",
            "data_regime": data_regime,
            "k_ar_diff": k_ar_diff,
            "coint_rank": coint_rank,
            "variables": cols,
            "n_observations": len(data),
            "cointegration_vectors": coint_vectors,
            "history": {
                "dates": idx_hist,
                "series": {c: [_sf(v) for v in data[c]] for c in cols},
                "fitted": fitted_dict,
                "fitted_dates": [d.isoformat() for d in fitted_dates],
            },
            "forecast": {
                "dates": [d.isoformat() for d in fc_dates],
                "series": forecast_dict,
            },
        }

        try:
            n = len(resid)
            k = resid.shape[1]
            sse = np.sum(resid ** 2)
            n_params = k_ar_diff * k * k + coint_rank * k
            result_dict["aic"] = _sf(n * np.log(sse / n) + 2 * n_params)
            result_dict["bic"] = _sf(n * np.log(sse / n) + np.log(n) * n_params)
        except Exception:
            result_dict["aic"] = None
            result_dict["bic"] = None

        if compute_irf:
            try:
                irf = fit.irf(irf_periods)
                irf_data = {}
                for i, impulse in enumerate(cols):
                    irf_data[impulse] = {}
                    for j, response in enumerate(cols):
                        irf_data[impulse][response] = [_sf(v) for v in irf.irfs[:, j, i]]

                sigma_u = {}
                try:
                    resid_cov = np.cov(fit.resid, rowvar=False)
                    for i, c in enumerate(cols):
                        sigma_u[c] = _sf(float(np.sqrt(resid_cov[i, i])))
                except Exception:
                    pass
                if not sigma_u:
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
            result_dict["diagnostics"] = _compute_residual_diagnostics(
                resid, columns=cols
            )
        except Exception as e:
            result_dict["diagnostics"] = {"error": str(e)}

        return result_dict

    except Exception as e:
        return {"error": str(e), "model": "VECM"}
