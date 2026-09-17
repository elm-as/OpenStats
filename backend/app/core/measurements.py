"""
Mesures descriptives partagees par l'Explorateur et l'Analyseur.

Les deux modules poursuivent des buts differents — l'un observe et classe des
decouvertes, l'autre diagnostique puis corrige les donnees — mais ils
s'appuient sur les memes mesures elementaires : asymetrie, valeurs extremes,
lacunes, doublons, correlations fortes, colonnes sans variance.

Ces mesures vivent ici et nulle part ailleurs. Deux implementations d'un meme
calcul finissent toujours par diverger : le seuil corrige d'un cote, la garde
ajoutee de l'autre, et l'application se met a repondre deux choses differentes
a la meme question.

Chaque fonction renvoie `None` ou une structure vide quand la mesure n'a pas de
sens sur l'entree fournie (serie constante, echantillon trop court) : c'est un
resultat, pas une erreur.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd
from scipy import stats

MIN_POINTS_FOR_MOMENTS = 3
MIN_POINTS_FOR_OUTLIERS = 12
MIN_PAIRS_FOR_CORRELATION = 4
IQR_FACTOR = 1.5


@dataclass(frozen=True)
class OutlierBounds:
    """Points hors des bornes de Tukey, avec les bornes elles-memes."""

    count: int
    ratio: float
    lower: float
    upper: float

    def to_dict(self) -> dict[str, Any]:
        return {"count": self.count, "ratio": round(self.ratio, 6),
                "lower": round(self.lower, 4), "upper": round(self.upper, 4)}


@dataclass(frozen=True)
class Correlation:
    """Liaison lineaire entre deux colonnes, sur les paires completes."""

    a: str
    b: str
    r: float
    p_value: float
    n: int


def skewness(series: pd.Series) -> float | None:
    """Coefficient d'asymetrie, ou None si les moments ne sont pas definis."""
    values = pd.to_numeric(series, errors="coerce").dropna()
    if len(values) < MIN_POINTS_FOR_MOMENTS or values.nunique() < 2:
        return None
    return float(stats.skew(values))


def kurtosis(series: pd.Series) -> float | None:
    """Coefficient d'aplatissement, ou None si les moments ne sont pas definis."""
    values = pd.to_numeric(series, errors="coerce").dropna()
    if len(values) < MIN_POINTS_FOR_MOMENTS or values.nunique() < 2:
        return None
    return float(stats.kurtosis(values))


def outliers(series: pd.Series, factor: float = IQR_FACTOR) -> OutlierBounds | None:
    """Valeurs hors de [Q1 - k*IQR ; Q3 + k*IQR].

    Renvoie None quand l'intervalle interquartile est nul : plus de la moitie
    des observations sont alors identiques, et toute valeur differente serait
    declaree extreme.
    """
    values = pd.to_numeric(series, errors="coerce").dropna()
    if len(values) < MIN_POINTS_FOR_OUTLIERS:
        return None

    q1, q3 = values.quantile(0.25), values.quantile(0.75)
    spread = q3 - q1
    if spread <= 0:
        return None

    lower, upper = q1 - factor * spread, q3 + factor * spread
    mask = (values < lower) | (values > upper)
    return OutlierBounds(int(mask.sum()), float(mask.mean()), float(lower), float(upper))


def missing_rate(series: pd.Series) -> float:
    """Part de valeurs manquantes, entre 0 et 1."""
    return float(series.isna().mean()) if len(series) else 0.0


def missing_rates(df: pd.DataFrame) -> dict[str, float]:
    """Taux de manquants par colonne."""
    return {col: missing_rate(df[col]) for col in df.columns}


def duplicate_rows(df: pd.DataFrame) -> tuple[int, float]:
    """Nombre et part de lignes strictement dupliquees."""
    if df.empty:
        return 0, 0.0
    count = int(df.duplicated().sum())
    return count, count / len(df)


