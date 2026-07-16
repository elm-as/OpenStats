"""
Package timeseries — Analyse de séries temporelles.

Sous-modules :
    helpers      — Utilitaires de parsing, formatage et préparation
    stationarity — Tests ADF/KPSS, différenciation, ordres d'intégration
    univariate   — ARIMA, SARIMA, Holt-Winters, décomposition saisonnière
    multivariate — VAR, VECM, ARDL, BVAR, Granger, Johansen, VARMAX
"""

import warnings
warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=FutureWarning)

# Helpers publics
from app.core.timeseries.helpers import (
    _sf,
    _sanitize,
    _parse_datetime_series,
    _prepare_series,
    _prepare_multivariate,
    _detect_seasonal_period,
    _infer_or_guess_freq,
    _build_forecast_dates,
    _compute_residual_diagnostics,
    _normalize_french_date_text,
)

# Stationnarité
from app.core.timeseries.stationarity import (
    test_stationarity,
    _difference_until_stationary,
    _summarize_integration_orders,
)

# Modèles univariés
from app.core.timeseries.univariate import (
    decompose_series,
    _auto_arima_order,
    fit_arima,
    _auto_sarima_order,
    fit_sarima,
    fit_exponential_smoothing,
    run_timeseries_analysis,
)

# Modèles multivariés
from app.core.timeseries.multivariate import (
    test_granger_causality,
    test_johansen_cointegration,
    _select_var_order,
    _normalize_var_trend,
    fit_var,
    fit_vecm,
    fit_ardl,
    fit_bvar,
    fit_pairwise_var,
    fit_varmax,
    _assess_model_suitability,
    run_multivariate_timeseries_analysis,
)

__all__ = [
    # helpers
    "_sf",
    "_sanitize",
    "_parse_datetime_series",
    "_prepare_series",
    "_prepare_multivariate",
    "_detect_seasonal_period",
    "_infer_or_guess_freq",
    "_build_forecast_dates",
    "_compute_residual_diagnostics",
    "_normalize_french_date_text",
    # stationarity
    "test_stationarity",
    "_difference_until_stationary",
    "_summarize_integration_orders",
    # univariate
    "decompose_series",
    "_auto_arima_order",
    "fit_arima",
    "_auto_sarima_order",
    "fit_sarima",
    "fit_exponential_smoothing",
    "run_timeseries_analysis",
    # multivariate
    "test_granger_causality",
    "test_johansen_cointegration",
    "_select_var_order",
    "_normalize_var_trend",
    "fit_var",
    "fit_vecm",
    "fit_ardl",
    "fit_bvar",
    "fit_pairwise_var",
    "fit_varmax",
    "_assess_model_suitability",
    "run_multivariate_timeseries_analysis",
]
