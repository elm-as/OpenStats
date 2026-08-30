"""
Registre et dispatcher d'exécution des nœuds Canvas.
"""

import traceback
import hashlib
import json
import redis
from flask import current_app

from .source import execute_dataset
from .preparation import execute_typing, execute_cleaning, execute_transform, execute_compute_variable
from .descriptive import execute_descriptive_numeric, execute_descriptive_categorical, execute_correlation, execute_vif, execute_bootstrap, execute_outliers
from .tests import execute_test_compare_means, execute_test_correlation, execute_test_independence, execute_test_stationarity, execute_test_normality, execute_test_anova
from .factorielle import execute_pca, execute_ca, execute_mca
from .modeling import (
    execute_clustering,
    execute_hierarchical_clustering,
    execute_regression,
    execute_classification,
    execute_explainability,
)
from .timeseries import execute_timeseries, execute_multivariate_timeseries, execute_granger, execute_cointegration, execute_ts_decomposition
from .simulation import execute_simulation
from .visualization import execute_visualization
from .output import execute_ai, execute_extension, execute_insights, execute_output
from .sql import execute_sql
from .hybrid import execute_python
from .advanced_analytics import execute_survival, execute_causal, execute_manifold, execute_garch
from ._shared import _sanitize

# Mapping de type de nœud vers la fonction d'exécution
NODE_EXECUTORS = {
    "dataset": execute_dataset,
    "sql": execute_sql,
    "python": execute_python,
    "typing": execute_typing,
    "cleaning": execute_cleaning,
    "transform": execute_transform,
    "computeVariable": execute_compute_variable,
    "descriptiveNumeric": execute_descriptive_numeric,
    "descriptiveCategorical": execute_descriptive_categorical,
    "bootstrap": execute_bootstrap,
    "outliers": execute_outliers,
    "correlation": execute_correlation,
    "vif": execute_vif,
    "testCompareMeans": execute_test_compare_means,
    "testCorrelation": execute_test_correlation,
    "testIndependence": execute_test_independence,
    "testStationarity": execute_test_stationarity,
    "testNormality": execute_test_normality,
    "testAnova": execute_test_anova,
    "pca": execute_pca,
    "ca": execute_ca,
    "mca": execute_mca,
    "clustering": execute_clustering,
    "hierarchicalClustering": execute_hierarchical_clustering,

    "regression": execute_regression,
    "classification": execute_classification,
    "explainability": execute_explainability,
    "survival": execute_survival,
    "causal": execute_causal,
    "manifold": execute_manifold,
    "garch": execute_garch,
    "timeseries": execute_timeseries,
    "multivariateTimeseries": execute_multivariate_timeseries,
    "granger": execute_granger,
    "cointegration": execute_cointegration,
    "tsDecomposition": execute_ts_decomposition,
    "simulation": execute_simulation,
    "visualization": execute_visualization,
    "ai": execute_ai,
    "extension": execute_extension,
    "insights": execute_insights,
    "output": execute_output,
}

import threading

_redis_client = None
_redis_disabled = False
_redis_lock = threading.Lock()

def get_redis_client():
    global _redis_client, _redis_disabled
    if _redis_disabled:
        return None
    with _redis_lock:
        if _redis_disabled:
            return None
        if _redis_client is None:
            try:
                url = current_app.config.get("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")
                client = redis.from_url(url, socket_connect_timeout=1, socket_timeout=1)
                client.ping()
                _redis_client = client
            except Exception as e:
                current_app.logger.info("Redis non disponible (%s), le cache in-memory/dégradé sera utilisé", e)
                _redis_disabled = True
                return None
        return _redis_client

def execute_node(node_type, data, dataset_id):
    """
    Exécute un nœud Canvas et renvoie { status, result?, error?, message? }.
    `dataset_id` est l'ID du dataset résolu depuis le nœud source.
    """
    if not dataset_id and node_type != "dataset":
        from app.models.dataset import Dataset
        latest = Dataset.query.order_by(Dataset.created_at.desc()).first()
        if latest:
            dataset_id = latest.id

    if not dataset_id and node_type != "dataset":
        return {"status": "skipped", "message": "Aucun dataset connecté"}

    if node_type not in NODE_EXECUTORS:
        return {"status": "skipped", "message": f"Type de nœud '{node_type}' non supporté"}

    # Ne pas cacher le noeud dataset
    use_cache = node_type != "dataset"
    cache_key = None
    r = None
    
    if use_cache:
        try:
            r = get_redis_client()
            if r:
                data_hash = hashlib.md5(json.dumps(data, sort_keys=True).encode()).hexdigest()
                cache_key = f"openstats:canvas:cache:{node_type}:{dataset_id}:{data_hash}"
                cached = r.get(cache_key)
                if cached:
                    return json.loads(cached)
        except Exception as e:
            current_app.logger.warning(f"Redis cache error: {e}")

    try:
        current_app.logger.info("Executing node '%s' (dataset_id=%s)", node_type, dataset_id)
        executor = NODE_EXECUTORS[node_type]
        result = executor(data, dataset_id)
        current_app.logger.info("Finished node '%s': %s", node_type, result.get("message") or result.get("status"))
        
        # Mise en cache (TTL de 24h)
        if use_cache and r and cache_key and result.get("status") == "success":
            try:
                r.setex(cache_key, 86400, json.dumps(result))
            except Exception:
                pass
                
        return result
    except Exception as e:
        return {"status": "error", "error": str(e), "traceback": traceback.format_exc()}
