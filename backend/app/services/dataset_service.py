"""
Service de gestion des datasets (Ingestion, Stockage, Cache, Métadonnées).
Compose DatasetComputationMixin, DatasetTimeseriesMixin et DatasetVersionsMixin (< 350 lignes).
"""

from __future__ import annotations

import logging
import os
import pandas as pd
from typing import Any

from app.extensions import db
from app.models.dataset import Dataset, DatasetVersion
from app.services.storage_service import storage
from app.core.ingestion import ingest_file, list_excel_sheets, read_excel_sheets, read_excel_sheet
from app.core.profiling import profile_dataframe
from app.services.dataset_computation import DatasetComputationMixin
from app.services.dataset_timeseries import DatasetTimeseriesMixin
from app.services.dataset_versions import DatasetVersionsMixin
from app.services.dataset_typing import DatasetTypingMixin
from app.services.dataset_cache import cached_read_parquet, invalidate_df_cache

logger = logging.getLogger(__name__)

# Alias pour compatibilité
_cached_read_parquet = cached_read_parquet
_invalidate_df_cache = invalidate_df_cache


class DatasetManager(
    DatasetComputationMixin,
    DatasetTimeseriesMixin,
    DatasetVersionsMixin,
    DatasetTypingMixin,
):
    """Orchestrateur central des datasets : ingestion, stockage, versions et calculs."""

    def __init__(self):
        self._session_cache: dict[str, dict] = {}

    def _get_cache(self, dataset_id: str) -> dict:
        """Récupère le cache de session pour un dataset."""
        if dataset_id not in self._session_cache:
            self._session_cache[dataset_id] = {}
        return self._session_cache[dataset_id]

    def _invalidate_session_cache(self, dataset_id: str) -> None:
        self._session_cache.pop(dataset_id, None)

    # ── Ingestion ──────────────────────────────────────────────

    def ingest(
        self,
        file_path: str,
        name: str = None,
        uploaded_by: str = None,
        workspace_id: str = None,
        **kwargs: Any,
    ) -> str:
        """Ingère un fichier de données brut, crée le Dataset et ses versions raw + cleaned."""
        df = ingest_file(file_path, **kwargs)
        profile = profile_dataframe(df)

        excel_sheets = list_excel_sheets(file_path)
        if excel_sheets:
            profile["excel_sheets"] = excel_sheets
            profile["selected_sheet"] = kwargs.get("sheet_name") or excel_sheets[0]

        original_filename = os.path.basename(file_path)
        file_size = os.path.getsize(file_path)
        dataset_name = name or os.path.splitext(original_filename)[0]

        ds = Dataset(
            name=dataset_name,
            original_filename=original_filename,
            file_size=file_size,
            rows=df.shape[0],
            columns=df.shape[1],
            profile=profile,
            uploaded_by=uploaded_by,
            workspace_id=workspace_id,
        )
        db.session.add(ds)
        db.session.flush()

        parquet_path = storage.save_dataframe(df, ds.id, version=1)
        v1 = DatasetVersion(
            dataset_id=ds.id,
            version_number=1,
            label="raw",
            description="Données brutes importées",
            parquet_path=parquet_path,
            rows=df.shape[0],
            columns=df.shape[1],
            profile_snapshot=profile,
        )
        db.session.add(v1)

        parquet_path_clean = storage.save_dataframe(df, ds.id, version=2)
        v2 = DatasetVersion(
            dataset_id=ds.id,
            version_number=2,
            label="cleaned",
            description="Copie de travail (identique à raw)",
            parquet_path=parquet_path_clean,
            rows=df.shape[0],
            columns=df.shape[1],
            profile_snapshot=profile,
        )
        db.session.add(v2)

        self._audit(ds.id, "upload", {"filename": original_filename, "rows": df.shape[0], "columns": df.shape[1]})
        db.session.commit()
        return ds.id

    def switch_excel_sheet(self, dataset_id: str, sheet_name: str, uploaded_by: str = None) -> dict:
        """Change la feuille active d'un dataset Excel et ré-ingère ses données."""
        ds = db.session.get(Dataset, dataset_id)
        if not ds:
            raise KeyError(f"Dataset non trouvé : {dataset_id}")
        if uploaded_by and ds.uploaded_by and ds.uploaded_by != uploaded_by:
            raise PermissionError("Accès non autorisé à ce dataset")

        from flask import current_app
        upload_dir = current_app.config.get("UPLOAD_FOLDER", "data/uploads")
        filepath = os.path.join(upload_dir, ds.original_filename)
        if not os.path.exists(filepath):
            filepath = os.path.join("data", "uploads", ds.original_filename)
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Fichier d'origine non trouvé : {ds.original_filename}")

        df = ingest_file(filepath, sheet_name=sheet_name)
        profile = profile_dataframe(df)
        excel_sheets = list_excel_sheets(filepath)
        if excel_sheets:
            profile["excel_sheets"] = excel_sheets
            profile["selected_sheet"] = sheet_name

        ds.rows = df.shape[0]
        ds.columns = df.shape[1]
        ds.profile = profile

        parquet_path = storage.save_dataframe(df, ds.id, version=1)
        v1 = DatasetVersion.query.filter_by(dataset_id=ds.id, version_number=1).first()
        if v1:
            v1.rows = df.shape[0]
            v1.columns = df.shape[1]
            v1.profile_snapshot = profile
            v1.parquet_path = parquet_path

        parquet_path_clean = storage.save_dataframe(df, ds.id, version=2)
        v2 = DatasetVersion.query.filter_by(dataset_id=ds.id, version_number=2).first()
        if v2:
            v2.rows = df.shape[0]
            v2.columns = df.shape[1]
            v2.profile_snapshot = profile
            v2.parquet_path = parquet_path_clean

        invalidate_df_cache(ds.id, 1)
        invalidate_df_cache(ds.id, 2)
        db.session.commit()
        return {"success": True, "dataset_id": ds.id, "active_sheet": sheet_name, "rows": ds.rows, "columns": ds.columns}

    # ── Accès aux données ──────────────────────────────────────

    def get(self, dataset_id: str) -> dict | None:
        """Retourne les métadonnées d'un dataset avec son profil courant."""
        ds = db.session.get(Dataset, dataset_id)
        if ds is None:
            return None
        data = ds.to_dict()
        data["profile"] = ds.profile
        data["excluded_columns"] = ds.excluded_columns or []
        data["type_overrides"] = ds.type_overrides or {}
        prof = ds.profile or {}
        data["excel_sheets"] = prof.get("excel_sheets") if isinstance(prof, dict) else None
        data["active_sheet"] = prof.get("selected_sheet") if isinstance(prof, dict) else None

        active_columns = data.get("columns", 0)
        if ds.excluded_columns:
            active_columns = max(0, active_columns - len(ds.excluded_columns))
        data["active_columns"] = active_columns
        return data

    def get_dataset_model(self, dataset_id: str) -> Dataset | None:
        """Retourne l'entité SQLAlchemy brute d'un dataset."""
        return db.session.get(Dataset, dataset_id)

    def get_parquet_path(self, dataset_id: str, version: int = 2) -> str | None:
        """Retourne le chemin absolu vers le fichier Parquet pour l'analyse via DuckDB."""
        ds = db.session.get(Dataset, dataset_id)
        if ds is None:
            return None
        path = storage._version_path(dataset_id, version)
        if not path.exists():
            return None
        return str(path.absolute())

    def get_df(self, dataset_id: str, version: int | None = None, cleaned: bool = True,
               respect_exclusions: bool = True) -> pd.DataFrame | None:
        """Charge le DataFrame depuis DuckDB / Parquet avec gestion de version et exclusions."""
        ds = db.session.get(Dataset, dataset_id)
        if ds is None:
            return None

        if version is not None:
            v = version
        elif cleaned:
            v = max((v.version_number for v in ds.versions), default=2)
        else:
            v = 1

        try:
            df = cached_read_parquet(dataset_id, v)
        except Exception:
            try:
                df = storage.load_dataframe(dataset_id, version=v)
            except Exception:
                return None

        if df is None:
            return None

        df = df.copy()
        if ds:
            type_overrides = ds.type_overrides or {}
            for col, target_type in type_overrides.items():
                if col in df.columns:
                    try:
                        if target_type in ("numeric", "continuous", "discrete"):
                            df[col] = pd.to_numeric(df[col], errors="coerce")
                        elif target_type in ("temporal", "datetime"):
                            df[col] = pd.to_datetime(df[col], errors="coerce")
                        elif target_type in ("categorical", "nominal", "ordinal", "text"):
                            df[col] = df[col].astype(str)
                        elif target_type == "binary":
                            df[col] = df[col].astype(bool)
                    except Exception:
                        pass

            if respect_exclusions and ds.excluded_columns:
                cols_to_drop = [c for c in ds.excluded_columns if c in df.columns]
                if cols_to_drop:
                    df = df.drop(columns=cols_to_drop)

        return df



    def list_datasets(self, page: int = 1, per_page: int = 20, user_id: str = None, workspace_id: str = None) -> dict:
        """Liste paginée des datasets filtrés par utilisateur et/ou workspace."""
        from flask import current_app, g
        query = Dataset.query
        if user_id:
            query = query.filter_by(uploaded_by=user_id)
        elif not current_app.config.get("AUTH_ENABLED", False):
            uid = getattr(getattr(g, "current_user", None), "id", None)
            if uid:
                query = query.filter_by(uploaded_by=uid)
        if workspace_id:
            query = query.filter_by(workspace_id=workspace_id)
        query = query.order_by(Dataset.created_at.desc())
        total = query.count()
        items = query.offset((page - 1) * per_page).limit(per_page).all()
        return {
            "datasets": [ds.to_dict() for ds in items],
            "page": page,
            "per_page": per_page,
            "total": total,
            "pages": max(1, (total + per_page - 1) // per_page),
        }

    def delete_dataset(self, dataset_id: str) -> dict:
        """Supprime un dataset, ses versions, résultats et fichiers."""
        from flask import current_app, g
        ds = db.session.get(Dataset, dataset_id)
        if ds is None:
            raise ValueError(f"Dataset {dataset_id} introuvable")
        try:
            if not current_app.config.get("AUTH_ENABLED", False):
                uid = getattr(getattr(g, "current_user", None), "id", None)
                if uid and ds.uploaded_by and ds.uploaded_by != uid:
                    raise ValueError(f"Dataset {dataset_id} introuvable")
        except Exception:
            pass

        dataset_name = ds.name
        storage.delete_dataset(dataset_id)
        invalidate_df_cache(dataset_id)
        self._session_cache.pop(dataset_id, None)

        db.session.delete(ds)
        db.session.commit()
        return {
            "message": "Dataset supprimé",
            "dataset_id": dataset_id,
            "name": dataset_name,
        }

    def copy_dataset(self, dataset_id: str, new_name: str = None, user_id: str = None) -> str:
        """Clone un dataset existant."""
        source = db.session.get(Dataset, dataset_id)
        if source is None:
            raise ValueError(f"Dataset {dataset_id} introuvable")

        name = new_name or f"{source.name} (copie)"
        new_ds = Dataset(
            name=name,
            original_filename=source.original_filename,
            file_size=source.file_size,
            rows=source.rows,
            columns=source.columns,
            uploaded_by=user_id or source.uploaded_by,
            workspace_id=source.workspace_id,
            profile=source.profile,
            excluded_columns=source.excluded_columns,
            type_overrides=source.type_overrides,
        )
        db.session.add(new_ds)
        db.session.flush()

        for v in source.versions:
            df = storage.load_dataframe(dataset_id, v.version_number)
            parquet_path = storage.save_dataframe(df, new_ds.id, version=v.version_number)
            new_v = DatasetVersion(
                dataset_id=new_ds.id,
                version_number=v.version_number,
                label=v.label,
                description=v.description,
                parquet_path=parquet_path,
                rows=v.rows,
                columns=v.columns,
                operations_log=v.operations_log,
                profile_snapshot=v.profile_snapshot,
            )
            db.session.add(new_v)

        db.session.commit()
        return new_ds.id


# Singleton global
dataset_manager = DatasetManager()
