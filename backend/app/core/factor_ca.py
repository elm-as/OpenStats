"""
Analyse Factorielle des Correspondances (AFC) sur tableaux de contingence.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from app.core.factor_serialization import _safe_float_val


def run_ca(
    df: pd.DataFrame,
    row_col: str,
    col_col: str,
    n_components: int | None = None,
) -> dict:
    """
    Exécute une AFC sur un tableau de contingence entre deux colonnes catégorielles.
    """
    if row_col not in df.columns or col_col not in df.columns:
        raise ValueError(f"Colonnes introuvables : {row_col}, {col_col}")

    contingency = pd.crosstab(df[row_col], df[col_col])
    if contingency.shape[0] < 2 or contingency.shape[1] < 2:
        raise ValueError("Le tableau de contingence doit avoir au moins 2 lignes et 2 colonnes")

    N = contingency.values.astype(float)
    grand_total = N.sum()
    if grand_total == 0:
        raise ValueError("Tableau de contingence vide")

    n_rows, n_cols = N.shape
    row_labels = [str(x) for x in contingency.index.tolist()]
    col_labels = [str(x) for x in contingency.columns.tolist()]

    if n_components is None:
        n_components = min(n_rows, n_cols) - 1
    n_components = max(1, min(n_components, n_rows - 1, n_cols - 1))

    P = N / grand_total
    row_masses = P.sum(axis=1)
    col_masses = P.sum(axis=0)

    Dr_inv_sqrt = np.diag(1.0 / np.sqrt(row_masses))
    Dc_inv_sqrt = np.diag(1.0 / np.sqrt(col_masses))

    S = Dr_inv_sqrt @ (P - np.outer(row_masses, col_masses)) @ Dc_inv_sqrt
    U, sigma, Vt = np.linalg.svd(S, full_matrices=False)

    sigma = sigma[:n_components]
    U = U[:, :n_components]
    Vt = Vt[:n_components, :]

    eigenvalues = sigma ** 2
    explained_ratio = eigenvalues / (eigenvalues.sum() if eigenvalues.sum() > 0 else 1)
    cumulative = np.cumsum(explained_ratio)

    row_coords = Dr_inv_sqrt @ U * sigma
    col_coords = Dc_inv_sqrt @ Vt.T * sigma

    row_contrib = np.zeros_like(row_coords)
    for j in range(n_components):
        if eigenvalues[j] > 0:
            row_contrib[:, j] = (row_masses * row_coords[:, j] ** 2) / eigenvalues[j] * 100

    col_contrib = np.zeros_like(col_coords)
    for j in range(n_components):
        if eigenvalues[j] > 0:
            col_contrib[:, j] = (col_masses * col_coords[:, j] ** 2) / eigenvalues[j] * 100

    row_dist_sq = (row_coords ** 2).sum(axis=1)
    row_cos2 = row_coords ** 2 / row_dist_sq[:, np.newaxis]
    np.nan_to_num(row_cos2, copy=False)

    col_dist_sq = (col_coords ** 2).sum(axis=1)
    col_cos2 = col_coords ** 2 / col_dist_sq[:, np.newaxis]
    np.nan_to_num(col_cos2, copy=False)

    component_labels = [f"Dim{i+1}" for i in range(n_components)]

    return {
        "method": "AFC",
        "row_variable": row_col,
        "col_variable": col_col,
        "n_rows": n_rows,
        "n_cols": n_cols,
        "n_components": int(n_components),
        "total_inertia": _safe_float_val(float(eigenvalues.sum())),
        "component_labels": component_labels,
        "eigenvalues": [_safe_float_val(e) for e in eigenvalues],
        "explained_variance_ratio": [_safe_float_val(v) for v in explained_ratio],
        "cumulative_variance": [_safe_float_val(v) for v in cumulative],
        "contingency_table": {
            "rows": row_labels,
            "cols": col_labels,
            "values": N.tolist(),
        },
        "row_coords": {
            label: {comp: _safe_float_val(row_coords[i, j]) for j, comp in enumerate(component_labels)}
            for i, label in enumerate(row_labels)
        },
        "col_coords": {
            label: {comp: _safe_float_val(col_coords[i, j]) for j, comp in enumerate(component_labels)}
            for i, label in enumerate(col_labels)
        },
        "row_contrib": {
            label: {comp: _safe_float_val(row_contrib[i, j]) for j, comp in enumerate(component_labels)}
            for i, label in enumerate(row_labels)
        },
        "col_contrib": {
            label: {comp: _safe_float_val(col_contrib[i, j]) for j, comp in enumerate(component_labels)}
            for i, label in enumerate(col_labels)
        },
        "row_cos2": {
            label: {comp: _safe_float_val(row_cos2[i, j]) for j, comp in enumerate(component_labels)}
            for i, label in enumerate(row_labels)
        },
        "col_cos2": {
            label: {comp: _safe_float_val(col_cos2[i, j]) for j, comp in enumerate(component_labels)}
            for i, label in enumerate(col_labels)
        },
    }
