"""
Utilitaires partagés pour l'exécution du Canvas.
"""

def _sanitize(obj, depth=0):
    """Nettoie récursivement un objet pour JSON."""
    import numpy as np
    if depth > 10:
        return str(obj)
    if obj is None or isinstance(obj, (bool, str)):
        return obj
    if isinstance(obj, int):
        return obj
    if isinstance(obj, float):
        return None if (np.isnan(obj) or np.isinf(obj)) else obj
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        v = float(obj)
        return None if (np.isnan(v) or np.isinf(v)) else v
    if isinstance(obj, np.ndarray):
        return _sanitize(obj.tolist(), depth + 1)
    if isinstance(obj, dict):
        return {k: _sanitize(v, depth + 1) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_sanitize(v, depth + 1) for v in obj]
    try:
        import json
        json.dumps(obj)
        return obj
    except (TypeError, ValueError):
        return None
