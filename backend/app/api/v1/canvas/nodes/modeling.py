"""
Nœuds de modélisation (Clustering, Régression, Classification).
"""

from app.services.dataset_service import dataset_manager
from ._shared import _sanitize, lire_decimal, lire_entier, lire_texte

def execute_clustering(data, dataset_id):
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

    X = StandardScaler().fit_transform(clean_df)
    
    # Pour la visualisation 2D
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
        # Contrairement a k-means, le nombre de composantes se choisit par un
        # critere d'information plutot que par une heuristique de forme.
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


def _modeles_demandes(data: dict) -> list[str] | None:
    """Liste des algorithmes a mettre en competition.

    L'interface envoie un seul identifiant, la recette en envoie plusieurs
    separes par des virgules : sans decoupage, « ridge,lasso » etait traite
    comme un nom de modele inconnu et la selection etait ignoree.
    """
    brut = lire_texte(data, "models")
    if not brut:
        return None
    cles = [c.strip() for c in str(brut).split(",") if c.strip()]
    return cles or None


def _reglages_modelisation(data: dict) -> dict:
    """Reglages d'entrainement saisis dans le noeud.

    Une taille de test exprimee en pourcentage (20) est ramenee en fraction ;
    un champ laisse vide retombe sur la valeur par defaut du moteur.
    """
    taille_test = lire_decimal(data, "testSize", 20.0)
    if taille_test > 1:
        taille_test = taille_test / 100.0

    hyperparams = {
        "max_depth": lire_entier(data, "maxDepth"),
        "min_samples_split": lire_entier(data, "minSamplesSplit"),
    }
    return {
        "test_size": taille_test,
        "split_strategy": lire_texte(data, "splitStrategy", "auto"),
        "cv_folds": lire_entier(data, "cvFolds", 5),
        "hyperparams": {k: v for k, v in hyperparams.items() if v is not None} or None,
    }


def execute_regression(data, dataset_id):
    cleaned = data.get("_cleaned", True)
    df = dataset_manager.get_df(dataset_id, cleaned=cleaned)
    if df is None or df.empty:
        return {"status": "error", "error": "DataFrame vide ou introuvable"}

    target = data.get("targetCol", "")
    if not target or target not in df.columns:
        # Auto-sélection de la dernière colonne numérique valide
        num_cols = [c for c in df.select_dtypes(include=["number"]).columns if df[c].dropna().nunique() > 1]
        if not num_cols:
            return {"status": "error", "error": "Aucune colonne numérique valide disponible comme cible"}
        target = num_cols[-1]

    models = _modeles_demandes(data)
    try:
        result = dataset_manager.train_models(dataset_id, target, model_keys=models,
                                              task_type="regression",
                                              **_reglages_modelisation(data))
    except Exception as e:
        return {"status": "error", "error": f"Erreur d'entraînement régression: {str(e)}"}
    return {
        "status": "success",
        "message": f"Régression entraînée (cible: {target})",
        "result": _sanitize(result),
    }


def execute_classification(data, dataset_id):
    cleaned = data.get("_cleaned", True)
    df = dataset_manager.get_df(dataset_id, cleaned=cleaned)
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

    models = _modeles_demandes(data)
    try:
        result = dataset_manager.train_models(dataset_id, target, model_keys=models,
                                              task_type="classification",
                                              **_reglages_modelisation(data))
    except Exception as e:
        return {"status": "error", "error": f"Erreur d'entraînement classification: {str(e)}"}
    return {
        "status": "success",
        "message": f"Classification entraînée (cible: {target})",
        "result": _sanitize(result),
    }


def execute_explainability(data, dataset_id):
    cleaned = data.get("_cleaned", True)
    df = dataset_manager.get_df(dataset_id, cleaned=cleaned)
    if df is None or df.empty:
        return {"status": "error", "error": "DataFrame vide ou introuvable"}

    target = data.get("targetCol", "")
    num_cols = df.select_dtypes(include=["number"]).columns.tolist()
    if not target and num_cols:
        target = num_cols[-1]

    if not target or target not in df.columns:
        return {"status": "error", "error": "Variable cible requise pour l'explicabilité SHAP"}

    X = df[num_cols].drop(columns=[target], errors="ignore").dropna()
    if X.shape[1] == 0:
        return {"status": "error", "error": "Aucune variable explicative numérique trouvée"}
    y = df.loc[X.index, target]

    from sklearn.ensemble import RandomForestRegressor
    from app.core.explainability import compute_shap_values

    try:
        rf = RandomForestRegressor(n_estimators=30, random_state=42)
        rf.fit(X, y)
        res = compute_shap_values(rf, X, max_samples=100)
    except Exception as e:
        return {"status": "error", "error": f"Erreur de calcul SHAP: {str(e)}"}

    return {
        "status": "success",
        "message": f"Explicabilité SHAP calculée sur '{target}' ({res.get('n_features', 0)} variables)",
        "result": _sanitize(res),
    }


def execute_hierarchical_clustering(data, dataset_id):
    """Exécute un clustering hiérarchique avec dendrogramme et découpage en k clusters."""
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



