"""
Analyse en Composantes Principales (ACP) sur variables numériques continues.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler

from app.core.analysis_scope import variables_analysables
from app.core.factor_serialization import _safe_float_val


def run_pca(
    df: pd.DataFrame,
    columns: list[str] | None = None,
    n_components: int | None = None,
) -> dict:
    """
    Exécute une ACP sur les colonnes numériques sélectionnées.
    Retourne valeurs propres, variance expliquée, coordonnées, contributions, corrélations.
    """
    # Une selection explicite de l'utilisateur fait autorite ; sinon on retire
    # les reperes (index temporel, identifiants) qui fabriqueraient un axe vide
    # de sens. Cf. app.core.analysis_scope.
    if columns:
        valid_cols = [c for c in columns if c in df.columns]
        data = df[valid_cols].select_dtypes(include=[np.number]).dropna() if valid_cols else variables_analysables(df).dropna()
    else:
        data = variables_analysables(df).dropna()

    if data.shape[1] < 2:
        raise ValueError("L'ACP nécessite au moins 2 variables numériques")

    if len(data) > 20000:
        data = data.sample(20000, random_state=42)

    variables = data.columns.tolist()
    n_obs, n_vars = data.shape

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(data)

    corr_matrix = np.corrcoef(X_scaled, rowvar=False)
    all_eigenvalues = np.sort(np.linalg.eigvalsh(corr_matrix))[::-1]

    auto_selection = None
    if n_components is None:
        kaiser_count = int(np.sum(all_eigenvalues > 1.0))
        cumvar = np.cumsum(all_eigenvalues / all_eigenvalues.sum())
        variance_80_count = int(np.argmax(cumvar >= 0.80)) + 1
        n_components = max(2, min(kaiser_count, n_vars, n_obs))
        auto_selection = {
            "method": "kaiser",
            "kaiser_count": kaiser_count,
            "variance_80_count": variance_80_count,
            "selected": n_components,
            "reason": (
                f"Kaiser : {kaiser_count} composante(s) avec λ > 1"
                if kaiser_count >= 2
                else f"Minimum de 2 composantes (Kaiser suggère {kaiser_count})"
            ),
        }
    n_components = min(n_components, n_vars, n_obs)

    eigenvalues, eigenvectors = np.linalg.eigh(corr_matrix)
    idx = np.argsort(eigenvalues)[::-1]
    eigenvalues = eigenvalues[idx][:n_components]
    eigenvectors = eigenvectors[:, idx][:, :n_components]

    explained_variance_ratio = eigenvalues / all_eigenvalues.sum()
    cumulative_variance = np.cumsum(explained_variance_ratio)

    scores = X_scaled @ eigenvectors
    loadings = eigenvectors * np.sqrt(eigenvalues)

    scores_sq = scores ** 2
    contrib_ind = scores_sq / scores_sq.sum(axis=0) * 100

    loadings_sq = loadings ** 2
    contrib_var = loadings_sq / loadings_sq.sum(axis=0) * 100

    dist_sq = (X_scaled ** 2).sum(axis=1)
    cos2_var = loadings ** 2

    component_labels = [f"CP{i+1}" for i in range(n_components)]

    return {
        "method": "ACP",
        "n_observations": n_obs,
        "n_variables": n_vars,
        "n_components": int(n_components),
        "variables": variables,
        "component_labels": component_labels,
        "eigenvalues": [_safe_float_val(e) for e in eigenvalues],
        "explained_variance_ratio": [_safe_float_val(v) for v in explained_variance_ratio],
        "cumulative_variance": [_safe_float_val(v) for v in cumulative_variance],
        "loadings": {
            var: {comp: _safe_float_val(loadings[i, j]) for j, comp in enumerate(component_labels)}
            for i, var in enumerate(variables)
        },
        "scores": [
            {comp: _safe_float_val(scores[i, j]) for j, comp in enumerate(component_labels)}
            for i in range(min(n_obs, 500))
        ],
        "contrib_var": {
            var: {comp: _safe_float_val(contrib_var[i, j]) for j, comp in enumerate(component_labels)}
            for i, var in enumerate(variables)
        },
        "cos2_var": {
            var: {comp: _safe_float_val(cos2_var[i, j]) for j, comp in enumerate(component_labels)}
            for i, var in enumerate(variables)
        },
        "contrib_ind_summary": {
            comp: {
                "mean": _safe_float_val(contrib_ind[:, j].mean()),
                "max": _safe_float_val(contrib_ind[:, j].max()),
                "top_5": sorted(
                    [{"index": int(k), "value": _safe_float_val(contrib_ind[k, j])}
                     for k in range(min(n_obs, 500))],
                    key=lambda x: x["value"] or 0, reverse=True,
                )[:5],
            }
            for j, comp in enumerate(component_labels)
        },
        "correlation_circle": {
            var: {"x": _safe_float_val(loadings[i, 0]), "y": _safe_float_val(loadings[i, 1]) if n_components >= 2 else 0}
            for i, var in enumerate(variables)
        },
        "auto_selection": auto_selection,
    }
