"""
Routes — Colonnes exclues et capacités d'analyse d'un dataset.
"""

from flask import request, jsonify
from app.api.v1 import api_v1_bp
from app.services.dataset_service import dataset_manager
from app.schemas import ExcludedColumnsSchema, validate_payload


@api_v1_bp.route("/datasets/<dataset_id>/excluded-columns", methods=["GET"])
def get_excluded_columns(dataset_id):
    """Retourne les colonnes exclues du dataset."""
    try:
        excluded = dataset_manager.get_excluded_columns(dataset_id)
        df = dataset_manager.get_df(dataset_id, cleaned=True, respect_exclusions=False)
        if df is None:
            return jsonify({"error": "Dataset introuvable"}), 404
        all_cols = df.columns.tolist()
        return jsonify({
            "excluded_columns": excluded,
            "active_columns": [c for c in all_cols if c not in excluded],
            "all_columns": all_cols,
        })
    except ValueError as e:
        return jsonify({"error": str(e)}), 404


@api_v1_bp.route("/datasets/<dataset_id>/excluded-columns", methods=["PUT"])
def set_excluded_columns(dataset_id):
    """Définit les colonnes exclues des analyses."""
    data, err = validate_payload(ExcludedColumnsSchema, request.get_json())
    if err:
        return jsonify(err), 400
    try:
        result = dataset_manager.set_excluded_columns(dataset_id, data["excluded_columns"])
        return jsonify(result)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@api_v1_bp.route("/datasets/<dataset_id>/capabilities", methods=["GET"])
