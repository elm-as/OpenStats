"""
Mixin pour l'analyse de séries temporelles (univariées et multivariées) de DatasetManager.
"""

from __future__ import annotations

import time
from typing import Any


class DatasetTimeseriesMixin:
    """Fournit les méthodes run_timeseries et run_multivariate_timeseries."""

    def run_timeseries(
        self,
        dataset_id: str,
        date_col: str,
        value_col: str,
        models: list[str] | None = None,
        forecast_steps: int = 10,
    ) -> dict:
        """Lance l'analyse de série temporelle."""
        from app.core.timeseries import run_timeseries_analysis

        df = self.get_df(dataset_id, respect_exclusions=False)
        if df is None:
            raise ValueError(f"Dataset {dataset_id} introuvable")

        if date_col not in df.columns:
            raise ValueError(f"Colonne date introuvable : {date_col}")
        if value_col not in df.columns:
            raise ValueError(f"Colonne valeur introuvable : {value_col}")

        t0 = time.time()
        results = run_timeseries_analysis(
            df,
            date_col,
            value_col,
            models=models,
            forecast_steps=forecast_steps,
        )
        duration = int((time.time() - t0) * 1000)

        cache = self._get_cache(dataset_id)
        cache["timeseries_results"] = results

        params = {
            "date_col": date_col,
            "value_col": value_col,
            "models": models,
            "forecast_steps": forecast_steps,
        }
        self._save_analysis(dataset_id, "timeseries", params, results, duration)
        return results

    def run_multivariate_timeseries(
        self,
        dataset_id: str,
        date_col: str,
        value_cols: list[str],
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
        from app.core.timeseries import run_multivariate_timeseries_analysis

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
            df,
            date_col,
            value_cols,
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

        params = {
            "date_col": date_col,
            "value_cols": value_cols,
            "models": models,
            "forecast_steps": forecast_steps,
            "forced_model": forced_model,
        }
        self._save_analysis(dataset_id, "multivariate_ts", params, results, duration)
        return results
