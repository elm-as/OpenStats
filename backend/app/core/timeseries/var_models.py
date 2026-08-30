import numpy as np
import pandas as pd
from typing import Any
from statsmodels.tsa.vector_ar.var_model import VAR

from app.core.timeseries.residual_diagnostics import (
    _sf, _compute_residual_diagnostics
)
from app.core.timeseries.series_preparation import _build_forecast_dates

from app.core.timeseries.tests_multivariate import test_granger_causality


def _select_var_order(data: pd.DataFrame, max_lags: int = 10) -> int:
    """Sélection automatique de l'ordre VAR par AIC."""
    try:
        max_lags = min(max_lags, len(data) // 3 - 1)
        if max_lags < 1:
            max_lags = 1
        model = VAR(data)
        result = model.select_order(maxlags=max_lags)
        return result.aic or 1
    except Exception:
        return 1


def _normalize_var_trend(var_trend: str | None) -> str:
    """Normalise le paramètre trend pour VAR (statsmodels)."""
    valid = {"c", "ct", "ctt", "n"}
    trend = (var_trend or "c").lower()
    return trend if trend in valid else "c"


def fit_var(
    data: pd.DataFrame,
    max_lags: int = 10,
    forecast_steps: int = 10,
    forecast_dates: list[str] | None = None,
    compute_irf: bool = True,
    irf_periods: int = 20,
    data_regime: str = "levels",
    var_trend: str = "c",
) -> dict[str, Any]:
    """Ajuste un modèle VAR et produit des prévisions multivariées + IRF."""
    try:
        trend = _normalize_var_trend(var_trend)
        lag_order = _select_var_order(data, max_lags)
        model = VAR(data)
        fit = model.fit(lag_order, trend=trend)

        cols = data.columns.tolist()
        idx_hist = [d.isoformat() for d in data.index]

        fitted = fit.fittedvalues
        fitted_dict = {}
        for c in cols:
            fitted_dict[c] = [_sf(v) for v in fitted[c]]

        fc = fit.forecast(data.values[-lag_order:], steps=forecast_steps)
        fc_df = pd.DataFrame(fc, columns=cols)

        fc_dates = _build_forecast_dates(data.index, forecast_steps, forecast_dates)

        forecast_dict = {}
        for c in cols:
            forecast_dict[c] = [_sf(v) for v in fc_df[c]]

        result_dict: dict[str, Any] = {
            "model": "VAR",
            "data_regime": data_regime,
            "var_trend": trend,
            "lag_order": lag_order,
            "aic": _sf(fit.aic),
            "bic": _sf(fit.bic),
            "hqic": _sf(fit.hqic),
            "fpe": _sf(fit.fpe),
            "variables": cols,
            "n_observations": len(data),
            "history": {
                "dates": idx_hist,
                "series": {c: [_sf(v) for v in data[c]] for c in cols},
                "fitted": fitted_dict,
                "fitted_dates": [d.isoformat() for d in fitted.index],
            },
            "forecast": {
                "dates": [d.isoformat() for d in fc_dates],
                "series": forecast_dict,
            },
        }

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
                    resid_cov = fit.sigma_u
                    for i, c in enumerate(cols):
                        sigma_u[c] = _sf(float(np.sqrt(resid_cov[i, i])))
                except Exception:
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
            fevd = fit.fevd(irf_periods)
            fevd_data = {}
            for i, var in enumerate(cols):
                fevd_data[var] = {}
                decomp = fevd.decomp[i]
                for j, source in enumerate(cols):
                    fevd_data[var][source] = [_sf(v) for v in decomp[:, j]]
            result_dict["fevd"] = {
                "periods": irf_periods,
                "data": fevd_data,
                "variables": cols,
            }
        except Exception as e:
            result_dict["fevd"] = {"error": str(e)}

        try:
            result_dict["diagnostics"] = _compute_residual_diagnostics(
                fit.resid, columns=cols
            )
        except Exception as e:
            result_dict["diagnostics"] = {"error": str(e)}

        return result_dict

    except Exception as e:
        return {"error": str(e), "model": "VAR"}


def fit_pairwise_var(
    data: pd.DataFrame,
    max_lags: int = 10,
    forecast_steps: int = 10,
    forecast_dates: list[str] | None = None,
    data_regime: str = "levels",
    var_trend: str = "c",
) -> dict[str, Any]:
    """VAR bivariés sur toutes les paires de variables."""
    try:
        cols = data.columns.tolist()
        k = len(cols)

        if k < 2:
            return {"error": "Au moins 2 variables requises", "model": "Pairwise VAR"}

        pairs = []
        all_forecasts: dict[str, list[list[float | None]]] = {c: [] for c in cols}
        best_pair_aic = np.inf
        best_pair = None

        for i in range(k):
            for j in range(i + 1, k):
                pair_cols = [cols[i], cols[j]]
                pair_data = data[pair_cols]

                pair_result = fit_var(
                    pair_data,
                    max_lags=max_lags,
                    forecast_steps=forecast_steps,
                    forecast_dates=forecast_dates,
                    compute_irf=True,
                    irf_periods=20,
                    data_regime=data_regime,
                    var_trend=var_trend,
                )

                pair_aic = pair_result.get("aic")
                if pair_aic is not None and "error" not in pair_result:
                    if pair_aic < best_pair_aic:
                        best_pair_aic = pair_aic
                        best_pair = pair_result

                if "error" not in pair_result and pair_result.get("forecast"):
                    for c in pair_cols:
                        fc_vals = pair_result["forecast"]["series"].get(c, [])
                        all_forecasts[c].append(fc_vals)

                pair_summary = {
                    "variables": pair_cols,
                    "lag_order": pair_result.get("lag_order"),
                    "aic": _sf(pair_aic) if pair_aic is not None else None,
                    "bic": _sf(pair_result.get("bic")),
                    "error": pair_result.get("error"),
                }

                if "error" not in pair_result:
                    try:
                        gc = test_granger_causality(pair_data, max_lag=min(max_lags, 4))
                        sig_pairs = [
                            d["interpretation"]
                            for d in gc.get("details", [])
                            if d.get("significant")
                        ]
                        pair_summary["granger_significant"] = sig_pairs
                    except Exception:
                        pass

                pairs.append(pair_summary)

        avg_forecasts: dict[str, list[float | None]] = {}
        for c in cols:
            if all_forecasts[c]:
                n_fc = max(len(f) for f in all_forecasts[c])
                averaged = []
                for step in range(n_fc):
                    vals = [
                        f[step]
                        for f in all_forecasts[c]
                        if step < len(f) and f[step] is not None
                    ]
                    averaged.append(_sf(np.mean(vals)) if vals else None)
                avg_forecasts[c] = averaged
            else:
                avg_forecasts[c] = []

        fc_dates_list = []
        if best_pair and best_pair.get("forecast", {}).get("dates"):
            fc_dates_list = best_pair["forecast"]["dates"]
        elif forecast_steps > 0:
            try:
                fc_dates = _build_forecast_dates(data.index, forecast_steps, forecast_dates)
                fc_dates_list = [d.isoformat() for d in fc_dates]
            except Exception:
                pass

        idx_hist = [d.isoformat() for d in data.index]

        valid_aics = [p["aic"] for p in pairs if p.get("aic") is not None]
        global_aic = _sf(np.mean(valid_aics)) if valid_aics else None

        return {
            "model": "Pairwise VAR",
            "data_regime": data_regime,
            "var_trend": _normalize_var_trend(var_trend),
            "variables": cols,
            "n_observations": len(data),
            "n_pairs": len(pairs),
            "pairs": pairs,
            "aic": global_aic,
            "bic": None,
            "history": {
                "dates": idx_hist,
                "series": {c: [_sf(v) for v in data[c]] for c in cols},
                "fitted": {},
                "fitted_dates": [],
            },
            "forecast": {
                "dates": fc_dates_list,
                "series": avg_forecasts,
            },
        }

    except Exception as e:
        return {"error": str(e), "model": "Pairwise VAR"}
