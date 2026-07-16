"""
Routes — Diagnostics, auto-pipeline, insights et recommandations.
"""

from flask import request, jsonify
from app.api.v1 import api_v1_bp
from app.services.dataset_service import dataset_manager
from app.api.v1.analysis._helpers import _sanitize_for_json


@api_v1_bp.route("/datasets/<dataset_id>/diagnostics", methods=["GET"])
def get_diagnostics(dataset_id):
    """Diagnostics automatiques du dataset (alertes, avertissements)."""
    ds = dataset_manager.get(dataset_id)
    if ds is None:
        return jsonify({"error": "Dataset introuvable"}), 404

    from app.core.recommendations import diagnose_dataset
    df = dataset_manager.get_df(dataset_id)
    advisories = diagnose_dataset(df, ds.get("profile"))
    return jsonify({"advisories": advisories, "count": len(advisories)})


@api_v1_bp.route("/datasets/<dataset_id>/auto-pipeline/detect", methods=["GET"])
def auto_pipeline_detect(dataset_id):
    """Détection du profil sémantique du dataset (types, cible, problème)."""
    ds = dataset_manager.get(dataset_id)
    if ds is None:
        return jsonify({"error": "Dataset introuvable"}), 404

    from app.core.auto_pipeline import detect_dataset_profile
    df = dataset_manager.get_df(dataset_id)
    hint = request.args.get("target")
    profile = detect_dataset_profile(df, user_hint_target=hint)
    return jsonify({"profile": profile.to_dict()})


@api_v1_bp.route("/datasets/<dataset_id>/auto-pipeline/recipe", methods=["GET", "POST"])
def auto_pipeline_recipe(dataset_id):
    """Construit (sans exécuter) une recipe de pipeline."""
    ds = dataset_manager.get(dataset_id)
    if ds is None:
        return jsonify({"error": "Dataset introuvable"}), 404

    from app.core.auto_pipeline import detect_dataset_profile, build_recipe
    df = dataset_manager.get_df(dataset_id)
    body = request.get_json(silent=True) or {}
    hint = body.get("target") or request.args.get("target")
    profile = detect_dataset_profile(df, user_hint_target=hint)
    recipe = build_recipe(profile)

    return jsonify({"profile": profile.to_dict(), "recipe": recipe.to_dict()})


@api_v1_bp.route("/datasets/<dataset_id>/auto-pipeline/execute", methods=["POST"])
def auto_pipeline_execute(dataset_id):
    """Exécute le pipeline automatique : détection → recipe → exécution.

    Body JSON (optionnel) :
      {
        "target": "col_y",
        "execute_optional": false,
      }
    """
    ds = dataset_manager.get(dataset_id)
    if ds is None:
        return jsonify({"error": "Dataset introuvable"}), 404

    from app.core.auto_pipeline import detect_dataset_profile, build_recipe, execute_recipe

    body = request.get_json(silent=True) or {}
    hint = body.get("target")
    execute_optional = bool(body.get("execute_optional", False))

    df = dataset_manager.get_df(dataset_id)
    profile = detect_dataset_profile(df, user_hint_target=hint)
    recipe = build_recipe(profile)

    import threading
    execution_result: dict = {}
    execution_error: list = []

    def _run():
        try:
            execution_result.update(execute_recipe(df, recipe, execute_optional=execute_optional))
        except Exception as e:
            execution_error.append(str(e))

    t = threading.Thread(target=_run, daemon=True)
    t.start()
    timeout_sec = 180
    t.join(timeout=timeout_sec)
    if t.is_alive():
        return jsonify({"error": f"Pipeline timed out after {timeout_sec}s"}), 504
    if execution_error:
        return jsonify({"error": f"Echec d'exécution: {execution_error[0]}"}), 500

    execution = execution_result

    try:
        analysis_results = ds.get("analysis_results", {}) or {}
        steps = execution.get("steps", {})
        if "descriptive" in steps and steps["descriptive"].get("status") == "success":
            analysis_results["descriptive_stats"] = steps["descriptive"]["result"]
        if "correlations" in steps and steps["correlations"].get("status") == "success":
            analysis_results["correlations"] = steps["correlations"]["result"]
        if "vif" in steps and steps["vif"].get("status") == "success":
            analysis_results["vif"] = steps["vif"]["result"]
        ds["analysis_results"] = analysis_results

        if "model" in steps and steps["model"].get("status") == "success":
            ds["model_results"] = steps["model"]["result"]
        if "timeseries" in steps and steps["timeseries"].get("status") == "success":
            ds["timeseries_results"] = steps["timeseries"]["result"]
        if "timeseries_multivariate" in steps and steps["timeseries_multivariate"].get("status") == "success":
            ds["multivariate_ts_results"] = steps["timeseries_multivariate"]["result"]
        if "pca" in steps and steps["pca"].get("status") == "success":
            factor = ds.get("factor_results", {}) or {}
            factor["pca"] = steps["pca"]["result"]
            ds["factor_results"] = factor
    except Exception:
        pass

    return jsonify({
        "profile": profile.to_dict(),
        "recipe": recipe.to_dict(),
        "execution": _sanitize_for_json(execution),
    })


