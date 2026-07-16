"""
Utilitaires partagés entre les modules de routes d'analyse.
"""

import re
import numpy as np
import pandas as pd


# ── Sérialisation JSON ────────────────────────────────────────────────

def _sanitize_for_json(obj, _depth=0):
    """Récursivement nettoie un objet pour le rendre JSON-sérialisable."""
    if _depth > 12:
        return str(obj)
    if obj is None or isinstance(obj, (bool, str)):
        return obj
    if isinstance(obj, int):
        return obj
    if isinstance(obj, float):
        return None if (np.isnan(obj) or np.isinf(obj)) else obj
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        v = float(obj)
        return None if (np.isnan(v) or np.isinf(v)) else v
    import datetime as dt
    if isinstance(obj, (dt.datetime, dt.date)):
        return obj.isoformat()
    if hasattr(obj, "to_dict"):
        return _sanitize_for_json(obj.to_dict(), _depth + 1)
    if hasattr(obj, "__dataclass_fields__"):
        d = {}
        for f in obj.__dataclass_fields__:
            d[f] = getattr(obj, f)
        return _sanitize_for_json(d, _depth + 1)
    if isinstance(obj, np.ndarray):
        return _sanitize_for_json(obj.tolist(), _depth + 1)
    if isinstance(obj, dict):
        return {k: _sanitize_for_json(v, _depth + 1) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_sanitize_for_json(v, _depth + 1) for v in obj]
    try:
        import json
        json.dumps(obj)
        return obj
    except (TypeError, ValueError):
        return None


# ── Construction de graphiques ────────────────────────────────────────

def _normalize_french_date_text(value: str) -> str:
    s = value.strip().lower()
    s = re.sub(r"^(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\\s+", "", s)
    months = {
        "janvier": "january", "fevrier": "february", "février": "february",
        "mars": "march", "avril": "april", "mai": "may", "juin": "june",
        "juillet": "july", "aout": "august", "août": "august",
        "septembre": "september", "octobre": "october", "novembre": "november",
        "decembre": "december", "décembre": "december",
    }
    for fr, en in months.items():
        s = re.sub(rf"\\b{re.escape(fr)}\\b", en, s)
    return s


def _parse_temporal_series(series: pd.Series) -> pd.Series:
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
    year_mask = text_vals.str.match(r"^\\d{4}$")
    if not year_mask.empty and year_mask.mean() > 0.9:
        parsed.loc[text_vals.index] = pd.to_datetime(text_vals, format="%Y", errors="coerce")
        return parsed

    dm_pattern = r"^(\\d{1,2})[/-](\\d{1,2})[/-](\\d{2,4})$"
    dm_extract = text_vals.str.extract(dm_pattern)
    d_gt_12 = pd.to_numeric(dm_extract[0], errors="coerce") > 12
    m_gt_12 = pd.to_numeric(dm_extract[1], errors="coerce") > 12
    prefer_dayfirst = d_gt_12.sum() >= m_gt_12.sum()

    normalized = text_vals.apply(_normalize_french_date_text)
    candidates: list[pd.Series] = [
        pd.to_datetime(normalized, errors="coerce", format="mixed", dayfirst=prefer_dayfirst),
        pd.to_datetime(text_vals, errors="coerce", format="mixed", dayfirst=prefer_dayfirst),
        pd.to_datetime(normalized, errors="coerce", dayfirst=prefer_dayfirst),
        pd.to_datetime(text_vals, errors="coerce", dayfirst=prefer_dayfirst),
        pd.to_datetime(normalized, errors="coerce", format="mixed", dayfirst=not prefer_dayfirst),
        pd.to_datetime(text_vals, errors="coerce", format="mixed", dayfirst=not prefer_dayfirst),
        pd.to_datetime(normalized, errors="coerce", dayfirst=not prefer_dayfirst),
        pd.to_datetime(text_vals, errors="coerce", dayfirst=not prefer_dayfirst),
    ]

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


def _bucket_temporal(x_series: pd.Series, granularity: str) -> "pd.Series | None":
    parsed = _parse_temporal_series(x_series)
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


def _safe_val(v):
    if v is None or (isinstance(v, float) and (np.isnan(v) or np.isinf(v))):
        return None
    if isinstance(v, (np.integer, np.int64)):
        return int(v)
    if isinstance(v, (np.floating, np.float64)):
        return round(float(v), 4)
    return v


