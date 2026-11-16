"""
Execution des noeuds de clustering (K-Means, GMM, DBSCAN, hierarchique).
"""

from __future__ import annotations

from typing import Any

from app.api.v1.canvas.nodes._shared import _sanitize
from app.services.dataset_service import dataset_manager


def execute_clustering(data: dict[str, Any], dataset_id: str) -> dict[str, Any]:
    """Execute le partitionnement selon la methode demandee."""
    method = data.get("method", "kmeans")
    cleaned = data.get("_cleaned", True)
    df = dataset_manager.get_df(dataset_id, cleaned=cleaned)
    if df is None or df.empty:
        return {"status": "error", "error": "DataFrame vide ou introuvable"}
    from app.core.analysis_scope import variables_analysables

    numeric_df = variables_analysables(df).dropna(axis=1, how="all")
    if numeric_df.shape[1] < 2:
        return {"status": "error", "error": "Au moins 2 variables numériques requises"}

    from sklearn.preprocessing import StandardScaler
    from sklearn.decomposition import PCA
    import numpy as np

    clean_df = numeric_df.dropna()
    if len(clean_df) < 3:
        return {"status": "error", "error": "Au moins 3 observations valides requises pour le clustering"}

    max_samples_clustering = {
        "hierarchical": 3000,
        "dbscan": 10000,
        "gmm": 10000,
        "kmeans": 20000,
    }
    cap = max_samples_clustering.get(method, 20000)
    if len(clean_df) > cap:
        clean_df = clean_df.sample(n=cap, random_state=42)

    X = StandardScaler().fit_transform(clean_df)
    pca = PCA(n_components=min(2, X.shape[1]))
    X_pca = pca.fit_transform(X)

    if method == "kmeans":
        from sklearn.cluster import KMeans
        from sklearn.metrics import silhouette_score
        best_k, best_score = 2, -1.0
        best_labels = None
        max_k = min(7, len(X))
        for k in range(2, max_k):
            km = KMeans(n_clusters=k, n_init=3, random_state=42)
            labels = km.fit_predict(X)
            if len(set(labels)) < 2:
                continue
            try:
                s = silhouette_score(X, labels, sample_size=min(500, len(X)))
                if s > best_score:
                    best_k, best_score = k, s
                    best_labels = labels
            except Exception:
                continue
        if best_labels is None:
            km = KMeans(n_clusters=min(2, max(1, len(X))), n_init=3, random_state=42)
            best_labels = km.fit_predict(X)
            best_k = len(set(best_labels))
            best_score = 0.0
        labels = best_labels
        result = {"method": "kmeans", "k": best_k, "silhouette": round(float(best_score), 4), "cluster_sizes": {str(i): int(np.sum(labels == i)) for i in set(labels)}}
    elif method == "gmm":
        from sklearn.mixture import GaussianMixture
        from sklearn.metrics import silhouette_score
        meilleur_bic, meilleur_modele, best_k = float("inf"), None, 2
        for k in range(2, min(8, len(X))):
            try:
                gmm = GaussianMixture(n_components=k, covariance_type="full",
                                      random_state=42, n_init=2).fit(X)
            except Exception:
                continue
            bic = gmm.bic(X)
            if bic < meilleur_bic:
                meilleur_bic, meilleur_modele, best_k = bic, gmm, k
        if meilleur_modele is None:
            return {"status": "error", "error": "Aucun mélange gaussien n'a convergé"}
        labels = meilleur_modele.predict(X)
        try:
            silhouette = float(silhouette_score(X, labels, sample_size=min(500, len(X))))
        except Exception:
            silhouette = 0.0
        result = {
            "method": "gmm",
            "k": best_k,
            "bic": round(float(meilleur_bic), 2),
            "silhouette": round(silhouette, 4),
            "cluster_sizes": {str(i): int(np.sum(labels == i)) for i in set(labels)},
            "probabilites_moyennes": [round(float(p), 4)
                                      for p in meilleur_modele.predict_proba(X).max(axis=1)[:50]],
        }
    elif method == "dbscan":
        from sklearn.cluster import DBSCAN
        db = DBSCAN(eps=0.5, min_samples=5)
        labels = db.fit_predict(X)
        n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
        result = {"method": "dbscan", "n_clusters": n_clusters, "noise_points": int(np.sum(labels == -1))}
    else:  # hierarchical
        from sklearn.cluster import AgglomerativeClustering
        from sklearn.metrics import silhouette_score
        best_k, best_score = 2, -1.0
        best_labels = None
        max_k = min(7, len(X))
        for k in range(2, max_k):
            ac = AgglomerativeClustering(n_clusters=k)
            labels = ac.fit_predict(X)
            if len(set(labels)) < 2:
                continue
            try:
                s = silhouette_score(X, labels, sample_size=min(500, len(X)))
                if s > best_score:
                    best_k, best_score = k, s
                    best_labels = labels
            except Exception:
                continue
        if best_labels is None:
            ac = AgglomerativeClustering(n_clusters=min(2, max(1, len(X))))
            best_labels = ac.fit_predict(X)
            best_k = len(set(best_labels))
            best_score = 0.0
        labels = best_labels
        result = {"method": "hierarchical", "k": best_k, "silhouette": round(float(best_score), 4)}

    points = []
    for i in range(min(500, len(X_pca))):
        points.append({
            "x": float(X_pca[i, 0]),
            "y": float(X_pca[i, 1]) if X_pca.shape[1] > 1 else 0.0,
            "cluster": int(labels[i])
        })
    result["points"] = points

    return {
        "status": "success",
        "message": f"Clustering ({method}) terminé",
        "result": _sanitize(result),
    }


def execute_hierarchical_clustering(data: dict[str, Any], dataset_id: str) -> dict[str, Any]:
    """Execute un clustering hierarchique avec dendrogramme et decoupage en k clusters."""
    cleaned = data.get("_cleaned", True)
    df = dataset_manager.get_df(dataset_id, cleaned=cleaned)
    if df is None or df.empty:
        return {"status": "error", "message": "DataFrame vide ou introuvable"}

    from app.core.clustering_hierarchical import run_hierarchical_clustering

    features = data.get("features")
    if isinstance(features, str):
        features = [f.strip() for f in features.split(",") if f.strip()]

    n_clusters = int(data.get("k") or data.get("n_clusters") or 3)
    method = data.get("method") or "ward"
    metric = data.get("metric") or "euclidean"

    res = run_hierarchical_clustering(
        df=df,
        features=features,
        n_clusters=n_clusters,
        method=method,
        metric=metric,
    )
    if res.get("status") == "error":
        return {"status": "error", "message": res.get("message", "Erreur clustering hiérarchique")}

    return {
        "status": "success",
        "message": f"Clustering hiérarchique ({method}) : {res['n_clusters']} clusters identifiés",
        "result": _sanitize(res),
    }
