import re
import numpy as np
import pandas as pd
from typing import Any

from statsmodels.stats.diagnostic import acorr_ljungbox
from statsmodels.stats.stattools import jarque_bera, durbin_watson


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


def _normalize_french_date_text(value: str) -> str:
    """Normalise une date textuelle française pour faciliter le parsing."""
    s = value.strip().lower()

    s = re.sub(
        r"^(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+",
        "",
        s,
    )

    months = {
        "janvier": "january",
        "fevrier": "february",
        "février": "february",
        "mars": "march",
        "avril": "april",
        "mai": "may",
        "juin": "june",
        "juillet": "july",
        "aout": "august",
        "août": "august",
        "septembre": "september",
        "octobre": "october",
        "novembre": "november",
        "decembre": "december",
        "décembre": "december",
    }
    for fr, en in months.items():
        s = re.sub(rf"\b{re.escape(fr)}\b", en, s)

    return s


def _parse_datetime_series(raw: pd.Series) -> pd.Series:
    """Parse robuste des dates: années seules, FR/US, mois-année et formats formats mixtes."""
    parsed = pd.Series(pd.NaT, index=raw.index, dtype="datetime64[ns]")
    non_null = raw.dropna()
    if non_null.empty:
        return parsed

    numeric_vals = pd.to_numeric(non_null, errors="coerce")
    if numeric_vals.notna().mean() > 0.9:
        year_like = numeric_vals.dropna().between(1000, 3000)
        if not year_like.empty and year_like.mean() > 0.9:
            years = numeric_vals.round().astype("Int64").astype(str)
            parsed.loc[non_null.index] = pd.to_datetime(years, format="%Y", errors="coerce")
            return parsed

    text_vals = non_null.astype(str).str.strip()
    year_mask = text_vals.str.match(r"^\d{4}$")
    if not year_mask.empty and year_mask.mean() > 0.9:
        parsed.loc[text_vals.index] = pd.to_datetime(text_vals, format="%Y", errors="coerce")
        return parsed

    dm_pattern = r"^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$"
    dm_extract = text_vals.str.extract(dm_pattern)
    d_gt_12 = pd.to_numeric(dm_extract[0], errors="coerce") > 12
    m_gt_12 = pd.to_numeric(dm_extract[1], errors="coerce") > 12
    prefer_dayfirst = d_gt_12.sum() >= m_gt_12.sum()

    normalized = text_vals.apply(_normalize_french_date_text)
    candidates: list[pd.Series] = []

    candidates.append(pd.to_datetime(normalized, errors="coerce", format="mixed", dayfirst=prefer_dayfirst))
    candidates.append(pd.to_datetime(text_vals, errors="coerce", format="mixed", dayfirst=prefer_dayfirst))
    candidates.append(pd.to_datetime(normalized, errors="coerce", dayfirst=prefer_dayfirst))
    candidates.append(pd.to_datetime(text_vals, errors="coerce", dayfirst=prefer_dayfirst))
    candidates.append(pd.to_datetime(normalized, errors="coerce", format="mixed", dayfirst=not prefer_dayfirst))
    candidates.append(pd.to_datetime(text_vals, errors="coerce", format="mixed", dayfirst=not prefer_dayfirst))
    candidates.append(pd.to_datetime(normalized, errors="coerce", dayfirst=not prefer_dayfirst))
    candidates.append(pd.to_datetime(text_vals, errors="coerce", dayfirst=not prefer_dayfirst))

    explicit_formats = [
        "%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y",
        "%m/%d/%Y", "%m-%d-%Y", "%m/%d/%y", "%m-%d-%y",
        "%Y/%m/%d", "%Y-%m-%d",
        "%m/%Y", "%m-%Y", "%Y/%m", "%Y-%m",
        "%d %B %Y", "%B %d %Y", "%d %b %Y", "%b %d %Y",
    ]
    for fmt in explicit_formats:
        candidates.append(pd.to_datetime(normalized, format=fmt, errors="coerce"))
        candidates.append(pd.to_datetime(text_vals, format=fmt, errors="coerce"))

    best = pd.Series(pd.NaT, index=text_vals.index, dtype="datetime64[ns]")
    for candidate in candidates:
        best = best.fillna(candidate)
    parsed.loc[text_vals.index] = best

    return parsed


