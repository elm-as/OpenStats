"""
Service principal orchestrant les opérations d'analyse.
Gère le cycle de vie des datasets via PostgreSQL + fichiers Parquet.
"""

from __future__ import annotations

import copy
import functools
import os
import threading
import time
from collections import OrderedDict
from pathlib import Path
from typing import Any

import pandas as pd

from app.config import Config
from app.extensions import db
from flask import current_app, g
from sqlalchemy.orm.attributes import flag_modified
from app.models.dataset import Dataset, DatasetVersion
from app.models.analysis import AnalysisResult
from app.models.audit import AuditLog
from app.services.storage_service import storage
from app.core.ingestion import ingest_file, list_excel_sheets
from app.core.profiling import profile_dataframe, generate_data_dictionary
from app.core.cleaning import run_cleaning_pipeline
from app.core.analysis import (
    compute_descriptive_stats, compute_correlation_matrix,
    compute_vif, run_hypothesis_test,
)
from app.core.modeling import prepare_data, train_competitive, train_single_model
from app.core.timeseries import run_timeseries_analysis, run_multivariate_timeseries_analysis
from app.core.explainability import compute_shap_values
from app.core.reporting import generate_report

# ── Cache LRU pour DataFrames (évite de re-lire les parquets) ──
_DF_CACHE: OrderedDict[str, pd.DataFrame] = OrderedDict()
_DF_CACHE_MAX = 8
_DF_CACHE_LOCK = threading.Lock()


def _cached_read_parquet(dataset_id: str, version: int) -> pd.DataFrame:
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


def _invalidate_df_cache(dataset_id: str) -> None:
    with _DF_CACHE_LOCK:
        keys = [k for k in _DF_CACHE if k.startswith(f"{dataset_id}:")]
        for k in keys:
            del _DF_CACHE[k]


