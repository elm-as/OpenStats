"""
Execution des noeuds supervises (Regression, Classification, Explicabilite SHAP).
"""

from __future__ import annotations

from typing import Any

import pandas as pd

from app.api.v1.canvas.nodes._shared import _sanitize, lire_decimal, lire_entier, lire_texte
from app.services.dataset_service import dataset_manager


def _modeles_demandes(data: dict[str, Any]) -> list[str] | None:
    """Liste des algorithmes a mettre en competition."""
    brut = lire_texte(data, "models")
    if not brut:
        return None
    cles = [c.strip() for c in str(brut).split(",") if c.strip()]
    return cles or None


def _reglages_modelisation(data: dict[str, Any]) -> dict[str, Any]:
    """Reglages d'entrainement saisis dans le noeud."""
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


def execute_regression(data: dict[str, Any], dataset_id: str, log_callback=None) -> dict[str, Any]:
    """Entrainement et evaluation d'un ensemble de modeles de regression."""
    cleaned = data.get("_cleaned", True)
    df = dataset_manager.get_df(dataset_id, cleaned=cleaned)
    if df is None or df.empty:
        return {"status": "error", "error": "DataFrame vide ou introuvable"}

    target = data.get("targetCol", "")
    if not target or target not in df.columns:
        num_cols = [c for c in df.select_dtypes(include=["number"]).columns if df[c].dropna().nunique() > 1]
        if not num_cols:
            return {"status": "error", "error": "Aucune colonne numérique valide disponible comme cible"}
        target = num_cols[-1]

    models = _modeles_demandes(data)
    try:
        result = dataset_manager.train_models(dataset_id, target, model_keys=models,
                                              task_type="regression",
                                              log_callback=log_callback,
                                              **_reglages_modelisation(data))
    except Exception as e:
        return {"status": "error", "error": f"Erreur d'entraînement régression: {str(e)}"}
    return {
        "status": "success",
        "message": f"Régression entraînée (cible: {target})",
        "result": _sanitize(result),
    }


def execute_classification(data: dict[str, Any], dataset_id: str, log_callback=None) -> dict[str, Any]:
    """Entrainement et evaluation d'un ensemble de classifieurs."""
    cleaned = data.get("_cleaned", True)
    df = dataset_manager.get_df(dataset_id, cleaned=cleaned)
    if df is None or df.empty:
        return {"status": "error", "error": "DataFrame vide ou introuvable"}

    target = data.get("targetCol", "")
    if not target or target not in df.columns:
        cat_cols = [c for c in df.columns if not pd.api.types.is_numeric_dtype(df[c]) or df[c].dropna().nunique() <= 10]
        if not cat_cols:
            return {"status": "error", "error": "Aucune colonne catégorielle/binaire valide disponible comme cible"}
        target = cat_cols[-1]

    models = _modeles_demandes(data)
    try:
        result = dataset_manager.train_models(dataset_id, target, model_keys=models,
                                              task_type="classification",
                                              log_callback=log_callback,
                                              **_reglages_modelisation(data))
    except Exception as e:
        return {"status": "error", "error": f"Erreur d'entraînement classification: {str(e)}"}
    return {
        "status": "success",
        "message": f"Classification entraînée (cible: {target})",
        "result": _sanitize(result),
    }


def execute_explainability(data: dict[str, Any], dataset_id: str) -> dict[str, Any]:
    """Calcul des valeurs SHAP sur un modele de reference."""
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
