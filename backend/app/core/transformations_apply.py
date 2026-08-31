"""
Application unitaire et vectorisée des transformations mathématiques sur pandas DataFrames et Series.
"""

from __future__ import annotations

from typing import Any
import numpy as np
import pandas as pd
from app.core.transformations_catalog import TRANSFORM_CATALOG


def _safe_float(v: Any) -> float | None:
    """Conversion flottante sécurisée pour JSON."""
    if v is None or (isinstance(v, float) and (np.isnan(v) or np.isinf(v))):
        return None
    try:
        f = float(v)
        return round(f, 6) if not (np.isnan(f) or np.isinf(f)) else None
    except (TypeError, ValueError):
        return None


def apply_transform(
    series: pd.Series,
    transform_key: str,
    params: dict[str, Any] | None = None,
) -> tuple[pd.Series, dict[str, Any]]:
    """
    Applique une transformation à une Series pandas.
    Retourne (series_transformée, metadata).
    """
    params = params or {}
    meta: dict[str, Any] = {"transform": transform_key, "column": series.name}

    if transform_key == "log":
        if (series <= 0).any():
            shift = abs(series.min()) + 1
            meta["shift"] = float(shift)
            result = np.log10(series + shift)
        else:
            result = np.log10(series)

    elif transform_key == "log1p":
        if (series < 0).any():
            shift = abs(series.min()) + 1
            meta["shift"] = float(shift)
            result = np.log1p(series + shift)
        else:
            result = np.log1p(series)

    elif transform_key == "sqrt":
        if (series < 0).any():
            shift = abs(series.min())
            meta["shift"] = float(shift)
            result = np.sqrt(series + shift)
        else:
            result = np.sqrt(series)

    elif transform_key == "reciprocal":
        safe = series.replace(0, np.nan)
        result = 1.0 / safe

    elif transform_key == "square":
        result = series ** 2

    elif transform_key == "boxcox":
        from scipy.stats import boxcox as _boxcox
        vals = series.dropna()
        if (vals <= 0).any():
            shift = abs(vals.min()) + 1
            meta["shift"] = float(shift)
            vals = vals + shift
        transformed, lam = _boxcox(vals.values)
        meta["lambda"] = float(lam)
        result = pd.Series(np.nan, index=series.index, name=series.name)
        result.loc[vals.index] = transformed

    elif transform_key == "yeo_johnson":
        from scipy.stats import yeojohnson
        vals = series.dropna()
        transformed, lam = yeojohnson(vals.values)
        meta["lambda"] = float(lam)
        result = pd.Series(np.nan, index=series.index, name=series.name)
        result.loc[vals.index] = transformed

    elif transform_key == "standardize":
        mu = series.mean()
        sigma = series.std()
        meta["mean"] = float(mu) if pd.notna(mu) else 0
        meta["std"] = float(sigma) if pd.notna(sigma) and sigma != 0 else 1
        result = (series - mu) / (sigma if sigma != 0 else 1)

    elif transform_key == "minmax":
        vmin = series.min()
        vmax = series.max()
        meta["min"] = float(vmin) if pd.notna(vmin) else 0
        meta["max"] = float(vmax) if pd.notna(vmax) else 1
        rng = vmax - vmin
        result = (series - vmin) / (rng if rng != 0 else 1)

    elif transform_key == "robust_scale":
        med = series.median()
        q1 = series.quantile(0.25)
        q3 = series.quantile(0.75)
        iqr = q3 - q1
        meta["median"] = float(med) if pd.notna(med) else 0
        meta["iqr"] = float(iqr) if pd.notna(iqr) else 1
        result = (series - med) / (iqr if iqr != 0 else 1)

    elif transform_key == "diff":
        order = params.get("order", 1)
        result = series.diff(periods=int(order))

    elif transform_key == "diff2":
        result = series.diff().diff()

    elif transform_key == "seasonal_diff":
        period = params.get("period", 12)
        result = series.diff(periods=int(period))

    elif transform_key == "detrend":
        from scipy.signal import detrend as _detrend
        vals = series.dropna()
        detrended = _detrend(vals.values, type="linear")
        result = pd.Series(np.nan, index=series.index, name=series.name)
        result.loc[vals.index] = detrended

    elif transform_key == "winsorize":
        lower = params.get("lower", 0.01)
        upper = params.get("upper", 0.99)
        q_lo = series.quantile(lower)
        q_hi = series.quantile(upper)
        meta["lower_bound"] = float(q_lo) if pd.notna(q_lo) else None
        meta["upper_bound"] = float(q_hi) if pd.notna(q_hi) else None
        result = series.clip(lower=q_lo, upper=q_hi)

    elif transform_key == "rank":
        result = series.rank(method="average", na_option="keep")

    elif transform_key == "lag":
        lag = int(params.get("lag", 1))
        meta["lag"] = lag
        result = series.shift(periods=lag)

    elif transform_key == "rolling_mean":
        window = int(params.get("window", 3))
        min_periods = int(params.get("min_periods", 1))
        meta["window"] = window
        result = series.rolling(window=window, min_periods=min_periods).mean()

    elif transform_key == "rolling_std":
        window = int(params.get("window", 3))
        min_periods = int(params.get("min_periods", 2))
        meta["window"] = window
        result = series.rolling(window=window, min_periods=min_periods).std()

    elif transform_key == "pct_change":
        periods = int(params.get("periods", 1))
        meta["periods"] = periods
        result = series.pct_change(periods=periods)

    else:
        raise ValueError(f"Transformation inconnue : {transform_key}")

    result.name = series.name
    return result, meta


def apply_transforms_to_df(
    df: pd.DataFrame,
    transforms: list[dict[str, Any]],
) -> tuple[pd.DataFrame, list[dict[str, Any]]]:
    """
    Applique une liste de transformations à un DataFrame.
    Chaque item : {"column": str, "transform": str, "params": {...}}
    Retourne (df_transformé, logs).
    """
    df_out = df.copy()
    logs = []

    for t in transforms:
        col = t["column"]
        key = t["transform"]
        params = t.get("params", {})

        if col not in df_out.columns:
            logs.append({"column": col, "transform": key, "error": f"Colonne '{col}' introuvable"})
            continue

        info = TRANSFORM_CATALOG.get(key)
        if info is None:
            logs.append({"column": col, "transform": key, "error": f"Transformation '{key}' inconnue"})
            continue

        try:
            original_stats = {
                "mean": _safe_float(df_out[col].mean()),
                "std": _safe_float(df_out[col].std()),
                "skewness": _safe_float(df_out[col].skew()),
                "min": _safe_float(df_out[col].min()),
                "max": _safe_float(df_out[col].max()),
            }

            transformed, meta = apply_transform(df_out[col], key, params)
            new_col_name = t.get("new_column", f"{col}_{key}")
            df_out[new_col_name] = transformed
            if (t.get("replace", False) or params.get("replace", False)) and new_col_name != col:
                df_out.drop(columns=[col], inplace=True)


            new_stats = {
                "mean": _safe_float(df_out[new_col_name].mean()),
                "std": _safe_float(df_out[new_col_name].std()),
                "skewness": _safe_float(df_out[new_col_name].skew()),
                "min": _safe_float(df_out[new_col_name].min()),
                "max": _safe_float(df_out[new_col_name].max()),
            }

            logs.append({
                "column": col,
                "new_column": new_col_name,
                "transform": key,
                "label": info["label"],
                "meta": meta,
                "before": original_stats,
                "after": new_stats,
                "success": True,
            })
        except Exception as e:
            logs.append({
                "column": col,
                "transform": key,
                "error": str(e),
                "success": False,
            })

    return df_out, logs