def _prepare_series(
    df: pd.DataFrame,
    date_col: str,
    value_col: str,
) -> pd.Series:
    """Construit une Series indexée par datetime, triée, sans doublons, avec ffill."""
    tmp = df[[date_col, value_col]].copy()
    tmp[date_col] = _parse_datetime_series(tmp[date_col])
    tmp = tmp.dropna(subset=[date_col])
    tmp = tmp.set_index(date_col).sort_index()
    series = tmp[value_col].astype(float)

    series = series[~series.index.duplicated(keep="last")]

    freq = _infer_or_guess_freq(series.index)
    series = series.asfreq(freq)

    series = series.ffill().bfill()
    return series


def _detect_seasonal_period(series: pd.Series) -> int:
    """Heuristique de détection de la période saisonnière."""
    freq = series.index.freq
    if freq is None:
        return 1

    freq_str = freq.freqstr if hasattr(freq, "freqstr") else str(freq)

    period_map = {
        "h": 24, "H": 24,
        "B": 5,
        "D": 7,
        "W": 52,
        "MS": 12, "M": 12,
        "ME": 12,
        "QS": 4, "Q": 4, "QE": 4,
        "YS": 1, "Y": 1, "YE": 1,
        "min": 60, "T": 60,
    }

    for key, period in period_map.items():
        if freq_str.startswith(key) or freq_str.endswith(key):
            return period

    return 1


def _infer_or_guess_freq(index: pd.DatetimeIndex) -> str:
    """Infère une fréquence temporelle robuste avec fallback journalier."""
    if index.freq is not None:
        return index.freq.freqstr

    inferred = pd.infer_freq(index)
    if inferred:
        return inferred

    if len(index) >= 2:
        delta = index[-1] - index[-2]
        if delta.days >= 365:
            return "YS"
        if delta.days >= 28:
            return "MS"
        if delta.days >= 7:
            return "W"
        if delta.days >= 1:
            return "D"
        if delta.seconds >= 3600:
            return "h"
        if delta.seconds >= 60:
            return "min"

    return "D"


def _build_forecast_dates(
    index: pd.DatetimeIndex,
    forecast_steps: int,
    forecast_dates: list[str] | None = None,
) -> pd.DatetimeIndex:
    """Construit les dates de prévision (custom si fournies, sinon auto)."""
    if forecast_dates:
        parsed = _parse_datetime_series(pd.Series(forecast_dates, dtype="object"))
        if parsed.isna().any():
            raise ValueError("Certaines forecast_dates sont invalides")
        if len(parsed) != forecast_steps:
            raise ValueError(
                f"Nombre de forecast_dates invalide : attendu {forecast_steps}, reçu {len(parsed)}"
            )
        return pd.DatetimeIndex(parsed.tolist())

    freq = _infer_or_guess_freq(index)
    last_date = index[-1]
    offset = pd.tseries.frequencies.to_offset(freq)
    return pd.date_range(start=last_date + offset, periods=forecast_steps, freq=freq)


def _prepare_multivariate(
    df: pd.DataFrame,
    date_col: str,
    value_cols: list[str],
) -> pd.DataFrame:
    """Construit un DataFrame multivarié indexé par datetime, trié, sans doublons."""
    cols = [date_col] + value_cols
    tmp = df[cols].copy()
    tmp[date_col] = _parse_datetime_series(tmp[date_col])
    tmp = tmp.dropna(subset=[date_col])
    tmp = tmp.set_index(date_col).sort_index()

    for c in value_cols:
        tmp[c] = tmp[c].astype(float)

    tmp = tmp[~tmp.index.duplicated(keep="last")]

    freq = _infer_or_guess_freq(tmp.index)
    tmp = tmp.asfreq(freq)

    tmp = tmp.ffill().bfill()
    return tmp
