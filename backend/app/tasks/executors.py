"""
Exécuteurs de tâches — wrappent les méthodes DatasetManager pour le système de jobs.
"""

from __future__ import annotations
from typing import Callable

from app.services.dataset_service import dataset_manager
from app.services.job_service import register_executor


def _exec_analysis(dataset_id: str, params: dict, progress_cb: Callable):
    """Analyse descriptive complète."""
    progress_cb(10, "Calcul des statistiques descriptives...")
    result = dataset_manager.analyze(dataset_id)
    progress_cb(90, "Finalisation...")
    return {"result": result}


def _exec_modeling(dataset_id: str, params: dict, progress_cb: Callable):
    """Entraînement compétitif."""
    progress_cb(5, "Préparation des données...")
    result = dataset_manager.train_models(
        dataset_id=dataset_id,
        target_col=params["target_column"],
        model_keys=params.get("models"),
        test_size=params.get("test_size", 0.2),
        split_strategy=params.get("split_strategy", "auto"),
        temporal_col=params.get("temporal_column"),
    )
    # Filtrer les objets non-sérialisables
    safe_result = {k: v for k, v in result.items() if k not in ("best_model", "trained_models")}
    progress_cb(95, "Modèle entraîné")
    return {"result": safe_result}


def _exec_timeseries(dataset_id: str, params: dict, progress_cb: Callable):
    """Analyse série temporelle."""
    progress_cb(10, "Analyse de la série temporelle...")
    result = dataset_manager.run_timeseries(
        dataset_id=dataset_id,
        date_col=params["date_col"],
        value_col=params["value_col"],
        models=params.get("models"),
        forecast_steps=params.get("forecast_steps", 10),
    )
    progress_cb(95, "Prévisions calculées")
    return {"result": result}


def _exec_multivariate_ts(dataset_id: str, params: dict, progress_cb: Callable):
    """Analyse séries temporelles multivariées."""
    progress_cb(10, "Analyse multivariée...")
    result = dataset_manager.run_multivariate_timeseries(
        dataset_id=dataset_id,
        date_col=params["date_col"],
        value_cols=params["value_cols"],
        models=params.get("models"),
        forecast_steps=params.get("forecast_steps", 10),
        granger_max_lag=params.get("granger_max_lag", 4),
        forced_model=params.get("forced_model"),
        var_data_mode=params.get("var_data_mode", "auto"),
        var_trend=params.get("var_trend", "c"),
        granger_data_mode=params.get("granger_data_mode", "auto"),
        forecast_dates=params.get("forecast_dates"),
        target_col=params.get("target_col"),
        bvar_lambda1=params.get("bvar_lambda1", 0.2),
        bvar_lambda2=params.get("bvar_lambda2", 0.5),
    )
    progress_cb(95, "Analyse multivariée terminée")
    return {"result": result}


def _exec_cleaning(dataset_id: str, params: dict, progress_cb: Callable):
    """Pipeline de nettoyage."""
    progress_cb(10, "Nettoyage en cours...")
    result = dataset_manager.clean(dataset_id, params["pipeline"])
    progress_cb(95, "Nettoyage terminé")
    return {"result": result}


def _exec_report(dataset_id: str, params: dict, progress_cb: Callable):
    """Génération de rapport PDF."""
    progress_cb(10, "Génération du rapport PDF...")
    result = dataset_manager.generate_pdf_report(
        dataset_id=dataset_id,
        title=params.get("title", "Rapport d'Analyse"),
        organization=params.get("organization", "OpenStats — Elmas Labs"),
    )
    progress_cb(95, "Rapport généré")
    return {"result_path": result}


def _exec_hypothesis_test(dataset_id: str, params: dict, progress_cb: Callable):
    """Test d'hypothèse."""
    progress_cb(10, "Exécution du test...")
    result = dataset_manager.run_test(dataset_id, params)
    progress_cb(95, "Test terminé")
    return {"result": result}


def register_all_executors():
    """Enregistre tous les exécuteurs de tâches."""
    register_executor("analysis", _exec_analysis)
    register_executor("modeling", _exec_modeling)
    register_executor("timeseries", _exec_timeseries)
    register_executor("multivariate_ts", _exec_multivariate_ts)
    register_executor("cleaning", _exec_cleaning)
    register_executor("report", _exec_report)
    register_executor("hypothesis_test", _exec_hypothesis_test)
