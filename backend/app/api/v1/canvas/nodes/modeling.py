"""
Nœuds de modélisation (Clustering, Régression, Classification).
"""

from app.services.dataset_service import dataset_manager
from ._shared import _sanitize

def execute_clustering(data, dataset_id):
    method = data.get("method", "kmeans")
    df = dataset_manager.get_df(dataset_id)
    if df is None or df.empty:
        return {"status": "error", "error": "DataFrame vide ou introuvable"}
    numeric_df = df.select_dtypes("number").dropna(axis=1, how="all")
    if numeric_df.shape[1] < 2:
        return {"status": "error", "error": "Au moins 2 variables numériques requises"}

    from sklearn.preprocessing import StandardScaler
    from sklearn.decomposition import PCA
    import numpy as np
    
    clean_df = numeric_df.dropna()
    if len(clean_df) < 3:
        return {"status": "error", "error": "Au moins 3 observations valides requises pour le clustering"}

    if len(clean_df) > 20000:
        clean_df = clean_df.sample(n=20000, random_state=42).reset_index(drop=True)

    X = StandardScaler().fit_transform(clean_df)
    
    # Pour la visualisation 2D
    pca = PCA(n_components=min(2, X.shape[1]))
    X_pca = pca.fit_transform(X)

    if method == "kmeans":
        from sklearn.cluster import KMeans
        from sklearn.metrics import silhouette_score
        best_k, best_score = 2, -1.0
        best_labels = None
        for k in range(2, min(11, len(X))):
            km = KMeans(n_clusters=k, n_init=10, random_state=42)
            labels = km.fit_predict(X)
            if len(set(labels)) < 2:
                continue
            try:
                s = silhouette_score(X, labels, sample_size=min(1000, len(X)))
                if s > best_score:
                    best_k, best_score = k, s
                    best_labels = labels
            except Exception:
                continue
        if best_labels is None:
            km = KMeans(n_clusters=min(2, max(1, len(X))), n_init=10, random_state=42)
            best_labels = km.fit_predict(X)
            best_k = len(set(best_labels))
            best_score = 0.0
        labels = best_labels
        result = {"method": "kmeans", "k": best_k, "silhouette": round(float(best_score), 4), "cluster_sizes": {str(i): int(np.sum(labels == i)) for i in set(labels)}}
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
        for k in range(2, min(11, len(X))):
            ac = AgglomerativeClustering(n_clusters=k)
            labels = ac.fit_predict(X)
            if len(set(labels)) < 2:
                continue
            try:
                s = silhouette_score(X, labels, sample_size=min(1000, len(X)))
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
    df = dataset_manager.get_df(dataset_id)
    if df is None or df.empty:
        return {"status": "error", "error": "DataFrame vide ou introuvable"}

    target = data.get("targetCol", "")
    if not target or target not in df.columns:
        # Auto-sélection de la dernière colonne numérique valide
        num_cols = [c for c in df.select_dtypes(include=["number"]).columns if df[c].dropna().nunique() > 1]
        if not num_cols:
            return {"status": "error", "error": "Aucune colonne numérique valide disponible comme cible"}
        target = num_cols[-1]

    models_val = data.get("models", "auto")
    models = None if models_val == "auto" else [models_val]
    try:
        result = dataset_manager.train_models(dataset_id, target, model_keys=models)
    except Exception as e:
        return {"status": "error", "error": f"Erreur d'entraînement régression: {str(e)}"}
    return {
        "status": "success",
        "message": f"Régression entraînée (cible: {target})",
        "result": _sanitize(result),
    }


def execute_classification(data, dataset_id):
    df = dataset_manager.get_df(dataset_id)
    if df is None or df.empty:
        return {"status": "error", "error": "DataFrame vide ou introuvable"}

    target = data.get("targetCol", "")
    import pandas as pd
    if not target or target not in df.columns:
        # Auto-sélection de la première/dernière colonne catégorielle ou binaire
        cat_cols = [c for c in df.columns if not pd.api.types.is_numeric_dtype(df[c]) or df[c].dropna().nunique() <= 10]
        if not cat_cols:
            return {"status": "error", "error": "Aucune colonne catégorielle/binaire valide disponible comme cible"}
        target = cat_cols[-1]

    models_val = data.get("models", "auto")
    models = None if models_val == "auto" else [models_val]
    try:
        result = dataset_manager.train_models(dataset_id, target, model_keys=models)
    except Exception as e:
        return {"status": "error", "error": f"Erreur d'entraînement classification: {str(e)}"}
    return {
        "status": "success",
        "message": f"Classification entraînée (cible: {target})",
        "result": _sanitize(result),
    }
