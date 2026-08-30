"""
Routes API pour la modélisation prédictive.
"""

import numpy as np
import pandas as pd
from flask import request, jsonify
from app.api.v1 import api_v1_bp
from app.services.dataset_service import dataset_manager
from app.schemas import TrainModelsSchema, PredictSchema, validate_payload


@api_v1_bp.route("/datasets/<dataset_id>/model/train", methods=["POST"])
def train_models(dataset_id):
    """
    Lance l'entraînement compétitif multi-algorithmes.
    Body JSON :
    {
        "target_column": "prix",
        "models": ["linear_regression", "random_forest", "xgboost"],  // optionnel
        "test_size": 0.2,  // optionnel
        "split_strategy": "auto",  // optionnel : auto | random | time
        "temporal_column": "annee"  // optionnel pour split temporel
    }
    """
    data, err = validate_payload(TrainModelsSchema, request.get_json())
    if err:
        return jsonify(err), 400

    try:
        results = dataset_manager.train_models(
            dataset_id=dataset_id,
            target_col=data["target_column"],
            model_keys=data.get("models"),
            test_size=data["test_size"],
            split_strategy=data["split_strategy"],
            temporal_col=data.get("temporal_column"),
        )

        # Retirer l'objet model non sérialisable
        response = {
            "task_type": results["task_type"],
            "ranking": results["ranking"],
            "failed": results["failed"],
            "best_model_key": results["best_model_key"],
            "shap": results.get("shap"),
            "data_split": results.get("data_split"),
            "diagnostics": results.get("diagnostics", {}),
        }

        return jsonify(response)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_v1_bp.route("/datasets/<dataset_id>/model/results", methods=["GET"])
def get_model_results(dataset_id):
    """Récupère les résultats de la dernière modélisation."""
    ds = dataset_manager.get(dataset_id)
    if ds is None:
        return jsonify({"error": "Dataset introuvable"}), 404

    results = ds.get("model_results", {})
    if not results:
        return jsonify({"error": "Aucun modèle entraîné"}), 404

    response = {
        "task_type": results.get("task_type"),
        "ranking": results.get("ranking", []),
        "failed": results.get("failed", []),
        "best_model_key": results.get("best_model_key"),
        "shap": results.get("shap"),
        "data_split": results.get("data_split"),
        "diagnostics": results.get("diagnostics", {}),
    }
    return jsonify(response)


