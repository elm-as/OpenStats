"""
Heuristiques de classification statistique, typage de colonnes et détection de cibles.
"""

from __future__ import annotations

import re
import pandas as pd
from typing import Any


def _is_id_like(series: pd.Series, col_name: str = "") -> bool:
    """Détecte un identifiant (cardinalité ≈ N et type int/str ou nom contenant 'id')."""
    n = len(series)
    if n == 0 or pd.api.types.is_float_dtype(series):
        return False
    name = (col_name or str(getattr(series, "name", ""))).lower()
    uniq = series.nunique(dropna=True)
    if any(k in name for k in ["id", "code", "uuid", "identifiant"]):
        return uniq >= 0.8 * n
    return (
        uniq >= 0.98 * n
        and n >= 200
        and (pd.api.types.is_integer_dtype(series) or pd.api.types.is_string_dtype(series))
    )


def _is_binary(series: pd.Series) -> bool:
    """Détecte une colonne binaire (2 valeurs distinctes non nulles)."""
    valid = series.dropna()
    if len(valid) == 0:
        return False
    return valid.nunique() == 2


def _is_temporal(series: pd.Series, name: str = "") -> bool:
    """Détecte une colonne temporelle (datetime natif, format date textuel ou nom évocateur d'année/date)."""
    if pd.api.types.is_datetime64_any_dtype(series):
        return True

    sample = series.dropna().head(50)
    if sample.empty:
        return False

    name_lower = (name or str(getattr(series, "name", ""))).lower().strip()
    is_temporal_name = bool(re.search(
        r'(?:^|[_\s])(date|datetime|time|timestamp|year|annee|année|mois|month|semaine|week|trimestre|quarter|an)(?:$|[_\s\d])',
        name_lower,
    ))

    if pd.api.types.is_numeric_dtype(series):
        try:
            nums = pd.to_numeric(sample, errors="coerce").dropna()
            if not nums.empty and (nums == nums.round()).all():
                if is_temporal_name and nums.between(1000, 3000).mean() > 0.8:
                    return True
                if nums.between(1800, 2100).all() and 2 <= nums.nunique() <= 200 and is_temporal_name:
                    return True
        except Exception:
            pass
        return False

    if series.dtype == object or pd.api.types.is_string_dtype(series):
        try:
            from app.core.profiling import try_parse_dates
            is_date, _ = try_parse_dates(series)
            if is_date:
                return True
        except Exception:
            pass
        if is_temporal_name:
            try:
                parsed = pd.to_datetime(sample, errors="coerce", dayfirst=True)
                if parsed.notna().mean() > 0.7:
                    return True
            except Exception:
                pass

    return False


def _classify_column(series: pd.Series, name: str = "") -> str:
    """Retourne le type sémantique : id | binary | temporal | numeric | discrete | categorical."""
    if _is_temporal(series, name=name):
        return "temporal"

    if _is_id_like(series, col_name=name):
        return "id"

    if _is_binary(series):
        return "binary"

    if pd.api.types.is_numeric_dtype(series):
        n_unique = series.nunique(dropna=True)
        if n_unique <= 10 and n_unique / max(len(series), 1) < 0.1:
            return "discrete"
        return "numeric"

    return "categorical"


def _score_target_candidate(series: pd.Series, col_type: str, name: str) -> float:
    """Score 0-100 pour estimer si une variable est un bon candidat target."""
    name_lower = name.lower()
    score = 30.0

    target_keywords = [
        "target", "label", "y", "outcome", "result", "class", "category",
        "churn", "default", "fraud", "click", "buy", "purchase", "convert",
        "price", "prix", "value", "valeur", "amount", "montant", "revenue",
        "sales", "ventes", "score", "rating", "note", "satisfaction",
        "status", "etat", "état", "is_", "has_"
    ]
    for kw in target_keywords:
        if kw in name_lower:
            score += 25
            break

    if col_type in ("id", "temporal"):
        score -= 50

    nr = series.isna().mean()
    if nr < 0.05:
        score += 10
    elif nr > 0.3:
        score -= 20

    if col_type in ("numeric", "binary", "discrete"):
        score += 15
    elif col_type == "categorical":
        nu = series.nunique(dropna=True)
        if 2 <= nu <= 10:
            score += 10
        else:
            score -= 10

    return max(0.0, min(100.0, score))


def _detect_problem_type(target_series: pd.Series, target_type: str = "") -> str:
    """regression | binary_classification | multiclass_classification | forecast | exploration."""
    clean = target_series.dropna()
    nu = clean.nunique()
    if nu < 2:
        return "exploration"

    if nu == 2 or target_type == "binary":
        return "binary_classification"

    if not pd.api.types.is_numeric_dtype(clean) or target_type == "categorical":
        return "multiclass_classification"

    if pd.api.types.is_float_dtype(clean):
        is_int_like = bool((clean == clean.round()).all())
        if is_int_like and nu <= 10:
            return "multiclass_classification"
        return "regression"

    if nu <= 10 or target_type == "discrete":
        return "multiclass_classification"

    return "regression"


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