class DatasetManager:
    """Gestionnaire de datasets avec persistance SQL + Parquet."""

    # ── Cache mémoire pour résultats in-session ────────────────
    # Les modèles entraînés (sklearn objects) ne sont pas sérialisables
    # en JSON, on les garde en mémoire pour la session courante.
    def __init__(self):
        self._session_cache: dict[str, dict] = {}
        self._cache_lock = threading.Lock()

    def _get_cache(self, dataset_id: str) -> dict:
        with self._cache_lock:
            if dataset_id not in self._session_cache:
                self._session_cache[dataset_id] = {}
            return self._session_cache[dataset_id]

    def _invalidate_session_cache(self, dataset_id: str) -> None:
        with self._cache_lock:
            self._session_cache.pop(dataset_id, None)

    # ── Ingestion ──────────────────────────────────────────────

    def ingest(self, filepath: str, name: str = None, uploaded_by: str = None, **kwargs) -> str:
        """Ingère un fichier et retourne un dataset_id."""
        df = ingest_file(filepath, **kwargs)
        profile = profile_dataframe(df)

        excel_sheets = list_excel_sheets(filepath)
        if excel_sheets:
            profile["excel_sheets"] = excel_sheets
            profile["selected_sheet"] = kwargs.get("sheet_name") or excel_sheets[0]

        ds = Dataset(
            name=name or Path(filepath).stem,
            original_filename=Path(filepath).name,
            file_size=os.path.getsize(filepath),
            rows=df.shape[0],
            columns=df.shape[1],
            profile=profile,
            uploaded_by=uploaded_by,
        )
        db.session.add(ds)
        db.session.flush()  # Génère ds.id

        # Sauvegarder la version raw (v1)
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

        # Sauvegarder la copie de travail (v2 = cleaned, initialement identique)
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

        # Audit
        self._audit(ds.id, "upload", {"filename": Path(filepath).name, "rows": df.shape[0], "columns": df.shape[1]})

        db.session.commit()
        return ds.id

    def switch_excel_sheet(self, dataset_id: str, sheet_name: str, uploaded_by: str = None) -> dict:
        """Change la feuille active d'un dataset Excel et ré-ingère ses données."""
        ds = db.session.get(Dataset, dataset_id)
        if not ds:
            raise KeyError(f"Dataset non trouvé : {dataset_id}")
        if uploaded_by and ds.uploaded_by and ds.uploaded_by != uploaded_by:
            raise PermissionError("Accès non autorisé à ce dataset")

        upload_dir = current_app.config["UPLOAD_FOLDER"]
        filepath = os.path.join(upload_dir, ds.original_filename)
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

        self._invalidate_session_cache(ds.id)
        _invalidate_df_cache(ds.id)
        self._audit(ds.id, "switch_sheet", {"sheet_name": sheet_name, "rows": df.shape[0], "columns": df.shape[1]})
        db.session.commit()
        return self.get(ds.id)

    # ── Accès datasets ─────────────────────────────────────────

    def get(self, dataset_id: str) -> dict | None:
        """Retourne un dict compatible avec l'ancien format pour rétrocompatibilité API."""
        ds = db.session.get(Dataset, dataset_id)
        if ds is None:
            return None
        # Mode "anonyme" : isolation par uploaded_by (user_id courant)
        try:
            if not current_app.config.get("AUTH_ENABLED", False):
                uid = getattr(getattr(g, "current_user", None), "id", None)
                if uid and ds.uploaded_by and ds.uploaded_by != uid:
                    return None
        except Exception:
            pass

        cache = self._get_cache(dataset_id)
        return {
            "id": ds.id,
            "name": ds.name,
            "created_at": ds.created_at.isoformat() if ds.created_at else None,
            "profile": ds.profile,
            "cleaning_log": self._get_cleaning_log(ds),
            "excluded_columns": ds.excluded_columns or [],
            "type_overrides": ds.type_overrides or {},
            "analysis_results": cache.get("analysis_results", {}),
            "model_results": cache.get("model_results", {}),
            "timeseries_results": cache.get("timeseries_results"),
            "multivariate_ts_results": cache.get("multivariate_ts_results"),
            "pca_results": cache.get("pca_results"),
            "ca_results": cache.get("ca_results"),
            "mca_results": cache.get("mca_results"),
            "transform_logs": cache.get("transform_logs"),
            "test_results": cache.get("test_results", []),
        }

    def get_dataset_model(self, dataset_id: str) -> Dataset | None:
        """Retourne le modèle ORM directement."""
        ds = db.session.get(Dataset, dataset_id)
        if ds is None:
            return None
        try:
            if not current_app.config.get("AUTH_ENABLED", False):
                uid = getattr(getattr(g, "current_user", None), "id", None)
                if uid and ds.uploaded_by and ds.uploaded_by != uid:
                    return None
        except Exception:
            pass
        return ds

    def get_parquet_path(self, dataset_id: str, version: int = 2) -> str | None:
        """Retourne le chemin absolu vers le fichier Parquet pour l'analyse via DuckDB."""
        ds = db.session.get(Dataset, dataset_id)
        if ds is None:
            return None
        # On peut rajouter les vérifications d'ACL si besoin
        path = storage._version_path(dataset_id, version)
        if not path.exists():
            return None
        return str(path.absolute())

    def get_df(self, dataset_id: str, cleaned: bool = True, respect_exclusions: bool = True) -> pd.DataFrame | None:
        ds = db.session.get(Dataset, dataset_id)
        if ds is None:
            return None
        try:
            if not current_app.config.get("AUTH_ENABLED", False):
                uid = getattr(getattr(g, "current_user", None), "id", None)
                if uid and ds.uploaded_by and ds.uploaded_by != uid:
                    return None
        except Exception:
            pass

        # cleaned = dernière version, raw = version 1
        if cleaned:
            version = max(v.version_number for v in ds.versions)
        else:
            version = 1

        df = _cached_read_parquet(dataset_id, version)

        if respect_exclusions and ds.excluded_columns:
            cols_to_drop = [c for c in ds.excluded_columns if c in df.columns]
            if cols_to_drop:
                df = df.drop(columns=cols_to_drop)
        return df

    def set_excluded_columns(self, dataset_id: str, excluded: list[str]) -> dict:
        """Définit les colonnes exclues des analyses."""
        ds = db.session.get(Dataset, dataset_id)
        if ds is None:
            raise ValueError(f"Dataset {dataset_id} introuvable")

        df = self.get_df(dataset_id, cleaned=True, respect_exclusions=False)
        all_cols = df.columns.tolist()
        invalid = [c for c in excluded if c not in all_cols]
        if invalid:
            raise ValueError(f"Colonnes inconnues : {invalid}")

        ds.excluded_columns = excluded
        self._audit(dataset_id, "exclude_columns", {"excluded": excluded})
        db.session.commit()

        return {
            "excluded_columns": excluded,
            "active_columns": [c for c in all_cols if c not in excluded],
        }

    def get_excluded_columns(self, dataset_id: str) -> list[str]:
        ds = db.session.get(Dataset, dataset_id)
        if ds is None:
            raise ValueError(f"Dataset {dataset_id} introuvable")
        return ds.excluded_columns or []

    def list_datasets(self, page: int = 1, per_page: int = 20) -> dict:
        datasets = Dataset.query
        # Mode "anonyme" : ne lister que les datasets du user courant
        try:
            if not current_app.config.get("AUTH_ENABLED", False):
                uid = getattr(getattr(g, "current_user", None), "id", None)
                if uid:
                    datasets = datasets.filter_by(uploaded_by=uid)
        except Exception:
            pass
        datasets = datasets.order_by(Dataset.created_at.desc())
        total = datasets.count()
        items = datasets.offset((page - 1) * per_page).limit(per_page).all()
        return {
            "datasets": [ds.to_dict() for ds in items],
            "page": page,
            "per_page": per_page,
            "total": total,
            "pages": max(1, (total + per_page - 1) // per_page),
        }

    def delete_dataset(self, dataset_id: str) -> dict:
        """Supprime un dataset, ses metadonnees et ses fichiers associes."""
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

        if dataset_id in self._session_cache:
            self._invalidate_session_cache(dataset_id)
        _invalidate_df_cache(dataset_id)

        db.session.delete(ds)
        db.session.commit()

        return {
            "message": "Dataset supprime",
            "dataset_id": dataset_id,
            "name": dataset_name,
        }

    def copy_dataset(self, dataset_id: str, new_name: str | None = None) -> str:
        """Duplique un dataset en se basant sur sa dernière version nettoyée."""
        original_ds = db.session.get(Dataset, dataset_id)
        if original_ds is None:
            raise ValueError(f"Dataset {dataset_id} introuvable")

        df = self.get_df(dataset_id, cleaned=True, respect_exclusions=False)
        if df is None:
            raise ValueError(f"Données introuvables pour le dataset {dataset_id}")

        new_ds_name = new_name or f"{original_ds.name}-cp"
        
        # Create new dataset record
        new_ds = Dataset(
            name=new_ds_name,
            original_filename=original_ds.original_filename,
            file_size=original_ds.file_size,
            rows=df.shape[0],
            columns=df.shape[1],
            workspace_id=original_ds.workspace_id,
            uploaded_by=original_ds.uploaded_by,
            excluded_columns=list(original_ds.excluded_columns or []),
            type_overrides=dict(original_ds.type_overrides or {}),
            profile=copy.deepcopy(original_ds.profile) if original_ds.profile else None,
        )
        db.session.add(new_ds)
        db.session.flush()

        # Save the copied dataframe as version 1 of the new dataset
        parquet_path = storage.save_dataframe(df, new_ds.id, version=1)
        v1 = DatasetVersion(
            dataset_id=new_ds.id,
            version_number=1,
            label="raw",
            description=f"Copie du dataset {original_ds.name}",
            parquet_path=parquet_path,
            rows=df.shape[0],
            columns=df.shape[1],
            profile_snapshot=copy.deepcopy(original_ds.profile) if original_ds.profile else None,
        )
        db.session.add(v1)
        
        self._audit(new_ds.id, "copy", {"copied_from": dataset_id, "original_name": original_ds.name})
        db.session.commit()
        return new_ds.id

    # ── Nettoyage ──────────────────────────────────────────────

    def clean(self, dataset_id: str, pipeline_config: list[dict]) -> dict:
        """Applique le pipeline de nettoyage."""
        ds = db.session.get(Dataset, dataset_id)
        if ds is None:
            raise ValueError(f"Dataset {dataset_id} introuvable")

        df_raw = storage.load_dataframe(dataset_id, version=1)
        df_clean, logs = run_cleaning_pipeline(df_raw.copy(), pipeline_config)

        # Nouvelle version
        next_version = max(v.version_number for v in ds.versions) + 1
        parquet_path = storage.save_dataframe(df_clean, dataset_id, version=next_version)

        new_profile = profile_dataframe(df_clean)
        self._apply_type_overrides_to_profile(new_profile, ds.type_overrides or {})

        version = DatasetVersion(
            dataset_id=dataset_id,
            version_number=next_version,
            label="cleaned",
            description=f"Nettoyage ({len(logs)} opérations)",
            parquet_path=parquet_path,
            rows=df_clean.shape[0],
            columns=df_clean.shape[1],
            operations_log=logs,
            profile_snapshot=new_profile,
        )
        db.session.add(version)

        ds.rows = df_clean.shape[0]
        ds.columns = df_clean.shape[1]
        ds.profile = new_profile

        self._audit(dataset_id, "clean", {"pipeline": pipeline_config, "logs_count": len(logs)},
                     version_before=next_version - 1, version_after=next_version)
        db.session.commit()
        _invalidate_df_cache(dataset_id)

        return {
            "shape_before": {"rows": df_raw.shape[0], "columns": df_raw.shape[1]},
            "shape_after": {"rows": df_clean.shape[0], "columns": df_clean.shape[1]},
            "logs": logs,
        }

    # ── Analyse ────────────────────────────────────────────────

    def analyze(self, dataset_id: str, bootstrap_ci: bool = False, n_bootstrap: int = 1000) -> dict:
        """Exécute l'analyse statistique complète."""
        df = self.get_df(dataset_id)
        if df is None:
            raise ValueError(f"Dataset {dataset_id} introuvable")

        t0 = time.time()
        descriptive = compute_descriptive_stats(df, bootstrap_ci=bootstrap_ci, n_bootstrap=n_bootstrap)
        pearson = compute_correlation_matrix(df, "pearson", bootstrap_ci=bootstrap_ci, n_bootstrap=min(n_bootstrap, 500))
        spearman = compute_correlation_matrix(df, "spearman", bootstrap_ci=bootstrap_ci, n_bootstrap=min(n_bootstrap, 500))
        vif = compute_vif(df)

        results = {
            "descriptive_stats": descriptive,
            "correlations": {"pearson": pearson, "spearman": spearman},
            "vif": vif,
        }
        duration = int((time.time() - t0) * 1000)

        cache = self._get_cache(dataset_id)
        cache["analysis_results"] = results

        self._save_analysis(dataset_id, "descriptive", {}, results, duration)
        return results

    def run_test(self, dataset_id: str, test_config: dict) -> dict:
        """Exécute un test d'hypothèse."""
        df = self.get_df(dataset_id)
        if df is None:
            raise ValueError(f"Dataset {dataset_id} introuvable")

        # Filtrer uniquement les kwargs acceptés par run_hypothesis_test
        _ALLOWED = {"test_type", "group_col", "value_col", "col1", "col2"}
        filtered = {k: v for k, v in test_config.items() if k in _ALLOWED and v is not None}

        t0 = time.time()
        result = run_hypothesis_test(df, **filtered)
        duration = int((time.time() - t0) * 1000)

        self._save_analysis(dataset_id, "test", test_config, result, duration)
        return result

    # ── Modélisation ───────────────────────────────────────────

    def train_models(
        self, dataset_id: str, target_col: str,
        model_keys: list[str] | None = None,
        test_size: float = 0.2,
        split_strategy: str = "auto",
        temporal_col: str | None = None,
    ) -> dict:
        """Lance l'entraînement compétitif multi-algorithmes."""
        df = self.get_df(dataset_id)
        if df is None:
            raise ValueError(f"Dataset {dataset_id} introuvable")

        t0 = time.time()
        data = prepare_data(
            df, target_col,
            test_size=test_size,
            split_strategy=split_strategy,
            temporal_col=temporal_col,
        )
        results = train_competitive(data, model_keys=model_keys)

        # SHAP sur le meilleur modèle
        shap_data = None
        if results.get("best_model") is not None:
            try:
                shap_data = compute_shap_values(results["best_model"], data["X_test"])
            except Exception as e:
                shap_data = {"error": str(e)}

        results["shap"] = shap_data
        results["data_split"] = {
            "train_size": len(data["X_train"]),
            "test_size": len(data["X_test"]),
            "features": data["feature_names"],
            "strategy": data.get("split_info", {}).get("strategy"),
            "temporal_column": data.get("split_info", {}).get("temporal_column"),
            "train_time_range": data.get("split_info", {}).get("train_time_range"),
            "test_time_range": data.get("split_info", {}).get("test_time_range"),
        }
        duration = int((time.time() - t0) * 1000)

        cache = self._get_cache(dataset_id)
        cache["model_results"] = results

        # Sauvegarder un résumé (sans l'objet modèle sklearn)
        params = {"target": target_col, "models": model_keys, "test_size": test_size,
                  "split_strategy": split_strategy}
        summary = {k: v for k, v in results.items() if k not in ("best_model", "trained_models")}
        self._save_analysis(dataset_id, "modeling", params, summary, duration)

        return results

    # ── Séries temporelles ───────────────────────────────────────

    def run_timeseries(
        self, dataset_id: str, date_col: str, value_col: str,
        models: list[str] | None = None,
        forecast_steps: int = 10,
    ) -> dict:
        """Lance l'analyse de série temporelle."""
        df = self.get_df(dataset_id, respect_exclusions=False)
        if df is None:
            raise ValueError(f"Dataset {dataset_id} introuvable")

        if date_col not in df.columns:
            raise ValueError(f"Colonne date introuvable : {date_col}")
        if value_col not in df.columns:
            raise ValueError(f"Colonne valeur introuvable : {value_col}")

        t0 = time.time()
        results = run_timeseries_analysis(
            df, date_col, value_col,
            models=models,
            forecast_steps=forecast_steps,
        )
        duration = int((time.time() - t0) * 1000)

        cache = self._get_cache(dataset_id)
        cache["timeseries_results"] = results

        params = {"date_col": date_col, "value_col": value_col, "models": models, "forecast_steps": forecast_steps}
        self._save_analysis(dataset_id, "timeseries", params, results, duration)

        return results

    def run_multivariate_timeseries(
        self, dataset_id: str, date_col: str, value_cols: list[str],
        models: list[str] | None = None,
        forecast_steps: int = 10,
        granger_max_lag: int = 4,
        forced_model: str | None = None,
        var_data_mode: str = "auto",
        granger_data_mode: str = "auto",
        forecast_dates: list[str] | None = None,
        var_trend: str = "c",
        target_col: str | None = None,
        bvar_lambda1: float = 0.2,
        bvar_lambda2: float = 0.5,
        max_lag: int = 12,
        ic_criterion: str = "aic",
        irf_periods: int = 20,
        fevd_periods: int = 20,
        confidence_level: float = 0.95,
        bootstrap_irf: bool = False,
        irf_orth: bool = True,
        vecm_det_order: int = 0,
        max_diff_order: int = 2,
    ) -> dict:
        """Lance l'analyse de séries temporelles multivariées."""
        df = self.get_df(dataset_id, respect_exclusions=False)
        if df is None:
            raise ValueError(f"Dataset {dataset_id} introuvable")

        if date_col not in df.columns:
            raise ValueError(f"Colonne date introuvable : {date_col}")
        for col in value_cols:
            if col not in df.columns:
                raise ValueError(f"Colonne valeur introuvable : {col}")

        if len(value_cols) < 2:
            raise ValueError("Au moins 2 colonnes numériques sont requises pour l'analyse multivariée")

        t0 = time.time()
        results = run_multivariate_timeseries_analysis(
            df, date_col, value_cols,
            models=models,
            forecast_steps=forecast_steps,
            granger_max_lag=granger_max_lag,
            forced_model=forced_model,
            var_data_mode=var_data_mode,
            granger_data_mode=granger_data_mode,
            forecast_dates=forecast_dates,
            var_trend=var_trend,
            target_col=target_col,
            bvar_lambda1=bvar_lambda1,
            bvar_lambda2=bvar_lambda2,
            max_lag=max_lag,
            ic_criterion=ic_criterion,
            irf_periods=irf_periods,
            fevd_periods=fevd_periods,
            confidence_level=confidence_level,
            bootstrap_irf=bootstrap_irf,
            irf_orth=irf_orth,
            vecm_det_order=vecm_det_order,
            max_diff_order=max_diff_order,
        )
        duration = int((time.time() - t0) * 1000)

        cache = self._get_cache(dataset_id)
        cache["multivariate_ts_results"] = results

        params = {"date_col": date_col, "value_cols": value_cols, "models": models,
                  "forecast_steps": forecast_steps, "forced_model": forced_model}
        self._save_analysis(dataset_id, "multivariate_ts", params, results, duration)

        return results

    # ── Types de colonnes ──────────────────────────────────────

    def _apply_type_overrides_to_profile(self, profile: dict, overrides: dict) -> None:
        """Applique les surcharges de type sur un profil."""
        if not overrides:
            return
        for entry in profile.get("dictionary", []):
            col_name = entry["nom_brut"]
            if col_name in overrides:
                entry["type_statistique"] = overrides[col_name]

    def update_column_type(self, dataset_id: str, column: str, new_type: str) -> dict:
        """Met à jour le type statistique d'une colonne dans le profil."""
        VALID_TYPES = {"continu", "discret", "temporel", "catégoriel_nominal", "binaire"}
        ds = db.session.get(Dataset, dataset_id)
        if ds is None:
            raise ValueError(f"Dataset {dataset_id} introuvable")
        if new_type not in VALID_TYPES:
            raise ValueError(f"Type invalide : {new_type}. Types valides : {', '.join(sorted(VALID_TYPES))}")

        profile = copy.deepcopy(ds.profile or {})
        dictionary = profile.get("dictionary", [])
        entry = next((e for e in dictionary if e["nom_brut"] == column), None)
        if entry is None:
            raise ValueError(f"Colonne introuvable : {column}")

        old_type = entry["type_statistique"]
        entry["type_statistique"] = new_type

        # Persister l'override
        overrides = dict(ds.type_overrides or {})
        overrides[column] = new_type
        ds.type_overrides = overrides
        ds.profile = profile
        flag_modified(ds, "profile")
        flag_modified(ds, "type_overrides")

        # Appliquer la conversion effective dans le DataFrame
        if old_type != new_type:
            try:
                df = self.get_df(dataset_id, cleaned=True, respect_exclusions=False)
                if column in df.columns:
                    if new_type == "temporel":
                        df[column] = pd.to_datetime(df[column], errors="coerce")
                    elif new_type == "continu":
                        df[column] = pd.to_numeric(df[column], errors="coerce").astype(float)
                    elif new_type == "discret":
                        df[column] = pd.to_numeric(df[column], errors="coerce")
                        df[column] = df[column].dropna().astype(int).reindex(df.index)
                    elif new_type == "catégoriel_nominal":
                        df[column] = df[column].astype(str).replace("nan", pd.NA)
                    elif new_type == "binaire":
                        df[column] = pd.to_numeric(df[column], errors="coerce")
                        df[column] = df[column].dropna().astype(int).reindex(df.index)
                    version = max(v.version_number for v in ds.versions)
                    storage.save_dataframe(df, dataset_id, version)
                    # Rafraîchir le cache
                    if dataset_id in self._session_cache:
                        self._invalidate_session_cache(dataset_id)
            except Exception:
                pass

        self._audit(dataset_id, "type_change", {"column": column, "old_type": old_type, "new_type": new_type})
        db.session.commit()

        return {
            "column": column,
            "old_type": old_type,
            "new_type": new_type,
            "profile": ds.profile,
        }

    # ── Rapport PDF ────────────────────────────────────────────

    def generate_pdf_report(
        self, dataset_id: str, title: str = "Rapport d'Analyse",
        organization: str = "OpenStats — Elmas Labs",
    ) -> str:
        """Génère le rapport PDF."""
        bundle = self.get_export_bundle(dataset_id, title=title, organization=organization)

        reports_dir = Config.REPORTS_DIR
        os.makedirs(reports_dir, exist_ok=True)

        from datetime import datetime
        filename = f"rapport_{dataset_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        output_path = os.path.join(reports_dir, filename)

        analysis = bundle.get("analysis", {})
        model = bundle.get("modeling", {})

        generate_report(
            output_path=output_path,
            title=title,
            organization=organization,
            data_summary=bundle.get("data_summary", {}).get("profile", {}),
            cleaning_log=bundle.get("cleaning_log", []),
            descriptive_stats=analysis.get("descriptive_stats", {}),
            correlation_results=analysis.get("correlations", {}).get("pearson", {}),
            test_results=bundle.get("tests", []),
            model_results=model,
            shap_results=model.get("shap"),
            timeseries_results=bundle.get("timeseries"),
            multivariate_ts_results=bundle.get("multivariate_timeseries"),
            pca_results=bundle.get("factor_analysis", {}).get("pca"),
            ca_results=bundle.get("factor_analysis", {}).get("ca"),
            mca_results=bundle.get("factor_analysis", {}).get("mca"),
            vif_results=analysis.get("vif"),
            transform_logs=bundle.get("transform_logs"),
        )

        self._audit(dataset_id, "report", {"title": title, "path": output_path})
        return output_path

    # ── Historique et versions ─────────────────────────────────

    def get_versions(self, dataset_id: str) -> list[dict]:
        """Liste les versions d'un dataset."""
        ds = db.session.get(Dataset, dataset_id)
        if ds is None:
            raise ValueError(f"Dataset {dataset_id} introuvable")
        return [v.to_dict() for v in ds.versions]

    def restore_version(self, dataset_id: str, version_number: int) -> dict:
        """Restaure une version comme copie de travail."""
        ds = db.session.get(Dataset, dataset_id)
        if ds is None:
            raise ValueError(f"Dataset {dataset_id} introuvable")

        target = next((v for v in ds.versions if v.version_number == version_number), None)
        if target is None:
            raise ValueError(f"Version {version_number} introuvable")

        df = storage.load_dataframe(dataset_id, version_number)

        next_version = max(v.version_number for v in ds.versions) + 1
        parquet_path = storage.save_dataframe(df, dataset_id, version=next_version)

        restored = DatasetVersion(
            dataset_id=dataset_id,
            version_number=next_version,
            label="restored",
            description=f"Restauration de v{version_number}",
            parquet_path=parquet_path,
            rows=df.shape[0],
            columns=df.shape[1],
            profile_snapshot=target.profile_snapshot,
        )
        db.session.add(restored)

        ds.rows = df.shape[0]
        ds.columns = df.shape[1]
        if target.profile_snapshot:
            ds.profile = target.profile_snapshot

        self._audit(dataset_id, "restore", {"restored_from": version_number},
                     version_before=next_version - 1, version_after=next_version)
        db.session.commit()
        _invalidate_df_cache(dataset_id)

        return restored.to_dict()

    def get_history(self, dataset_id: str, limit: int = 50) -> list[dict]:
        """Retourne l'historique des analyses et audit."""
        ds = db.session.get(Dataset, dataset_id)
        if ds is None:
            raise ValueError(f"Dataset {dataset_id} introuvable")

        analyses = (
            AnalysisResult.query
            .filter_by(dataset_id=dataset_id)
            .order_by(AnalysisResult.created_at.desc())
            .limit(limit)
            .all()
        )
        return [a.to_dict() for a in analyses]

    def get_audit_trail(self, dataset_id: str, limit: int = 100) -> list[dict]:
        """Retourne le journal d'audit."""
        logs = (
            AuditLog.query
            .filter_by(dataset_id=dataset_id)
            .order_by(AuditLog.created_at.desc())
            .limit(limit)
            .all()
        )
        return [log.to_dict() for log in logs]

    def store_analysis_result(self, dataset_id: str, key: str, value: dict) -> None:
        """Stocke un résultat d'analyse dans le cache session pour les exports/rapports."""
        cache = self._get_cache(dataset_id)
        ar = cache.setdefault("analysis_results", {})
        ar[key] = value

    def store_ad_hoc_analysis(
        self,
        dataset_id: str,
        analysis_type: str,
        parameters: dict,
        results: dict,
        cache_key: str | None = None,
        duration_ms: int = 0,
    ) -> dict:
        """Persiste une analyse calculée hors DatasetManager et l'ajoute au cache de session."""
        if cache_key:
            self._get_cache(dataset_id)[cache_key] = results
        self._save_analysis(dataset_id, analysis_type, parameters, results, duration_ms)
        return results

    def get_export_bundle(
        self,
        dataset_id: str,
        title: str | None = None,
        organization: str | None = None,
    ) -> dict:
        """Construit un payload d'export stable à partir du cache et des résultats persistés."""
        from datetime import datetime, timezone

        ds = db.session.get(Dataset, dataset_id)
        if ds is None:
            raise ValueError(f"Dataset {dataset_id} introuvable")

        cache = self._get_cache(dataset_id)
        raw_df = self.get_df(dataset_id, cleaned=False, respect_exclusions=False)
        current_df = self.get_df(dataset_id, cleaned=True, respect_exclusions=False)
        active_df = self.get_df(dataset_id, cleaned=True, respect_exclusions=True)

        analysis_results = cache.get("analysis_results") or self._load_latest_analysis_result(dataset_id, "descriptive") or {}
        model_results = cache.get("model_results") or self._load_latest_analysis_result(dataset_id, "modeling") or {}
        timeseries_results = cache.get("timeseries_results") or self._load_latest_analysis_result(dataset_id, "timeseries") or {}
        multivariate_ts_results = cache.get("multivariate_ts_results") or self._load_latest_analysis_result(dataset_id, "multivariate_ts") or {}
        pca_results = cache.get("pca_results") or self._load_latest_analysis_result(dataset_id, "pca") or {}
        ca_results = cache.get("ca_results") or self._load_latest_analysis_result(dataset_id, "ca") or {}
        mca_results = cache.get("mca_results") or self._load_latest_analysis_result(dataset_id, "mca") or {}
        test_results = cache.get("test_results") or self._load_all_analysis_results(dataset_id, "test")
        cleaning_log = self._get_cleaning_log(ds)
        transform_logs = cache.get("transform_logs") or self._get_transform_log(ds)

        profile = copy.deepcopy(ds.profile or {})
        excluded_columns = ds.excluded_columns or []
        current_shape = {
            "rows": int(current_df.shape[0]),
            "columns": int(current_df.shape[1]),
        } if current_df is not None else ds.shape
        active_shape = {
            "rows": int(active_df.shape[0]),
            "columns": int(active_df.shape[1]),
        } if active_df is not None else current_shape
        raw_shape = {
            "rows": int(raw_df.shape[0]),
            "columns": int(raw_df.shape[1]),
        } if raw_df is not None else current_shape

        return {
            "metadata": {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "format_version": "2.0",
                "title": title or f"Export {ds.name}",
                "organization": organization or "OpenStats — Elmas Labs",
            },
            "dataset": {
                "id": ds.id,
                "name": ds.name,
                "original_filename": ds.original_filename,
                "created_at": ds.created_at.isoformat() if ds.created_at else None,
                "updated_at": ds.updated_at.isoformat() if ds.updated_at else None,
                "file_size": ds.file_size,
                "shape": current_shape,
                "raw_shape": raw_shape,
                "active_shape": active_shape,
                "excluded_columns": excluded_columns,
                "active_columns": active_df.columns.tolist() if active_df is not None else [],
                "type_overrides": ds.type_overrides or {},
                "versions_count": len(ds.versions),
                "current_version": ds.current_version.version_number if ds.current_version else None,
            },
            "data_summary": {
                "shape": current_shape,
                "raw_shape": raw_shape,
                "active_shape": active_shape,
                "memory_usage_mb": profile.get("memory_usage_mb"),
                "dtypes": profile.get("dtypes", {}),
                "dictionary": profile.get("dictionary", []),
                "preview": self._make_preview_records(active_df),
                "profile": profile,
            },
            "analysis": {
                "descriptive_stats": analysis_results.get("descriptive_stats", {}),
                "correlations": analysis_results.get("correlations", {}),
                "vif": analysis_results.get("vif") or [],
            },
            "tests": test_results or [],
            "modeling": model_results or {},
            "timeseries": timeseries_results or {},
            "multivariate_timeseries": multivariate_ts_results or {},
            "factor_analysis": {
                "pca": pca_results or {},
                "ca": ca_results or {},
                "mca": mca_results or {},
            },
            "cleaning_log": cleaning_log,
            "transform_logs": transform_logs,
            "versions": self.get_versions(dataset_id),
            "history": self.get_history(dataset_id, limit=100),
            "audit_trail": self.get_audit_trail(dataset_id, limit=100),
        }

    # ── Helpers internes ───────────────────────────────────────

    def _load_latest_analysis_result(self, dataset_id: str, analysis_type: str) -> dict | None:
        """Charge le dernier résultat complet persisté pour un type d'analyse."""
        row = (
            AnalysisResult.query
            .filter_by(dataset_id=dataset_id, analysis_type=analysis_type)
            .order_by(AnalysisResult.created_at.desc())
            .first()
        )
        if row is None:
            return None
        result = storage.load_result(dataset_id, row.id)
        if isinstance(result, dict):
            return result
        return copy.deepcopy(row.result_summary) if row.result_summary else None

    def _load_all_analysis_results(self, dataset_id: str, analysis_type: str) -> list[dict]:
        """Charge tous les résultats persistés pour un type d'analyse, dans l'ordre chronologique."""
        rows = (
            AnalysisResult.query
            .filter_by(dataset_id=dataset_id, analysis_type=analysis_type)
            .order_by(AnalysisResult.created_at.asc())
            .all()
        )
        results: list[dict] = []
        for row in rows:
            result = storage.load_result(dataset_id, row.id)
            if isinstance(result, dict):
                results.append(result)
            elif row.result_summary:
                results.append(copy.deepcopy(row.result_summary))
        return results

    def _make_preview_records(self, df: pd.DataFrame | None, limit: int = 25) -> list[dict]:
        """Construit un aperçu JSON-safe du dataset courant."""
        if df is None or df.empty:
            return []

        records: list[dict] = []
        for row in df.head(limit).to_dict(orient="records"):
            normalized = {}
            for key, value in row.items():
                try:
                    is_missing = bool(pd.isna(value))
                except Exception:
                    is_missing = False

                if is_missing:
                    normalized[key] = None
                elif isinstance(value, pd.Timestamp):
                    normalized[key] = value.isoformat()
                elif hasattr(value, "item"):
                    try:
                        normalized[key] = value.item()
                    except Exception:
                        normalized[key] = value
                else:
                    normalized[key] = value
            records.append(normalized)
        return records

    def _get_transform_log(self, ds: Dataset) -> list:
        """Récupère le log de la dernière transformation persistée."""
        transformed_versions = [v for v in ds.versions if v.label == "transformed"]
        if transformed_versions:
            return transformed_versions[-1].operations_log or []
        return []

    def _audit(self, dataset_id: str, action: str, parameters: dict = None,
               version_before: int = None, version_after: int = None) -> None:
        """Enregistre une entrée d'audit."""
        log = AuditLog(
            dataset_id=dataset_id,
            action=action,
            parameters=parameters or {},
            version_before=version_before,
            version_after=version_after,
        )
        db.session.add(log)

    def _save_analysis(self, dataset_id: str, analysis_type: str,
                       parameters: dict, results: dict, duration_ms: int) -> str:
        """Sauvegarde un résultat d'analyse en DB + fichier."""
        ds = db.session.get(Dataset, dataset_id)
        current_version = max(v.version_number for v in ds.versions) if ds.versions else 1

        ar = AnalysisResult(
            dataset_id=dataset_id,
            dataset_version=current_version,
            analysis_type=analysis_type,
            parameters=parameters,
            duration_ms=duration_ms,
            status="completed",
        )
        db.session.add(ar)
        db.session.flush()

        # Sauvegarder les résultats complets sur disque
        result_path = storage.save_result(results, dataset_id, ar.id)
        ar.result_path = result_path

        # Résumé léger en DB
        ar.result_summary = self._make_summary(analysis_type, results)

        db.session.commit()
        return ar.id

    def _make_summary(self, analysis_type: str, results: dict) -> dict:
        """Crée un résumé léger pour stockage DB."""
        if analysis_type == "descriptive":
            return {"has_correlations": "correlations" in results, "has_vif": "vif" in results}
        if analysis_type == "test":
            return {k: results.get(k) for k in ("test", "statistic", "p_value", "significant", "effect_size")}
        if analysis_type == "modeling":
            return {
                "task_type": results.get("task_type"),
                "best_model_key": results.get("best_model_key"),
                "ranking_count": len(results.get("ranking", [])),
            }
        if analysis_type in ("timeseries", "multivariate_ts"):
            return {"model_count": len(results.get("models", results.get("var_results", {}))),
                    "has_irf": "irf" in results}
        return {}

    def _get_cleaning_log(self, ds: Dataset) -> list:
        """Récupère le log de nettoyage depuis la dernière version cleaned."""
        cleaned_versions = [v for v in ds.versions if v.label == "cleaned"]
        if cleaned_versions:
            return cleaned_versions[-1].operations_log or []
        return []


# Singleton global
dataset_manager = DatasetManager()
