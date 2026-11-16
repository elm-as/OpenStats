"""
Construction de données de visualisation et sérialisation pour les routes d'analyse.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from app.api.v1.analysis.chart_serialization import sanitize_for_json as _sanitize_for_json
from app.api.v1.analysis.chart_temporal_parser import (
    bucket_temporal as _bucket_temporal,
    parse_temporal_series as _parse_temporal_series,
    safe_val as _safe_val,
)


def build_chart_data(
    df: pd.DataFrame,
    chart_type: str,
    x_col: str | None,
    y_cols: list[str],
    group_col: str | None,
    aggregation: str,
    top_n: int,
    time_granularity: str | None = None,
    color_col: str | None = None,
    size_col: str | None = None,
    chart_title: str | None = None,
    log_y: bool = False,
) -> dict:
    """Construit les données de graphique selon le type demandé."""
    agg_funcs = {
        "mean": "mean", "sum": "sum", "count": "count",
        "median": "median", "min": "min", "max": "max",
    }
    agg_fn = agg_funcs.get(aggregation, "mean")
    sans_agregation = str(aggregation).strip().lower() in ("none", "aucune", "raw", "brut")

    aliases = {
        "boxplot": "box",
        "density": "histogram",
        "multi_line": "line",
        "multiline": "line",
    }
    chart_type = aliases.get(chart_type, chart_type)

    if chart_type == "auto":
        if not x_col or x_col not in df.columns:
            chart_type = "histogram" if len(y_cols) == 1 else "box"
        else:
            x_s = df[x_col].dropna()
            if pd.api.types.is_datetime64_any_dtype(x_s) or _parse_temporal_series(x_s).notna().mean() > 0.6:
                chart_type = "line"
            elif not pd.api.types.is_numeric_dtype(x_s) or x_s.nunique() <= 15:
                chart_type = "stacked_bar" if len(y_cols) > 1 else "bar"
            elif y_cols and pd.api.types.is_numeric_dtype(x_s):
                chart_type = "bubble" if color_col else "scatter"
            else:
                chart_type = "bar"

    base_result = {
        "chart_type": chart_type,
        "x_col": x_col,
        "chart_title": chart_title,
        "log_y": log_y,
    }

    if chart_type in ["raw_values", "box", "violin", "histogram"]:
        if not x_col or x_col not in df.columns:
            valid_cols = [c for c in y_cols if c in df.columns]
            if not valid_cols:
                return {"error": "Au moins une variable numérique valide est requise"}
            records = []
            for _, row in df[valid_cols].dropna(how="all").iterrows():
                rec = {}
                for c in valid_cols:
                    rec[c] = _safe_val(row[c])
                records.append(rec)
            return {**base_result, "data": records, "series": valid_cols}

    if chart_type == "pie":
        if not x_col:
            return {"error": "x_col (étiquettes) requis pour le diagramme circulaire"}
        if y_cols and len(y_cols) > 0 and y_cols[0] in df.columns:
            y_col = y_cols[0]
            grouped = df.groupby(x_col)[y_col].agg(agg_fn).dropna()
            grouped = grouped.sort_values(ascending=False).head(top_n)
            total = grouped.sum()
            data = []
            for k, v in grouped.items():
                pct = round(float(v / total * 100), 2) if total != 0 else 0
                data.append({"name": str(k), "value": _safe_val(v), "percent": pct})
            return {**base_result, "data": data, "y_col": y_col, "total": _safe_val(total)}
        else:
            col_data = df[x_col].dropna()
            counts = col_data.value_counts().head(top_n)
            total = int(counts.sum())
            data = []
            for k, v in counts.items():
                pct = round(float(v / total * 100), 2) if total != 0 else 0
                data.append({"name": str(k), "value": int(v), "percent": pct})
            return {**base_result, "data": data, "total": total}

    if chart_type in ["scatter", "bubble"]:
        if not x_col or len(y_cols) < 1:
            return {"error": f"x_col + au moins 1 y_col requis pour {chart_type}"}
        y_col = y_cols[0]

        cols_to_keep = [x_col, y_col]
        if color_col and color_col in df.columns:
            cols_to_keep.append(color_col)
        if size_col and size_col in df.columns:
            cols_to_keep.append(size_col)

        subset = df[cols_to_keep].dropna()
        if len(subset) > 1000:
            subset = subset.sample(n=1000, random_state=42)

        data_points = []
        for _, row in subset.iterrows():
            pt = {"x": _safe_val(row[x_col]), "y": _safe_val(row[y_col])}
            if color_col:
                pt["color"] = _safe_val(row[color_col])
            if size_col:
                pt["size"] = _safe_val(row[size_col])
            data_points.append(pt)

        return {**base_result, "data": data_points, "y_col": y_col, "color_col": color_col, "size_col": size_col}

    if chart_type == "heatmap":
        if not x_col or not y_cols:
            return {"error": "x_col et y_cols[0] requis pour la Heatmap"}
        y_col = y_cols[0]
        z_col = color_col if color_col else None

        if z_col and z_col in df.columns:
            pivot = df.pivot_table(index=y_col, columns=x_col, values=z_col, aggfunc=agg_fn).fillna(0)
        else:
            pivot = pd.crosstab(df[y_col], df[x_col]).fillna(0)

        pivot = pivot.iloc[:50, :50]

        return {
            **base_result,
            "y_col": y_col,
            "z_col": z_col,
            "x_labels": [str(c) for c in pivot.columns],
            "y_labels": [str(i) for i in pivot.index],
            "z_values": pivot.values.tolist(),
        }

    if chart_type == "radar":
        if not x_col or len(y_cols) < 1:
            return {"error": "x_col (categories) et y_cols (mesures) requis pour Radar"}

        grouped = df.groupby(x_col, sort=True)[y_cols].agg(agg_fn).head(top_n)
        records = []
        for idx, row in grouped.iterrows():
            rec = {"x": str(idx)}
            for c in y_cols:
                rec[c] = _safe_val(row[c])
            records.append(rec)
        return {**base_result, "data": records, "series": y_cols}

    if not x_col or x_col not in df.columns:
        if len(y_cols) < 1:
            return {"error": "Au moins une variable Y valide est requise"}
        df_work = df.copy()
        df_work["__obs__"] = np.arange(1, len(df_work) + 1)
        x_work_col = "__obs__"
    else:
        x_work_col = x_col
        df_work = df.copy()
        if time_granularity in {"auto", "day", "month", "year"}:
            bucketed = _bucket_temporal(df_work[x_col], time_granularity)
            if bucketed is not None:
                df_work["__x_time_bucket__"] = bucketed
                x_work_col = "__x_time_bucket__"

    g_col = group_col or color_col

    if not pd.api.types.is_numeric_dtype(df_work[x_work_col]) or df_work[x_work_col].nunique() <= 30:
        if g_col and g_col in df_work.columns:
            pivot = df_work.pivot_table(index=x_work_col, columns=g_col, values=y_cols[0], aggfunc=agg_fn)
            pivot = pivot.head(top_n).fillna(0)
            records = []
            for idx, row in pivot.iterrows():
                rec = {"x": str(idx)}
                for c in pivot.columns:
                    rec[str(c)] = _safe_val(row[c])
                records.append(rec)
            series_keys = [str(c) for c in pivot.columns]
        elif sans_agregation:
            brut = df_work[[x_work_col] + y_cols].dropna().head(top_n)
            records = []
            for _, row in brut.iterrows():
                rec = {"x": str(row[x_work_col])}
                for c in y_cols:
                    rec[c] = _safe_val(row[c])
                records.append(rec)
            series_keys = y_cols
        else:
            grouped = df_work.groupby(x_work_col, sort=True)[y_cols].agg(agg_fn).head(top_n)
            records = []
            for idx, row in grouped.iterrows():
                rec = {"x": str(idx)}
                for c in y_cols:
                    rec[c] = _safe_val(row[c])
                records.append(rec)
            series_keys = y_cols
    else:
        cols_to_keep = [x_work_col] + y_cols
        if g_col and g_col in df.columns:
            cols_to_keep.append(g_col)

        subset = df_work[cols_to_keep].dropna().sort_values(x_work_col)

        if len(subset) > 1000:
            subset = subset.iloc[::max(1, len(subset) // 1000)]

        records = []
        for _, row in subset.iterrows():
            rec = {"x": _safe_val(row[x_work_col])}
            for c in y_cols:
                rec[c] = _safe_val(row[c])
            if g_col:
                rec["color"] = _safe_val(row[g_col])
            records.append(rec)

        if g_col:
            series_keys = [y_cols[0]]
            return {**base_result, "data": records, "series": series_keys, "color_col": g_col}
        else:
            series_keys = y_cols

    return {**base_result, "data": records, "series": series_keys}


__all__ = [
    "build_chart_data",
    "_sanitize_for_json",
]