@api_v1_bp.route("/datasets/<dataset_id>/model/predict", methods=["POST"])
def predict_values(dataset_id):
    """
    Prédit les valeurs de la variable cible avec le meilleur modèle entraîné.
    Body JSON :
    {
        "features": {"col1": 10.5, "col2": 3.0, ...}
    }
    ou pour plusieurs observations :
    {
        "features": [{"col1": 10.5, "col2": 3.0}, {"col1": 12.0, "col2": 4.5}]
    }
    """
    ds = dataset_manager.get(dataset_id)
    if ds is None:
        return jsonify({"error": "Dataset introuvable"}), 404

    model_results = dataset_manager.get_model_results(dataset_id)
    if not model_results:
        return jsonify({"error": "Aucun modèle entraîné. Lancez d'abord un entraînement."}), 400

    best_model = model_results.get("best_model")
    if best_model is None:
        return jsonify({"error": "Aucun meilleur modèle disponible"}), 400

    data = request.get_json()
    if not data or "features" not in data:
        return jsonify({"error": "features requis"}), 400

    features_input = data["features"]
    feature_names = model_results.get("data_split", {}).get("features", [])

    if not feature_names:
        return jsonify({"error": "Liste des features introuvable dans les résultats du modèle"}), 400

    try:
        # Gérer un seul dict ou une liste de dicts
        if isinstance(features_input, dict):
            features_list = [features_input]
        elif isinstance(features_input, list):
            features_list = features_input
        else:
            return jsonify({"error": "features doit être un dict ou une liste de dicts"}), 400

        # Récupérer le DF pour l'imputation
        df = dataset_manager.get_df(dataset_id)

        # Construire le DataFrame avec les bonnes colonnes dans le bon ordre
        rows = []
        for feat_dict in features_list:
            row = {}
            for fname in feature_names:
                val = feat_dict.get(fname)
                if val is None or val == "":
                    # Imputation automatique si la feature est désactivée/manquante
                    if fname in df.columns:
                        col = df[fname].dropna()
                        if pd.api.types.is_numeric_dtype(col):
                            val = col.mean()
                        else:
                            val = col.mode().iloc[0] if len(col) > 0 else "unknown"
                    else:
                        val = 0.0 # Fallback
                else:
                    if fname in df.columns and pd.api.types.is_numeric_dtype(df[fname]):
                        try:
                            val = float(val)
                        except (ValueError, TypeError):
                            return jsonify({"error": f"Valeur numérique invalide pour {fname}: {val}"}), 400
                    else:
                        val = str(val)
                row[fname] = val
            rows.append(row)

        X_pred = pd.DataFrame(rows, columns=feature_names)
        predictions = best_model.predict(X_pred)
        
        le = model_results.get("label_encoder")
        if le is not None:
            predictions = le.inverse_transform(predictions)

        task_type = model_results.get("task_type", "regression")

        def _safe(v):
            if isinstance(v, (np.floating, np.float64)):
                return round(float(v), 6)
            if isinstance(v, (np.integer, np.int64)):
                return int(v)
            return v

        result = {
            "predictions": [_safe(p) for p in predictions],
            "task_type": task_type,
            "model_used": model_results.get("best_model_key"),
            "features_used": feature_names,
        }

        # Probabilités pour la classification
        if task_type == "classification" and hasattr(best_model, "predict_proba"):
            try:
                probas = best_model.predict_proba(X_pred)
                if le is not None:
                    classes = list(le.classes_)
                else:
                    classes = best_model.classes_ if hasattr(best_model, "classes_") else None
                    if classes is None and hasattr(best_model, "named_steps"):
                        inner = list(best_model.named_steps.values())[-1]
                        classes = inner.classes_ if hasattr(inner, "classes_") else None
                result["probabilities"] = [
                    {str(c): _safe(p) for c, p in zip(classes, row)} if classes is not None else [_safe(p) for p in row]
                    for row in probas
                ]
            except Exception:
                pass

        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_v1_bp.route("/datasets/<dataset_id>/model/feature-ranges", methods=["GET"])
def get_feature_ranges(dataset_id):
    """
    Retourne les plages de valeurs des features utilisées pour l'entraînement.
    Utile pour le formulaire de simulation.
    """
    ds = dataset_manager.get(dataset_id)
    if ds is None:
        return jsonify({"error": "Dataset introuvable"}), 404

    model_results = ds.get("model_results", {})
    if not model_results:
        return jsonify({"error": "Aucun modèle entraîné"}), 404

    feature_names = model_results.get("data_split", {}).get("features", [])
    df = dataset_manager.get_df(dataset_id)

    ranges = {}
    for fname in feature_names:
        if fname in df.columns:
            col = df[fname].dropna()
            if pd.api.types.is_numeric_dtype(col):
                unique_vals = col.dropna().unique()
                if len(unique_vals) <= 10:
                    mode_val = col.mode().iloc[0] if not col.empty else unique_vals[0]
                    ranges[fname] = {
                        "type": "categorical",
                        "categories": unique_vals.tolist(),
                        "mode": str(mode_val),
                    }
                else:
                    ranges[fname] = {
                        "type": "numeric",
                        "min": round(float(col.min()), 4),
                        "max": round(float(col.max()), 4),
                        "mean": round(float(col.mean()), 4),
                        "median": round(float(col.median()), 4),
                        "std": round(float(col.std()), 4),
                    }
            else:
                unique_vals = col.dropna().unique()
                if len(unique_vals) <= 100:
                    mode_val = col.mode().iloc[0] if not col.empty else unique_vals[0]
                    ranges[fname] = {
                        "type": "categorical",
                        "categories": unique_vals.tolist(),
                        "mode": str(mode_val),
                    }

    return jsonify({
        "features": feature_names,
        "ranges": ranges,
        "task_type": model_results.get("task_type"),
        "best_model_key": model_results.get("best_model_key"),
    })
