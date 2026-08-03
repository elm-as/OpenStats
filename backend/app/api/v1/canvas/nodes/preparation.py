"""
Nœuds de préparation — Typage, Nettoyage, Transformation, Calcul.
"""

import json
from app.services.dataset_service import dataset_manager
from ._shared import _sanitize

def execute_typing(data, dataset_id):
    overrides = data.get("typeOverrides", {})
    if isinstance(overrides, str):
        try:
            overrides = json.loads(overrides)
        except (json.JSONDecodeError, ValueError):
            overrides = {}
    if overrides and dataset_id:
        for col, new_type in overrides.items():
            if new_type and new_type != "auto":
                try:
                    dataset_manager.update_column_type(dataset_id, col, new_type)
                except Exception as e:
                    print(f"Warning: Failed to update type for {col}: {e}")

    raw_excluded = data.get("excludedColumns", "[]")
    if isinstance(raw_excluded, str):
        try:
            excluded = json.loads(raw_excluded)
        except (json.JSONDecodeError, ValueError):
            excluded = []
    elif isinstance(raw_excluded, list):
        excluded = raw_excluded
    else:
        excluded = []
    if excluded and dataset_id:
        try:
            dataset_manager.set_excluded_columns(dataset_id, excluded)
        except Exception as e:
            print(f"Warning: Failed to set excluded columns: {e}")

    ds = dataset_manager.get(dataset_id)
    if ds and ds.get("profile", {}).get("dictionary"):
        types_summary = {}
        for col in ds["profile"]["dictionary"]:
            t = col.get("type_statistique", "inconnu")
            types_summary[t] = types_summary.get(t, 0) + 1
        return {
            "status": "success",
            "message": f"Types détectés: {types_summary}",
            "result": {"types": types_summary, "columns": len(ds["profile"]["dictionary"])},
        }
    return {"status": "success", "message": "Profil de types déjà calculé lors de l'import"}


def _build_cleaning_pipeline_from_actions(actions):
    pipeline = []
    if "drop_duplicates" in actions:
        pipeline.append({"step": "deduplication", "config": {}})
    na_action = None
    for a in actions:
        if a.startswith("fill_") or a == "drop_nulls":
            na_action = a
            break
    if na_action:
        if na_action == "drop_nulls":
            pipeline.append({"step": "missing_values", "config": {"default_strategy": "drop"}})
        elif na_action == "fill_mean":
            pipeline.append({"step": "missing_values", "config": {"default_strategy": "mean"}})
        elif na_action == "fill_median":
            pipeline.append({"step": "missing_values", "config": {"default_strategy": "median"}})
        elif na_action == "fill_knn":
            pipeline.append({"step": "missing_values", "config": {"default_strategy": "knn"}})
    if "drop_high_missing" in actions or "drop_near_constant" in actions:
        pipeline.append({"step": "outliers", "config": {"method": "iqr", "treatment": "cap", "threshold": 1.5}})
    return pipeline


def execute_cleaning(data, dataset_id):
    mode = data.get("mode", "auto")
    if mode == "auto":
        pipeline = [
            {"step": "deduplication", "config": {}},
            {"step": "missing_values", "config": {"default_strategy": "median"}},
            {"step": "outliers", "config": {"method": "iqr", "treatment": "cap", "threshold": 1.5}},
        ]
    else:
        actions_str = data.get("actions", "")
        actions = [a.strip() for a in actions_str.split(",") if a.strip()]
        pipeline = _build_cleaning_pipeline_from_actions(actions)

    if not pipeline:
        return {"status": "skipped", "message": "Aucune action de nettoyage configurée"}

    result = dataset_manager.clean(dataset_id, pipeline)
    return {
        "status": "success",
        "message": f"Nettoyage appliqué ({len(pipeline)} étapes)",
        "result": _sanitize(result),
    }


def execute_transform(data, dataset_id):
    action = data.get("action", "auto_recommend")
    columns_str = data.get("columns", "")

    if action == "auto_recommend":
        from app.core.transformations import recommend_transforms
        df = dataset_manager.get_df(dataset_id)
        ds = dataset_manager.get(dataset_id)
        analysis_results = ds.get("analysis_results", {}) if ds else {}
        recs = recommend_transforms(df, analysis_results, None)
        return {
            "status": "success",
            "message": f"{len(recs)} recommandation(s) de transformation",
            "result": _sanitize(recs),
        }
    else:
        from app.core.transformations import apply_transforms_to_df
        df = dataset_manager.get_df(dataset_id, respect_exclusions=False)
        cols = [c.strip() for c in columns_str.split(",") if c.strip()] if columns_str else df.select_dtypes("number").columns.tolist()
        transforms = [{"column": c, "transform": action, "params": {}} for c in cols]
        df_result, logs = apply_transforms_to_df(df, transforms)
        return {
            "status": "success",
            "message": f"{len(logs)} transformation(s) appliquée(s)",
            "result": _sanitize({"logs": logs, "shape": {"rows": df_result.shape[0], "columns": df_result.shape[1]}}),
        }


def execute_compute_variable(data, dataset_id):
    new_col = data.get("newColumn", "")
    formula = data.get("formula", "")
    if not new_col or not formula:
        return {"status": "error", "error": "Nom de colonne et formule requis"}
    from app.core.compute_variable import compute_new_variable
    df = dataset_manager.get_df(dataset_id, respect_exclusions=False)
    df_result, log = compute_new_variable(df, new_col, formula)
    if not log["success"]:
        return {"status": "error", "error": log.get("error", "Erreur de calcul")}
    return {
        "status": "success",
        "message": f"Variable '{new_col}' créée",
        "result": _sanitize(log),
    }
