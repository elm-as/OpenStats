import warnings
import numpy as np
import pandas as pd
from typing import Any

from statsmodels.tsa.stattools import grangercausalitytests
from statsmodels.tsa.vector_ar.var_model import VAR
from statsmodels.tsa.vector_ar.vecm import VECM, coint_johansen
from statsmodels.tsa.statespace.varmax import VARMAX as _VARMAX

try:
    from statsmodels.tsa.ardl import ARDL as _ARDL, ardl_select_order as _ardl_select_order
    _HAS_ARDL = True
except ImportError:
    _HAS_ARDL = False

from app.core.timeseries.helpers import (
    _sf, _sanitize, _build_forecast_dates,
    _compute_residual_diagnostics, _prepare_multivariate
)
from app.core.timeseries.stationarity import (
    test_stationarity, _difference_until_stationary,
    _summarize_integration_orders
)


def test_granger_causality(
    data: pd.DataFrame,
    max_lag: int = 4,
) -> dict[str, Any]:
    """Teste la causalité de Granger entre toutes les paires de variables."""
    cols = data.columns.tolist()
    results_matrix: dict[str, dict[str, float | None]] = {}
    details: list[dict[str, Any]] = []

    for cause in cols:
        results_matrix[cause] = {}
        for effect in cols:
            if cause == effect:
                results_matrix[cause][effect] = None
                continue
            try:
                test_df = data[[effect, cause]].dropna()
                if len(test_df) < max_lag + 5:
                    results_matrix[cause][effect] = None
                    continue
                gc = grangercausalitytests(test_df, maxlag=max_lag, verbose=False)
                best_p = min(gc[lag][0]["ssr_ftest"][1] for lag in gc)
                results_matrix[cause][effect] = _sf(best_p)
                details.append({
                    "cause": cause,
                    "effect": effect,
                    "p_value": _sf(best_p),
                    "significant": best_p < 0.05,
                    "interpretation": (
                        f"{cause} cause-Granger {effect}"
                        if best_p < 0.05
                        else f"{cause} ne cause-Granger pas {effect}"
                    ),
                })
            except Exception:
                results_matrix[cause][effect] = None

    return {
        "max_lag": max_lag,
        "matrix": results_matrix,
        "columns": cols,
        "details": details,
    }


