"""
Pipeline de nettoyage des données.
Architecture Chain of Responsibility : chaque étape est indépendante,
configurable, réversible et journalisée.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from typing import Any
from copy import deepcopy


class CleaningStep:
    """Classe de base pour une étape de nettoyage."""

    name: str = "base"

    def apply(self, df: pd.DataFrame, config: dict) -> tuple[pd.DataFrame, dict]:
        """Applique la transformation. Retourne (df_transformé, log_opération)."""
        raise NotImplementedError

    def _log(self, message: str, details: dict | None = None) -> dict:
        return {"step": self.name, "message": message, "details": details or {}}


class DeduplicationStep(CleaningStep):
    """Suppression des doublons."""

    name = "deduplication"

    def apply(self, df: pd.DataFrame, config: dict) -> tuple[pd.DataFrame, dict]:
        subset = config.get("columns")  # None = toutes les colonnes
        before = len(df)
        df = df.drop_duplicates(subset=subset, keep="first").reset_index(drop=True)
        removed = before - len(df)
        return df, self._log(f"{removed} doublons supprimés", {"removed": removed})


class MissingValuesStep(CleaningStep):
    """Gestion des valeurs manquantes par colonne."""

    name = "missing_values"

    STRATEGIES = {
        "drop": "_drop",
        "mean": "_impute_mean",
        "median": "_impute_median",
        "mode": "_impute_mode",
        "knn": "_impute_knn",
        "forward_fill": "_forward_fill",
        "interpolate": "_interpolate",
        "constant": "_impute_constant",
    }

    def apply(self, df: pd.DataFrame, config: dict) -> tuple[pd.DataFrame, dict]:
        """
        config: {
            "columns": {"col_name": {"strategy": "mean"}, ...}
            "default_strategy": "median"  # pour les colonnes non spécifiées
        }
        """
        logs = []
        columns_config = config.get("columns", {})
        default_strategy = config.get("default_strategy", "median")

        for col in df.columns:
            null_count = df[col].isna().sum()
            if null_count == 0:
                continue

            col_config = columns_config.get(col, {"strategy": default_strategy})
            strategy = col_config.get("strategy", default_strategy)

            if strategy in self.STRATEGIES:
                method = getattr(self, self.STRATEGIES[strategy])
                df = method(df, col, col_config)
                logs.append(f"{col}: {strategy} ({null_count} valeurs)")

        return df, self._log(f"Imputation appliquée sur {len(logs)} colonnes", {"details": logs})

    def _drop(self, df: pd.DataFrame, col: str, config: dict) -> pd.DataFrame:
        return df.dropna(subset=[col]).reset_index(drop=True)

    def _impute_mean(self, df: pd.DataFrame, col: str, config: dict) -> pd.DataFrame:
        if pd.api.types.is_numeric_dtype(df[col]):
            df[col] = df[col].fillna(df[col].mean())
        return df

    def _impute_median(self, df: pd.DataFrame, col: str, config: dict) -> pd.DataFrame:
        if pd.api.types.is_numeric_dtype(df[col]):
            df[col] = df[col].fillna(df[col].median())
        return df

    def _impute_mode(self, df: pd.DataFrame, col: str, config: dict) -> pd.DataFrame:
        mode_val = df[col].mode()
        if not mode_val.empty:
            df[col] = df[col].fillna(mode_val.iloc[0])
        return df

    def _impute_knn(self, df: pd.DataFrame, col: str, config: dict) -> pd.DataFrame:
        from sklearn.impute import KNNImputer

        k = config.get("k", 5)
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        if col not in numeric_cols:
            return self._impute_median(df, col, config)

        imputer = KNNImputer(n_neighbors=k)
        df[numeric_cols] = imputer.fit_transform(df[numeric_cols])
        return df

    def _forward_fill(self, df: pd.DataFrame, col: str, config: dict) -> pd.DataFrame:
        df[col] = df[col].ffill()
        return df

    def _interpolate(self, df: pd.DataFrame, col: str, config: dict) -> pd.DataFrame:
        if pd.api.types.is_numeric_dtype(df[col]):
            df[col] = df[col].interpolate(method="linear")
        return df

    def _impute_constant(self, df: pd.DataFrame, col: str, config: dict) -> pd.DataFrame:
        value = config.get("value", 0)
        df[col] = df[col].fillna(value)
        return df


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


class NormalizationStep(CleaningStep):
    """Normalisation et mise à l'échelle."""

    name = "normalization"

    def apply(self, df: pd.DataFrame, config: dict) -> tuple[pd.DataFrame, dict]:
        """
        config: {
            "method": "standard" | "minmax" | "robust" | "maxabs" | "log",
            "columns": [...] | null
        }
        """
        from sklearn.preprocessing import StandardScaler, MinMaxScaler, RobustScaler, MaxAbsScaler

        method = config.get("method", "standard")
        columns = config.get("columns") or df.select_dtypes(include=[np.number]).columns.tolist()
        columns = [c for c in columns if c in df.columns]

        if not columns:
            return df, self._log("Aucune colonne numérique à normaliser")

        scalers = {
            "standard": StandardScaler,
            "minmax": MinMaxScaler,
            "robust": RobustScaler,
            "maxabs": MaxAbsScaler,
        }

        if method == "log":
            for col in columns:
                min_val = df[col].min()
                if min_val <= 0:
                    df[col] = np.log1p(df[col] - min_val + 1)
                else:
                    df[col] = np.log1p(df[col])
        elif method in scalers:
            scaler = scalers[method]()
            df[columns] = scaler.fit_transform(df[columns])
        else:
            return df, self._log(f"Méthode inconnue : {method}")

        return df, self._log(f"Normalisation {method} sur {len(columns)} colonnes", {"columns": columns})


