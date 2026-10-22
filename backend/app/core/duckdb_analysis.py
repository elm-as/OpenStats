"""
Module d'analyse via DuckDB pour l'optimisation de la mémoire.
Permet d'effectuer les statistiques descriptives sans charger le DataFrame dans Pandas.
Garantit la libération systématique des connexions et la protection contre l'injection SQL.
"""

from __future__ import annotations

import logging
import os
from typing import Any
import duckdb
import pandas as pd

logger = logging.getLogger(__name__)


def _sf(val: Any) -> float | None:
    if val is None or pd.isna(val):
        return None
    try:
        return round(float(val), 4)
    except (ValueError, TypeError):
        return None


def _escape_col(col_name: str) -> str:
    """Échappe le nom de colonne pour l'injecter sans risque comme identifiant SQL."""
    escaped = col_name.replace('"', '""')
    return f'"{escaped}"'


def _compute_numeric_col(conn: Any, safe_col: str, col: str, total_rows: int) -> dict[str, Any] | None:
    """Calcule les statistiques descriptives d'une variable numérique."""
    query = f"""
    SELECT 
        count({safe_col}) as count,
        avg({safe_col}) as mean,
        median({safe_col}) as median,
        stddev_samp({safe_col}) as std,
        var_samp({safe_col}) as variance,
        min({safe_col}) as min,
        max({safe_col}) as max,
        quantile_cont({safe_col}, 0.25) as q1,
        quantile_cont({safe_col}, 0.75) as q3,
        skewness({safe_col}) as skewness,
        kurtosis({safe_col}) as kurtosis,
        sum(case when {safe_col} is null then 1 else 0 end) as null_count
    FROM ds
    """
    row = conn.execute(query).fetchone()
    if not row:
        return None

    count, mean, median, std, variance, min_val, max_val, q1, q3, skewness, kurtosis, null_count = row
    null_count = int(null_count) if null_count is not None else 0
    null_rate = null_count / total_rows if total_rows > 0 else 0

    mode_query = f"SELECT {safe_col} FROM ds WHERE {safe_col} IS NOT NULL GROUP BY {safe_col} ORDER BY count(*) DESC LIMIT 1"
    mode_row = conn.execute(mode_query).fetchone()
    mode_val = mode_row[0] if mode_row else None

    return {
        "name": col,
        "type": "numeric",
        "count": int(count) if count is not None else 0,
        "mean": _sf(mean),
        "median": _sf(median),
        "mode": _sf(mode_val),
        "std": _sf(std),
        "variance": _sf(variance),
        "min": _sf(min_val),
        "max": _sf(max_val),
        "range": _sf(max_val - min_val) if max_val is not None and min_val is not None else None,
        "q1": _sf(q1),
        "q3": _sf(q3),
        "iqr": _sf(q3 - q1) if q3 is not None and q1 is not None else None,
        "cv": _sf((std / mean) * 100) if mean and mean != 0 and std else None,
        "skewness": _sf(skewness),
        "kurtosis": _sf(kurtosis),
        "null_count": null_count,
        "null_rate": _sf(null_rate),
    }


def _compute_temporal_col(conn: Any, safe_col: str, col: str, total_rows: int) -> dict[str, Any] | None:
    """Calcule les statistiques d'une variable temporelle."""
    query = f"""
    SELECT 
        count({safe_col}) as count,
        min({safe_col}) as min_val,
        max({safe_col}) as max_val,
        count(distinct {safe_col}) as periods_count,
        sum(case when {safe_col} is null then 1 else 0 end) as null_count
    FROM ds
    """
    row = conn.execute(query).fetchone()
    if not row:
        return None

    count, min_val, max_val, periods_count, null_count = row
    null_count = int(null_count) if null_count is not None else 0
    null_rate = null_count / total_rows if total_rows > 0 else 0

    return {
        "name": col,
        "type": "temporal",
        "count": int(count) if count is not None else 0,
        "min": str(min_val) if min_val is not None else None,
        "max": str(max_val) if max_val is not None else None,
        "periods_count": int(periods_count) if periods_count is not None else 0,
        "null_count": null_count,
        "null_rate": _sf(null_rate),
    }


