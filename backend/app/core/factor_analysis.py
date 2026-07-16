"""
Module d'analyse factorielle : ACP, AFC, ACM.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from typing import Any


# ── ACP (Analyse en Composantes Principales) ─────────────────────────

def run_pca(df: pd.DataFrame, columns: list[str] | None = None, n_components: int | None = None) -> dict:
    """
    Exécute une ACP sur les colonnes numériques sélectionnées.
    Retourne valeurs propres, variance expliquée, coordonnées, contributions, corrélations.
    """
    if columns:
        data = df[columns].select_dtypes(include=[np.number]).dropna()
    else:
        data = df.select_dtypes(include=[np.number]).dropna()

    if data.shape[1] < 2:
        raise ValueError("L'ACP nécessite au moins 2 variables numériques")

    variables = data.columns.tolist()
    n_obs, n_vars = data.shape

    # Standardisation (nécessaire avant calcul des valeurs propres pour Kaiser)
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(data)

    # Matrice de corrélation
    corr_matrix = np.corrcoef(X_scaled, rowvar=False)

    # Calcul de toutes les valeurs propres pour la sélection automatique
    all_eigenvalues = np.sort(np.linalg.eigvalsh(corr_matrix))[::-1]

    auto_selection = None
    if n_components is None:
        # Critère de Kaiser : garder les composantes avec valeur propre > 1
        kaiser_count = int(np.sum(all_eigenvalues > 1.0))
        # Alternative : expliquer ≥ 80% de la variance
        cumvar = np.cumsum(all_eigenvalues / all_eigenvalues.sum())
        variance_80_count = int(np.argmax(cumvar >= 0.80)) + 1
        # Prendre le max des deux critères, minimum 2, maximum n_vars
        n_components = max(2, min(kaiser_count, n_vars, n_obs))
        auto_selection = {
            "method": "kaiser",
            "kaiser_count": kaiser_count,
            "variance_80_count": variance_80_count,
            "selected": n_components,
            "reason": f"Kaiser : {kaiser_count} composante(s) avec λ > 1"
                if kaiser_count >= 2
                else f"Minimum de 2 composantes (Kaiser suggère {kaiser_count})",
        }
    n_components = min(n_components, n_vars, n_obs)

    # Décomposition en valeurs propres
    eigenvalues, eigenvectors = np.linalg.eigh(corr_matrix)

    # Trier par ordre décroissant
    idx = np.argsort(eigenvalues)[::-1]
    eigenvalues = eigenvalues[idx][:n_components]
    eigenvectors = eigenvectors[:, idx][:, :n_components]

    # Variance expliquée
    total_var = eigenvalues.sum() if eigenvalues.sum() > 0 else 1
    explained_variance_ratio = eigenvalues / corr_matrix.shape[0]  # Sur total des valeurs propres
    total_eigenvalues = all_eigenvalues
    explained_variance_ratio = eigenvalues / total_eigenvalues.sum()
    cumulative_variance = np.cumsum(explained_variance_ratio)

    # Coordonnées des individus (scores)
    scores = X_scaled @ eigenvectors

    # Coordonnées des variables (loadings = corrélations variables/composantes)
    loadings = eigenvectors * np.sqrt(eigenvalues)

    # Contributions des individus (en %)
    scores_sq = scores ** 2
    contrib_ind = scores_sq / scores_sq.sum(axis=0) * 100

    # Contributions des variables (en %)
    loadings_sq = loadings ** 2
    contrib_var = loadings_sq / loadings_sq.sum(axis=0) * 100

    # Qualité de représentation (cos²) des individus
    dist_sq = (X_scaled ** 2).sum(axis=1)
    cos2_ind = scores ** 2 / dist_sq[:, np.newaxis]

    # Qualité de représentation (cos²) des variables
    cos2_var = loadings ** 2

    def _safe(v):
        if isinstance(v, (np.floating, float)):
            if np.isnan(v) or np.isinf(v):
                return None
            return round(float(v), 6)
        if isinstance(v, (np.integer, int)):
            return int(v)
        return v

    component_labels = [f"CP{i+1}" for i in range(n_components)]

    return {
        "method": "ACP",
        "n_observations": n_obs,
        "n_variables": n_vars,
        "n_components": int(n_components),
        "variables": variables,
        "component_labels": component_labels,
        "eigenvalues": [_safe(e) for e in eigenvalues],
        "explained_variance_ratio": [_safe(v) for v in explained_variance_ratio],
        "cumulative_variance": [_safe(v) for v in cumulative_variance],
        "loadings": {
            var: {comp: _safe(loadings[i, j]) for j, comp in enumerate(component_labels)}
            for i, var in enumerate(variables)
        },
        "scores": [
            {comp: _safe(scores[i, j]) for j, comp in enumerate(component_labels)}
            for i in range(min(n_obs, 500))  # Limiter pour la sérialisation
        ],
        "contrib_var": {
            var: {comp: _safe(contrib_var[i, j]) for j, comp in enumerate(component_labels)}
            for i, var in enumerate(variables)
        },
        "cos2_var": {
            var: {comp: _safe(cos2_var[i, j]) for j, comp in enumerate(component_labels)}
            for i, var in enumerate(variables)
        },
        "contrib_ind_summary": {
            comp: {
                "mean": _safe(contrib_ind[:, j].mean()),
                "max": _safe(contrib_ind[:, j].max()),
                "top_5": sorted(
                    [{"index": int(k), "value": _safe(contrib_ind[k, j])}
                     for k in range(min(n_obs, 500))],
                    key=lambda x: x["value"] or 0, reverse=True,
                )[:5],
            }
            for j, comp in enumerate(component_labels)
        },
        "correlation_circle": {
            var: {"x": _safe(loadings[i, 0]), "y": _safe(loadings[i, 1]) if n_components >= 2 else 0}
            for i, var in enumerate(variables)
        },
        "auto_selection": auto_selection,
    }


# ── AFC (Analyse Factorielle des Correspondances) ────────────────────

def run_ca(df: pd.DataFrame, row_col: str, col_col: str, n_components: int | None = None) -> dict:
    """
    Exécute une AFC (Analyse Factorielle des Correspondances) sur un tableau de contingence.
    row_col et col_col sont deux colonnes catégorielles du DataFrame.
    """
    if row_col not in df.columns or col_col not in df.columns:
        raise ValueError(f"Colonnes introuvables : {row_col}, {col_col}")

    # Construire le tableau de contingence
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

    # Profils
    P = N / grand_total  # Matrice des fréquences relatives
    row_masses = P.sum(axis=1)  # Masses des lignes
    col_masses = P.sum(axis=0)  # Masses des colonnes

    # Matrice centrée réduite pour la SVD
    Dr_inv_sqrt = np.diag(1.0 / np.sqrt(row_masses))
    Dc_inv_sqrt = np.diag(1.0 / np.sqrt(col_masses))

    S = Dr_inv_sqrt @ (P - np.outer(row_masses, col_masses)) @ Dc_inv_sqrt

    # SVD
    U, sigma, Vt = np.linalg.svd(S, full_matrices=False)

    # Garder n_components
    sigma = sigma[:n_components]
    U = U[:, :n_components]
    Vt = Vt[:n_components, :]

    eigenvalues = sigma ** 2
    total_inertia = eigenvalues.sum() if eigenvalues.sum() > 0 else 1
    explained_ratio = eigenvalues / (eigenvalues.sum() if eigenvalues.sum() > 0 else 1)
    cumulative = np.cumsum(explained_ratio)

    # Coordonnées principales des lignes et colonnes
    row_coords = Dr_inv_sqrt @ U * sigma
    col_coords = Dc_inv_sqrt @ Vt.T * sigma

    # Contributions des lignes (en %)
    row_contrib = np.zeros_like(row_coords)
    for j in range(n_components):
        if eigenvalues[j] > 0:
            row_contrib[:, j] = (row_masses * row_coords[:, j] ** 2) / eigenvalues[j] * 100

    # Contributions des colonnes (en %)
    col_contrib = np.zeros_like(col_coords)
    for j in range(n_components):
        if eigenvalues[j] > 0:
            col_contrib[:, j] = (col_masses * col_coords[:, j] ** 2) / eigenvalues[j] * 100

    # Cos² des lignes
    row_dist_sq = (row_coords ** 2).sum(axis=1)
    row_cos2 = row_coords ** 2 / row_dist_sq[:, np.newaxis]
    np.nan_to_num(row_cos2, copy=False)

    # Cos² des colonnes
    col_dist_sq = (col_coords ** 2).sum(axis=1)
    col_cos2 = col_coords ** 2 / col_dist_sq[:, np.newaxis]
    np.nan_to_num(col_cos2, copy=False)

    def _safe(v):
        if isinstance(v, (np.floating, float)):
            if np.isnan(v) or np.isinf(v):
                return None
            return round(float(v), 6)
        if isinstance(v, (np.integer, int)):
            return int(v)
        return v

    component_labels = [f"Dim{i+1}" for i in range(n_components)]

    return {
        "method": "AFC",
        "row_variable": row_col,
        "col_variable": col_col,
        "n_rows": n_rows,
        "n_cols": n_cols,
        "n_components": int(n_components),
        "total_inertia": _safe(float(eigenvalues.sum())),
        "component_labels": component_labels,
        "eigenvalues": [_safe(e) for e in eigenvalues],
        "explained_variance_ratio": [_safe(v) for v in explained_ratio],
        "cumulative_variance": [_safe(v) for v in cumulative],
        "contingency_table": {
            "rows": row_labels,
            "cols": col_labels,
            "values": N.tolist(),
        },
        "row_coords": {
            label: {comp: _safe(row_coords[i, j]) for j, comp in enumerate(component_labels)}
            for i, label in enumerate(row_labels)
        },
        "col_coords": {
            label: {comp: _safe(col_coords[i, j]) for j, comp in enumerate(component_labels)}
            for i, label in enumerate(col_labels)
        },
        "row_contrib": {
            label: {comp: _safe(row_contrib[i, j]) for j, comp in enumerate(component_labels)}
            for i, label in enumerate(row_labels)
        },
        "col_contrib": {
            label: {comp: _safe(col_contrib[i, j]) for j, comp in enumerate(component_labels)}
            for i, label in enumerate(col_labels)
        },
        "row_cos2": {
            label: {comp: _safe(row_cos2[i, j]) for j, comp in enumerate(component_labels)}
            for i, label in enumerate(row_labels)
        },
        "col_cos2": {
            label: {comp: _safe(col_cos2[i, j]) for j, comp in enumerate(component_labels)}
            for i, label in enumerate(col_labels)
        },
    }


# ── ACM (Analyse des Correspondances Multiples) ──────────────────────

def run_mca(df: pd.DataFrame, columns: list[str] | None = None, n_components: int | None = None) -> dict:
    """
    Exécute une ACM (Analyse des Correspondances Multiples) sur des variables catégorielles.
    Utilise la méthode de Burt / matrice indicatrice.
    """
    if columns:
        data = df[columns].copy()
    else:
        data = df.select_dtypes(include=["object", "category", "bool"]).copy()

    if data.shape[1] < 2:
        raise ValueError("L'ACM nécessite au moins 2 variables catégorielles")

    # Supprimer les lignes avec NaN
    data = data.dropna()
    n_obs = len(data)
    if n_obs < 3:
        raise ValueError("Pas assez d'observations pour l'ACM")

    # Cap à 5000 lignes pour éviter une explosion mémoire (SVD sur matrice n×n)
    _MAX_ROWS_MCA = 5000
    sampled = False
    if n_obs > _MAX_ROWS_MCA:
        data = data.sample(n=_MAX_ROWS_MCA, random_state=42)
        n_obs = _MAX_ROWS_MCA
        sampled = True

    variables = data.columns.tolist()
    n_vars = len(variables)

    # Matrice indicatrice (dummy / disjonctive complète)
    indicator = pd.get_dummies(data, prefix_sep=":::")
    Z = indicator.values.astype(float)
    modalities = indicator.columns.tolist()
    n_modalities = len(modalities)

    if n_components is None:
        n_components = min(n_modalities - n_vars, 10)
    n_components = max(1, min(n_components, n_modalities - n_vars, n_obs - 1))

    # Matrice de Burt
    B = Z.T @ Z

    # Fréquences
    grand_total = Z.sum()
    P = Z / grand_total
    col_masses = P.sum(axis=0)

    # Matrice pour la SVD
    Dc_inv_sqrt = np.diag(1.0 / np.sqrt(np.where(col_masses > 0, col_masses, 1)))
    row_masses_vec = P.sum(axis=1)
    Dr_inv_sqrt = np.diag(1.0 / np.sqrt(np.where(row_masses_vec > 0, row_masses_vec, 1)))

    S = Dr_inv_sqrt @ (P - np.outer(row_masses_vec, col_masses)) @ Dc_inv_sqrt

    # SVD
    U, sigma, Vt = np.linalg.svd(S, full_matrices=False)

    # Filtrer les composantes triviales (valeur propre = 1/n_vars)
    eigenvalues_all = sigma ** 2
    # Garder les n_components plus grandes
    keep = min(n_components, len(eigenvalues_all))
    eigenvalues = eigenvalues_all[:keep]
    U = U[:, :keep]
    Vt = Vt[:keep, :]

    # Correction de Benzécri pour obtenir des taux d'inertie modifiés
    threshold = 1.0 / n_vars
    benzecri = np.array([(((e - threshold) / (1 - threshold)) ** 2) if e > threshold else 0 for e in eigenvalues])
    benzecri_total = benzecri.sum() if benzecri.sum() > 0 else 1
    explained_ratio = benzecri / benzecri_total
    cumulative = np.cumsum(explained_ratio)

    # Coordonnées des individus
    ind_coords = Dr_inv_sqrt @ U * sigma[:keep]

    # Coordonnées des modalités
    mod_coords = Dc_inv_sqrt @ Vt[:keep, :].T * sigma[:keep]

    # Contributions des modalités (en %)
    mod_contrib = np.zeros_like(mod_coords)
    for j in range(keep):
        if eigenvalues[j] > 0:
            mod_contrib[:, j] = (col_masses * mod_coords[:, j] ** 2) / eigenvalues[j] * 100

    # Cos² des modalités
    mod_dist_sq = (mod_coords ** 2).sum(axis=1)
    mod_cos2 = mod_coords ** 2 / np.where(mod_dist_sq[:, np.newaxis] > 0, mod_dist_sq[:, np.newaxis], 1)

    def _safe(v):
        if isinstance(v, (np.floating, float)):
            if np.isnan(v) or np.isinf(v):
                return None
            return round(float(v), 6)
        if isinstance(v, (np.integer, int)):
            return int(v)
        return v

    component_labels = [f"Dim{i+1}" for i in range(keep)]

    # Regrouper les modalités par variable
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
        "eigenvalues": [_safe(e) for e in eigenvalues],
        "explained_variance_ratio": [_safe(v) for v in explained_ratio],
        "cumulative_variance": [_safe(v) for v in cumulative],
        "modality_info": modality_info,
        "modality_coords": {
            info["full"]: {comp: _safe(mod_coords[i, j]) for j, comp in enumerate(component_labels)}
            for i, info in enumerate(modality_info)
        },
        "modality_contrib": {
            info["full"]: {comp: _safe(mod_contrib[i, j]) for j, comp in enumerate(component_labels)}
            for i, info in enumerate(modality_info)
        },
        "modality_cos2": {
            info["full"]: {comp: _safe(mod_cos2[i, j]) for j, comp in enumerate(component_labels)}
            for i, info in enumerate(modality_info)
        },
        "individual_coords": [
            {comp: _safe(ind_coords[i, j]) for j, comp in enumerate(component_labels)}
            for i in range(min(n_obs, 500))
        ],
        "eta2": _compute_eta2(data, ind_coords, component_labels, variables),
    }


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
