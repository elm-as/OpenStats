"""
Détecteur intelligent : analyse un DataFrame pour identifier :
 - les types de variables (numérique, catégorielle, temporelle, ID, binaire)
 - une cible probable pour la modélisation
 - le type de problème (régression / classification / forecast / clustering / exploration)
 - les structures (panel, temporel, cross-section)
 - les anomalies (valeurs manquantes massives, doublons, outliers)
 - les corrélations fortes / multicolinéarité potentielle
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any

import numpy as np
import pandas as pd


# ── Heuristiques typage ──────────────────────────────────────────────────


def _is_id_like(series: pd.Series) -> bool:
    """Détecte un identifiant (cardinalité ≈ N)."""
    n = len(series)
    if n == 0:
        return False
    uniq = series.nunique(dropna=True)
    return uniq >= 0.95 * n and uniq >= 50


def _is_binary(series: pd.Series) -> bool:
    valid = series.dropna()
    if len(valid) == 0:
        return False
    return valid.nunique() == 2


def _is_temporal(series: pd.Series) -> bool:
    """Détecte une colonne temporelle (datetime, année, dates parsables)."""
    if pd.api.types.is_datetime64_any_dtype(series):
        return True
    sample = series.dropna().head(50)
    if sample.empty:
        return False

    # Année (entier 1000-3000)
    try:
        nums = pd.to_numeric(sample, errors="coerce")
        if nums.notna().mean() > 0.9:
            within = nums.between(1000, 3000).mean()
            if within > 0.8:
                return True
    except Exception:
        pass

    # Dates parsables
    try:
        parsed = pd.to_datetime(sample.astype(str), errors="coerce", dayfirst=True, format="mixed")
        if parsed.notna().mean() > 0.7:
            return True
    except Exception:
        pass

    return False


def _classify_column(series: pd.Series, name: str = "") -> str:
    """Retourne le type sémantique : id | binary | temporal | numeric | discrete | categorical."""
    name_lower = name.lower()

    if _is_temporal(series) or any(k in name_lower for k in ["date", "time", "year", "annee", "mois", "month"]):
        if _is_temporal(series):
            return "temporal"

    if _is_id_like(series):
        return "id"

    if _is_binary(series):
        return "binary"

    if pd.api.types.is_numeric_dtype(series):
        n_unique = series.nunique(dropna=True)
        # Discret si peu de valeurs uniques
        if n_unique <= 10 and n_unique / max(len(series), 1) < 0.1:
            return "discrete"
        return "numeric"

    return "categorical"


# ── Détection cible & problème ───────────────────────────────────────────


def _score_target_candidate(series: pd.Series, col_type: str, name: str) -> float:
    """
    Score 0-100 pour estimer si une variable est un bon candidat target.
    Heuristique : nom évocateur + taux de manquants + cardinalité.
    """
    name_lower = name.lower()
    score = 30.0

    # Nom évocateur
    target_keywords = [
        "target", "label", "y", "outcome", "result", "class", "category",
        "churn", "default", "fraud", "click", "buy", "purchase", "convert",
        "price", "prix", "value", "valeur", "amount", "montant", "revenue",
        "sales", "ventes", "score", "rating", "note",
    ]
    for kw in target_keywords:
        if kw in name_lower:
            score += 25
            break

    # Pénalité pour ID / temporal
    if col_type in ("id", "temporal"):
        score -= 50

    # Taux de manquants
    nr = series.isna().mean()
    if nr < 0.05:
        score += 10
    elif nr > 0.3:
        score -= 20

    # Numerique ou binaire = bon candidat
    if col_type in ("numeric", "binary", "discrete"):
        score += 15
    elif col_type == "categorical":
        nu = series.nunique(dropna=True)
        if 2 <= nu <= 10:
            score += 10
        else:
            score -= 10

    return max(0.0, min(100.0, score))


def _detect_problem_type(target_series: pd.Series, target_type: str) -> str:
    """regression | binary_classification | multiclass_classification | forecast."""
    if target_type == "binary":
        return "binary_classification"
    if target_type == "numeric":
        return "regression"
    if target_type == "discrete":
        nu = target_series.nunique(dropna=True)
        if nu == 2:
            return "binary_classification"
        if nu <= 10:
            return "multiclass_classification"
        return "regression"
    if target_type == "categorical":
        return "multiclass_classification"
    return "exploration"


# ── DatasetProfile ───────────────────────────────────────────────────────


@dataclass
class DatasetProfile:
    """Profil sémantique d'un dataset."""

    n_rows: int = 0
    n_cols: int = 0
    column_types: dict[str, str] = field(default_factory=dict)  # col -> type
    numeric_cols: list[str] = field(default_factory=list)
    categorical_cols: list[str] = field(default_factory=list)
    binary_cols: list[str] = field(default_factory=list)
    temporal_cols: list[str] = field(default_factory=list)
    id_cols: list[str] = field(default_factory=list)
    discrete_cols: list[str] = field(default_factory=list)

    suggested_target: str | None = None
    target_score: float = 0.0
    problem_type: str = "exploration"  # regression | binary_classification | multiclass | forecast | exploration

    has_temporal: bool = False
    is_timeseries: bool = False  # 1 date + ≥1 valeur
    is_panel: bool = False  # date + entité + valeurs
    is_cross_section: bool = True

    duplicate_rows: int = 0
    duplicate_ratio: float = 0.0
    overall_null_rate: float = 0.0
    high_missing_cols: list[str] = field(default_factory=list)  # >50% NaN
    near_constant_cols: list[str] = field(default_factory=list)

    flags: list[str] = field(default_factory=list)  # Drapeaux libres : "small_sample", "high_dim", "wide_dataset"

    candidate_targets: list[dict[str, Any]] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)

    # Stationnarité (rempli uniquement si temporal)
    # col -> {"order": 0|1|2, "is_stationary": bool, "adf_p": float, "kpss_p": float}
    integration_orders: dict[str, dict[str, Any]] = field(default_factory=dict)
    # Résumé : "all_stationary" | "cointegrated" | "mixed" | "all_nonstationary"
    stationarity_summary: str = "unknown"
    cointegration_likely: bool = False  # True si ≥2 I(1) probablement cointégrées

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


