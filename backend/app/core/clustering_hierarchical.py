"""
Module de Clustering Hiérarchique Ascendant (HAC / CAH).
Calcul de liaison, dendrogramme Plotly, découpage en clusters et métriques.
"""

from __future__ import annotations

import logging
from typing import Any
import numpy as np
import pandas as pd
from scipy.cluster.hierarchy import linkage, dendrogram, fcluster
from scipy.spatial.distance import pdist
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score

logger = logging.getLogger(__name__)


def run_hierarchical_clustering(
    df: pd.DataFrame,
    features: list[str] | None = None,
    n_clusters: int = 3,
    method: str = "ward",
    metric: str = "euclidean",
    max_dendrogram_leaves: int = 50,
) -> dict[str, Any]:
    """
    Exécute un clustering hiérarchique ascendant complet.

    :param df: DataFrame source
    :param features: Colonnes numériques sélectionnées (toutes numériques si None)
    :param n_clusters: Nombre de clusters cibles
    :param method: Méthode d'agrégation ('ward', 'complete', 'average', 'single')
    :param metric: Métrique de distance ('euclidean', 'cityblock', 'cosine')
    :param max_dendrogram_leaves: Nombre max de feuilles affichées dans le dendrogramme
    :return: Dictionnaire avec dendrogramme, labels, silhouettes et résumés
    """
    num_df = df.select_dtypes(include=[np.number])
    if features:
        valid_cols = [c for c in features if c in num_df.columns]
    else:
        valid_cols = num_df.columns.tolist()

    if len(valid_cols) < 2:
        return {
            "status": "error",
            "message": "Au moins 2 variables numériques sont requises pour le clustering.",
        }

    clean_data = df[valid_cols].dropna()
    n_samples = len(clean_data)
    if n_samples < 4:
        return {
            "status": "error",
            "message": f"Échantillon trop faible ({n_samples} lignes après suppression des valeurs manquantes).",
        }

    # Ward requiert impérativement la métrique euclidean
    if method == "ward":
        metric = "euclidean"

    # 1. Matrice de liaison
    X = clean_data.values
    # Standardisation z-score
    std = np.std(X, axis=0)
    std[std == 0] = 1.0
    X_scaled = (X - np.mean(X, axis=0)) / std

    try:
        Z = linkage(X_scaled, method=method, metric=metric)
    except Exception as e:
        logger.exception("Erreur lors du calcul de la matrice de liaison: %s", e)
        return {"status": "error", "message": f"Erreur de calcul de liaison: {e}"}

    # 2. Données du dendrogramme (format Plotly)
    p_leaves = min(max_dendrogram_leaves, n_samples)
    dendro_dict = dendrogram(
        Z,
        truncate_mode="lastp" if n_samples > p_leaves else None,
        p=p_leaves,
        no_plot=True,
    )

    # Calcul du seuil de distance coupant Z en n_clusters
    k = max(2, min(n_clusters, n_samples - 1))
    # Distance seuil correspondant au découpage en k clusters
    distances = Z[:, 2]
    if len(distances) >= k:
        threshold = float((distances[-k + 1] + distances[-k]) / 2.0) if k > 1 else float(distances[-1])
    else:
        threshold = float(distances[-1] * 0.7)

    # 3. Affectation des clusters
    cluster_labels = fcluster(Z, t=k, criterion="maxclust")
    # Indices renumérotés de 0 à k-1
    cluster_labels = cluster_labels - 1

    # 4. Score de silhouette
    sil_score = None
    if 2 <= k < n_samples:
        try:
            sil_score = round(float(silhouette_score(X_scaled, cluster_labels)), 4)
        except Exception:
            sil_score = None

    # 5. Résumés par cluster
    clean_copy = clean_data.copy()
    clean_copy["_cluster"] = [f"Cluster {c + 1}" for c in cluster_labels]
    cluster_summary = []
    for c_id in range(k):
        c_label = f"Cluster {c_id + 1}"
        c_df = clean_copy[clean_copy["_cluster"] == c_label][valid_cols]
        count = len(c_df)
        pct = round(count / n_samples * 100.0, 2)
        means = {col: round(float(c_df[col].mean()), 3) for col in valid_cols}
        cluster_summary.append({
            "cluster": c_label,
            "count": count,
            "percentage": pct,
            "means": means,
        })

    # 6. Projection 2D pour affichage scatter (PCA 2 composantes)
    pca = PCA(n_components=2)
    coords_2d = pca.fit_transform(X_scaled)
    var_ratio = [round(float(v) * 100, 2) for v in pca.explained_variance_ratio_]

    scatter_points = []
    subsample_idx = np.linspace(0, n_samples - 1, min(n_samples, 300), dtype=int)
    for idx in subsample_idx:
        scatter_points.append({
            "x": round(float(coords_2d[idx, 0]), 3),
            "y": round(float(coords_2d[idx, 1]), 3),
            "cluster": f"Cluster {int(cluster_labels[idx]) + 1}",
        })

    return {
        "status": "success",
        "method": method,
        "metric": metric,
        "n_clusters": k,
        "n_samples": n_samples,
        "features": valid_cols,
        "silhouette_score": sil_score,
        "cut_threshold": round(threshold, 3),
        "dendrogram": {
            "icoord": dendro_dict["icoord"],
            "dcoord": dendro_dict["dcoord"],
            "color_list": dendro_dict["color_list"],
            "ivl": dendro_dict["ivl"],
        },
        "cluster_summary": cluster_summary,
        "projection_2d": {
            "points": scatter_points,
            "variance_explained": var_ratio,
        },
    }
