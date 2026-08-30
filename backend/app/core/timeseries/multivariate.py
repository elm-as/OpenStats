"""
Module de séries temporelles multivariées (Façade publique).

Réexporte les modèles et tests multivariés :
- test_granger_causality, test_johansen_cointegration
- fit_var, fit_pairwise_var
- fit_vecm
- fit_ardl
- fit_bvar
- fit_varmax
- run_multivariate_timeseries_analysis
"""

from app.core.timeseries.tests_multivariate import (
    test_granger_causality,
    test_johansen_cointegration,
)
from app.core.timeseries.var_models import (
    fit_var,
    fit_pairwise_var,
    _select_var_order,
    _normalize_var_trend,
)
from app.core.timeseries.vecm_models import fit_vecm
from app.core.timeseries.ardl_models import fit_ardl
from app.core.timeseries.bvar_models import fit_bvar
from app.core.timeseries.varmax_models import fit_varmax
from app.core.timeseries.suitability import _assess_model_suitability
from app.core.timeseries.pipeline import run_multivariate_timeseries_analysis

__all__ = [
    "test_granger_causality",
    "test_johansen_cointegration",
    "fit_var",
    "fit_pairwise_var",
    "fit_vecm",
    "fit_ardl",
    "fit_bvar",
    "fit_varmax",
    "run_multivariate_timeseries_analysis",
    "_select_var_order",
    "_normalize_var_trend",
    "_assess_model_suitability",
]