def _compute_id_col(conn: Any, safe_col: str, col: str, total_rows: int) -> dict[str, Any] | None:
    """Calcule les statistiques d'une variable identifiant."""
    query = f"""
    SELECT 
        count({safe_col}) as count,
        count(distinct {safe_col}) as cardinality,
        sum(case when {safe_col} is null then 1 else 0 end) as null_count
    FROM ds
    """
    row = conn.execute(query).fetchone()
    if not row:
        return None

    count, cardinality, null_count = row
    null_count = int(null_count) if null_count is not None else 0
    null_rate = null_count / total_rows if total_rows > 0 else 0
    cardinality = int(cardinality) if cardinality is not None else 0

    return {
        "name": col,
        "type": "id",
        "count": int(count) if count is not None else 0,
        "cardinality": cardinality,
        "uniqueness_rate": _sf(cardinality / total_rows) if total_rows > 0 else 0,
        "null_count": null_count,
        "null_rate": _sf(null_rate),
    }


def _compute_categorical_col(conn: Any, safe_col: str, col: str, total_rows: int) -> dict[str, Any] | None:
    """Calcule les statistiques d'une variable catégorielle."""
    query = f"""
    SELECT 
        count({safe_col}) as count,
        count(distinct {safe_col}) as cardinality,
        sum(case when {safe_col} is null then 1 else 0 end) as null_count
    FROM ds
    """
    row = conn.execute(query).fetchone()
    if not row:
        return None

    count, cardinality, null_count = row
    null_count = int(null_count) if null_count is not None else 0
    null_rate = null_count / total_rows if total_rows > 0 else 0

    top_query = f"SELECT {safe_col}, count(*) as freq FROM ds WHERE {safe_col} IS NOT NULL GROUP BY {safe_col} ORDER BY freq DESC LIMIT 10"
    top_rows = conn.execute(top_query).fetchall()

    top_values = {str(k): int(v) for k, v in top_rows}
    mode_val = str(top_rows[0][0]) if top_rows else None
    mode_freq = int(top_rows[0][1]) if top_rows else 0

    return {
        "name": col,
        "type": "categorical",
        "count": int(count) if count is not None else 0,
        "cardinality": int(cardinality) if cardinality is not None else 0,
        "mode": mode_val,
        "mode_frequency": mode_freq,
        "top_values": top_values,
        "null_count": null_count,
        "null_rate": _sf(null_rate),
    }


def compute_descriptive_stats_duckdb(parquet_path: str, columns_info: list[dict[str, str]]) -> dict[str, Any]:
    """
    Calcule les statistiques descriptives pour chaque variable via DuckDB.
    Garantit la fermeture de connexion et la sécurité SQL.
    """
    if not os.path.exists(parquet_path):
        raise FileNotFoundError(f"Fichier Parquet introuvable : '{parquet_path}'")

    results: dict[str, Any] = {}
    conn = duckdb.connect(database=":memory:")

    try:
        escaped_path = parquet_path.replace("'", "''")
        conn.execute(f"CREATE VIEW ds AS SELECT * FROM read_parquet('{escaped_path}')")
        total_rows = conn.execute("SELECT count(*) FROM ds").fetchone()[0]

        for col_info in columns_info:
            col = col_info["name"]
            col_type = col_info["type"]
            safe_col = _escape_col(col)

            try:
                if col_type == "numeric":
                    stat = _compute_numeric_col(conn, safe_col, col, total_rows)
                elif col_type in ("temporal", "date", "datetime"):
                    stat = _compute_temporal_col(conn, safe_col, col, total_rows)
                elif col_type == "id":
                    stat = _compute_id_col(conn, safe_col, col, total_rows)
                else:
                    stat = _compute_categorical_col(conn, safe_col, col, total_rows)

                if stat:
                    results[col] = stat
            except Exception as exc:
                logger.warning("Échec du calcul DuckDB sur la colonne '%s' (%s) : %s", col, col_type, exc)
    finally:
        conn.close()

    return results
