"""
Parsing temporel et conversion de valeurs sures pour les graphiques.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

from app.core.profiling import normalize_date_text


def safe_val(v: Any) -> Any:
    """Nettoie une valeur unitaire pour l'incorporer dans un jeu de donnees de graphique."""
    if v is None or (isinstance(v, float) and (np.isnan(v) or np.isinf(v))):
        return None
    if isinstance(v, (np.integer, np.int64)):
        return int(v)
    if isinstance(v, (np.floating, np.float64)):
        return round(float(v), 4)
    return v


def parse_temporal_series(series: pd.Series) -> pd.Series:
    """Parse une serie en datetime64 avec detection heuristique des formats."""
    parsed = pd.Series(pd.NaT, index=series.index, dtype="datetime64[ns]")
    non_null = series.dropna()
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

    normalized = text_vals.apply(normalize_date_text)
    candidates: list[pd.Series] = [
        pd.to_datetime(normalized, errors="coerce", format="mixed", dayfirst=prefer_dayfirst),
        pd.to_datetime(text_vals, errors="coerce", format="mixed", dayfirst=prefer_dayfirst),
        pd.to_datetime(normalized, errors="coerce", format="mixed", dayfirst=not prefer_dayfirst),
        pd.to_datetime(text_vals, errors="coerce", format="mixed", dayfirst=not prefer_dayfirst),
    ]
    for fmt in ["%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d", "%m/%d/%Y", "%m/%Y", "%Y/%m"]:
        candidates.extend([
            pd.to_datetime(normalized, format=fmt, errors="coerce"),
            pd.to_datetime(text_vals, format=fmt, errors="coerce"),
        ])

    best = pd.Series(pd.NaT, index=text_vals.index, dtype="datetime64[ns]")
    for candidate in candidates:
        best = best.fillna(candidate)
    parsed.loc[text_vals.index] = best
    return parsed


def bucket_temporal(x_series: pd.Series, granularity: str) -> pd.Series | None:
    """Regroupe les observations temporelles par pas (jour, mois, annee)."""
    parsed = parse_temporal_series(x_series)
    if parsed.notna().mean() < 0.6:
        return None

    g = granularity
    if g == "auto":
        n = len(parsed.dropna())
        if n > 15000:
            g = "year"
        elif n > 1500:
            g = "month"
        else:
            g = "day"

    if g == "year":
        return parsed.dt.strftime("%Y")
    if g == "month":
        return parsed.dt.strftime("%Y-%m")
    if g == "day":
        return parsed.dt.strftime("%Y-%m-%d")
    return None
