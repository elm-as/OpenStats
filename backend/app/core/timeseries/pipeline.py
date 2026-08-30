import pandas as pd
from typing import Any

from app.core.timeseries.residual_diagnostics import _sanitize
from app.core.timeseries.series_preparation import _prepare_multivariate
from app.core.timeseries.stationarity import (
    test_stationarity, _difference_until_stationary,
    _summarize_integration_orders
)
from app.core.timeseries.tests_multivariate import (
    test_granger_causality, test_johansen_cointegration
)
from app.core.timeseries.suitability import _assess_model_suitability
from app.core.timeseries.var_models import fit_var, fit_pairwise_var, _normalize_var_trend
from app.core.timeseries.vecm_models import fit_vecm
from app.core.timeseries.ardl_models import fit_ardl
from app.core.timeseries.bvar_models import fit_bvar
from app.core.timeseries.varmax_models import fit_varmax
from app.core.timeseries.recommendation import (
    build_methodological_pivot,
    build_pipeline_recommendations,
)


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

    stationarity = {col: test_stationarity(data[col]) for col in value_cols}
    results["stationarity"] = stationarity

    all_stationary = all(s.get("is_stationary", False) for s in stationarity.values())
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

    use_levels = all_stationary or vecm_eligible
    var_regime = var_data_mode if var_data_mode != "auto" else ("levels" if use_levels else "diff")
    var_data = data if var_regime == "levels" else diff_data

    granger_regime = granger_data_mode if granger_data_mode != "auto" else ("levels" if use_levels else "diff")
    granger_data = data if granger_regime == "levels" else diff_data

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
                "error": model_suitability.get("ardl", {}).get("reason", "ARDL non disponible."),
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
                "error": model_suitability.get("bvar", {}).get("reason", "BVAR non applicable."),
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
                "error": model_suitability.get("pairwise_var", {}).get("reason", "Pairwise VAR non applicable."),
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
                "error": model_suitability.get("varmax", {}).get("reason", "VARMAX non applicable."),
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

    results["methodological_pivot"] = build_methodological_pivot(
        forced_model=forced_model,
        var_data_mode=var_data_mode,
        granger_data_mode=granger_data_mode,
        var_trend=_normalize_var_trend(var_trend),
        var_regime=var_regime,
        granger_regime=granger_regime,
        diff_orders=diff_orders,
        vecm_eligible=vecm_eligible,
        integration_diagnostics=integration_diagnostics,
        all_stationary=all_stationary,
        johansen=johansen,
    )

    results["recommendation"] = build_pipeline_recommendations(
        integration_diagnostics=integration_diagnostics,
        has_coint=has_coint,
        all_stationary=all_stationary,
        model_results=model_results,
        ardl_target=ardl_target,
        n_obs=len(data),
        n_vars=len(value_cols),
        forced_model=forced_model,
    )

    return _sanitize(results)