def build_chart_data(
    df: pd.DataFrame,
    chart_type: str,
    x_col: "str | None",
    y_cols: list[str],
    group_col: "str | None",
    aggregation: str,
    top_n: int,
    time_granularity: "str | None" = None,
    color_col: "str | None" = None,
    size_col: "str | None" = None,
    chart_title: "str | None" = None,
    log_y: bool = False,
) -> dict:
    """Construit les données de graphique selon le type demandé."""
    agg_funcs = {
        "mean": "mean", "sum": "sum", "count": "count",
        "median": "median", "min": "min", "max": "max",
    }
    agg_fn = agg_funcs.get(aggregation, "mean")

    base_result = {
        "chart_type": chart_type,
        "x_col": x_col,
        "chart_title": chart_title,
        "log_y": log_y,
    }

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
        if color_col and color_col in df.columns: cols_to_keep.append(color_col)
        if size_col and size_col in df.columns: cols_to_keep.append(size_col)
        
        subset = df[cols_to_keep].dropna()
        if len(subset) > 1000:
            subset = subset.sample(n=1000, random_state=42)
            
        data_points = []
        for _, row in subset.iterrows():
            pt = {"x": _safe_val(row[x_col]), "y": _safe_val(row[y_col])}
            if color_col: pt["color"] = _safe_val(row[color_col])
            if size_col: pt["size"] = _safe_val(row[size_col])
            data_points.append(pt)
            
        return {**base_result, "data": data_points, "y_col": y_col, "color_col": color_col, "size_col": size_col}

    if chart_type == "heatmap":
        if not x_col or not y_cols:
            return {"error": "x_col et y_cols[0] requis pour la Heatmap"}
        y_col = y_cols[0]
        z_col = color_col if color_col else None
        
        # S'il y a un z_col, on fait un pivot_table, sinon on compte les occurrences (crosstab)
        if z_col and z_col in df.columns:
            pivot = df.pivot_table(index=y_col, columns=x_col, values=z_col, aggfunc=agg_fn).fillna(0)
        else:
            pivot = pd.crosstab(df[y_col], df[x_col]).fillna(0)
            
        # Limiter à 50x50 pour l'affichage web
        pivot = pivot.iloc[:50, :50]
        
        return {
            **base_result,
            "y_col": y_col,
            "z_col": z_col,
            "x_labels": [str(c) for c in pivot.columns],
            "y_labels": [str(i) for i in pivot.index],
            "z_values": pivot.values.tolist()
        }

    if chart_type == "radar":
        # Radar charts typiquement utilisent une categorie en X et plusieurs mesures numériques en Y_cols
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

    if not x_col or len(y_cols) < 1:
        return {"error": "x_col et y_cols requis"}

    x_work_col = x_col
    df_work = df.copy()
    if time_granularity in {"auto", "day", "month", "year"}:
        bucketed = _bucket_temporal(df_work[x_col], time_granularity)
        if bucketed is not None:
            df_work["__x_time_bucket__"] = bucketed
            x_work_col = "__x_time_bucket__"

    # group_col mapping to color_col for backward compatibility
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
        # Optimisation pour les grandes séries temporelles ou numériques
        cols_to_keep = [x_work_col] + y_cols
        if g_col and g_col in df.columns: cols_to_keep.append(g_col)
        
        subset = df_work[cols_to_keep].dropna().sort_values(x_work_col)
        
        if len(subset) > 1000:
            # Pour préserver la distribution, on fait un échantillonnage statique ou on downsample
            subset = subset.iloc[::max(1, len(subset) // 1000)]
            
        records = []
        for _, row in subset.iterrows():
            rec = {"x": _safe_val(row[x_work_col])}
            for c in y_cols:
                rec[c] = _safe_val(row[c])
            if g_col:
                rec["color"] = _safe_val(row[g_col])
            records.append(rec)
        
        # Si on a groupé par couleur, on renvoie une seule série (la première de y_cols) mais avec une propriété 'color'
        if g_col:
            series_keys = [y_cols[0]]
            return {**base_result, "data": records, "series": series_keys, "color_col": g_col}
        else:
            series_keys = y_cols

    return {**base_result, "data": records, "series": series_keys}