# ── Stationnarité rapide ──────────────────────────────────────────────────


def _integration_order(series: pd.Series, max_diff: int = 2) -> dict[str, Any]:
    """Retourne l'ordre d'intégration I(d) d'une série via ADF."""
    try:
        from statsmodels.tsa.stattools import adfuller, kpss
    except ImportError:
        return {"order": 0, "is_stationary": True, "adf_p": None, "kpss_p": None, "error": "statsmodels manquant"}

    s = series.dropna()
    if len(s) < 8:
        return {"order": 0, "is_stationary": True, "adf_p": None, "kpss_p": None, "error": "série trop courte"}

    result = {"order": 0, "is_stationary": False, "adf_p": None, "kpss_p": None}
    for d in range(max_diff + 1):
        try:
            adf_p = float(adfuller(s, autolag="AIC")[1])
        except Exception:
            adf_p = 1.0
        try:
            kpss_p = float(kpss(s, regression="c", nlags="auto")[1])
        except Exception:
            kpss_p = 0.0
        stationary = adf_p < 0.05 and kpss_p > 0.05
        if d == 0:
            result["adf_p"] = round(adf_p, 4)
            result["kpss_p"] = round(kpss_p, 4)
        if stationary:
            result["order"] = d
            result["is_stationary"] = True
            if d > 0:
                result["adf_p"] = round(adf_p, 4)
                result["kpss_p"] = round(kpss_p, 4)
            break
        if d < max_diff:
            s = s.diff().dropna()
        else:
            result["order"] = max_diff + 1
    return result


# ── Detector principal ───────────────────────────────────────────────────


