"""
Routes — Scénarios et simulation avancée.
"""

from flask import request, jsonify
from app.api.v1 import api_v1_bp
from app.services.dataset_service import dataset_manager


@api_v1_bp.route("/datasets/<dataset_id>/scenarios/create", methods=["POST"])
def create_scenario_route(dataset_id):
    """Crée un scénario à partir de modifications.
    Body JSON :
    {
        "name": "pessimiste",
        "modifications": {
            "col1": 100,
            "col2": {"shift": -0.1},
            "col3": {"set_quantile": 0.1}
        }
    }
    """
    ds = dataset_manager.get(dataset_id)
    if ds is None:
        return jsonify({"error": "Dataset introuvable"}), 404

    data = request.get_json()
    if not data or "modifications" not in data:
        return jsonify({"error": "modifications requis"}), 400

    df = dataset_manager.get_df(dataset_id)
    from app.core.scenarios import create_scenario

    try:
        scenario = create_scenario(
            df,
            modifications=data["modifications"],
            name=data.get("name", "custom"),
        )
        cache = dataset_manager._get_cache(dataset_id)
        scenarios = cache.setdefault("scenarios", {})
        scenarios[scenario["name"]] = scenario

        return jsonify({
            "name": scenario["name"],
            "modifications": scenario["modifications"],
            "n_rows": scenario["n_rows"],
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_v1_bp.route("/datasets/<dataset_id>/scenarios/presets", methods=["POST"])
def create_preset_scenarios_route(dataset_id):
    """Crée les scénarios prédéfinis (pessimiste / central / optimiste).
    Body JSON optionnel : {"columns": ["col1", "col2"]}
    """
    ds = dataset_manager.get(dataset_id)
    if ds is None:
        return jsonify({"error": "Dataset introuvable"}), 404

    data = request.get_json() or {}
    df = dataset_manager.get_df(dataset_id)
    from app.core.scenarios import create_preset_scenarios

    try:
        scenarios = create_preset_scenarios(df, numeric_cols=data.get("columns"))
        cache = dataset_manager._get_cache(dataset_id)
        cache_scenarios = cache.setdefault("scenarios", {})
        for s in scenarios:
            cache_scenarios[s["name"]] = s

        return jsonify({
            "scenarios": [
                {"name": s["name"], "modifications": s["modifications"], "n_rows": s["n_rows"]}
                for s in scenarios
            ]
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_v1_bp.route("/datasets/<dataset_id>/scenarios/run", methods=["POST"])
def run_scenario_route(dataset_id):
    """Exécute un ou plusieurs scénarios sur le modèle entraîné.
    Body JSON : {"scenario_names": ["pessimiste", "central", "optimiste"]}
    Ou : {"scenario_names": ["custom"]}
    """
    ds = dataset_manager.get(dataset_id)
    if ds is None:
        return jsonify({"error": "Dataset introuvable"}), 404

    cache = dataset_manager._get_cache(dataset_id)
    model_results = cache.get("model_results", {})
    best_model = model_results.get("best_model")
    if best_model is None:
        return jsonify({"error": "Aucun modèle entraîné. Lancez d'abord la modélisation."}), 400

    data = request.get_json() or {}
    scenario_names = data.get("scenario_names", [])
    scenarios = cache.get("scenarios", {})

    if not scenario_names:
        scenario_names = list(scenarios.keys())
    if not scenario_names:
        return jsonify({"error": "Aucun scénario défini. Créez des scénarios d'abord."}), 400

    from app.core.scenarios import run_scenario, compare_scenarios

    task_type = model_results.get("task_type", "regression")
    feature_names = model_results.get("data_split", {}).get("features", [])

    try:
        results = []
        names = []
        for name in scenario_names:
            sc = scenarios.get(name)
            if sc is None:
                return jsonify({"error": f"Scénario '{name}' introuvable"}), 404
            res = run_scenario(sc["df"], best_model, feature_names, task_type)
            results.append(res)
            names.append(name)

        comparison = compare_scenarios(results, names)

        return jsonify({
            "task_type": task_type,
            "results": [
                {"name": n, **r} for n, r in zip(names, results)
            ],
            "comparison": comparison,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_v1_bp.route("/datasets/<dataset_id>/scenarios/compare", methods=["POST"])
def compare_scenarios_route(dataset_id):
    """Alias pour run qui inclut la comparaison. Même payload que /run."""
    return run_scenario_route(dataset_id)


@api_v1_bp.route("/datasets/<dataset_id>/sensitivity", methods=["POST"])
def sensitivity_analysis_route(dataset_id):
    """Analyse de sensibilité sur une ou plusieurs variables.
    Body JSON :
    {
        "variables": ["col1", "col2"],
        "n_points": 20,
        "range_pct": 0.5
    }
    """
    ds = dataset_manager.get(dataset_id)
    if ds is None:
        return jsonify({"error": "Dataset introuvable"}), 404

    cache = dataset_manager._get_cache(dataset_id)
    model_results = cache.get("model_results", {})
    best_model = model_results.get("best_model")
    if best_model is None:
        return jsonify({"error": "Aucun modèle entraîné."}), 400

    data = request.get_json() or {}
    feature_names = model_results.get("data_split", {}).get("features", [])
    variables = data.get("variables", feature_names)
    n_points = data.get("n_points", 20)
    range_pct = data.get("range_pct", 0.5)
    task_type = model_results.get("task_type", "regression")

    df = dataset_manager.get_df(dataset_id)
    from app.core.scenarios import sensitivity_analysis

    try:
        results = []
        for var in variables:
            if var not in feature_names:
                continue
            res = sensitivity_analysis(
                best_model, df, feature_names, var,
                task_type=task_type, n_points=n_points, range_pct=range_pct,
            )
            results.append(res)

        return jsonify({"analyses": results, "count": len(results)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_v1_bp.route("/datasets/<dataset_id>/tornado", methods=["POST"])
def tornado_chart_route(dataset_id):
    """Données pour tornado chart.
    Body JSON optionnel : {"sigma": 1.0}
    """
    ds = dataset_manager.get(dataset_id)
    if ds is None:
        return jsonify({"error": "Dataset introuvable"}), 404

    cache = dataset_manager._get_cache(dataset_id)
    model_results = cache.get("model_results", {})
    best_model = model_results.get("best_model")
    if best_model is None:
        return jsonify({"error": "Aucun modèle entraîné."}), 400

    data = request.get_json() or {}
    sigma = data.get("sigma", 1.0)
    feature_names = model_results.get("data_split", {}).get("features", [])
    task_type = model_results.get("task_type", "regression")

    df = dataset_manager.get_df(dataset_id)
    from app.core.scenarios import tornado_chart_data

    try:
        result = tornado_chart_data(best_model, df, feature_names, task_type, sigma)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_v1_bp.route("/datasets/<dataset_id>/partial-dependence", methods=["POST"])
def partial_dependence_route(dataset_id):
    """Partial Dependence Plots.
    Body JSON : {"features": ["col1", "col2"], "n_points": 30}
    """
    ds = dataset_manager.get(dataset_id)
    if ds is None:
        return jsonify({"error": "Dataset introuvable"}), 404

    cache = dataset_manager._get_cache(dataset_id)
    model_results = cache.get("model_results", {})
    best_model = model_results.get("best_model")
    if best_model is None:
        return jsonify({"error": "Aucun modèle entraîné."}), 400

    data = request.get_json() or {}
    feature_names = model_results.get("data_split", {}).get("features", [])
    features = data.get("features", feature_names[:5])
    n_points = data.get("n_points", 30)

    df = dataset_manager.get_df(dataset_id)
    from app.core.scenarios import partial_dependence_data

    try:
        result = partial_dependence_data(best_model, df, feature_names, features, n_points)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_v1_bp.route("/datasets/<dataset_id>/monte-carlo", methods=["POST"])
def monte_carlo_route(dataset_id):
    """Simulation Monte Carlo.
    Body JSON :
    {
        "n_simulations": 1000,
        "noise_type": "gaussian",
        "noise_scale": 1.0,
        "seed": 42
    }
    """
    ds = dataset_manager.get(dataset_id)
    if ds is None:
        return jsonify({"error": "Dataset introuvable"}), 404

    cache = dataset_manager._get_cache(dataset_id)
    model_results = cache.get("model_results", {})
    best_model = model_results.get("best_model")
    if best_model is None:
        return jsonify({"error": "Aucun modèle entraîné."}), 400

    data = request.get_json() or {}
    n_simulations = min(data.get("n_simulations", 1000), 10000)
    noise_type = data.get("noise_type", "gaussian")
    if noise_type not in ("gaussian", "uniform"):
        return jsonify({"error": "noise_type doit être 'gaussian' ou 'uniform'"}), 400
    noise_scale = data.get("noise_scale", 1.0)
    seed = data.get("seed", 42)
    task_type = model_results.get("task_type", "regression")
    feature_names = model_results.get("data_split", {}).get("features", [])

    df = dataset_manager.get_df(dataset_id)
    from app.core.scenarios import monte_carlo_simulation

    try:
        result = monte_carlo_simulation(
            best_model, df, feature_names,
            n_simulations=n_simulations,
            noise_type=noise_type,
            noise_scale=noise_scale,
            task_type=task_type,
            seed=seed,
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_v1_bp.route("/datasets/<dataset_id>/stress-test", methods=["POST"])
def stress_test_route(dataset_id):
    """Stress test : chocs de ±nσ sur chaque variable.
    Body JSON optionnel : {"sigmas": [1.0, 2.0]}
    """
    ds = dataset_manager.get(dataset_id)
    if ds is None:
        return jsonify({"error": "Dataset introuvable"}), 404

    cache = dataset_manager._get_cache(dataset_id)
    model_results = cache.get("model_results", {})
    best_model = model_results.get("best_model")
    if best_model is None:
        return jsonify({"error": "Aucun modèle entraîné."}), 400

    data = request.get_json() or {}
    sigmas = data.get("sigmas", [1.0, 2.0])
    task_type = model_results.get("task_type", "regression")
    feature_names = model_results.get("data_split", {}).get("features", [])

    df = dataset_manager.get_df(dataset_id)
    from app.core.scenarios import stress_test

    try:
        result = stress_test(best_model, df, feature_names, task_type, sigmas)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_v1_bp.route("/datasets/<dataset_id>/scenarios", methods=["GET"])
def list_scenarios_route(dataset_id):
    """Liste les scénarios sauvegardés en cache."""
    ds = dataset_manager.get(dataset_id)
    if ds is None:
        return jsonify({"error": "Dataset introuvable"}), 404

    cache = dataset_manager._get_cache(dataset_id)
    scenarios = cache.get("scenarios", {})

    return jsonify({
        "scenarios": [
            {"name": name, "modifications": sc["modifications"], "n_rows": sc["n_rows"]}
            for name, sc in scenarios.items()
        ],
        "count": len(scenarios),
    })