def constant_columns(df: pd.DataFrame) -> list[str]:
    """Colonnes sans aucune variation observee."""
    return [col for col in df.columns if df[col].dropna().nunique() <= 1]


def near_constant_columns(df: pd.DataFrame, dominance: float = 0.98) -> list[str]:
    """Colonnes dont une seule modalite couvre presque tout l'echantillon."""
    suspects: list[str] = []
    for col in df.columns:
        valid = df[col].dropna()
        if valid.empty:
            continue
        if valid.nunique() <= 1 or valid.value_counts(normalize=True).iloc[0] > dominance:
            suspects.append(col)
    return suspects


def identifier_like_columns(df: pd.DataFrame, uniqueness: float = 0.95,
                            min_rows: int = 20) -> list[str]:
    """Colonnes textuelles quasi uniques : des identifiants deguises en variables.

    Les dates sont exclues : elles sont uniques par construction sans etre des
    identifiants.
    """
    suspects: list[str] = []
    for col in df.columns:
        if pd.api.types.is_numeric_dtype(df[col]) or pd.api.types.is_datetime64_any_dtype(df[col]):
            continue
        valid = df[col].dropna()
        if len(valid) >= min_rows and valid.nunique() / len(valid) >= uniqueness:
            suspects.append(col)
    return suspects


def correlation(x: pd.Series, y: pd.Series) -> tuple[float, float, int]:
    """Correlation de Pearson (r, p, n) sur les paires completes.

    Renvoie (0, 1, n) quand la mesure n'a pas de sens : moins de quatre paires
    completes, ou l'une des deux series constante. Les preconditions de
    `pearsonr` sont ainsi verifiees en amont plutot qu'interceptees.
    """
    pair = pd.concat([x, y], axis=1).replace([np.inf, -np.inf], np.nan).dropna()
    if (len(pair) < MIN_PAIRS_FOR_CORRELATION
            or pair.iloc[:, 0].nunique() < 2 or pair.iloc[:, 1].nunique() < 2):
        return 0.0, 1.0, len(pair)

    r, p = stats.pearsonr(pair.iloc[:, 0], pair.iloc[:, 1])
    return float(r), float(p), len(pair)


def strong_correlations(df: pd.DataFrame, columns: list[str],
                        threshold: float = 0.9) -> list[Correlation]:
    """Paires de colonnes dont la liaison depasse le seuil, en valeur absolue."""
    found: list[Correlation] = []
    for index, a in enumerate(columns):
        for b in columns[index + 1:]:
            if a not in df.columns or b not in df.columns:
                continue
            r, p, n = correlation(df[a], df[b])
            if abs(r) >= threshold:
                found.append(Correlation(a, b, r, p, n))
    return sorted(found, key=lambda c: -abs(c.r))


def normality(series: pd.Series) -> dict[str, Any] | None:
    """Test de normalite adapte a la taille de l'echantillon.

    Shapiro-Wilk en dessous de 5 000 observations, D'Agostino-Pearson au-dela.
    Renvoie None quand aucun des deux n'est applicable.
    """
    values = pd.to_numeric(series, errors="coerce").dropna()
    if values.nunique() < 2:
        return None

    if len(values) <= 5000:
        if len(values) < MIN_POINTS_FOR_MOMENTS:
            return None
        statistic, p_value = stats.shapiro(values)
        name = "Shapiro-Wilk"
    else:
        statistic, p_value = stats.normaltest(values)
        name = "D'Agostino-Pearson"

    return {"name": name, "stat": round(float(statistic), 4), "p": float(p_value)}


def class_imbalance(series: pd.Series) -> dict[str, Any] | None:
    """Desequilibre d'une variable qualitative : ratio minorite / majorite."""
    counts = series.value_counts()
    if len(counts) < 2:
        return None
    return {
        "counts": {str(k): int(v) for k, v in counts.items()},
        "ratio": float(counts.min() / counts.max()),
        "majority_share": float(counts.max() / counts.sum()),
        "minority": str(counts.idxmin()),
        "majority": str(counts.idxmax()),
    }
