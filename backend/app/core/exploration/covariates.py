"""
Classement des covariables par pertinence vis-à-vis de la cible.

Répond à la question « sur quelles variables lancer l'analyse ? ». Remplace les
tranches arbitraires (`numeric_cols[:5]`) par un classement fondé sur
l'information mutuelle, qui capte aussi les liaisons non linéaires qu'une
corrélation de Pearson manque.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from app.core.statistical_attempt import attempt


MAX_CATEGORIES_FOR_ENCODING = 50


def _encode_for_mi(series: pd.Series) -> tuple[np.ndarray, bool]:
    """Encode une colonne en vecteur numérique. Renvoie (valeurs, est_discret)."""
    if pd.api.types.is_numeric_dtype(series):
        return series.to_numpy(dtype=float), False
    codes = pd.Categorical(series).codes.astype(float)
    return codes, True


def _clean_pair(df: pd.DataFrame, col: str, target: str) -> pd.DataFrame:
    pair = df[[col, target]].replace([np.inf, -np.inf], np.nan).dropna()
    return pair


def mutual_information(df: pd.DataFrame, target: str, columns: list[str],
                       random_state: int = 0) -> dict[str, float]:
    """Information mutuelle normalisée entre chaque colonne et la cible.

    Normalisée par l'entropie de la cible pour rester dans [0, 1] et rester
    comparable d'un dataset à l'autre.
    """
    from sklearn.feature_selection import mutual_info_classif, mutual_info_regression

    if target not in df.columns:
        return {}

    target_numeric = pd.api.types.is_numeric_dtype(df[target]) and df[target].nunique() > 12
    scores: dict[str, float] = {}

    for col in columns:
        if col == target:
            continue
        pair = _clean_pair(df, col, target)
        if len(pair) < 8 or pair[col].nunique() < 2:
            continue
        if not pd.api.types.is_numeric_dtype(pair[col]) and pair[col].nunique() > MAX_CATEGORIES_FOR_ENCODING:
            continue

        x, discrete = _encode_for_mi(pair[col])
        y, _ = _encode_for_mi(pair[target])

        estimator = mutual_info_regression if target_numeric else mutual_info_classif
        # Une colonne que l'estimateur refuse est ecartee du classement :
        # elle ne peut simplement pas etre comparee aux autres.
        outcome = attempt(estimator, x.reshape(-1, 1), y,
                          discrete_features=[discrete], random_state=random_state)
        if outcome:
            scores[col] = float(outcome.value[0])

    return _normalize(scores, df[target])


def _normalize(scores: dict[str, float], target_series: pd.Series) -> dict[str, float]:
    """Ramène les scores dans [0, 1] par l'entropie de la cible."""
    if not scores:
        return {}

    if pd.api.types.is_numeric_dtype(target_series) and target_series.nunique() > 12:
        # Pas d'entropie discrète exploitable : on normalise par le maximum observé.
        top = max(scores.values()) or 1.0
        return {k: round(min(1.0, v / top), 4) for k, v in scores.items()}

    counts = target_series.value_counts(normalize=True)
    entropy = float(-(counts * np.log(counts)).sum()) or 1.0
    return {k: round(min(1.0, v / entropy), 4) for k, v in scores.items()}


def rank_covariates(df: pd.DataFrame, target: str, columns: list[str],
                    top_k: int | None = None) -> list[tuple[str, float]]:
    """Covariables triées par information mutuelle décroissante avec la cible."""
    scores = mutual_information(df, target, columns)
    ordered = sorted(scores.items(), key=lambda kv: -kv[1])
    return ordered[:top_k] if top_k else ordered


def pearson_corr(df: pd.DataFrame, a: str, b: str) -> tuple[float, float, int]:
    """Corrélation de Pearson (r, p, n) sur les paires complètes."""
    from scipy import stats

    pair = _clean_pair(df, a, b)
    if len(pair) < 4:
        return 0.0, 1.0, len(pair)
    r, p = stats.pearsonr(pair[a], pair[b])
    return float(r), float(p), len(pair)