def test_johansen_cointegration(
    data: pd.DataFrame,
    det_order: int = 0,
    k_ar_diff: int = 1,
    integration_diagnostics: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Test de cointégration de Johansen."""
    try:
        result = coint_johansen(data.dropna(), det_order=det_order, k_ar_diff=k_ar_diff)

        trace_stats = result.lr1.tolist()
        trace_cvs = result.cvt.tolist()

        max_eig_stats = result.lr2.tolist()
        max_eig_cvs = result.cvm.tolist()

        n_vars = data.shape[1]
        cointegration_rank = 0
        trace_tests = []
        for i in range(n_vars):
            cv_95 = trace_cvs[i][1]
            is_significant = trace_stats[i] > cv_95
            trace_tests.append({
                "hypothesis": f"r ≤ {i}",
                "statistic": _sf(trace_stats[i]),
                "critical_value_95": _sf(cv_95),
                "reject": is_significant,
            })
            if is_significant:
                cointegration_rank = i + 1

        max_eig_tests = []
        for i in range(n_vars):
            cv_95 = max_eig_cvs[i][1]
            is_significant = max_eig_stats[i] > cv_95
            max_eig_tests.append({
                "hypothesis": f"r ≤ {i}",
                "statistic": _sf(max_eig_stats[i]),
                "critical_value_95": _sf(cv_95),
                "reject": is_significant,
            })

        raw_cointegration_rank = cointegration_rank
        raw_has_cointegration = raw_cointegration_rank > 0

        assumption_valid = True
        assumption_message = (
            "Hypothèse I(1) non vérifiée : interprétation prudente recommandée."
        )
        if integration_diagnostics is not None:
            assumption_valid = bool(integration_diagnostics.get("all_i1", False))
            if assumption_valid:
                assumption_message = (
                    "Toutes les séries semblent I(1) : le test de Johansen et un VECM "
                    "sont interprétables."
                )
            elif integration_diagnostics.get("all_i0", False):
                assumption_message = (
                    "Toutes les séries sont déjà stationnaires I(0) : la cointégration "
                    "n'est pas le bon cadre et un VECM n'est pas justifié."
                )
            elif integration_diagnostics.get("mixed_orders", False):
                order_text = ", ".join(
                    f"{col}=I({order})"
                    for col, order in (integration_diagnostics.get("orders") or {}).items()
                )
                assumption_message = (
                    f"Ordres d'intégration hétérogènes détectés ({order_text}). "
                    "Le signal Johansen reste exploratoire et un VECM n'est pas recommandé."
                )
            else:
                order_text = ", ".join(
                    f"I({order})" for order in (integration_diagnostics.get("unique_orders") or [])
                )
                assumption_message = (
                    f"Les séries ne sont pas toutes I(1) ({order_text or 'ordre non I(1)'}). "
                    "Le test de Johansen n'est pas exploitable comme preuve robuste de cointégration."
                )

        if assumption_valid:
            has_cointegration = raw_has_cointegration
            usable_cointegration_rank = raw_cointegration_rank
            vecm_eligible = raw_has_cointegration
        else:
            has_cointegration = False
            usable_cointegration_rank = 0
            vecm_eligible = False

        if not assumption_valid and raw_has_cointegration:
            interpretation = (
                f"Signal brut de cointégration détecté (rang brut = {raw_cointegration_rank}), "
                "mais hypothèse I(1) non satisfaite → VECM non recommandé"
            )
        elif has_cointegration:
            interpretation = (
                f"{usable_cointegration_rank} relation(s) de cointégration détectée(s) → "
                "VECM recommandé"
            )
        else:
            interpretation = "Pas de cointégration exploitable détectée → VAR stationarisé recommandé"

        return {
            "det_order": det_order,
            "k_ar_diff": k_ar_diff,
            "trace_tests": trace_tests,
            "max_eigenvalue_tests": max_eig_tests,
            "cointegration_rank": usable_cointegration_rank,
            "has_cointegration": has_cointegration,
            "raw_cointegration_rank": raw_cointegration_rank,
            "raw_has_cointegration": raw_has_cointegration,
            "assumption_valid": assumption_valid,
            "assumption_message": assumption_message,
            "vecm_eligible": vecm_eligible,
            "interpretation": interpretation,
        }
    except Exception as e:
        return {"error": str(e)}


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
        n_det = n_coeffs - k * p

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


def _assess_model_suitability(
    n_obs: int,
    n_vars: int,
    integration_diagnostics: dict[str, Any],
    johansen: dict[str, Any],
    all_stationary: bool,
) -> dict[str, dict[str, Any]]:
    """Évalue la pertinence des différents modèles."""
    mixed = integration_diagnostics.get("mixed_orders", False)
    all_i0 = integration_diagnostics.get("all_i0", False)
    all_i1 = integration_diagnostics.get("all_i1", False)
    vecm_ok = johansen.get("vecm_eligible", False)
    min_obs_var = n_vars * 5 + 10

    suits: dict[str, dict[str, Any]] = {}

    suits["var"] = {
        "suitable": n_obs >= min_obs_var,
        "recommended": n_obs >= min_obs_var and (all_stationary or all_i1 or not mixed),
        "reason": (
            "Modèle de référence pour séries multivariées."
            if n_obs >= min_obs_var
            else f"Échantillon trop petit ({n_obs} obs pour {n_vars} vars, min ~{min_obs_var})."
        ),
    }

    suits["vecm"] = {
        "suitable": vecm_ok and n_obs >= min_obs_var,
        "recommended": vecm_ok,
        "reason": (
            "Recommandé : toutes les séries I(1) avec cointégration détectée."
            if vecm_ok
            else (
                "Non applicable : les conditions I(1) homogènes et cointégration ne sont pas remplies."
                if not all_i1
                else "Pas de cointégration détectée par Johansen."
            )
        ),
    }

    suits["ardl"] = {
        "suitable": _HAS_ARDL and n_vars >= 2 and n_obs >= 15,
        "recommended": mixed or (not all_i1 and not all_i0 and n_obs >= 15),
        "reason": (
            "Fortement recommandé pour ordres d'intégration mixtes I(0)/I(1) "
            "(Pesaran, Shin & Smith, 2001)."
            if mixed
            else "Alternative valide quand le cadre VAR/VECM classique n'est pas optimal."
        ),
    }

    suits["bvar"] = {
        "suitable": n_obs >= 10,
        "recommended": n_obs < 50 or n_obs < n_vars * 10,
        "reason": (
            f"Recommandé : petit échantillon ({n_obs} obs). "
            "Le prior Minnesota régularise les estimations."
            if n_obs < 50
            else "Utilisable comme alternative régularisée au VAR classique."
        ),
    }

    n_pairs = n_vars * (n_vars - 1) // 2
    suits["pairwise_var"] = {
        "suitable": n_vars >= 3 and n_obs >= 15,
        "recommended": n_vars >= 4 and n_obs < n_vars * 15,
        "reason": (
            f"Recommandé : {n_vars} variables et seulement {n_obs} obs. "
            f"Analyse bivariée ({n_pairs} paires) économise les degrés de liberté."
            if n_vars >= 4 and n_obs < n_vars * 15
            else f"Disponible comme analyse complémentaire ({n_pairs} paires)."
        ),
    }

    suits["varmax"] = {
        "suitable": n_vars <= 6 and n_obs >= 30,
        "recommended": False,
        "reason": (
            "Représentation état-espace plus flexible. "
            + ("Limité à ≤ 6 variables." if n_vars > 6 else "Disponible.")
            + (" Échantillon trop petit." if n_obs < 30 else "")
        ),
    }

    return suits


def run_multivariate_timeseries_analysis(
    df: pd.DataFrame,
    date_col: str,
    value_cols: list[str],
    models: list[str] | None = None,
    forecast_steps: int = 10,
    granger_max_lag: int = 4,
    forced_model: str | None = None,
    var_data_mode: str = "auto",
    granger_data_mode: str = "auto",
    forecast_dates: list[str] | None = None,
    var_trend: str = "c",
    target_col: str | None = None,
    bvar_lambda1: float = 0.2,
    bvar_lambda2: float = 0.5,
    max_lag: int = 12,
    ic_criterion: str = "aic",
    irf_periods: int = 20,
    fevd_periods: int = 20,
    confidence_level: float = 0.95,
    bootstrap_irf: bool = False,
    irf_orth: bool = True,
    vecm_det_order: int = 0,
    max_diff_order: int = 2,
) -> dict[str, Any]:
    """Analyse complète multivariée."""
    data = _prepare_multivariate(df, date_col, value_cols)

    if len(data) < 15:
        return {"error": "Données trop courtes (minimum 15 observations requises)"}

    results: dict[str, Any] = {
        "type": "multivariate",
        "date_col": date_col,
        "value_cols": value_cols,
        "n_variables": len(value_cols),
        "n_observations": len(data),
        "date_range": {
            "start": data.index[0].isoformat(),
            "end": data.index[-1].isoformat(),
        },
        "frequency": data.index.freq.freqstr if data.index.freq else "unknown",
    }

    stationarity = {}
    for col in value_cols:
        stationarity[col] = test_stationarity(data[col])
    results["stationarity"] = stationarity

    all_stationary = all(
        s.get("is_stationary", False)
        for s in stationarity.values()
    )
    results["all_stationary"] = all_stationary

    diff_data, diff_orders = _difference_until_stationary(data)
    if diff_data.empty:
        return {"error": "Différenciation impossible: données insuffisantes après transformation"}

    integration_diagnostics = _summarize_integration_orders(diff_orders)
    results["integration_diagnostics"] = integration_diagnostics

    johansen = test_johansen_cointegration(data, integration_diagnostics=integration_diagnostics)
    results["johansen_cointegration"] = johansen

    has_coint = johansen.get("has_cointegration", False)
    vecm_eligible = johansen.get("vecm_eligible", False)

    valid_modes = {"auto", "levels", "diff"}
    if var_data_mode not in valid_modes:
        return {"error": f"var_data_mode invalide: {var_data_mode}. Valeurs: auto|levels|diff"}
    if granger_data_mode not in valid_modes:
        return {"error": f"granger_data_mode invalide: {granger_data_mode}. Valeurs: auto|levels|diff"}

    if var_data_mode == "levels":
        var_data = data
        var_regime = "levels"
    elif var_data_mode == "diff":
        var_data = diff_data
        var_regime = "diff"
    else:
        if all_stationary or vecm_eligible:
            var_data = data
            var_regime = "levels"
        else:
            var_data = diff_data
            var_regime = "diff"

    if granger_data_mode == "levels":
        granger_data = data
        granger_regime = "levels"
    elif granger_data_mode == "diff":
        granger_data = diff_data
        granger_regime = "diff"
    else:
        if all_stationary or vecm_eligible:
            granger_data = data
            granger_regime = "levels"
        else:
            granger_data = diff_data
            granger_regime = "diff"

    granger_results = test_granger_causality(granger_data, max_lag=granger_max_lag)
    granger_results["data_regime"] = granger_regime
    results["granger_causality"] = granger_results

    model_suitability = _assess_model_suitability(
        n_obs=len(data),
        n_vars=len(value_cols),
        integration_diagnostics=integration_diagnostics,
        johansen=johansen,
        all_stationary=all_stationary,
    )
    results["model_suitability"] = model_suitability

    if models is None:
        models = ["var"]
        if vecm_eligible:
            models.append("vecm")
        if integration_diagnostics.get("mixed_orders"):
            models.append("ardl")
        if len(data) < 50 or len(data) < len(value_cols) * 10:
            models.append("bvar")
        if len(value_cols) >= 4 and len(data) < len(value_cols) * 15:
            models.append("pairwise_var")

    models = [m.lower() for m in models]
    ardl_target = target_col if target_col and target_col in value_cols else value_cols[0]

    model_results = {}

    if "var" in models:
        model_results["var"] = fit_var(
            var_data,
            forecast_steps=forecast_steps,
            forecast_dates=forecast_dates,
            data_regime=var_regime,
            var_trend=var_trend,
        )

    if "vecm" in models:
        if vecm_eligible:
            coint_rank = johansen.get("cointegration_rank", 1) if has_coint else 1
            model_results["vecm"] = fit_vecm(
                data,
                coint_rank=coint_rank,
                forecast_steps=forecast_steps,
                forecast_dates=forecast_dates,
                data_regime="levels",
            )
        else:
            order_text = ", ".join(
                f"{col}=I({order})"
                for col, order in (integration_diagnostics.get("orders") or {}).items()
            )
            model_results["vecm"] = {
                "model": "VECM",
                "error": (
                    "VECM non estimé : Johansen/VECM requiert des séries toutes I(1). "
                    f"Ordres détectés : {order_text or 'indisponibles'}."
                ),
            }

    if "ardl" in models:
        if model_suitability.get("ardl", {}).get("suitable", False):
            model_results["ardl"] = fit_ardl(
                var_data,
                target=ardl_target,
                max_lags=min(granger_max_lag, 8),
                forecast_steps=forecast_steps,
                forecast_dates=forecast_dates,
                data_regime=var_regime,
            )
        else:
            model_results["ardl"] = {
                "model": "ARDL",
                "error": model_suitability.get("ardl", {}).get(
                    "reason", "ARDL non disponible."
                ),
            }

    if "bvar" in models:
        if model_suitability.get("bvar", {}).get("suitable", False):
            model_results["bvar"] = fit_bvar(
                var_data,
                forecast_steps=forecast_steps,
                forecast_dates=forecast_dates,
                data_regime=var_regime,
                var_trend=var_trend,
                lambda1=bvar_lambda1,
                lambda2=bvar_lambda2,
            )
        else:
            model_results["bvar"] = {
                "model": "BVAR",
                "error": model_suitability.get("bvar", {}).get(
                    "reason", "BVAR non applicable."
                ),
            }

    if "pairwise_var" in models:
        if model_suitability.get("pairwise_var", {}).get("suitable", False):
            model_results["pairwise_var"] = fit_pairwise_var(
                var_data,
                forecast_steps=forecast_steps,
                forecast_dates=forecast_dates,
                data_regime=var_regime,
                var_trend=var_trend,
            )
        else:
            model_results["pairwise_var"] = {
                "model": "Pairwise VAR",
                "error": model_suitability.get("pairwise_var", {}).get(
                    "reason", "Pairwise VAR non applicable."
                ),
            }

    if "varmax" in models:
        if model_suitability.get("varmax", {}).get("suitable", False):
            model_results["varmax"] = fit_varmax(
                var_data,
                forecast_steps=forecast_steps,
                forecast_dates=forecast_dates,
                data_regime=var_regime,
                var_trend=var_trend,
            )
        else:
            model_results["varmax"] = {
                "model": "VARMAX",
                "error": model_suitability.get("varmax", {}).get(
                    "reason", "VARMAX non applicable."
                ),
            }

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
    ranking.sort(key=lambda x: x["aic"])

    forced_model = forced_model.lower() if forced_model else None
    if forced_model and forced_model in model_results and "error" not in model_results[forced_model]:
        forced_entry = next((r for r in ranking if r["key"] == forced_model), None)
        if forced_entry:
            ranking = [forced_entry] + [r for r in ranking if r["key"] != forced_model]

    results["ranking"] = ranking
    results["best_model"] = ranking[0]["key"] if ranking else None

    if integration_diagnostics.get("mixed_orders"):
        pivot_reason = (
            "Ordres d'intégration hétérogènes détectés : le signal Johansen est traité "
            "comme exploratoire et les analyses dynamiques basculent vers des séries stationarisées."
        )
    elif johansen.get("assumption_valid") is False and integration_diagnostics.get("all_i0"):
        pivot_reason = (
            "Toutes les séries sont déjà stationnaires I(0) : le cadre VECM est écarté et "
            "un VAR en niveaux reste privilégié."
        )
    elif vecm_eligible:
        pivot_reason = (
            "Toutes les séries semblent I(1) et une cointégration exploitable est détectée : "
            "le niveau est conservé pour VECM et le diagnostic dynamique."
        )
    elif not all_stationary and (var_regime == "diff" or granger_regime == "diff"):
        pivot_reason = (
            "Séries non stationnaires sans cointégration exploitable : application en différences "
            "pour limiter les corrélations fallacieuses."
        )
    else:
        pivot_reason = "Régime en niveaux conservé (stationnarité suffisante)."

    results["methodological_pivot"] = {
        "forced_model": forced_model,
        "var_data_mode": var_data_mode,
        "granger_data_mode": granger_data_mode,
        "var_trend": _normalize_var_trend(var_trend),
        "applied_var_regime": var_regime,
        "applied_granger_regime": granger_regime,
        "diff_orders": diff_orders,
        "vecm_eligible": vecm_eligible,
        "integration_interpretation": integration_diagnostics.get("interpretation"),
        "reason": pivot_reason,
    }

    reco_parts = []
    if integration_diagnostics.get("mixed_orders"):
        reco_parts.append(
            "Ordres d'intégration hétérogènes détectés. Johansen/VECM ne constituent pas "
            "une preuve robuste de relation de long terme dans cette configuration."
        )
        if "ardl" in model_results and "error" not in model_results.get("ardl", {}):
            bt = model_results["ardl"].get("bounds_test", {})
            if bt and bt.get("cointegration_detected"):
                reco_parts.append(
                    "Le Bounds Test ARDL (Pesaran et al.) détecte une relation de long terme "
                    f"malgré les ordres mixtes → ARDL recommandé pour la variable {ardl_target}."
                )
            else:
                reco_parts.append(
                    "Le Bounds Test ARDL ne détecte pas de relation de long terme. "
                    "Privilégiez un VAR sur séries stationarisées."
                )
        else:
            reco_parts.append(
                "ARDL (Pesaran, Shin & Smith, 2001) est l'alternative de référence "
                "pour les ordres d'intégration mixtes I(0)/I(1)."
            )
    elif integration_diagnostics.get("all_i0"):
        reco_parts.append(
            "Toutes les séries sont stationnaires I(0) : le modèle VAR en niveaux est approprié."
        )
    elif has_coint:
        reco_parts.append(
            "Cointégration détectée : le modèle VECM est recommandé pour capturer "
            "les relations de long terme entre les variables."
        )
    elif all_stationary:
        reco_parts.append(
            "Toutes les séries sont stationnaires : le modèle VAR en niveaux est approprié."
        )
    else:
        reco_parts.append(
            "Séries non-stationnaires sans cointégration : le modèle VAR en différences "
            "est recommandé."
        )

    if len(data) < 50:
        if "bvar" in model_results and "error" not in model_results.get("bvar", {}):
            reco_parts.append(
                f"Petit échantillon ({len(data)} obs) : le BVAR avec prior Minnesota "
                "offre des estimations plus stables grâce à la régularisation."
            )
        else:
            reco_parts.append(
                f"Petit échantillon ({len(data)} obs) : envisagez le BVAR (prior Minnesota) "
                "pour des estimations régularisées."
            )

    if len(value_cols) >= 4 and len(data) < len(value_cols) * 15:
        reco_parts.append(
            f"Avec {len(value_cols)} variables et {len(data)} obs, le Pairwise VAR "
            "bivarié permet d'analyser chaque paire sans saturer les degrés de liberté."
        )

    results["recommendation"] = " ".join(reco_parts)

    forced_model_applied = bool(
        forced_model
        and forced_model in model_results
        and "error" not in model_results[forced_model]
    )

    if forced_model and not forced_model_applied:
        results["recommendation"] += (
            f" Le forçage {forced_model.upper()} a été ignoré car les conditions "
            "requises ne sont pas satisfaites."
        )
    elif forced_model_applied:
        results["recommendation"] += (
            f" Forçage utilisateur actif : {forced_model.upper()} utilisé prioritairement "
            "malgré la recommandation automatique."
        )

    return _sanitize(results)
