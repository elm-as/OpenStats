import numpy as np
import pandas as pd
from typing import Any
from statsmodels.tsa.stattools import adfuller, kpss

from app.core.timeseries.helpers import _sf


def test_stationarity(series: pd.Series) -> dict[str, Any]:
    """Tests de stationnarité : ADF + KPSS."""
    results = {}

    # ADF (H0 : non-stationnaire)
    try:
        adf_stat, adf_p, adf_lag, adf_nobs, adf_crit, _ = adfuller(series.dropna(), autolag="AIC")
        results["adf"] = {
            "statistic": _sf(adf_stat),
            "p_value": _sf(adf_p),
            "lags_used": int(adf_lag),
            "n_obs": int(adf_nobs),
            "critical_values": {k: _sf(v) for k, v in adf_crit.items()},
            "is_stationary": bool(adf_p < 0.05),
            "interpretation": (
                "Série stationnaire (rejet de H0)" if adf_p < 0.05
                else "Série non-stationnaire (H0 non rejetée)"
            ),
        }
    except Exception as e:
        results["adf"] = {"error": str(e)}

    # KPSS (H0 : stationnaire)
    try:
        kpss_stat, kpss_p, kpss_lag, kpss_crit = kpss(series.dropna(), regression="c", nlags="auto")
        results["kpss"] = {
            "statistic": _sf(kpss_stat),
            "p_value": _sf(kpss_p),
            "lags_used": int(kpss_lag),
            "critical_values": {k: _sf(v) for k, v in kpss_crit.items()},
            "is_stationary": bool(kpss_p > 0.05),
            "interpretation": (
                "Série stationnaire (H0 non rejetée)" if kpss_p > 0.05
                else "Série non-stationnaire (rejet de H0)"
            ),
        }
    except Exception as e:
        results["kpss"] = {"error": str(e)}

    # Diagnostic combiné
    adf_ok = results.get("adf", {}).get("is_stationary", False)
    kpss_ok = results.get("kpss", {}).get("is_stationary", False)

    if adf_ok and kpss_ok:
        results["conclusion"] = "Série stationnaire (confirmé par ADF et KPSS)"
    elif adf_ok and not kpss_ok:
        results["conclusion"] = "Stationnarité autour d'une tendance (ADF ✓, KPSS ✗)"
    elif not adf_ok and kpss_ok:
        results["conclusion"] = "Stationnarité avec racine unitaire possible (ADF ✗, KPSS ✓)"
    else:
        results["conclusion"] = "Série non-stationnaire (ADF ✗, KPSS ✗)"

    results["is_stationary"] = bool(adf_ok and kpss_ok)

    return results


def _difference_until_stationary(
    data: pd.DataFrame,
    max_diff: int = 2,
) -> tuple[pd.DataFrame, dict[str, int]]:
    """Différencie chaque série jusqu'à stationnarité (ou max_diff)."""
    diff_orders: dict[str, int] = {}
    transformed = pd.DataFrame(index=data.index)

    for col in data.columns:
        s = data[col].copy()
        order = 0
        while order < max_diff:
            stationarity = test_stationarity(s)
            if stationarity.get("is_stationary", False):
                break
            s = s.diff().dropna()
            order += 1

        diff_orders[col] = order
        transformed[col] = s.reindex(data.index)

    transformed = transformed.dropna()
    return transformed, diff_orders


def _summarize_integration_orders(diff_orders: dict[str, int]) -> dict[str, Any]:
    """Résume les ordres d'intégration estimés par variable."""
    orders = {col: int(order) for col, order in diff_orders.items()}
    unique_orders = sorted(set(orders.values()))
    homogeneous = len(unique_orders) == 1
    all_i0 = unique_orders == [0]
    all_i1 = unique_orders == [1]
    max_order = max(unique_orders) if unique_orders else None

    if all_i0:
        interpretation = (
            "Toutes les séries semblent I(0) : elles sont déjà stationnaires, "
            "donc le cadre Johansen/VECM n'est pas approprié."
        )
    elif all_i1:
        interpretation = (
            "Toutes les séries semblent I(1) : l'hypothèse requise par Johansen/VECM "
            "est cohérente."
        )
    elif homogeneous:
        order = unique_orders[0]
        interpretation = (
            f"Toutes les séries semblent I({order}). Johansen/VECM suppose "
            "spécifiquement des séries I(1)."
        )
    else:
        order_text = ", ".join(f"{col}=I({order})" for col, order in orders.items())
        interpretation = (
            f"Ordres d'intégration hétérogènes détectés ({order_text}). "
            "Johansen/VECM n'est pas valide dans cette configuration."
        )

    return {
        "orders": orders,
        "unique_orders": unique_orders,
        "homogeneous": homogeneous,
        "mixed_orders": not homogeneous,
        "all_i0": all_i0,
        "all_i1": all_i1,
        "max_order": max_order,
        "interpretation": interpretation,
    }
