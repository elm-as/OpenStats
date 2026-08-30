import numpy as np
import pandas as pd
from typing import Any

from statsmodels.tsa.stattools import grangercausalitytests
from statsmodels.tsa.vector_ar.vecm import coint_johansen

from app.core.timeseries.residual_diagnostics import _sf


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
