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


from app.core.cleaning_base import CleaningStep
from app.core.cleaning_outliers import OutlierStep



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
                remaining_nulls = df[col].isna().sum()
                imputed_count = null_count - remaining_nulls
                logs.append(f"{col}: {strategy} ({imputed_count} imputées, {remaining_nulls} restantes)")

        return df, self._log(f"Imputation appliquée sur {len(logs)} colonnes", {"details": logs})

    def _drop(self, df: pd.DataFrame, col: str, config: dict) -> pd.DataFrame:
        return df.dropna(subset=[col]).reset_index(drop=True)

    def _impute_mean(self, df: pd.DataFrame, col: str, config: dict) -> pd.DataFrame:
        if pd.api.types.is_numeric_dtype(df[col]):
            mean_val = df[col].mean()
            fill_val = mean_val if pd.notna(mean_val) else 0
            df[col] = df[col].fillna(fill_val)
        else:
            df = self._impute_mode(df, col, config)
        return df

    def _impute_median(self, df: pd.DataFrame, col: str, config: dict) -> pd.DataFrame:
        if pd.api.types.is_numeric_dtype(df[col]):
            med_val = df[col].median()
            fill_val = med_val if pd.notna(med_val) else 0
            df[col] = df[col].fillna(fill_val)
        else:
            df = self._impute_mode(df, col, config)
        return df

    def _impute_mode(self, df: pd.DataFrame, col: str, config: dict) -> pd.DataFrame:
        mode_val = df[col].mode()
        if not mode_val.empty and pd.notna(mode_val.iloc[0]):
            df[col] = df[col].fillna(mode_val.iloc[0])
        else:
            fill_val = 0 if pd.api.types.is_numeric_dtype(df[col]) else "Inconnu"
            df[col] = df[col].fillna(fill_val)
        return df

    def _impute_knn(self, df: pd.DataFrame, col: str, config: dict) -> pd.DataFrame:
        if pd.api.types.is_numeric_dtype(df[col]):
            from sklearn.impute import KNNImputer
            k = config.get("k", 5)
            numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
            if len(numeric_cols) > 0:
                try:
                    imputer = KNNImputer(n_neighbors=k)
                    df[numeric_cols] = imputer.fit_transform(df[numeric_cols])
                except Exception:
                    df = self._impute_median(df, col, config)
            else:
                df = self._impute_median(df, col, config)
        else:
            df = self._impute_mode(df, col, config)
        return df

    def _forward_fill(self, df: pd.DataFrame, col: str, config: dict) -> pd.DataFrame:
        df[col] = df[col].ffill().bfill()
        if df[col].isna().any():
            df = self._impute_mode(df, col, config)
        return df

    def _interpolate(self, df: pd.DataFrame, col: str, config: dict) -> pd.DataFrame:
        if pd.api.types.is_numeric_dtype(df[col]):
            df[col] = df[col].interpolate(method="linear").bfill().ffill()
            if df[col].isna().any():
                df[col] = df[col].fillna(0)
        else:
            df = self._impute_mode(df, col, config)
        return df

    def _impute_constant(self, df: pd.DataFrame, col: str, config: dict) -> pd.DataFrame:
        value = config.get("value", 0)
        df[col] = df[col].fillna(value)
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
