import numpy as np
import pandas as pd
from typing import Any

from statsmodels.stats.diagnostic import acorr_ljungbox
from statsmodels.stats.stattools import jarque_bera, durbin_watson


def _sf(v) -> float | None:
    """Safe float conversion."""
    if v is None or (isinstance(v, float) and (np.isnan(v) or np.isinf(v))):
        return None
    try:
        f = float(v)
        if np.isnan(f) or np.isinf(f):
            return None
        return round(f, 6)
    except (TypeError, ValueError):
        return None


def _sanitize(obj):
    """Convertit récursivement les types numpy en types Python natifs."""
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize(v) for v in obj]
    if isinstance(obj, (np.bool_,)):
        return bool(obj)
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        f = float(obj)
        if np.isnan(f) or np.isinf(f):
            return None
        return f
    if isinstance(obj, (np.ndarray,)):
        return [_sanitize(v) for v in obj.tolist()]
    return obj


def _compute_residual_diagnostics(
    residuals: np.ndarray | pd.DataFrame,
    columns: list[str] | None = None,
) -> dict[str, Any]:
    """Compute residual diagnostics: Ljung-Box, Jarque-Bera, Durbin-Watson."""
    if isinstance(residuals, pd.DataFrame):
        cols = residuals.columns.tolist()
        resid_arr = residuals.values
    else:
        resid_arr = np.asarray(residuals)
        if resid_arr.ndim == 1:
            resid_arr = resid_arr.reshape(-1, 1)
        cols = columns or [f"var_{i}" for i in range(resid_arr.shape[1])]

    per_var: dict[str, dict[str, Any]] = {}
    issues: list[str] = []

    for j, col in enumerate(cols):
        r = resid_arr[:, j]
        r_clean = r[np.isfinite(r)]
        if len(r_clean) < 10:
            per_var[col] = {"error": "Not enough observations for diagnostics"}
            continue

        diag: dict[str, Any] = {}

        # Ljung-Box (test for autocorrelation in residuals)
        try:
            n_lags = min(10, len(r_clean) // 5)
            if n_lags >= 1:
                lb = acorr_ljungbox(r_clean, lags=[n_lags], return_df=True)
                lb_stat = float(lb["lb_stat"].iloc[0])
                lb_pval = float(lb["lb_pvalue"].iloc[0])
                lb_ok = lb_pval > 0.05
                diag["ljung_box"] = {
                    "statistic": _sf(lb_stat),
                    "p_value": _sf(lb_pval),
                    "lags": n_lags,
                    "ok": lb_ok,
                    "interpretation": (
                        "Pas d'autocorrélation résiduelle significative"
                        if lb_ok
                        else f"Autocorrélation résiduelle détectée (p={lb_pval:.4f}) — le modèle capture mal la dynamique"
                    ),
                }
                if not lb_ok:
                    issues.append(f"{col}: autocorrélation résiduelle (LB p={lb_pval:.4f})")
        except Exception as e:
            diag["ljung_box"] = {"error": str(e)}

        # Jarque-Bera (test for normality)
        try:
            jb_stat, jb_pval, skew, kurtosis = jarque_bera(r_clean)
            jb_ok = jb_pval > 0.05
            diag["jarque_bera"] = {
                "statistic": _sf(float(jb_stat)),
                "p_value": _sf(float(jb_pval)),
                "skewness": _sf(float(skew)),
                "kurtosis": _sf(float(kurtosis)),
                "ok": jb_ok,
                "interpretation": (
                    "Résidus distribués normalement"
                    if jb_ok
                    else "Résidus non gaussiens — les intervalles de confiance sont approximatifs"
                ),
            }
            if not jb_ok:
                issues.append(f"{col}: résidus non-normaux (JB p={jb_pval:.4f})")
        except Exception as e:
            diag["jarque_bera"] = {"error": str(e)}

        # Durbin-Watson (autocorrelation of order 1)
        try:
            dw = float(durbin_watson(r_clean))
            dw_ok = 1.5 <= dw <= 2.5
            diag["durbin_watson"] = {
                "statistic": _sf(dw),
                "ok": dw_ok,
                "interpretation": (
                    "Pas d'autocorrélation d'ordre 1"
                    if dw_ok
                    else (
                        f"Autocorrélation positive détectée (DW={dw:.3f})" if dw < 1.5
                        else f"Autocorrélation négative détectée (DW={dw:.3f})"
                    )
                ),
            }
            if not dw_ok:
                issues.append(f"{col}: autocorrélation d'ordre 1 (DW={dw:.3f})")
        except Exception as e:
            diag["durbin_watson"] = {"error": str(e)}

        diag["residual_mean"] = _sf(float(np.mean(r_clean)))
        diag["residual_std"] = _sf(float(np.std(r_clean)))

        per_var[col] = diag

    all_lb_ok = all(
        v.get("ljung_box", {}).get("ok", True)
        for v in per_var.values()
        if "error" not in v
    )
    all_jb_ok = all(
        v.get("jarque_bera", {}).get("ok", True)
        for v in per_var.values()
        if "error" not in v
    )
    all_dw_ok = all(
        v.get("durbin_watson", {}).get("ok", True)
        for v in per_var.values()
        if "error" not in v
    )

    return {
        "per_variable": per_var,
        "summary": {
            "all_ljung_box_ok": all_lb_ok,
            "all_jarque_bera_ok": all_jb_ok,
            "all_durbin_watson_ok": all_dw_ok,
            "model_adequate": all_lb_ok and all_dw_ok,
            "issues": issues,
            "interpretation": (
                "Les résidus ne montrent aucun problème structurel majeur."
                if all_lb_ok and all_dw_ok
                else (
                    "Problèmes détectés dans les résidus : "
                    + "; ".join(issues[:5])
                    + (". Considérez un lag plus élevé ou un modèle alternatif."
                       if not all_lb_ok else ".")
                )
            ),
        },
    }