@api_v1_bp.route("/datasets/<dataset_id>/insights", methods=["GET"])
def get_insights(dataset_id):
    """Moteur d'interprétation narratif — agrège des insights depuis toutes les analyses."""
    ds = dataset_manager.get(dataset_id)
    if ds is None:
        return jsonify({"error": "Dataset introuvable"}), 404

    from app.core.interpretation import (
        narrate_descriptive, narrate_correlations, narrate_vif,
        narrate_modeling, narrate_timeseries, narrate_multivariate_timeseries,
        narrate_pca, narrate_ca, narrate_mca, narrate_diagnostics,
    )
    from app.core.interpretation.base import sort_insights, insights_to_dict
    from app.core.recommendations import diagnose_dataset

    df = dataset_manager.get_df(dataset_id)
    all_insights = []

    try:
        advisories = diagnose_dataset(df, ds.get("profile"))
        all_insights.extend(narrate_diagnostics(advisories))
    except Exception:
        pass

    analysis = ds.get("analysis_results") or {}

    desc = analysis.get("descriptive_stats") or analysis.get("descriptive")
    if isinstance(desc, dict):
        try:
            all_insights.extend(narrate_descriptive(desc))
        except Exception:
            pass

    corr = analysis.get("correlations") or analysis.get("correlation_matrix")
    if isinstance(corr, dict):
        try:
            all_insights.extend(narrate_correlations(corr))
        except Exception:
            pass

    vif = analysis.get("vif")
    if vif:
        try:
            all_insights.extend(narrate_vif(vif))
        except Exception:
            pass

    model_res = ds.get("model_results") or analysis.get("modeling")
    if isinstance(model_res, dict) and model_res:
        try:
            all_insights.extend(narrate_modeling(model_res))
        except Exception:
            pass

    ts = ds.get("timeseries_results") or analysis.get("timeseries")
    if isinstance(ts, dict) and ts:
        try:
            all_insights.extend(narrate_timeseries(ts))
        except Exception:
            pass

    mts = ds.get("multivariate_ts_results") or analysis.get("multivariate_ts")
    if isinstance(mts, dict) and mts:
        try:
            all_insights.extend(narrate_multivariate_timeseries(mts))
        except Exception:
            pass

    factor = ds.get("factor_results") or analysis.get("factor")
    if isinstance(factor, dict):
        if factor.get("pca"):
            try:
                all_insights.extend(narrate_pca(factor["pca"]))
            except Exception:
                pass
        if factor.get("ca"):
            try:
                all_insights.extend(narrate_ca(factor["ca"]))
            except Exception:
                pass
        if factor.get("mca"):
            try:
                all_insights.extend(narrate_mca(factor["mca"]))
            except Exception:
                pass

    sorted_ins = sort_insights(all_insights)
    return jsonify({
        "insights": insights_to_dict(sorted_ins),
        "count": len(sorted_ins),
        "summary": {
            "critical": sum(1 for i in sorted_ins if i.severity.value == "critical"),
            "warning": sum(1 for i in sorted_ins if i.severity.value == "warning"),
            "info": sum(1 for i in sorted_ins if i.severity.value == "info"),
            "success": sum(1 for i in sorted_ins if i.severity.value == "success"),
            "methodological": sum(1 for i in sorted_ins if i.severity.value == "methodological"),
        },
    })


@api_v1_bp.route("/datasets/<dataset_id>/recommend-tests", methods=["POST"])
def recommend_tests_route(dataset_id):
    """Recommande les tests adaptés.
    Body JSON : {"col1": "var1", "col2": "var2"}
    """
    ds = dataset_manager.get(dataset_id)
    if ds is None:
        return jsonify({"error": "Dataset introuvable"}), 404

    data = request.get_json(silent=True) or {}
    col1 = data.get("col1")
    if not col1:
        return jsonify({"error": "col1 requis"}), 400

    from app.core.recommendations import recommend_tests
    df = dataset_manager.get_df(dataset_id)
    recs = recommend_tests(df, col1, data.get("col2"))
    return jsonify({"recommendations": recs})


@api_v1_bp.route("/datasets/<dataset_id>/check-assumptions", methods=["POST"])
def check_assumptions_route(dataset_id):
    """Vérifie les hypothèses d'un test.
    Body JSON : {"test_type": "means_comparison", "value_col": "...", "group_col": "..."}
    """
    ds = dataset_manager.get(dataset_id)
    if ds is None:
        return jsonify({"error": "Dataset introuvable"}), 404

    data = request.get_json(silent=True) or {}
    test_type = data.get("test_type")
    if not test_type:
        return jsonify({"error": "test_type requis"}), 400

    from app.core.recommendations import check_assumptions_for_test
    df = dataset_manager.get_df(dataset_id)
    checks = check_assumptions_for_test(df, test_type, data)
    all_passed = all(c.get("passed", True) for c in checks if c.get("passed") is not None)
    return jsonify({"checks": checks, "all_passed": all_passed})


@api_v1_bp.route("/datasets/<dataset_id>/recommend-models", methods=["POST"])
def recommend_models_route(dataset_id):
    """Recommande les modèles adaptés.
    Body JSON : {"target_column": "prix"}
    """
    ds = dataset_manager.get(dataset_id)
    if ds is None:
        return jsonify({"error": "Dataset introuvable"}), 404

    data = request.get_json(silent=True) or {}
    target = data.get("target_column")
    if not target:
        return jsonify({"error": "target_column requis"}), 400

    from app.core.recommendations import recommend_models
    df = dataset_manager.get_df(dataset_id)
    recs = recommend_models(df, target)
    return jsonify({"recommendations": recs})
