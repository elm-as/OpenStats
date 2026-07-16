"""
Routes — Transformations de données et calcul de variables.
"""

import numpy as np
from flask import request, jsonify
from app.api.v1 import api_v1_bp
from app.services.dataset_service import dataset_manager
from app.schemas import TransformApplySchema, validate_payload


@api_v1_bp.route("/datasets/<dataset_id>/transforms/catalog", methods=["GET"])
def get_transform_catalog_route(dataset_id):
    """Retourne le catalogue des transformations disponibles."""
    ds = dataset_manager.get(dataset_id)
    if ds is None:
        return jsonify({"error": "Dataset introuvable"}), 404

    from app.core.transformations import get_transform_catalog
    return jsonify({"transforms": get_transform_catalog()})


@api_v1_bp.route("/datasets/<dataset_id>/transforms/recommend", methods=["GET"])
def recommend_transforms_route(dataset_id):
    """Recommande des transformations basées sur les résultats statistiques."""
    ds = dataset_manager.get(dataset_id)
    if ds is None:
        return jsonify({"error": "Dataset introuvable"}), 404

    from app.core.transformations import recommend_transforms
    df = dataset_manager.get_df(dataset_id)
    analysis = ds.get("analysis_results", {})
    ts = ds.get("timeseries_results", {})
    recommendations = recommend_transforms(df, analysis, ts if ts else None)
    return jsonify({"recommendations": recommendations})


