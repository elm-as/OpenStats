"""
Nœud de simulation et prédiction avancée.
"""

from app.services.dataset_service import dataset_manager
from ._shared import _sanitize

def execute_simulation(data, dataset_id):
    sim_type = data.get("simulationType", "prediction")
    cache = dataset_manager._get_cache(dataset_id)
    model_results = cache.get("model_results", {})
    best_model = model_results.get("best_model")
    if best_model is None:
        return {"status": "error", "error": "Aucun modèle entraîné. Ajoutez un bloc Régression/Classification avant."}

    feature_names = model_results.get("data_split", {}).get("features", [])
    task_type = model_results.get("task_type", "regression")
    df = dataset_manager.get_df(dataset_id)

    if sim_type == "monte_carlo":
        from app.core.scenarios import monte_carlo_simulation
        result = monte_carlo_simulation(best_model, df, feature_names, task_type=task_type)
    elif sim_type == "sensitivity":
        from app.core.scenarios import sensitivity_analysis
        results = []
        for var in feature_names[:5]:
            results.append(sensitivity_analysis(best_model, df, feature_names, var, task_type=task_type))
        result = {"analyses": results}
    elif sim_type == "tornado":
        from app.core.scenarios import tornado_chart_data
        result = tornado_chart_data(best_model, df, feature_names, task_type)
    elif sim_type == "stress_test":
        from app.core.scenarios import stress_test
        result = stress_test(best_model, df, feature_names, task_type)
    elif sim_type == "scenarios":
        from app.core.scenarios import create_preset_scenarios, run_scenario, compare_scenarios
        scenarios = create_preset_scenarios(df)
        sc_results, sc_names = [], []
        for sc in scenarios:
            r = run_scenario(sc["df"], best_model, feature_names, task_type)
            sc_results.append(r)
            sc_names.append(sc["name"])
        result = {"results": [{"name": n, **r} for n, r in zip(sc_names, sc_results)], "comparison": compare_scenarios(sc_results, sc_names)}
    else:  # prediction
        result = {"message": "Prédiction unitaire: utilisez les blocs de simulation dans l'interface principale", "feature_names": feature_names}

    return {
        "status": "success",
        "message": f"Simulation '{sim_type}' exécutée",
        "result": _sanitize(result),
    }
