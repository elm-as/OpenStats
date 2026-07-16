"""
Nœuds de modélisation (Clustering, Régression, Classification).
"""

from app.services.dataset_service import dataset_manager
from ._shared import _sanitize

def execute_clustering(data, dataset_id):
    method = data.get("method", "kmeans")
    df = dataset_manager.get_df(dataset_id)
    numeric_df = df.select_dtypes("number").dropna(axis=1, how="all")
    if numeric_df.shape[1] < 2:
        return {"status": "error", "error": "Au moins 2 variables numériques requises"}

    from sklearn.preprocessing import StandardScaler
    from sklearn.decomposition import PCA
    import numpy as np
    
    clean_df = numeric_df.dropna()
    X = StandardScaler().fit_transform(clean_df)
    
    # Pour la visualisation 2D
    pca = PCA(n_components=min(2, X.shape[1]))
    X_pca = pca.fit_transform(X)

    if method == "kmeans":
        from sklearn.cluster import KMeans
        from sklearn.metrics import silhouette_score
        best_k, best_score = 2, -1
        for k in range(2, min(11, len(X))):
            km = KMeans(n_clusters=k, n_init=10, random_state=42)
            labels = km.fit_predict(X)
            s = silhouette_score(X, labels)
            if s > best_score:
                best_k, best_score = k, s
        km = KMeans(n_clusters=best_k, n_init=10, random_state=42)
        labels = km.fit_predict(X)
        result = {"method": "kmeans", "k": best_k, "silhouette": round(float(best_score), 4), "cluster_sizes": {str(i): int(np.sum(labels == i)) for i in range(best_k)}}
    elif method == "dbscan":
        from sklearn.cluster import DBSCAN
        db = DBSCAN(eps=0.5, min_samples=5)
        labels = db.fit_predict(X)
        n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
        result = {"method": "dbscan", "n_clusters": n_clusters, "noise_points": int(np.sum(labels == -1))}
    else:  # hierarchical
        from sklearn.cluster import AgglomerativeClustering
        from sklearn.metrics import silhouette_score
        best_k, best_score = 2, -1
        for k in range(2, min(11, len(X))):
            ac = AgglomerativeClustering(n_clusters=k)
            labels = ac.fit_predict(X)
            s = silhouette_score(X, labels)
            if s > best_score:
                best_k, best_score = k, s
        ac = AgglomerativeClustering(n_clusters=best_k)
        labels = ac.fit_predict(X)
        result = {"method": "hierarchical", "k": best_k, "silhouette": round(float(best_score), 4)}

    # Ajout des points pour le graphe
    points = []
    for i in range(min(500, len(X_pca))):  # Limiter à 500 points pour le web
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


def execute_regression(data, dataset_id):
    target = data.get("targetCol", "")
    if not target:
        return {"status": "error", "error": "Variable cible requise"}
    models_val = data.get("models", "auto")
    models = None if models_val == "auto" else [models_val]
    result = dataset_manager.train_models(dataset_id, target, model_keys=models)
    return {
        "status": "success",
        "message": f"Régression entraînée (cible: {target})",
        "result": _sanitize(result),
    }


def execute_classification(data, dataset_id):
    target = data.get("targetCol", "")
    if not target:
        return {"status": "error", "error": "Variable cible requise"}
    models_val = data.get("models", "auto")
    models = None if models_val == "auto" else [models_val]
    result = dataset_manager.train_models(dataset_id, target, model_keys=models)
    return {
        "status": "success",
        "message": f"Classification entraînée (cible: {target})",
        "result": _sanitize(result),
    }