@api_v1_bp.route("/datasets/<dataset_id>/transforms/apply", methods=["POST"])
def apply_transforms_route(dataset_id):
    """Applique des transformations au dataset.

    Body JSON :
    {
        "transforms": [
            {"column": "col1", "transform": "log", "params": {}},
            {"column": "col2", "transform": "standardize"}
        ],
        "inplace": false
    }
    """
    ds = dataset_manager.get(dataset_id)
    if ds is None:
        return jsonify({"error": "Dataset introuvable"}), 404

    data, err = validate_payload(TransformApplySchema, request.get_json())
    if err:
        return jsonify(err), 400

    transforms = data["transforms"]
    inplace = data["inplace"]

    from app.core.transformations import apply_transforms_to_df
    df = dataset_manager.get_df(dataset_id, respect_exclusions=False)

    try:
        df_result, logs = apply_transforms_to_df(df, transforms)

        if inplace:
            from app.extensions import db
            from app.models.dataset import DatasetVersion
            from app.services.storage_service import storage
            from app.core.profiling import profile_dataframe

            ds_model = dataset_manager.get_dataset_model(dataset_id)
            next_version = max(v.version_number for v in ds_model.versions) + 1
            parquet_path = storage.save_dataframe(df_result, dataset_id, version=next_version)

            new_profile = profile_dataframe(df_result)
            version = DatasetVersion(
                dataset_id=dataset_id,
                version_number=next_version,
                label="transformed",
                description=f"Transformation ({len(logs)} opérations)",
                parquet_path=parquet_path,
                rows=df_result.shape[0],
                columns=df_result.shape[1],
                operations_log=logs,
                profile_snapshot=new_profile,
            )
            db.session.add(version)
            ds_model.rows = df_result.shape[0]
            ds_model.columns = df_result.shape[1]
            ds_model.profile = new_profile
            db.session.commit()

        cache = dataset_manager._get_cache(dataset_id)
        cache.setdefault("transform_logs", []).extend(logs)

        return jsonify({
            "logs": logs,
            "applied": inplace,
            "shape": {"rows": df_result.shape[0], "columns": df_result.shape[1]},
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_v1_bp.route("/datasets/<dataset_id>/compute-variable", methods=["POST"])
def compute_variable_route(dataset_id):
    """Calcule une nouvelle variable basée sur une formule mathématique."""
    from app.schemas import ComputeVariableSchema

    ds = dataset_manager.get(dataset_id)
    if ds is None:
        return jsonify({"error": "Dataset introuvable"}), 404

    data, err = validate_payload(ComputeVariableSchema, request.get_json())
    if err:
        return jsonify(err), 400

    new_column = data["new_column"]
    formula = data["formula"]

    from app.core.compute_variable import compute_new_variable
    df = dataset_manager.get_df(dataset_id, respect_exclusions=False)
    df_result, log = compute_new_variable(df, new_column, formula)

    if not log["success"]:
        return jsonify({"error": log.get("error", "Erreur lors du calcul")}), 400

    try:
        from app.extensions import db
        from app.models.dataset import DatasetVersion
        from app.services.storage_service import storage
        from app.core.profiling import profile_dataframe

        ds_model = dataset_manager.get_dataset_model(dataset_id)
        next_version = max((v.version_number for v in ds_model.versions), default=0) + 1
        parquet_path = storage.save_dataframe(df_result, dataset_id, version=next_version)

        new_profile = profile_dataframe(df_result)
        version = DatasetVersion(
            dataset_id=dataset_id,
            version_number=next_version,
            label="computed_variable",
            description=f"Calcul de variable: {new_column} = {formula}",
            parquet_path=parquet_path,
            rows=df_result.shape[0],
            columns=df_result.shape[1],
            operations_log=[log],
            profile_snapshot=new_profile,
        )
        db.session.add(version)
        ds_model.rows = df_result.shape[0]
        ds_model.columns = df_result.shape[1]
        ds_model.profile = new_profile
        db.session.commit()

        cache = dataset_manager._get_cache(dataset_id)
        cache.setdefault("transform_logs", []).append(log)

        return jsonify({
            "log": log,
            "applied": True,
            "shape": {"rows": df_result.shape[0], "columns": df_result.shape[1]},
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_v1_bp.route("/datasets/<dataset_id>/transforms/preview", methods=["POST"])
def preview_transform_route(dataset_id):
    """Aperçu rapide d'une transformation sur une seule colonne.
    Body JSON : {"column": "col1", "transform": "log", "params": {}}
    """
    ds = dataset_manager.get(dataset_id)
    if ds is None:
        return jsonify({"error": "Dataset introuvable"}), 404

    data = request.get_json()
    if not data or "column" not in data or "transform" not in data:
        return jsonify({"error": "column et transform requis"}), 400

    from app.core.transformations import apply_transform
    df = dataset_manager.get_df(dataset_id, respect_exclusions=False)
    col = data["column"]
    key = data["transform"]
    params = data.get("params", {})

    if col not in df.columns:
        return jsonify({"error": f"Colonne '{col}' introuvable"}), 400

    try:
        original = df[col]
        transformed, meta = apply_transform(original, key, params)

        def _safe(v):
            if v is None or (isinstance(v, float) and (np.isnan(v) or np.isinf(v))):
                return None
            try:
                f = float(v)
                return round(f, 4) if not (np.isnan(f) or np.isinf(f)) else None
            except (TypeError, ValueError):
                return None

        n = min(len(original), 200)
        step = max(1, len(original) // n)
        indices = list(range(0, len(original), step))[:n]

        return jsonify({
            "column": col,
            "transform": key,
            "original": {
                "values": [_safe(original.iloc[i]) for i in indices],
                "mean": _safe(original.mean()),
                "std": _safe(original.std()),
                "skewness": _safe(original.skew()),
                "kurtosis": _safe(original.kurtosis()),
                "min": _safe(original.min()),
                "max": _safe(original.max()),
            },
            "transformed": {
                "values": [_safe(transformed.iloc[i]) for i in indices],
                "mean": _safe(transformed.mean()),
                "std": _safe(transformed.std()),
                "skewness": _safe(transformed.skew()),
                "kurtosis": _safe(transformed.kurtosis()),
                "min": _safe(transformed.min()),
                "max": _safe(transformed.max()),
            },
            "meta": meta,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