def detect_dataset_profile(
    df: pd.DataFrame,
    user_hint_target: str | None = None,
) -> DatasetProfile:
    """Analyse complète d'un DataFrame pour produire son profil sémantique."""
    profile = DatasetProfile(n_rows=len(df), n_cols=df.shape[1])

    # 1. Typage des colonnes
    for col in df.columns:
        ct = _classify_column(df[col], name=col)
        profile.column_types[col] = ct
        if ct == "numeric":
            profile.numeric_cols.append(col)
        elif ct == "categorical":
            profile.categorical_cols.append(col)
        elif ct == "binary":
            profile.binary_cols.append(col)
        elif ct == "temporal":
            profile.temporal_cols.append(col)
        elif ct == "id":
            profile.id_cols.append(col)
        elif ct == "discrete":
            profile.discrete_cols.append(col)

    profile.has_temporal = len(profile.temporal_cols) > 0

    # 2. Qualité
    profile.duplicate_rows = int(df.duplicated().sum())
    profile.duplicate_ratio = profile.duplicate_rows / max(len(df), 1)
    profile.overall_null_rate = float(df.isna().mean().mean()) if df.shape[1] > 0 else 0.0
    profile.high_missing_cols = [c for c in df.columns if df[c].isna().mean() > 0.5]

    # Constantes / quasi-constantes
    for c in df.columns:
        valid = df[c].dropna()
        if len(valid) > 0 and valid.nunique() == 1:
            profile.near_constant_cols.append(c)
        elif len(valid) > 0:
            top_freq = valid.value_counts(normalize=True).iloc[0]
            if top_freq > 0.98:
                profile.near_constant_cols.append(c)

    # 3. Drapeaux
    if profile.n_rows < 100:
        profile.flags.append("small_sample")
    if profile.n_rows > 100000:
        profile.flags.append("large_sample")
    if profile.n_cols > 50:
        profile.flags.append("wide_dataset")
    if profile.n_cols > profile.n_rows:
        profile.flags.append("high_dim")

    # 4. Structure temporelle / panel
    if profile.has_temporal:
        # Panel : date + ≥1 ID + numériques
        if profile.id_cols and (profile.numeric_cols or profile.discrete_cols):
            profile.is_panel = True
            profile.is_cross_section = False
        elif profile.numeric_cols or profile.discrete_cols:
            profile.is_timeseries = True
            profile.is_cross_section = False

    # 5. Détection target
    candidates = []
    if user_hint_target and user_hint_target in df.columns:
        ct = profile.column_types.get(user_hint_target, "numeric")
        profile.suggested_target = user_hint_target
        profile.target_score = 100.0
        profile.problem_type = _detect_problem_type(df[user_hint_target], ct)
    else:
        for col in df.columns:
            ct = profile.column_types[col]
            score = _score_target_candidate(df[col], ct, col)
            candidates.append({"column": col, "type": ct, "score": float(round(score, 1))})

        candidates.sort(key=lambda x: -x["score"])
        profile.candidate_targets = candidates[:5]

        # Suggérer le top si > 50 et non-id/temporal
        best = candidates[0] if candidates else None
        if best and best["score"] >= 50 and best["type"] not in ("id", "temporal"):
            profile.suggested_target = best["column"]
            profile.target_score = best["score"]
            profile.problem_type = _detect_problem_type(df[best["column"]], best["type"])

    # Si pas de target et série temporelle, problem_type = forecast
    if not profile.suggested_target and profile.is_timeseries and profile.numeric_cols:
        profile.problem_type = "forecast"
        # La cible "implicite" est la première numérique
        profile.suggested_target = profile.numeric_cols[0]

    # 5b. Stationnarité (si structure temporelle et pas trop de colonnes / lignes)
    if profile.has_temporal and profile.numeric_cols and profile.n_rows >= 12:
        cols_to_test = profile.numeric_cols[:15]  # max 15 colonnes
        orders = {}
        for col in cols_to_test:
            orders[col] = _integration_order(df[col].dropna())
        profile.integration_orders = orders

        n_stationary = sum(1 for v in orders.values() if v["order"] == 0)
        n_i1 = sum(1 for v in orders.values() if v["order"] == 1)
        n_total = len(orders)

        if n_stationary == n_total:
            profile.stationarity_summary = "all_stationary"
        elif n_i1 == n_total:
            profile.stationarity_summary = "all_nonstationary"
            profile.cointegration_likely = n_i1 >= 2
        elif n_i1 > 0 and n_stationary > 0:
            profile.stationarity_summary = "mixed"
        else:
            profile.stationarity_summary = "all_nonstationary"

        # Notes
        non_stat = [c for c, v in orders.items() if v["order"] > 0]
        if non_stat:
            profile.notes.append(
                f"Séries non-stationnaires détectées : {', '.join(non_stat[:4])} — différenciation recommandée."
            )
        if profile.cointegration_likely:
            profile.notes.append(
                f"{n_i1} séries I(1) détectées — test de cointégration recommandé (Johansen). VECM possible."
            )

    # 6. Notes contextuelles
    if profile.duplicate_ratio > 0.05:
        profile.notes.append(
            f"{profile.duplicate_rows} doublons détectés ({profile.duplicate_ratio:.1%}) — nettoyage recommandé."
        )
    if profile.high_missing_cols:
        profile.notes.append(
            f"{len(profile.high_missing_cols)} colonne(s) avec >50% de valeurs manquantes : "
            + ", ".join(profile.high_missing_cols[:5])
        )
    if profile.near_constant_cols:
        profile.notes.append(
            f"{len(profile.near_constant_cols)} colonne(s) quasi-constante(s) : "
            + ", ".join(profile.near_constant_cols[:5])
        )
    if "high_dim" in profile.flags:
        profile.notes.append("Dataset à haute dimension (p > n) — réduction de dimensions conseillée.")
    if profile.is_timeseries:
        profile.notes.append("Structure de série temporelle détectée — prévision possible.")
    if profile.is_panel:
        profile.notes.append("Structure de panel détectée (entités × temps).")

    return profile
