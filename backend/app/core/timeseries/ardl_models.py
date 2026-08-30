import numpy as np
import pandas as pd
from typing import Any

try:
    from statsmodels.tsa.ardl import ARDL as _ARDL, ardl_select_order as _ardl_select_order
    _HAS_ARDL = True
except ImportError:
    _HAS_ARDL = False

from app.core.timeseries.residual_diagnostics import (
    _sf, _compute_residual_diagnostics
)
from app.core.timeseries.series_preparation import _build_forecast_dates



def fit_ardl(
    data: pd.DataFrame,
    target: str,
    max_lags: int = 4,
    forecast_steps: int = 10,
    forecast_dates: list[str] | None = None,
    data_regime: str = "levels",
) -> dict[str, Any]:
    """ARDL avec Bounds Testing."""
    if not _HAS_ARDL:
        return {"error": "statsmodels >= 0.13 requis pour ARDL", "model": "ARDL"}

    try:
        cols = data.columns.tolist()
        if target not in cols:
            return {"error": f"Variable cible '{target}' introuvable", "model": "ARDL"}

        exog_cols = [c for c in cols if c != target]
        endog = data[target].astype(float)
        exog = data[exog_cols].astype(float)

        max_possible = max(1, len(data) // (len(cols) + 2) - 1)
        safe_lags = min(max_lags, max_possible, 8)

        try:
            sel = _ardl_select_order(endog, safe_lags, exog, safe_lags, ic="aic")
            ar_lags = sel.ar_lags if sel.ar_lags else list(range(1, min(safe_lags, 2) + 1))
            dl_lags = sel.dl_lags if sel.dl_lags else {c: list(range(safe_lags + 1)) for c in exog_cols}
        except Exception:
            ar_lags = list(range(1, min(safe_lags, 2) + 1))
            dl_lags = {c: list(range(min(safe_lags, 2) + 1)) for c in exog_cols}

        model = _ARDL(endog, ar_lags, exog, dl_lags, trend="c")
        fit = model.fit()

        bounds_test = None
        try:
            bt = fit.bounds_test(case=3)
            stat_val = float(bt.stat) if hasattr(bt, "stat") else None
            p_val = float(bt.pvalue) if hasattr(bt, "pvalue") else None

            crit_dict = {}
            if hasattr(bt, "crit_vals") and bt.crit_vals is not None:
                cv = bt.crit_vals
                for level in cv.index:
                    crit_dict[str(level)] = {
                        "I0": _sf(cv.loc[level, "I(0)"]) if "I(0)" in cv.columns else None,
                        "I1": _sf(cv.loc[level, "I(1)"]) if "I(1)" in cv.columns else None,
                    }

            i1_5pct = crit_dict.get("5%", {}).get("I1")
            i0_5pct = crit_dict.get("5%", {}).get("I0")
            if stat_val is not None and i1_5pct is not None and i0_5pct is not None:
                if stat_val > i1_5pct:
                    conclusion = "Relation de long terme détectée (F > borne I(1) à 5%)"
                    coint_detected = True
                elif stat_val < i0_5pct:
                    conclusion = "Pas de relation de long terme (F < borne I(0) à 5%)"
                    coint_detected = False
                else:
                    conclusion = "Zone d'incertitude (F entre bornes I(0) et I(1) à 5%)"
                    coint_detected = False
            else:
                conclusion = "Bounds test exécuté mais interprétation impossible"
                coint_detected = False

            bounds_test = {
                "f_statistic": _sf(stat_val),
                "p_value": _sf(p_val),
                "critical_values": crit_dict,
                "conclusion": conclusion,
                "cointegration_detected": coint_detected,
            }
        except Exception as e:
            bounds_test = {"error": str(e)}

        fitted_vals = fit.fittedvalues
        idx_hist = [d.isoformat() for d in data.index]

        history_series = {c: [_sf(v) for v in data[c]] for c in cols}
        fitted_dict = {target: [_sf(v) for v in fitted_vals]}
        fitted_dates_list = [d.isoformat() for d in fitted_vals.index]

        try:
            last_exog = exog.iloc[-1:].values
            exog_oos = pd.DataFrame(
                np.repeat(last_exog, forecast_steps, axis=0),
                columns=exog_cols,
            )
            fc = fit.forecast(steps=forecast_steps, exog_oos=exog_oos)
            fc_dates = _build_forecast_dates(data.index, forecast_steps, forecast_dates)
            forecast_dict = {target: [_sf(v) for v in fc]}
            for c in exog_cols:
                forecast_dict[c] = [_sf(exog_oos[c].iloc[i]) for i in range(forecast_steps)]
            forecast_dates_list = [d.isoformat() for d in fc_dates]
        except Exception as e:
            forecast_dict = {target: []}
            forecast_dates_list = []

        ardl_order = {
            "ar_lags": [int(l) for l in ar_lags] if ar_lags else [],
            "dl_lags": {c: [int(l) for l in lags] for c, lags in (dl_lags.items() if isinstance(dl_lags, dict) else [])},
        }

        result_dict = {
            "model": "ARDL",
            "data_regime": data_regime,
            "target_col": target,
            "variables": cols,
            "n_observations": len(data),
            "aic": _sf(fit.aic),
            "bic": _sf(fit.bic),
            "ardl_order": ardl_order,
            "bounds_test": bounds_test,
            "history": {
                "dates": idx_hist,
                "series": history_series,
                "fitted": fitted_dict,
                "fitted_dates": fitted_dates_list,
            },
            "forecast": {
                "dates": forecast_dates_list,
                "series": forecast_dict,
            },
        }

        try:
            ardl_resid = fit.resid.values
            result_dict["diagnostics"] = _compute_residual_diagnostics(
                ardl_resid.reshape(-1, 1), columns=[target]
            )
        except Exception as e:
            result_dict["diagnostics"] = {"error": str(e)}

        return result_dict

    except Exception as e:
        return {"error": str(e), "model": "ARDL"}
