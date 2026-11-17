"""
Construction de données de visualisation et sérialisation pour les routes d'analyse.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd

from app.api.v1.analysis.chart_serialization import sanitize_for_json as _sanitize_for_json
from app.api.v1.analysis.chart_temporal_parser import (
    bucket_temporal as _bucket_temporal,
    parse_temporal_series as _parse_temporal_series,
    safe_val as _safe_val,
)

_AGG_FUNCS = {
    "mean": "mean",
    "sum": "sum",
    "count": "count",
    "median": "median",
    "min": "min",
    "max": "max",
}

_ALIASES = {
    "boxplot": "box",
    "density": "histogram",
    "multi_line": "line",
    "multiline": "line",
}


@dataclass
class _ChartRequest:
    df: pd.DataFrame
    chart_type: str
    x_col: str | None
    y_cols: list[str]
    group_col: str | None
    aggregation: str
    agg_fn: str
    sans_agregation: bool
    top_n: int
    time_granularity: str | None
    color_col: str | None
    size_col: str | None
    base_result: dict[str, Any]


def _infer_auto_chart_type(req: _ChartRequest) -> str:
    if not req.x_col or req.x_col not in req.df.columns:
        return "histogram" if len(req.y_cols) == 1 else "box"
    x_s = req.df[req.x_col].dropna()
    if pd.api.types.is_datetime64_any_dtype(x_s) or _parse_temporal_series(x_s).notna().mean() > 0.6:
        return "line"
    if not pd.api.types.is_numeric_dtype(x_s) or x_s.nunique() <= 15:
        return "stacked_bar" if len(req.y_cols) > 1 else "bar"
    if req.y_cols and pd.api.types.is_numeric_dtype(x_s):
        return "bubble" if req.color_col else "scatter"
    return "bar"


def _build_distribution_data(req: _ChartRequest) -> dict[str, Any] | None:
    if req.x_col and req.x_col in req.df.columns:
        return None
    valid_cols = [c for c in req.y_cols if c in req.df.columns]
    if not valid_cols:
        return {"error": "Au moins une variable numérique valide est requise"}
    records = [
        {c: _safe_val(row[c]) for c in valid_cols}
        for _, row in req.df[valid_cols].dropna(how="all").iterrows()
    ]
    return {**req.base_result, "data": records, "series": valid_cols}


def _build_pie_data(req: _ChartRequest) -> dict[str, Any]:
    if not req.x_col:
        return {"error": "x_col (étiquettes) requis pour le diagramme circulaire"}
    if req.y_cols and req.y_cols[0] in req.df.columns:
        y_col = req.y_cols[0]
        grouped = req.df.groupby(req.x_col)[y_col].agg(req.agg_fn).dropna().sort_values(ascending=False).head(req.top_n)
        total = grouped.sum()
        data = [
            {"name": str(k), "value": _safe_val(v), "percent": round(float(v / total * 100), 2) if total != 0 else 0}
            for k, v in grouped.items()
        ]
        return {**req.base_result, "data": data, "y_col": y_col, "total": _safe_val(total)}

    counts = req.df[req.x_col].dropna().value_counts().head(req.top_n)
    total = int(counts.sum())
    data = [
        {"name": str(k), "value": int(v), "percent": round(float(v / total * 100), 2) if total != 0 else 0}
        for k, v in counts.items()
    ]
    return {**req.base_result, "data": data, "total": total}


def _build_scatter_data(req: _ChartRequest) -> dict[str, Any]:
    if not req.x_col or len(req.y_cols) < 1:
        return {"error": f"x_col + au moins 1 y_col requis pour {req.chart_type}"}
    y_col = req.y_cols[0]
    cols_to_keep = [req.x_col, y_col]
    if req.color_col and req.color_col in req.df.columns:
        cols_to_keep.append(req.color_col)
    if req.size_col and req.size_col in req.df.columns:
        cols_to_keep.append(req.size_col)

    subset = req.df[cols_to_keep].dropna()
    if len(subset) > 1000:
        subset = subset.sample(n=1000, random_state=42)

    data_points = []
    for _, row in subset.iterrows():
        pt: dict[str, Any] = {"x": _safe_val(row[req.x_col]), "y": _safe_val(row[y_col])}
        if req.color_col:
            pt["color"] = _safe_val(row[req.color_col])
        if req.size_col:
            pt["size"] = _safe_val(row[req.size_col])
        data_points.append(pt)

    return {**req.base_result, "data": data_points, "y_col": y_col, "color_col": req.color_col, "size_col": req.size_col}


def _build_heatmap_data(req: _ChartRequest) -> dict[str, Any]:
    if not req.x_col or not req.y_cols:
        return {"error": "x_col et y_cols[0] requis pour la Heatmap"}
    y_col = req.y_cols[0]
    z_col = req.color_col or None
    if z_col and z_col in req.df.columns:
        pivot = req.df.pivot_table(index=y_col, columns=req.x_col, values=z_col, aggfunc=req.agg_fn).fillna(0)
    else:
        pivot = pd.crosstab(req.df[y_col], req.df[req.x_col]).fillna(0)
    pivot = pivot.iloc[:50, :50]
    return {
        **req.base_result,
        "y_col": y_col,
        "z_col": z_col,
        "x_labels": [str(c) for c in pivot.columns],
        "y_labels": [str(i) for i in pivot.index],
        "z_values": pivot.values.tolist(),
    }


def _build_radar_data(req: _ChartRequest) -> dict[str, Any]:
    if not req.x_col or len(req.y_cols) < 1:
        return {"error": "x_col (categories) et y_cols (mesures) requis pour Radar"}
    grouped = req.df.groupby(req.x_col, sort=True)[req.y_cols].agg(req.agg_fn).head(req.top_n)
    records = [{"x": str(idx), **{c: _safe_val(row[c]) for c in req.y_cols}} for idx, row in grouped.iterrows()]
    return {**req.base_result, "data": records, "series": req.y_cols}


def _build_grouped_categories(req: _ChartRequest, df_work: pd.DataFrame, x_work_col: str) -> dict[str, Any]:
    g_col = req.group_col or req.color_col
    if g_col and g_col in df_work.columns:
        pivot = df_work.pivot_table(index=x_work_col, columns=g_col, values=req.y_cols[0], aggfunc=req.agg_fn)
        pivot = pivot.head(req.top_n).fillna(0)
        records = [{"x": str(idx), **{str(c): _safe_val(row[c]) for c in pivot.columns}} for idx, row in pivot.iterrows()]
        return {**req.base_result, "data": records, "series": [str(c) for c in pivot.columns]}

    if req.sans_agregation:
        brut = df_work[[x_work_col] + req.y_cols].dropna().head(req.top_n)
        records = [{"x": str(row[x_work_col]), **{c: _safe_val(row[c]) for c in req.y_cols}} for _, row in brut.iterrows()]
        return {**req.base_result, "data": records, "series": req.y_cols}

    grouped = df_work.groupby(x_work_col, sort=True)[req.y_cols].agg(req.agg_fn).head(req.top_n)
    records = [{"x": str(idx), **{c: _safe_val(row[c]) for c in req.y_cols}} for idx, row in grouped.iterrows()]
    return {**req.base_result, "data": records, "series": req.y_cols}


def _build_continuous_series(req: _ChartRequest, df_work: pd.DataFrame, x_work_col: str) -> dict[str, Any]:
    g_col = req.group_col or req.color_col
    cols_to_keep = [x_work_col] + req.y_cols
    if g_col and g_col in req.df.columns:
        cols_to_keep.append(g_col)

    subset = df_work[cols_to_keep].dropna().sort_values(x_work_col)
    if len(subset) > 1000:
        subset = subset.iloc[:: max(1, len(subset) // 1000)]

    records = []
    for _, row in subset.iterrows():
        rec = {"x": _safe_val(row[x_work_col]), **{c: _safe_val(row[c]) for c in req.y_cols}}
        if g_col:
            rec["color"] = _safe_val(row[g_col])
        records.append(rec)

    if g_col:
        return {**req.base_result, "data": records, "series": [req.y_cols[0]], "color_col": g_col}
    return {**req.base_result, "data": records, "series": req.y_cols}


def build_chart_data(df: pd.DataFrame, chart_type: str = "auto", **opts: Any) -> dict:
    """Construit les données de graphique selon le type demandé."""
    aggregation = opts.get("aggregation", "mean")
    chart_type = _ALIASES.get(chart_type, chart_type)
    y_cols = opts.get("y_cols")
    if y_cols is None and opts.get("x_col") is None and chart_type == "auto":
        y_cols = df.select_dtypes(include="number").columns.tolist()[:1]
    req = _ChartRequest(
        df=df,
        chart_type=chart_type,
        x_col=opts.get("x_col"),
        y_cols=y_cols or [],
        group_col=opts.get("group_col"),
        aggregation=aggregation,
        agg_fn=_AGG_FUNCS.get(aggregation, "mean"),
        sans_agregation=str(aggregation).strip().lower() in ("none", "aucune", "raw", "brut"),
        top_n=opts.get("top_n", 20),
        time_granularity=opts.get("time_granularity"),
        color_col=opts.get("color_col"),
        size_col=opts.get("size_col"),
        base_result={},
    )
    if req.chart_type == "auto":
        req.chart_type = _infer_auto_chart_type(req)
    req.base_result = {
        "chart_type": req.chart_type,
        "x_col": req.x_col,
        "chart_title": opts.get("chart_title"),
        "log_y": bool(opts.get("log_y", False)),
    }

    if req.chart_type in ["raw_values", "box", "violin", "histogram"]:
        dist_res = _build_distribution_data(req)
        if dist_res is not None:
            return dist_res
    if req.chart_type == "pie":
        return _build_pie_data(req)
    if req.chart_type in ["scatter", "bubble"]:
        return _build_scatter_data(req)
    if req.chart_type == "heatmap":
        return _build_heatmap_data(req)
    if req.chart_type == "radar":
        return _build_radar_data(req)

    if not req.x_col or req.x_col not in df.columns:
        if len(req.y_cols) < 1:
            return {"error": "Au moins une variable Y valide est requise"}
        df_work = df.copy()
        df_work["__obs__"] = np.arange(1, len(df_work) + 1)
        x_work_col = "__obs__"
    else:
        df_work = df.copy()
        x_work_col = req.x_col
        if req.time_granularity in {"auto", "day", "month", "year"}:
            bucketed = _bucket_temporal(df_work[req.x_col], req.time_granularity)
            if bucketed is not None:
                df_work["__x_time_bucket__"] = bucketed
                x_work_col = "__x_time_bucket__"

    if not pd.api.types.is_numeric_dtype(df_work[x_work_col]) or df_work[x_work_col].nunique() <= 30:
        return _build_grouped_categories(req, df_work, x_work_col)
    return _build_continuous_series(req, df_work, x_work_col)


__all__ = [
    "build_chart_data",
    "_sanitize_for_json",
]
