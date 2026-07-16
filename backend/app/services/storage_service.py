"""
Service de stockage fichiers pour les DataFrames (Parquet).
Gère la sérialisation/désérialisation et le versioning sur disque.
"""

from __future__ import annotations

import os
import json
import shutil
from functools import lru_cache
from pathlib import Path

import pandas as pd

from app.config import Config


class StorageService:
    """Gère le stockage des DataFrames en Parquet et le cache LRU."""

    def __init__(self, data_dir: str | None = None):
        self.data_dir = Path(data_dir or Config.DATA_DIR)
        self.datasets_dir = self.data_dir / "datasets"
        self.datasets_dir.mkdir(parents=True, exist_ok=True)
        self._cache: dict[str, pd.DataFrame] = {}
        self._max_cache = 20  # Max datasets en mémoire

    # ── Chemins ────────────────────────────────────────────────

    def _dataset_dir(self, dataset_id: str) -> Path:
        p = self.datasets_dir / dataset_id
        p.mkdir(parents=True, exist_ok=True)
        return p

    def _version_path(self, dataset_id: str, version: int) -> Path:
        return self._dataset_dir(dataset_id) / f"v{version}.parquet"

    def _results_dir(self, dataset_id: str) -> Path:
        p = self._dataset_dir(dataset_id) / "results"
        p.mkdir(parents=True, exist_ok=True)
        return p

    # ── DataFrame I/O ──────────────────────────────────────────

    def save_dataframe(self, df: pd.DataFrame, dataset_id: str, version: int) -> str:
        """Sauvegarde un DataFrame en Parquet. Retourne le chemin relatif."""
        path = self._version_path(dataset_id, version)
        df.to_parquet(path, engine="pyarrow", index=False)
        cache_key = f"{dataset_id}_v{version}"
        self._put_cache(cache_key, df)
        return str(path.relative_to(self.data_dir))

    def load_dataframe(self, dataset_id: str, version: int) -> pd.DataFrame:
        """Charge un DataFrame depuis le cache ou le disque."""
        cache_key = f"{dataset_id}_v{version}"
        if cache_key in self._cache:
            return self._cache[cache_key].copy()

        path = self._version_path(dataset_id, version)
        if not path.exists():
            raise FileNotFoundError(f"Version {version} du dataset {dataset_id} introuvable")

        df = pd.read_parquet(path, engine="pyarrow")
        self._put_cache(cache_key, df)
        return df.copy()

    def load_dataframe_from_path(self, relative_path: str) -> pd.DataFrame:
        """Charge un DataFrame depuis un chemin relatif."""
        path = self.data_dir / relative_path
        if not path.exists():
            raise FileNotFoundError(f"Fichier introuvable : {path}")
        return pd.read_parquet(path, engine="pyarrow")

    # ── Résultats d'analyses ───────────────────────────────────

    def save_result(self, data: dict, dataset_id: str, analysis_id: str) -> str:
        """Sauvegarde un résultat d'analyse en JSON. Retourne le chemin relatif."""
        result_dir = self._results_dir(dataset_id)
        path = result_dir / f"{analysis_id}.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, default=str)
        return str(path.relative_to(self.data_dir))

    def load_result(self, dataset_id: str, analysis_id: str) -> dict | None:
        """Charge un résultat d'analyse depuis le disque."""
        path = self._results_dir(dataset_id) / f"{analysis_id}.json"
        if not path.exists():
            return None
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    # ── Nettoyage ──────────────────────────────────────────────

    def delete_dataset(self, dataset_id: str) -> None:
        """Supprime tous les fichiers d'un dataset."""
        ds_dir = self.datasets_dir / dataset_id
        if ds_dir.exists():
            shutil.rmtree(ds_dir)
        # Purge cache
        keys_to_remove = [k for k in self._cache if k.startswith(dataset_id)]
        for k in keys_to_remove:
            del self._cache[k]

    def list_versions(self, dataset_id: str) -> list[int]:
        """Liste les versions disponibles sur disque."""
        ds_dir = self.datasets_dir / dataset_id
        if not ds_dir.exists():
            return []
        versions = []
        for f in ds_dir.glob("v*.parquet"):
            try:
                versions.append(int(f.stem[1:]))
            except ValueError:
                continue
        return sorted(versions)

    # ── Cache interne ──────────────────────────────────────────

    def _put_cache(self, key: str, df: pd.DataFrame) -> None:
        """Ajoute au cache LRU, évicte le plus ancien si plein."""
        if key in self._cache:
            del self._cache[key]
        if len(self._cache) >= self._max_cache:
            oldest = next(iter(self._cache))
            del self._cache[oldest]
        self._cache[key] = df

    def clear_cache(self) -> None:
        self._cache.clear()

    @property
    def cache_info(self) -> dict:
        return {
            "cached_datasets": len(self._cache),
            "max_cache": self._max_cache,
            "keys": list(self._cache.keys()),
        }


# Singleton
storage = StorageService()
