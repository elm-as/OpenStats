"""
Étape de nettoyage pour la détection et le traitement des valeurs aberrantes.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from app.core.cleaning_base import CleaningStep


class OutlierStep(CleaningStep):
    """Détection et traitement des valeurs aberrantes."""

    name = "outliers"

    def apply(self, df: pd.DataFrame, config: dict) -> tuple[pd.DataFrame, dict]:
        """
        config: {
            "method": "iqr" | "zscore" | "isolation_forest",
            "treatment": "remove" | "cap" | "log" | "flag",
            "threshold": 1.5 (pour IQR) ou 3.0 (pour Z-score),
            "columns": ["col1", "col2"] | null (toutes numériques)
        }
        """
        method = config.get("method", "iqr")
        treatment = config.get("treatment", "cap")
        threshold = config.get("threshold", 1.5 if method == "iqr" else 3.0)
        columns = config.get("columns") or df.select_dtypes(include=[np.number]).columns.tolist()

        total_outliers = 0
        for col in columns:
            if col not in df.columns or not pd.api.types.is_numeric_dtype(df[col]):
                continue

            mask = self._detect(df[col], method, threshold)
            n_outliers = mask.sum()
            total_outliers += n_outliers

            if n_outliers == 0:
                continue

            df = self._treat(df, col, mask, treatment, config)

        return df, self._log(
            f"{total_outliers} outliers détectés ({method}), traitement: {treatment}",
            {"method": method, "treatment": treatment, "total_outliers": int(total_outliers)},
        )

    def _detect(self, series: pd.Series, method: str, threshold: float) -> pd.Series:
        if method == "iqr":
            q1 = series.quantile(0.25)
            q3 = series.quantile(0.75)
            iqr = q3 - q1
            return (series < q1 - threshold * iqr) | (series > q3 + threshold * iqr)
        elif method == "zscore":
            mean = series.mean()
            std = series.std()
            if std == 0:
                return pd.Series(False, index=series.index)
            z = (series - mean).abs() / std
            return z > threshold
        elif method == "isolation_forest":
            from sklearn.ensemble import IsolationForest

            valid = series.dropna()
            if len(valid) < 10:
                return pd.Series(False, index=series.index)
            iso = IsolationForest(contamination=0.05, random_state=42)
            preds = iso.fit_predict(valid.values.reshape(-1, 1))
            mask = pd.Series(False, index=series.index)
            mask.loc[valid.index] = preds == -1
            return mask
        return pd.Series(False, index=series.index)

    def _treat(self, df: pd.DataFrame, col: str, mask: pd.Series, treatment: str, config: dict) -> pd.DataFrame:
        if treatment == "remove":
            df = df[~mask].reset_index(drop=True)
        elif treatment == "cap":
            lower_p = config.get("cap_lower", 0.01)
            upper_p = config.get("cap_upper", 0.99)
            lower = df[col].quantile(lower_p)
            upper = df[col].quantile(upper_p)
            df[col] = df[col].clip(lower, upper)
        elif treatment == "log":
            min_val = df[col].min()
            if min_val <= 0:
                df[col] = np.log1p(df[col] - min_val + 1)
            else:
                df[col] = np.log1p(df[col])
        elif treatment == "flag":
            df[f"{col}_is_outlier"] = mask.astype(int)
        return df
