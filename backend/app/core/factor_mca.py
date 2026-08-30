"""
Analyse des Correspondances Multiples (ACM) sur variables catégorielles.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from app.core.factor_serialization import _safe_float_val


def _compute_eta2(data: pd.DataFrame, ind_coords: np.ndarray, component_labels: list[str], variables: list[str]) -> dict:
    """Calcule le rapport de corrélation η² entre chaque variable et chaque axe."""
    result = {}
    n = len(data)
    for j, comp in enumerate(component_labels):
        coords = ind_coords[:min(n, len(ind_coords)), j]
        grand_mean = coords.mean()
        sst = ((coords - grand_mean) ** 2).sum()
        if sst == 0:
            result[comp] = {var: 0.0 for var in variables}
            continue
        comp_eta2 = {}
        for var in variables:
            groups = data[var].iloc[:len(coords)]
            ssb = 0
            for _, group_idx in groups.groupby(groups).groups.items():
                idx = [i for i in group_idx if i < len(coords)]
                if idx:
                    group_mean = coords[idx].mean()
                    ssb += len(idx) * (group_mean - grand_mean) ** 2
            comp_eta2[var] = round(float(ssb / sst), 6) if sst > 0 else 0.0
        result[comp] = comp_eta2
    return result


def run_mca(
    df: pd.DataFrame,
    columns: list[str] | None = None,
    n_components: int | None = None,
) -> dict:
    """
    Exécute une ACM (Analyse des Correspondances Multiples) sur des variables catégorielles.
    Utilise la méthode de Burt et la correction de Benzécri.
    """
    if columns:
        data = df[columns].copy()
    else:
        data = df.select_dtypes(include=["object", "category", "bool"]).copy()

    if data.shape[1] < 2:
        raise ValueError("L'ACM nécessite au moins 2 variables catégorielles")

    data = data.dropna()
    n_obs = len(data)
    if n_obs < 3:
        raise ValueError("Pas assez d'observations pour l'ACM")

    _MAX_ROWS_MCA = 5000
    sampled = False
    if n_obs > _MAX_ROWS_MCA:
        data = data.sample(n=_MAX_ROWS_MCA, random_state=42)
        n_obs = _MAX_ROWS_MCA
        sampled = True

    variables = data.columns.tolist()
    n_vars = len(variables)

    indicator = pd.get_dummies(data, prefix_sep=":::")
    Z = indicator.values.astype(float)
    modalities = indicator.columns.tolist()
    n_modalities = len(modalities)

    if n_components is None:
        n_components = min(n_modalities - n_vars, 10)
    n_components = max(1, min(n_components, n_modalities - n_vars, n_obs - 1))

    grand_total = Z.sum()
    P = Z / grand_total
    col_masses = P.sum(axis=0)

    Dc_inv_sqrt = np.diag(1.0 / np.sqrt(np.where(col_masses > 0, col_masses, 1)))
    row_masses_vec = P.sum(axis=1)
    Dr_inv_sqrt = np.diag(1.0 / np.sqrt(np.where(row_masses_vec > 0, row_masses_vec, 1)))

    S = Dr_inv_sqrt @ (P - np.outer(row_masses_vec, col_masses)) @ Dc_inv_sqrt
    U, sigma, Vt = np.linalg.svd(S, full_matrices=False)

    eigenvalues_all = sigma ** 2
    keep = min(n_components, len(eigenvalues_all))
    eigenvalues = eigenvalues_all[:keep]
    U = U[:, :keep]
    Vt = Vt[:keep, :]

    threshold = 1.0 / n_vars
    benzecri = np.array([(((e - threshold) / (1 - threshold)) ** 2) if e > threshold else 0 for e in eigenvalues])
    benzecri_total = benzecri.sum() if benzecri.sum() > 0 else 1
    explained_ratio = benzecri / benzecri_total
    cumulative = np.cumsum(explained_ratio)

    ind_coords = Dr_inv_sqrt @ U * sigma[:keep]
    mod_coords = Dc_inv_sqrt @ Vt[:keep, :].T * sigma[:keep]

    mod_contrib = np.zeros_like(mod_coords)
    for j in range(keep):
        if eigenvalues[j] > 0:
            mod_contrib[:, j] = (col_masses * mod_coords[:, j] ** 2) / eigenvalues[j] * 100

    mod_dist_sq = (mod_coords ** 2).sum(axis=1)
    mod_cos2 = mod_coords ** 2 / np.where(mod_dist_sq[:, np.newaxis] > 0, mod_dist_sq[:, np.newaxis], 1)

    component_labels = [f"Dim{i+1}" for i in range(keep)]

    modality_info = []
    for mod_name in modalities:
        parts = mod_name.split(":::", 1)
        var_name = parts[0] if len(parts) == 2 else mod_name
        mod_label = parts[1] if len(parts) == 2 else mod_name
        modality_info.append({"variable": var_name, "modality": mod_label, "full": mod_name})

    return {
        "method": "ACM",
        "n_observations": n_obs,
        "n_variables": n_vars,
        "n_modalities": n_modalities,
        "n_components": keep,
        "variables": variables,
        "component_labels": component_labels,
        "sampled": sampled,
        "eigenvalues": [_safe_float_val(e) for e in eigenvalues],
        "explained_variance_ratio": [_safe_float_val(v) for v in explained_ratio],
        "cumulative_variance": [_safe_float_val(v) for v in cumulative],
        "modality_info": modality_info,
        "modality_coords": {
            info["full"]: {comp: _safe_float_val(mod_coords[i, j]) for j, comp in enumerate(component_labels)}
            for i, info in enumerate(modality_info)
        },
        "modality_contrib": {
            info["full"]: {comp: _safe_float_val(mod_contrib[i, j]) for j, comp in enumerate(component_labels)}
            for i, info in enumerate(modality_info)
        },
        "modality_cos2": {
            info["full"]: {comp: _safe_float_val(mod_cos2[i, j]) for j, comp in enumerate(component_labels)}
            for i, info in enumerate(modality_info)
        },
        "individual_coords": [
            {comp: _safe_float_val(ind_coords[i, j]) for j, comp in enumerate(component_labels)}
            for i in range(min(n_obs, 500))
        ],
        "eta2": _compute_eta2(data, ind_coords, component_labels, variables),
    }
