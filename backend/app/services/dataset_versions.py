"""
Mixin de gestion des versions, de l'audit et des bundles d'export pour DatasetManager.
"""

from __future__ import annotations

import copy
import os
import pandas as pd
from datetime import datetime, timezone
from typing import Any

from app.config import Config
from app.extensions import db
from app.models.dataset import Dataset, DatasetVersion
from app.models.analysis import AnalysisResult
from app.models.audit import AuditLog
from app.services.storage_service import storage


class DatasetVersionsMixin:
    """Fournit les méthodes d'historique, de versionnage, d'audit et d'export bundle."""

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

        self._audit(
            dataset_id,
            "restore",
            {"restored_from": version_number},
            version_before=next_version - 1,
            version_after=next_version,
        )
        db.session.commit()
        from app.services.dataset_service import _invalidate_df_cache
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

    def generate_pdf_report(
        self,
        dataset_id: str,
        title: str = "Rapport d'Analyse",
        organization: str = "OpenStats — Elmas Labs",
    ) -> str:
        """Génère le rapport PDF via le moteur professionnel unifié."""
        bundle = self.get_export_bundle(dataset_id, title=title, organization=organization)

        reports_dir = Config.REPORTS_DIR
        os.makedirs(reports_dir, exist_ok=True)

        filename = f"rapport_{dataset_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        output_path = os.path.join(reports_dir, filename)

        from app.core.professional_report import build_report_payload, generate_pdf

        ds = self.get(dataset_id) or {}
        content = build_report_payload(
            dataset_name=ds.get("name") or dataset_id,
            profile=bundle.get("data_summary", {}).get("profile", {}),
            recipe=bundle.get("recipe", {}),
            descriptive=bundle.get("analysis", {}).get("descriptive_stats"),
            model_results=bundle.get("modeling", {}),
            insights=bundle.get("insights", {}),
        )
        content.title = title
        content.subtitle = f"Édité par {organization}"

        pdf_bytes = generate_pdf(content)
        with open(output_path, "wb") as f:
            f.write(pdf_bytes)

        self._audit(dataset_id, "report", {"title": title, "path": output_path})
        return output_path

    def get_export_bundle(
        self,
        dataset_id: str,
        title: str | None = None,
        organization: str | None = None,
    ) -> dict:
        """Construit un payload d'export stable à partir du cache et des résultats persistés."""
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

    def _audit(
        self,
        dataset_id: str,
        action: str,
        parameters: dict = None,
        version_before: int = None,
        version_after: int = None,
    ) -> None:
        """Enregistre une entrée d'audit."""
        log = AuditLog(
            dataset_id=dataset_id,
            action=action,
            parameters=parameters or {},
            version_before=version_before,
            version_after=version_after,
        )
        db.session.add(log)

    def _get_cleaning_log(self, ds: Dataset) -> list:
        """Récupère le log de nettoyage depuis la dernière version cleaned."""
        cleaned_versions = [v for v in ds.versions if v.label == "cleaned"]
        if cleaned_versions:
            return cleaned_versions[-1].operations_log or []
        return []
