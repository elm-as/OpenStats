"""
Préparation et prétraitement des données pour la modélisation.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline


def detect_task_type(
    y: pd.Series,
    user_override: str | None = None,
    explicit_task: str | None = None,
) -> str:
    """Détecte canoniquement et fiablement si la tâche est une régression ou classification."""
    if explicit_task:
        exp = str(explicit_task).lower().strip()
        if "regress" in exp:
            return "regression"
        if "classif" in exp:
            return "classification"

    if user_override:
        uo = str(user_override).lower().strip()
        if uo in ("catégoriel", "categoriel", "categorical", "binaire", "binary", "bool", "boolean", "discret", "discrete"):
            return "classification"
        if uo in ("numérique", "numerique", "numeric", "continu", "continuous", "float"):
            return "regression"

    clean_y = y.dropna()
    n_unique = clean_y.nunique()
    if n_unique <= 1:
        return "classification" if not pd.api.types.is_numeric_dtype(clean_y) else "regression"

    if n_unique == 2:
        return "classification"

    if not pd.api.types.is_numeric_dtype(clean_y):
        return "classification"

    if pd.api.types.is_float_dtype(clean_y):
        is_integer_valued = bool((clean_y == clean_y.round()).all())
        if is_integer_valued and n_unique <= 10:
            return "classification"
        return "regression"

    if n_unique <= 10:
        return "classification"

    return "regression"


def _parse_temporal_for_split(series: pd.Series) -> pd.Series:
    """Parsing léger des dates pour décider un split temporel."""
    s = series.dropna()
    if s.empty:
        return pd.Series(pd.NaT, index=series.index, dtype="datetime64[ns]")

    parsed = pd.Series(pd.NaT, index=series.index, dtype="datetime64[ns]")

    if pd.api.types.is_datetime64_any_dtype(series):
        parsed.loc[s.index] = pd.to_datetime(s, errors="coerce")
        return parsed

    if pd.api.types.is_numeric_dtype(series):
        numeric_vals = pd.to_numeric(s, errors="coerce").dropna()
        if not numeric_vals.empty and (numeric_vals == numeric_vals.round()).all():
            years = numeric_vals.between(1000, 3000)
            if not years.empty and years.mean() > 0.8:
                parsed.loc[s.index] = pd.to_datetime(numeric_vals.round().astype("Int64").astype(str), format="%Y", errors="coerce")
                return parsed
        return parsed

    text_vals = s.astype(str).str.strip()
    parsed1 = pd.to_datetime(text_vals, errors="coerce", dayfirst=True, format="mixed")
    parsed2 = pd.to_datetime(text_vals, errors="coerce", dayfirst=False, format="mixed")
    best = parsed1 if parsed1.notna().mean() >= parsed2.notna().mean() else parsed2
    parsed.loc[s.index] = best
    return parsed


def _choose_temporal_column(df: pd.DataFrame, target_col: str, temporal_col: str | None) -> str | None:
    """Choisit une colonne temporelle exploitable pour split chronologique."""
    if temporal_col and temporal_col in df.columns and temporal_col != target_col:
        parsed = _parse_temporal_for_split(df[temporal_col])
        if parsed.notna().mean() >= 0.6 and parsed.nunique(dropna=True) >= 6:
            return temporal_col

    candidates = [c for c in df.columns if c != target_col]
    scored = sorted(
        candidates,
        key=lambda c: 0 if any(k in c.lower() for k in ["date", "annee", "année", "year", "time"]) else 1,
    )
    for c in scored:
        parsed = _parse_temporal_for_split(df[c])
        if parsed.notna().mean() >= 0.6 and parsed.nunique(dropna=True) >= 6:
            return c
    return None


def _sanitize_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Supprime les caractères nuls (\x00) pour éviter les erreurs de sérialisation."""
    df.columns = [c.replace('\x00', '') if isinstance(c, str) else c for c in df.columns]
    for col in df.select_dtypes(include=['object']).columns:
        try:
            df[col] = df[col].astype(str).str.replace('\x00', '', regex=False)
        except Exception:
            pass
    return df.reset_index(drop=True)