class EncodingStep(CleaningStep):
    """Encodage des variables catégorielles."""

    name = "encoding"

    def apply(self, df: pd.DataFrame, config: dict) -> tuple[pd.DataFrame, dict]:
        """
        config: {
            "columns": {"col_name": {"method": "onehot"}, ...},
            "default_method": "onehot",
            "target_column": "y"  # pour target encoding
        }
        """
        default_method = config.get("default_method", "onehot")
        columns_config = config.get("columns", {})
        target_col = config.get("target_column")
        encoded_cols = []

        cat_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()
        if target_col and target_col in cat_cols:
            cat_cols.remove(target_col)

        for col in cat_cols:
            col_config = columns_config.get(col, {"method": default_method})
            method = col_config.get("method", default_method)

            if method == "onehot":
                dummies = pd.get_dummies(df[col], prefix=col, drop_first=True, dtype=int)
                df = pd.concat([df.drop(columns=[col]), dummies], axis=1)
            elif method == "label":
                df[col] = df[col].astype("category").cat.codes
            elif method == "target" and target_col:
                means = df.groupby(col)[target_col].mean()
                df[col] = df[col].map(means)
            elif method == "binary":
                codes = df[col].astype("category").cat.codes
                max_bits = int(np.ceil(np.log2(codes.max() + 1))) if codes.max() > 0 else 1
                for bit in range(max_bits):
                    df[f"{col}_bit{bit}"] = ((codes >> bit) & 1).astype(int)
                df = df.drop(columns=[col])

            encoded_cols.append(col)

        return df, self._log(f"Encodage de {len(encoded_cols)} colonnes catégorielles", {"columns": encoded_cols})


# ── Pipeline orchestrateur ──────────────────────────────────────────────

STEP_REGISTRY = {
    "deduplication": DeduplicationStep,
    "missing_values": MissingValuesStep,
    "outliers": OutlierStep,
    "normalization": NormalizationStep,
    "encoding": EncodingStep,
}


def run_cleaning_pipeline(df: pd.DataFrame, pipeline_config: list[dict]) -> tuple[pd.DataFrame, list[dict]]:
    """
    Exécute le pipeline de nettoyage complet.

    pipeline_config: [
        {"step": "deduplication", "config": {...}},
        {"step": "missing_values", "config": {...}},
        ...
    ]

    Retourne: (DataFrame nettoyé, journal des opérations)
    """
    logs = []
    df = df.copy()

    for step_conf in pipeline_config:
        step_name = step_conf.get("step")
        config = step_conf.get("config", {})

        step_cls = STEP_REGISTRY.get(step_name)
        if step_cls is None:
            logs.append({"step": step_name, "message": f"Étape inconnue : {step_name}"})
            continue

        step = step_cls()
        df, log = step.apply(df, config)
        logs.append(log)

    return df, logs
