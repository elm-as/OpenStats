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
from .descriptive import execute_descriptive_numeric, execute_descriptive_categorical, execute_correlation, execute_vif
from .tests import execute_test_compare_means, execute_test_correlation, execute_test_independence, execute_test_stationarity
from .factorielle import execute_pca, execute_ca, execute_mca
from .modeling import execute_clustering, execute_regression, execute_classification
from .timeseries import execute_timeseries, execute_multivariate_timeseries
from .simulation import execute_simulation
from .visualization import execute_visualization
from .output import execute_ai, execute_extension, execute_insights, execute_output
from .sql import execute_sql
from .hybrid import execute_python

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
    "correlation": execute_correlation,
    "vif": execute_vif,
    "testCompareMeans": execute_test_compare_means,
    "testCorrelation": execute_test_correlation,
    "testIndependence": execute_test_independence,
    "testStationarity": execute_test_stationarity,
    "pca": execute_pca,
    "ca": execute_ca,
    "mca": execute_mca,
    "clustering": execute_clustering,
    "regression": execute_regression,
    "classification": execute_classification,
    "timeseries": execute_timeseries,
    "multivariateTimeseries": execute_multivariate_timeseries,
    "simulation": execute_simulation,
    "visualization": execute_visualization,
    "ai": execute_ai,
    "extension": execute_extension,
    "insights": execute_insights,
    "output": execute_output,
}

_redis_client = None
_redis_disabled = False

def get_redis_client():
    global _redis_client, _redis_disabled
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
        executor = NODE_EXECUTORS[node_type]
        result = executor(data, dataset_id)
        
        # Mise en cache (TTL de 24h)
        if use_cache and r and cache_key and result.get("status") == "success":
            try:
                r.setex(cache_key, 86400, json.dumps(result))
            except Exception:
                pass
                
        return result
    except Exception as e:
        return {"status": "error", "error": str(e), "traceback": traceback.format_exc()}