def execute_panel(data, dataset_id):
    """Econometrie de panel : effets fixes, effets aleatoires et test de Hausman.

    Sans ce noeud, la structure de panel etait reconnue par l'analyseur mais
    l'etape correspondante n'avait aucun equivalent sur le canvas : la
    conversion produisait un noeud d'un type que personne ne savait executer.
    """
    from app.core.analysis_scope import variables_analysables
    from app.core.panel_models import fit_panel_models
    from app.core.auto_pipeline.panel_structure import detecter_panel
    from app.core.auto_pipeline.heuristics import _is_temporal

    cleaned = data.get("_cleaned", True)
    df = dataset_manager.get_df(dataset_id, cleaned=cleaned)
    if df is None or df.empty:
        return {"status": "error", "error": "DataFrame vide ou introuvable"}

    entity_col = lire_texte(data, "entityCol")
    time_col = lire_texte(data, "timeCol")

    # A defaut de choix explicite, on redetecte la structure plutot que de
    # prendre les premieres colonnes venues.
    if not entity_col or not time_col:
        temporelles = [c for c in df.columns if _is_temporal(df[c], name=str(c))]
        candidats = [c for c in df.columns
                     if c not in temporelles and df[c].nunique(dropna=True) <= len(df) / 2]
        couple = detecter_panel(df, temporelles, candidats)
        if not couple:
            return {"status": "error",
                    "error": "Aucune structure de panel détectée : indiquez la colonne "
                             "d'entité et la colonne de période."}
        entity_col, time_col = couple

    for nom, colonne in (("entité", entity_col), ("période", time_col)):
        if colonne not in df.columns:
            return {"status": "error", "error": f"Colonne {nom} '{colonne}' introuvable"}

    target = lire_texte(data, "targetCol")
    numeriques = [c for c in variables_analysables(df, minimum=1).columns if c != time_col]
    if not target or target not in df.columns:
        target = numeriques[-1] if numeriques else None
    if not target:
        return {"status": "error", "error": "Variable cible numérique requise"}

    covariables_brut = lire_texte(data, "covariates")
    if covariables_brut:
        covariables = [c.strip() for c in str(covariables_brut).split(",")
                       if c.strip() in df.columns and c.strip() != target]
    else:
        covariables = [c for c in numeriques if c != target][:6]

    if not covariables:
        return {"status": "error", "error": "Au moins une covariable est requise"}

    try:
        result = fit_panel_models(df, entity_col=entity_col, time_col=time_col,
                                  target_col=target, covariates=covariables)
    except Exception as e:
        return {"status": "error", "error": f"Erreur économétrie de panel: {str(e)}"}

    hausman = (result or {}).get("hausman_test", {})
    prefere = "effets fixes" if hausman.get("prefer_fixed_effects") else "effets aléatoires"
    return {
        "status": "success",
        "message": (f"Panel sur '{target}' : {result.get('n_entities')} entités × "
                    f"{result.get('n_observations', 0) // max(1, result.get('n_entities', 1))} "
                    f"périodes — Hausman recommande les {prefere}"),
        "result": _sanitize(result),
    }


def execute_count_model(data, dataset_id):
    """Regression de comptage : Poisson, ou binomiale negative si surdispersion.

    Une cible de denombrement passee en regression lineaire produit des
    predictions negatives et des intervalles faux : ce noeud modelise la loi
    reelle du comptage et teste l'hypothese de Poisson au lieu de la supposer.
    """
    from app.core.analysis_scope import variables_analysables
    from app.core.count_models import ajuster_modele_comptage, est_comptage

    cleaned = data.get("_cleaned", True)
    df = dataset_manager.get_df(dataset_id, cleaned=cleaned)
    if df is None or df.empty:
        return {"status": "error", "error": "DataFrame vide ou introuvable"}

    target = lire_texte(data, "targetCol")
    if not target:
        candidats = [c for c in df.columns if est_comptage(df[c], str(c))]
        target = candidats[0] if candidats else None
    if not target or target not in df.columns:
        return {"status": "error",
                "error": "Aucune variable de comptage détectée : indiquez la cible."}

    if not est_comptage(df[target], str(target)):
        return {"status": "error",
                "error": (f"'{target}' ne se comporte pas comme un comptage "
                          "(entiers positifs). Utilisez une régression classique.")}

    covariables_brut = lire_texte(data, "covariates")
    if covariables_brut:
        covariables = [c.strip() for c in str(covariables_brut).split(",")
                       if c.strip() in df.columns and c.strip() != target]
    else:
        numeriques = [c for c in variables_analysables(df, minimum=1).columns if c != target]
        categorielles = [c for c in df.select_dtypes(include=["object", "category"]).columns
                         if df[c].nunique() <= 10]
        covariables = (numeriques[:5] + categorielles[:2])

    if not covariables:
        return {"status": "error", "error": "Au moins une covariable est requise"}

    resultat = ajuster_modele_comptage(df, target, covariables,
                                       exposure_col=lire_texte(data, "exposureCol"))
    if resultat.get("status") != "success":
        return {"status": "error", "error": resultat.get("error", "Échec de l'ajustement")}

    retenu = resultat["selected_model"]
    libelle = "binomiale négative" if retenu == "negative_binomial" else "Poisson"
    return {
        "status": "success",
        "message": (f"Modèle de comptage sur '{target}' — {libelle} retenu "
                    f"(dispersion = {resultat.get('dispersion')})"),
        "result": _sanitize(resultat),
    }