def get_capabilities(dataset_id):
    """Retourne les analyses disponibles en fonction des types de colonnes du dataset."""
    ds = dataset_manager.get(dataset_id)
    if ds is None:
        return jsonify({"error": "Dataset introuvable"}), 404

    df = dataset_manager.get_df(dataset_id)
    profile = ds["profile"]
    dictionary = profile.get("dictionary", [])
    excluded = ds.get("excluded_columns", [])

    numeric_cols, discrete_cols, categorical_cols, binary_cols, temporal_cols = [], [], [], [], []

    for col_info in dictionary:
        col_name = col_info["nom_brut"]
        if col_name in excluded:
            continue
        col_type = col_info.get("type_statistique", "")

        if col_type == "continu":
            numeric_cols.append(col_name)
        elif col_type == "discret":
            numeric_cols.append(col_name)
            discrete_cols.append(col_name)
        elif col_type == "binaire":
            binary_cols.append(col_name)
            categorical_cols.append(col_name)
        elif col_type.startswith("catégoriel"):
            categorical_cols.append(col_name)
        elif col_type == "temporel":
            temporal_cols.append(col_name)

    grouping_cols = categorical_cols + discrete_cols

    group_counts = {}
    for col in grouping_cols:
        if col in df.columns:
            group_counts[col] = int(df[col].nunique())

    has_numeric = len(numeric_cols) >= 1
    has_multi_numeric = len(numeric_cols) >= 2
    has_categorical = len(categorical_cols) >= 1
    has_grouping = len(grouping_cols) >= 1
    has_multi_grouping = len(grouping_cols) >= 2
    has_multi_categorical = len(categorical_cols) >= 2
    has_binary = len(binary_cols) >= 1
    has_temporal = len(temporal_cols) >= 1

    analyses = []

    if has_numeric:
        analyses.append({
            "key": "descriptive_numeric", "label": "Statistiques descriptives (numériques)",
            "description": "Moyenne, médiane, écart-type, asymétrie, kurtosis",
            "category": "descriptive", "icon": "bar_chart", "available": True,
            "requires": "≥1 variable numérique", "applicable_columns": numeric_cols,
        })

    if has_categorical:
        analyses.append({
            "key": "descriptive_categorical", "label": "Statistiques descriptives (catégorielles)",
            "description": "Mode, fréquences, cardinalité, distribution",
            "category": "descriptive", "icon": "pie_chart", "available": True,
            "requires": "≥1 variable catégorielle", "applicable_columns": categorical_cols,
        })

    analyses.append({
        "key": "correlation_pearson", "label": "Corrélation de Pearson",
        "description": "Corrélation linéaire entre variables numériques (suppose normalité)",
        "category": "correlation", "icon": "trending_up", "available": has_multi_numeric,
        "requires": "≥2 variables numériques", "applicable_columns": numeric_cols,
        "reason": None if has_multi_numeric else f"Seulement {len(numeric_cols)} variable(s) numérique(s) détectée(s)",
    })

    analyses.append({
        "key": "correlation_spearman", "label": "Corrélation de Spearman",
        "description": "Corrélation de rang (pas de supposition de normalité)",
        "category": "correlation", "icon": "trending_up", "available": has_multi_numeric,
        "requires": "≥2 variables numériques", "applicable_columns": numeric_cols,
        "reason": None if has_multi_numeric else f"Seulement {len(numeric_cols)} variable(s) numérique(s) détectée(s)",
    })

    analyses.append({
        "key": "vif", "label": "Facteur d'Inflation de la Variance (VIF)",
        "description": "Détection de la multicolinéarité entre variables explicatives",
        "category": "diagnostic", "icon": "alert_triangle", "available": has_multi_numeric,
        "requires": "≥2 variables numériques", "applicable_columns": numeric_cols,
        "reason": None if has_multi_numeric else f"Seulement {len(numeric_cols)} variable(s) numérique(s) détectée(s)",
    })

    can_compare_means = has_grouping and has_numeric
    analyses.append({
        "key": "test_compare_means",
        "label": "Comparaison de moyennes (T-test / Mann-Whitney / ANOVA / Kruskal-Wallis)",
        "description": "Compare la moyenne d'une variable numérique entre les groupes. Sélection automatique du test.",
        "category": "hypothesis", "icon": "git_compare", "available": can_compare_means,
        "requires": "1 variable de groupement + 1 variable numérique",
        "config_fields": [
            {"key": "group_col", "label": "Variable de groupement", "type": "select", "options": grouping_cols},
            {"key": "value_col", "label": "Variable à comparer", "type": "select", "options": numeric_cols},
        ],
        "reason": None if can_compare_means else "Nécessite au moins 1 variable de groupement ET 1 variable numérique",
    })

    analyses.append({
        "key": "test_correlation", "label": "Test de corrélation (Pearson / Spearman)",
        "description": "Teste la significativité de la corrélation entre deux variables numériques.",
        "category": "hypothesis", "icon": "link", "available": has_multi_numeric,
        "requires": "2 variables numériques",
        "config_fields": [
            {"key": "col1", "label": "Variable 1", "type": "select", "options": numeric_cols},
            {"key": "col2", "label": "Variable 2", "type": "select", "options": numeric_cols},
        ],
        "reason": None if has_multi_numeric else f"Seulement {len(numeric_cols)} variable(s) numérique(s)",
    })

    analyses.append({
        "key": "test_independence", "label": "Test d'indépendance (Chi-carré / Fisher)",
        "description": "Teste l'indépendance entre deux variables catégorielles ou discrètes.",
        "category": "hypothesis", "icon": "grid", "available": has_multi_grouping,
        "requires": "2 variables catégorielles ou discrètes",
        "config_fields": [
            {"key": "col1", "label": "Variable 1", "type": "select", "options": grouping_cols},
            {"key": "col2", "label": "Variable 2", "type": "select", "options": grouping_cols},
        ],
        "reason": None if has_multi_grouping else f"Seulement {len(grouping_cols)} variable(s) catégorielle(s) / discrète(s)",
    })

    analyses.append({
        "key": "test_stationarity", "label": "Tests de stationnarité (ADF / KPSS)",
        "description": "Augmented Dickey-Fuller + KPSS. Conclusion combinée + ordre d'intégration suggéré.",
        "category": "hypothesis", "icon": "activity", "available": has_numeric,
        "requires": "1 variable numérique",
        "config_fields": [{"key": "col", "label": "Variable à tester", "type": "select", "options": numeric_cols}],
        "reason": None if has_numeric else "Aucune variable numérique disponible",
    })

    regression_targets = numeric_cols
    classification_targets = [c for c in grouping_cols if group_counts.get(c, 0) >= 2]

    analyses.append({
        "key": "modeling_regression", "label": "Modélisation prédictive — Régression",
        "description": "Prédiction d'une variable numérique continue. Algorithmes : Linéaire, Ridge, Lasso, RF, XGBoost…",
        "category": "modeling", "icon": "trending_up",
        "available": len(regression_targets) >= 1 and (len(numeric_cols) + len(categorical_cols)) >= 2,
        "requires": "Variable cible numérique + ≥1 variable explicative",
        "applicable_columns": regression_targets,
        "reason": None if regression_targets else "Aucune variable numérique pour servir de cible",
    })

    analyses.append({
        "key": "modeling_classification", "label": "Modélisation prédictive — Classification",
        "description": "Prédiction d'une variable catégorielle ou discrète. Algorithmes : Logistique, RF, XGBoost, SVM…",
        "category": "modeling", "icon": "layers",
        "available": len(classification_targets) >= 1 and (len(numeric_cols) + len(categorical_cols)) >= 2,
        "requires": "Variable cible catégorielle/discrète + ≥1 variable explicative",
        "applicable_columns": classification_targets,
        "reason": None if classification_targets else "Aucune variable catégorielle/discrète pour servir de cible",
    })

    can_timeseries = has_temporal and has_numeric
    analyses.append({
        "key": "timeseries", "label": "Analyse de séries temporelles (ARIMA / SARIMA / Holt-Winters)",
        "description": "Décomposition, tests ADF/KPSS, modélisation ARIMA/SARIMA/Holt-Winters et prévisions",
        "category": "timeseries", "icon": "trending_up", "available": can_timeseries,
        "requires": "1 variable temporelle + 1 variable numérique",
        "config_fields": [
            {"key": "date_col", "label": "Variable date", "type": "select", "options": temporal_cols},
            {"key": "value_col", "label": "Variable à analyser", "type": "select", "options": numeric_cols},
            {"key": "forecast_steps", "label": "Horizon de prévision", "type": "select", "options": ["5", "10", "20", "30", "50"]},
        ],
        "reason": None if can_timeseries else "Nécessite au moins 1 variable temporelle ET 1 variable numérique",
    })

    can_multivariate_ts = has_temporal and has_multi_numeric
    analyses.append({
        "key": "timeseries_multivariate", "label": "Séries temporelles multivariées (VAR / VECM)",
        "description": "Modélisation VAR/VECM, causalité de Granger, cointégration de Johansen, IRF, FEVD",
        "category": "timeseries", "icon": "trending_up", "available": can_multivariate_ts,
        "requires": "1 variable temporelle + ≥2 variables numériques",
        "config_fields": [
            {"key": "date_col", "label": "Variable date", "type": "select", "options": temporal_cols},
            {"key": "value_cols", "label": "Variables à analyser", "type": "multiselect", "options": numeric_cols},
            {"key": "forecast_steps", "label": "Horizon de prévision", "type": "select", "options": ["5", "10", "20", "30", "50"]},
        ],
        "reason": None if can_multivariate_ts else "Nécessite au moins 1 variable temporelle ET 2 variables numériques",
    })

    analyses.append({
        "key": "transforms", "label": "Transformations de données",
        "description": "Log, différenciation, standardisation, Box-Cox, winsorisation…",
        "category": "transformation", "icon": "trending_up", "available": has_numeric,
        "requires": "≥1 variable numérique", "applicable_columns": numeric_cols,
        "reason": None if has_numeric else "Aucune variable numérique disponible",
    })

    analyses.append({
        "key": "pca", "label": "ACP — Analyse en Composantes Principales",
        "description": "Réduction de dimensions : valeurs propres, cercle des corrélations, biplot",
        "category": "factorielle", "icon": "layers", "available": has_multi_numeric,
        "requires": "≥2 variables numériques", "applicable_columns": numeric_cols,
        "reason": None if has_multi_numeric else f"Seulement {len(numeric_cols)} variable(s) numérique(s)",
    })

    analyses.append({
        "key": "ca", "label": "AFC — Analyse Factorielle des Correspondances",
        "description": "Associations entre deux variables catégorielles via tableau de contingence",
        "category": "factorielle", "icon": "grid", "available": has_multi_categorical,
        "requires": "≥2 variables catégorielles",
        "config_fields": [
            {"key": "row_col", "label": "Variable en ligne", "type": "select", "options": grouping_cols},
            {"key": "col_col", "label": "Variable en colonne", "type": "select", "options": grouping_cols},
        ],
        "reason": None if has_multi_categorical else f"Seulement {len(categorical_cols)} variable(s) catégorielle(s)",
    })

    analyses.append({
        "key": "mca", "label": "ACM — Analyse des Correspondances Multiples",
        "description": "Analyse factorielle de plusieurs variables catégorielles : nuage des modalités, η², contributions",
        "category": "factorielle", "icon": "layers", "available": has_multi_categorical,
        "requires": "≥2 variables catégorielles", "applicable_columns": categorical_cols,
        "reason": None if has_multi_categorical else f"Seulement {len(categorical_cols)} variable(s) catégorielle(s)",
    })

    has_model = False
    try:
        ds_data = dataset_manager.get(dataset_id)
        if ds_data and ds_data.get("model_results", {}).get("best_model") is not None:
            has_model = True
    except Exception:
        pass

    analyses.append({
        "key": "simulation", "label": "Simulation / Prédiction",
        "description": "Prédisez les valeurs de la variable cible en saisissant les valeurs des variables explicatives",
        "category": "simulation", "icon": "trending_up", "available": has_model,
        "requires": "Un modèle entraîné",
        "reason": None if has_model else "Entraînez d'abord un modèle dans l'onglet Modélisation",
    })

    analyses.append({
        "key": "scenarios", "label": "Scénarios et simulation avancée",
        "description": "Comparaison de scénarios, tornado chart, analyse de sensibilité, Monte Carlo, stress test",
        "category": "simulation", "icon": "bar_chart", "available": has_model,
        "requires": "Un modèle entraîné",
        "reason": None if has_model else "Entraînez d'abord un modèle dans l'onglet Modélisation",
    })

    all_cols_list = numeric_cols + categorical_cols + temporal_cols
    can_chart = len(all_cols_list) >= 1
    analyses.append({
        "key": "chart_builder", "label": "Constructeur de graphiques",
        "description": "Créez des graphiques personnalisés : courbes, diagrammes circulaires, barres, nuages de points…",
        "category": "visualization", "icon": "bar_chart", "available": can_chart,
        "requires": "≥1 variable", "applicable_columns": all_cols_list,
        "reason": None if can_chart else "Aucune variable disponible",
    })

    analyses.append({
        "key": "user_extension", "label": "Extensions & Scripts",
        "description": "Créez vos propres méthodes d'analyse en Python. Idéal pour les besoins spécifiques non couverts.",
        "category": "extension", "icon": "sparkles", "available": True,
        "requires": "Compte utilisateur actif", "applicable_columns": all_cols_list,
    })

    return jsonify({
        "dataset_id": dataset_id,
        "columns": {
            "numeric": numeric_cols, "discrete": discrete_cols, "categorical": categorical_cols,
            "grouping": grouping_cols, "binary": binary_cols, "temporal": temporal_cols,
        },
        "column_groups": group_counts,
        "excluded_columns": excluded,
        "analyses": analyses,
        "summary": {
            "total_columns": len(dictionary),
            "active_columns": len(dictionary) - len(excluded),
            "excluded_count": len(excluded),
            "numeric_count": len(numeric_cols),
            "discrete_count": len(discrete_cols),
            "categorical_count": len(categorical_cols),
            "binary_count": len(binary_cols),
            "temporal_count": len(temporal_cols),
        },
    })
