"""
Serialisation JSON recursive pour les donnees analytiques.
"""

from __future__ import annotations

import datetime as dt
import json
from typing import Any

import numpy as np


def sanitize_for_json(obj: Any, _depth: int = 0) -> Any:
    """Nettoie recursivement un objet pour le rendre JSON-serialisable."""
    if _depth > 12:
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
    if isinstance(obj, (dt.datetime, dt.date)):
        return obj.isoformat()
    if hasattr(obj, "to_dict"):
        return sanitize_for_json(obj.to_dict(), _depth + 1)
    if hasattr(obj, "__dataclass_fields__"):
        d = {}
        for f in obj.__dataclass_fields__:
            d[f] = getattr(obj, f)
        return sanitize_for_json(d, _depth + 1)
    if isinstance(obj, np.ndarray):
        return sanitize_for_json(obj.tolist(), _depth + 1)
    if isinstance(obj, dict):
        return {k: sanitize_for_json(v, _depth + 1) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [sanitize_for_json(v, _depth + 1) for v in obj]
    try:
        json.dumps(obj)
        return obj
    except (TypeError, ValueError):
        return None
