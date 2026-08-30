import numpy as np
import pandas as pd
from typing import Any

from app.core.timeseries.residual_diagnostics import (
    _sf, _compute_residual_diagnostics
)
from app.core.timeseries.series_preparation import _build_forecast_dates

from app.core.timeseries.var_models import _normalize_var_trend, _select_var_order


def fit_bvar(
    data: pd.DataFrame,
    max_lags: int = 10,
    forecast_steps: int = 10,
    forecast_dates: list[str] | None = None,
    compute_irf: bool = True,
    irf_periods: int = 20,
    data_regime: str = "levels",
    var_trend: str = "c",
    lambda1: float = 0.2,
    lambda2: float = 0.5,
) -> dict[str, Any]:
    """VAR bayésien avec prior Minnesota/Litterman."""
    try:
        cols = data.columns.tolist()
        k = len(cols)
        T = len(data)
        trend = _normalize_var_trend(var_trend)

        lag_order = _select_var_order(data, max_lags)
        p = lag_order

        sigma = np.zeros(k)
        for i, col in enumerate(cols):
            try:
                y = data[col].values
                if len(y) > 2:
                    x = y[:-1]
                    yy = y[1:]
                    slope = np.sum((x - x.mean()) * (yy - yy.mean())) / max(np.sum((x - x.mean()) ** 2), 1e-12)
                    intercept = yy.mean() - slope * x.mean()
                    resid = yy - slope * x - intercept
                    sigma[i] = np.std(resid, ddof=1) if len(resid) > 1 else data[col].std()
                else:
                    sigma[i] = data[col].std()
            except Exception:
                sigma[i] = data[col].std()
        sigma[sigma < 1e-12] = 1.0

        Y = data.iloc[p:].values
        n = len(Y)
        if n < k + 1:
            return {"error": f"Pas assez d'observations après lag ({n} obs, {k} vars)", "model": "BVAR"}

        X_parts = []
        for lag in range(1, p + 1):
            start = p - lag
            end = T - lag
            X_parts.append(data.iloc[start:end].values)

        has_const = trend in ("c", "ct", "ctt")
        has_trend_term = trend in ("ct", "ctt")
        has_quad = trend == "ctt"

        if has_const:
            X_parts.append(np.ones((n, 1)))
        if has_trend_term:
            X_parts.append(np.arange(1, n + 1).reshape(-1, 1))
        if has_quad:
            X_parts.append((np.arange(1, n + 1) ** 2).reshape(-1, 1))

        X = np.hstack(X_parts)
        n_coeffs = X.shape[1]

        B_hat = np.zeros((n_coeffs, k))
        for i in range(k):
            prior_prec = np.zeros(n_coeffs)
            prior_mean = np.zeros(n_coeffs)

            idx = 0
            for lag in range(1, p + 1):
                for j in range(k):
                    if i == j:
                        pv = (lambda1 / lag) ** 2
                        if lag == 1:
                            prior_mean[idx] = 1.0
                    else:
                        pv = (lambda1 * lambda2 * sigma[i] / (lag * sigma[j])) ** 2
                    prior_prec[idx] = 1.0 / max(pv, 1e-12)
                    idx += 1

            for det_idx in range(idx, n_coeffs):
                prior_prec[det_idx] = 1e-8

            Omega_inv = np.diag(prior_prec)
            XtX = X.T @ X
            Xty = X.T @ Y[:, i]
            try:
                B_hat[:, i] = np.linalg.solve(
                    XtX + Omega_inv,
                    Xty + Omega_inv @ prior_mean,
                )
            except np.linalg.LinAlgError:
                B_hat[:, i] = np.linalg.lstsq(
                    XtX + Omega_inv,
                    Xty + Omega_inv @ prior_mean,
                    rcond=None,
                )[0]

        fitted = X @ B_hat
        resid = Y - fitted
        Sigma_u = (resid.T @ resid) / max(n - n_coeffs, 1)

        A_mats = []
        for lag in range(p):
            A_l = B_hat[lag * k:(lag + 1) * k, :].T
            A_mats.append(A_l)

        idx_hist = [d.isoformat() for d in data.index]
        fitted_dates = data.index[p:]
        fitted_dict = {}
        for j, c in enumerate(cols):
            fitted_dict[c] = [_sf(v) for v in fitted[:, j]]

        current_vals = list(data.values[-p:])
        forecasts = np.zeros((forecast_steps, k))
        for h in range(forecast_steps):
            x_new = []
            for lag in range(1, p + 1):
                x_new.extend(current_vals[-lag])
            if has_const:
                x_new.append(1.0)
            if has_trend_term:
                x_new.append(float(n + h + 1))
            if has_quad:
                x_new.append(float((n + h + 1) ** 2))
            x_new = np.array(x_new)
            forecasts[h] = x_new @ B_hat
            current_vals.append(forecasts[h])

        fc_dates = _build_forecast_dates(data.index, forecast_steps, forecast_dates)
        forecast_dict = {}
        for j, c in enumerate(cols):
            forecast_dict[c] = [_sf(v) for v in forecasts[:, j]]

        log_det = np.log(max(np.linalg.det(Sigma_u), 1e-300))
        n_total_params = k * n_coeffs
        aic_val = log_det + 2 * n_total_params / n
        bic_val = log_det + np.log(n) * n_total_params / n

        result_dict: dict[str, Any] = {
            "model": "BVAR",
            "data_regime": data_regime,
            "var_trend": trend,
            "lag_order": lag_order,
            "aic": _sf(aic_val),
            "bic": _sf(bic_val),
            "variables": cols,
            "n_observations": len(data),
            "bvar_hyperparameters": {"lambda1": lambda1, "lambda2": lambda2},
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

        if compute_irf:
            try:
                P = np.linalg.cholesky(Sigma_u)
                Phi = [np.eye(k)]
                for s in range(1, irf_periods + 1):
                    Phi_s = np.zeros((k, k))
                    for j in range(min(s, p)):
                        Phi_s += Phi[s - j - 1] @ A_mats[j]
                    Phi.append(Phi_s)

                irf_data = {}
                for i_imp, impulse in enumerate(cols):
                    irf_data[impulse] = {}
                    for j_resp, response in enumerate(cols):
                        vals = []
                        for s in range(irf_periods + 1):
                            oirf = Phi[s] @ P
                            vals.append(_sf(oirf[j_resp, i_imp]))
                        irf_data[impulse][response] = vals

                sigma_u_dict = {}
                for j, c in enumerate(cols):
                    sigma_u_dict[c] = _sf(float(np.sqrt(Sigma_u[j, j])))

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
                    "sigma_u": sigma_u_dict,
                    "descriptive_stats": desc_stats,
                }
            except Exception as e:
                result_dict["irf"] = {"error": str(e)}

        if compute_irf and "irf" in result_dict and "error" not in result_dict.get("irf", {}):
            try:
                P = np.linalg.cholesky(Sigma_u)
                Phi = [np.eye(k)]
                for s in range(1, irf_periods + 1):
                    Phi_s = np.zeros((k, k))
                    for j in range(min(s, p)):
                        Phi_s += Phi[s - j - 1] @ A_mats[j]
                    Phi.append(Phi_s)

                fevd_data = {}
                for i_var, var_name in enumerate(cols):
                    fevd_data[var_name] = {}
                    for j_src, src_name in enumerate(cols):
                        decomp = []
                        for h in range(1, irf_periods + 1):
                            num = sum((Phi[s] @ P)[i_var, j_src] ** 2 for s in range(h + 1))
                            den = sum(
                                sum((Phi[s] @ P)[i_var, q] ** 2 for q in range(k))
                                for s in range(h + 1)
                            )
                            decomp.append(_sf(num / den if den > 0 else 0))
                        fevd_data[var_name][src_name] = decomp

                result_dict["fevd"] = {
                    "periods": irf_periods,
                    "data": fevd_data,
                    "variables": cols,
                }
            except Exception as e:
                result_dict["fevd"] = {"error": str(e)}

        try:
            result_dict["diagnostics"] = _compute_residual_diagnostics(
                resid, columns=cols
            )
        except Exception as e:
            result_dict["diagnostics"] = {"error": str(e)}

        return result_dict

    except Exception as e:
        return {"error": str(e), "model": "BVAR"}
