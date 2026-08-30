"""
Cache mémoire LRU pour les DataFrames.
"""

from __future__ import annotations

import collections
import threading
import pandas as pd
from app.services.storage_service import storage

_DF_CACHE: collections.OrderedDict[str, pd.DataFrame] = collections.OrderedDict()
_DF_CACHE_LOCK = threading.Lock()
_DF_CACHE_MAX = 20


def cached_read_parquet(dataset_id: str, version: int) -> pd.DataFrame:
    """Lit un Parquet avec mise en cache mémoire LRU."""
    key = f"{dataset_id}:v{version}"
    with _DF_CACHE_LOCK:
        if key in _DF_CACHE:
            _DF_CACHE.move_to_end(key)
            return _DF_CACHE[key]
    df = storage.load_dataframe(dataset_id, version)
    with _DF_CACHE_LOCK:
        if len(_DF_CACHE) >= _DF_CACHE_MAX:
            _DF_CACHE.popitem(last=False)
        _DF_CACHE[key] = df
    return df


def invalidate_df_cache(dataset_id: str, version: int | None = None) -> None:
    """Invalide les entrées de cache pour un dataset."""
    prefix = f"{dataset_id}:v{version}" if version is not None else f"{dataset_id}:"
    with _DF_CACHE_LOCK:
        keys = [k for k in _DF_CACHE if k.startswith(prefix)]
        for k in keys:
            del _DF_CACHE[k]