def prepare_data(
    df: pd.DataFrame,
    target_col: str,
    test_size: float = 0.2,
    random_state: int = 42,
    split_strategy: str = "auto",
    temporal_col: str | None = None,
    task_type: str | None = None,
    user_override: str | None = None,
) -> dict:
    """Prépare les données pour la modélisation : séparation train/test."""
    working_df = _sanitize_dataframe(df.copy())
    if target_col not in working_df.columns:
        raise ValueError(f"Colonne cible '{target_col}' introuvable dans le dataset")

    working_df = working_df.dropna(subset=[target_col])
    if working_df.empty:
        raise ValueError(f"La colonne cible '{target_col}' ne contient que des valeurs manquantes (NaN)")

    target_base = str(target_col).strip().lower()
    cols_to_drop = [target_col]

    for col in working_df.columns:
        col_str = str(col).strip()
        col_lower = col_str.lower()
        if col_str == target_col or col_lower == target_base:
            continue
        if col_lower.startswith(f"{target_base}_") or col_lower.endswith(f"_{target_base}") or f"_{target_base}_" in col_lower:
            cols_to_drop.append(col)

    X = working_df.drop(columns=list(set(cols_to_drop)), errors="ignore")

    for col in X.columns:
        if pd.api.types.is_datetime64_any_dtype(X[col]):
            dt_s = X[col]
            year_s = dt_s.dt.year.astype(float)
            if dt_s.dt.month.nunique(dropna=True) > 1:
                X[col] = year_s + (dt_s.dt.dayofyear - 1) / 365.25
            else:
                X[col] = year_s
        elif "datetime" in str(X[col].dtype).lower():
            try:
                dt_s = pd.to_datetime(X[col], errors="coerce")
                if dt_s.notna().sum() > 0:
                    year_s = dt_s.dt.year.astype(float)
                    if dt_s.dt.month.nunique(dropna=True) > 1:
                        X[col] = year_s + (dt_s.dt.dayofyear - 1) / 365.25
                    else:
                        X[col] = year_s
            except Exception:
                pass
        elif X[col].dtype == object:
            try:
                parsed = pd.to_datetime(X[col], errors="coerce")
                if parsed.notna().mean() >= 0.8:
                    year_s = parsed.dt.year.astype(float)
                    if parsed.dt.month.nunique(dropna=True) > 1:
                        X[col] = year_s + (dt_s.dt.dayofyear - 1) / 365.25
                    else:
                        X[col] = year_s
            except Exception:
                pass

    cols_to_keep = []
    for col in X.columns:
        if X[col].dropna().empty:
            continue
        if pd.api.types.is_numeric_dtype(X[col]):
            cols_to_keep.append(col)
        else:
            if X[col].nunique() < 50:
                cols_to_keep.append(col)

    X = X[cols_to_keep]
    if X.empty:
        raise ValueError("Aucune feature valide disponible pour la modélisation")
    y = working_df[target_col]
    if y.nunique() < 2:
        val_sample = y.iloc[0] if len(y) > 0 else 'vide'
        raise ValueError(
            f"La colonne cible '{target_col}' ne contient qu'une seule valeur unique ('{val_sample}'). "
            f"La modélisation requiert au moins 2 modalités distinctes."
        )
    resolved_task_type = detect_task_type(y, user_override=user_override, explicit_task=task_type)

    use_time_split = False
    chosen_time_col = None
    if split_strategy not in {"auto", "random", "time"}:
        raise ValueError("split_strategy invalide (valeurs: auto, random, time)")

    if split_strategy in {"auto", "time"}:
        chosen_time_col = _choose_temporal_column(working_df, target_col, temporal_col)
        use_time_split = chosen_time_col is not None
        if split_strategy == "time" and chosen_time_col is None:
            raise ValueError("split temporel demandé mais aucune colonne temporelle valide trouvée")

    if use_time_split and chosen_time_col:
        parsed_time = _parse_temporal_for_split(working_df[chosen_time_col])
        order = parsed_time.sort_values().index
        X_sorted = X.loc[order]
        y_sorted = y.loc[order]
        t_sorted = parsed_time.loc[order]

        split_idx = max(1, int(len(X_sorted) * (1 - test_size)))
        if split_idx >= len(X_sorted):
            split_idx = len(X_sorted) - 1

        X_train, X_test = X_sorted.iloc[:split_idx], X_sorted.iloc[split_idx:]
        y_train, y_test = y_sorted.iloc[:split_idx], y_sorted.iloc[split_idx:]
        t_train, t_test = t_sorted.iloc[:split_idx], t_sorted.iloc[split_idx:]
        split_info = {
            "strategy": "time",
            "temporal_column": chosen_time_col,
            "train_time_range": {
                "start": t_train.min().isoformat() if t_train.notna().any() else None,
                "end": t_train.max().isoformat() if t_train.notna().any() else None,
            },
            "test_time_range": {
                "start": t_test.min().isoformat() if t_test.notna().any() else None,
                "end": t_test.max().isoformat() if t_test.notna().any() else None,
            },
        }
    else:
        can_stratify = resolved_task_type == "classification" and y.nunique() <= 50 and (y.value_counts().min() >= 2)
        stratify = y if can_stratify else None
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state, stratify=stratify
        )
        split_info = {
            "strategy": "random",
            "temporal_column": None,
            "train_time_range": None,
            "test_time_range": None,
        }

    return {
        "X_train": X_train, "X_test": X_test,
        "y_train": y_train, "y_test": y_test,
        "task_type": resolved_task_type,
        "feature_names": X.columns.tolist(),
        "split_info": split_info,
    }


def _build_preprocessor(X: pd.DataFrame, needs_scaling: bool = False) -> ColumnTransformer:
    """Construit un ColumnTransformer pour l'imputation et l'encodage selon les types."""
    X_clean = X.copy()
    for col in X_clean.columns:
        if pd.api.types.is_datetime64_any_dtype(X_clean[col]) or "datetime" in str(X_clean[col].dtype).lower():
            X_clean[col] = X_clean[col].astype(str).replace({'NaT': np.nan, 'nan': np.nan, 'None': np.nan, '<NaT>': np.nan})

    numeric_features = X_clean.select_dtypes(include=[np.number]).columns.tolist()
    categorical_features = X_clean.select_dtypes(exclude=[np.number]).columns.tolist()

    numeric_transformer_steps = [("imputer", SimpleImputer(strategy="median"))]
    if needs_scaling:
        numeric_transformer_steps.append(("scaler", StandardScaler()))

    numeric_transformer = Pipeline(steps=numeric_transformer_steps)

    categorical_transformer = Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False))
    ])

    transformers = []
    if numeric_features:
        transformers.append(("num", numeric_transformer, numeric_features))
    if categorical_features:
        transformers.append(("cat", categorical_transformer, categorical_features))

    return ColumnTransformer(transformers=transformers, remainder="passthrough")
