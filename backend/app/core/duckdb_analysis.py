"""
Module d'analyse via DuckDB pour l'optimisation de la mémoire.
Permet d'effectuer les statistiques descriptives sans charger le DataFrame dans Pandas.
"""

from __future__ import annotations

import duckdb
import pandas as pd
from typing import Any


def _sf(val: Any) -> float | None:
    if val is None or pd.isna(val):
        return None
    try:
        return round(float(val), 4)
    except (ValueError, TypeError):
        return None


def compute_descriptive_stats_duckdb(parquet_path: str, columns_info: list[dict]) -> dict[str, Any]:
    """
    Calcule les statistiques descriptives pour chaque variable via DuckDB.
    columns_info: liste de dicts contenant {"name": "col_name", "type": "numeric" ou "categorical"}
    """
    results = {}
    
    # Ouvrir la connexion DuckDB
    conn = duckdb.connect(database=':memory:')
    
    # Créer une vue
    conn.execute(f"CREATE VIEW ds AS SELECT * FROM '{parquet_path}'")
    
    # Récupérer le nombre total de lignes
    total_rows = conn.execute("SELECT count(*) FROM ds").fetchone()[0]
    
    for col_info in columns_info:
        col = col_info["name"]
        col_type = col_info["type"]
        
        # Sécuriser le nom de la colonne avec des guillemets
        safe_col = f'"{col}"'
        
        if col_type == "numeric":
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
            try:
                row = conn.execute(query).fetchone()
                count, mean, median, std, variance, min_val, max_val, q1, q3, skewness, kurtosis, null_count = row
                
                null_count = int(null_count) if null_count is not None else 0
                null_rate = null_count / total_rows if total_rows > 0 else 0
                
                # Mode numÃ©rique
                mode_query = f"SELECT {safe_col} FROM ds WHERE {safe_col} IS NOT NULL GROUP BY {safe_col} ORDER BY count(*) DESC LIMIT 1"
                mode_row = conn.execute(mode_query).fetchone()
                mode_val = mode_row[0] if mode_row else None
                
                results[col] = {
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
            except Exception as e:
                pass
                
        else:
            query = f"""
            SELECT 
                count({safe_col}) as count,
                count(distinct {safe_col}) as cardinality,
                sum(case when {safe_col} is null then 1 else 0 end) as null_count
            FROM ds
            """
            try:
                row = conn.execute(query).fetchone()
                count, cardinality, null_count = row
                null_count = int(null_count) if null_count is not None else 0
                null_rate = null_count / total_rows if total_rows > 0 else 0
                
                # Top values and mode
                top_query = f"SELECT {safe_col}, count(*) as freq FROM ds WHERE {safe_col} IS NOT NULL GROUP BY {safe_col} ORDER BY freq DESC LIMIT 10"
                top_rows = conn.execute(top_query).fetchall()
                
                top_values = {str(k): int(v) for k, v in top_rows}
                mode_val = str(top_rows[0][0]) if top_rows else None
                mode_freq = int(top_rows[0][1]) if top_rows else 0
                
                results[col] = {
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
            except Exception as e:
                pass
                
    conn.close()
    return results
