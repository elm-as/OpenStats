"""
Mixin de calculs et analyses statistiques pour DatasetManager.
Délègue les opérations métier aux modules app.core.
"""

from __future__ import annotations

import time
from typing import Any

from app.extensions import db
from app.models.dataset import Dataset, DatasetVersion
from app.models.analysis import AnalysisResult
from app.services.storage_service import storage
from app.core.profiling import profile_dataframe
from app.core.cleaning import run_cleaning_pipeline
from app.core.analysis import (
    compute_descriptive_stats,
    compute_correlation_matrix,
    compute_vif,
    run_hypothesis_test,
)


class DatasetComputationMixin:
    """Fournit les méthodes d'analyse, nettoyage, modélisation et séries temporelles."""

    def clean(self, dataset_id: str, pipeline_config: list[dict]) -> dict:
        """Applique le pipeline de nettoyage."""
        ds = db.session.get(Dataset, dataset_id)
        if ds is None:
            raise ValueError(f"Dataset {dataset_id} introuvable")

        df_raw = storage.load_dataframe(dataset_id, version=1)
        df_clean, logs = run_cleaning_pipeline(df_raw.copy(), pipeline_config)

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

        self._audit(
            dataset_id,
            "clean",
            {"pipeline": pipeline_config, "logs_count": len(logs)},
            version_before=next_version - 1,
            version_after=next_version,
        )
        db.session.commit()
        from app.services.dataset_service import _invalidate_df_cache
        _invalidate_df_cache(dataset_id)

        return {
            "shape_before": {"rows": df_raw.shape[0], "columns": df_raw.shape[1]},
            "shape_after": {"rows": df_clean.shape[0], "columns": df_clean.shape[1]},
            "logs": logs,
        }

    def analyze(self, dataset_id: str, bootstrap_ci: bool = False, n_bootstrap: int = 1000) -> dict:
        """Exécute l'analyse statistique descriptive, corrélations et VIF."""
        df = self.get_df(dataset_id)
        if df is None:
            raise ValueError(f"Dataset {dataset_id} introuvable")

        t0 = time.time()

        descriptive = {}
        try:
            descriptive = compute_descriptive_stats(df, bootstrap_ci=bootstrap_ci, n_bootstrap=n_bootstrap)
        except Exception as e:
            descriptive = {"error": f"Erreur stats descriptives: {str(e)}"}

        pearson, spearman = {}, {}
        try:
            pearson = compute_correlation_matrix(df, "pearson", bootstrap_ci=bootstrap_ci, n_bootstrap=min(n_bootstrap, 500))
        except Exception as e:
            pearson = {"error": f"Erreur corrélation Pearson: {str(e)}"}
        try:
            spearman = compute_correlation_matrix(df, "spearman", bootstrap_ci=bootstrap_ci, n_bootstrap=min(n_bootstrap, 500))
        except Exception as e:
            spearman = {"error": f"Erreur corrélation Spearman: {str(e)}"}

        vif = []
        try:
            vif = compute_vif(df)
        except Exception as e:
            vif = [{"error": f"Erreur VIF: {str(e)}"}]

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

        _ALLOWED = {"test_type", "group_col", "value_col", "col1", "col2"}
        filtered = {k: v for k, v in test_config.items() if k in _ALLOWED and v is not None}

        t0 = time.time()
        result = run_hypothesis_test(df, **filtered)
        duration = int((time.time() - t0) * 1000)

        self._save_analysis(dataset_id, "test", test_config, result, duration)
        return result

    def train_models(
        self,
        dataset_id: str,
        target_col: str,
        model_keys: list[str] | None = None,
        test_size: float = 0.2,
        split_strategy: str = "auto",
        temporal_col: str | None = None,
        task_type: str | None = None,
    ) -> dict:
        """Lance l'entraînement compétitif multi-algorithmes."""
        from app.core.modeling import prepare_data, train_competitive

        df = self.get_df(dataset_id)
        if df is None:
            raise ValueError(f"Dataset {dataset_id} introuvable")

        ds_meta = self.get(dataset_id)
        type_overrides = (ds_meta.get("type_overrides") or {}) if ds_meta else {}
        target_override = type_overrides.get(target_col)

        t0 = time.time()
        data = prepare_data(
            df,
            target_col,
            test_size=test_size,
            split_strategy=split_strategy,
            temporal_col=temporal_col,
            task_type=task_type,
            user_override=target_override,
        )
        results = train_competitive(data, model_keys=model_keys, task_type=task_type)

        shap_data = None
        if results.get("best_model") is not None:
            try:
                from app.core.explainability import compute_shap_values
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

        params = {
            "target": target_col,
            "models": model_keys,
            "test_size": test_size,
            "split_strategy": split_strategy,
        }
        summary = {k: v for k, v in results.items() if k not in ("best_model", "trained_models")}
        self._save_analysis(dataset_id, "modeling", params, summary, duration)

        return results

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

    def _save_analysis(
        self,
        dataset_id: str,
        analysis_type: str,
        parameters: dict,
        results: dict,
        duration_ms: int,
    ) -> str:
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

        result_path = storage.save_result(results, dataset_id, ar.id)
        ar.result_path = result_path
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
            return {
                "model_count": len(results.get("models", results.get("var_results", {}))),
                "has_irf": "irf" in results,
            }
        return {}
