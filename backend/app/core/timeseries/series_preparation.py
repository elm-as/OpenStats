import re
import pandas as pd

from app.core.profiling import normalize_date_text
from app.core.temporal_typing import parse_compact_numeric


def _parse_datetime_series(raw: pd.Series) -> pd.Series:
    """Parse robuste des dates: années seules, FR/US, mois-année et formats mixtes."""
    parsed = pd.Series(pd.NaT, index=raw.index, dtype="datetime64[ns]")
    non_null = raw.dropna()
    if non_null.empty:
        return parsed

    # Annees seules, periodes AAAAMM / AAAAMMJJ, numeros de serie Excel :
    # meme autorite que la detection, pour qu'une colonne reconnue comme date
    # soit aussi lisible par le moteur (cf. core.temporal_typing).
    compact = parse_compact_numeric(non_null)
    if compact is not None:
        parsed.loc[compact.index] = compact
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

    normalized = text_vals.apply(normalize_date_text)
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
