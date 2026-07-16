"""
Profilage des données : inférence de types, statistiques de base,
détection d'unités et génération du dictionnaire de données.
"""

from __future__ import annotations

import re
import numpy as np
import pandas as pd
from typing import Any


# ── Expressions régulières pour la détection d'unités ──────────────────────

UNIT_PATTERNS = [
    (r"[_(]?\s*°[CF]\s*[)]?$", "temperature"),
    (r"[_(]?\s*(USD|EUR|GBP|CHF|CAD|JPY)\s*[)]?$", "currency"),
    (r"[_(]?\s*(kg|g|mg|lb|oz)\s*[)]?$", "mass"),
    (r"[_(]?\s*(km|m|cm|mm|mi|ft|in)\s*[)]?$", "length"),
    (r"[_(]?\s*(ms|s|min|h|hr)\s*[)]?$", "duration"),
    (r"[_(]?\s*(pct|%)\s*[)]?$", "percentage"),
    (r"[_(]?\s*(L|mL|gal)\s*[)]?$", "volume"),
    (r"[_(]?\s*(W|kW|MW|HP)\s*[)]?$", "power"),
    (r"[_(]?\s*(Pa|hPa|bar|psi|atm)\s*[)]?$", "pressure"),
]

REGEX_TYPE_PATTERNS = {
    "email": r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$",
    "phone": r"^[\+]?[\d\s\-().]{7,20}$",
    "uuid": r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
    "postal_code_fr": r"^\d{5}$",
    "ip_address": r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$",
    "url": r"^https?://",
    "iso_date": r"^\d{4}-\d{2}-\d{2}",
    "gps_coord": r"^-?\d{1,3}\.\d{4,}$",
}


# ── Formats de dates courants ──────────────────────────────────────────

DATE_FORMATS = [
    # ISO
    "%Y-%m-%d",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%d %H:%M:%S",
    "%Y/%m/%d",
    # Français
    "%d/%m/%Y",
    "%d-%m-%Y",
    "%d.%m.%Y",
    "%d/%m/%Y %H:%M",
    "%d/%m/%Y %H:%M:%S",
    "%d %B %Y",        # 15 janvier 2024
    "%d %b %Y",        # 15 jan 2024
    # US
    "%m/%d/%Y",
    "%m-%d-%Y",
    "%m/%d/%Y %I:%M %p",
    # Textuels
    "%B %d, %Y",       # January 15, 2024
    "%b %d, %Y",       # Jan 15, 2024
    "%d %b %y",        # 15 Jan 24
    # Compacts
    "%Y%m%d",
    "%d%m%Y",
]


def try_parse_dates(series: pd.Series, sample_size: int = 50) -> tuple[bool, str | None]:
    """
    Tente de parser une série en dates avec plusieurs formats.
    Retourne (success, format_detected).
    """
    sample = series.dropna().astype(str).head(sample_size)
    if sample.empty:
        return False, None

    # D'abord essayer pandas infer_datetime_format (rapide)
    try:
        parsed = pd.to_datetime(sample, format="mixed", dayfirst=True)
        if parsed.notna().sum() / len(sample) >= 0.8:
            return True, "mixed"
    except (ValueError, TypeError):
        pass

    # Essai format par format
    for fmt in DATE_FORMATS:
        try:
            parsed = pd.to_datetime(sample, format=fmt, errors="coerce")
            success_rate = parsed.notna().sum() / len(sample)
            if success_rate >= 0.8:
                return True, fmt
        except (ValueError, TypeError):
            continue

    return False, None


def detect_unit_from_column_name(col_name: str) -> dict | None:
    """Détecte l'unité de mesure depuis le nom de la colonne."""
    for pattern, domain in UNIT_PATTERNS:
        match = re.search(pattern, col_name, re.IGNORECASE)
        if match:
            unit_str = match.group(0).strip("_() ")
            return {"unit": unit_str, "domain": domain}
    return None


def infer_statistical_type(series: pd.Series, col_name: str = "") -> str:
    """
    Infère le type statistique d'une colonne :
    Continu, Discret, Catégoriel Nominal, Catégoriel Ordinal, Binaire, Temporel
    """
    if series.dropna().empty:
        return "inconnu"

    # Tentative datetime (type natif pandas)
    if pd.api.types.is_datetime64_any_dtype(series):
        return "temporel"

    # Tentative datetime (chaînes avec multi-format)
    if series.dtype == object:
        is_date, _ = try_parse_dates(series)
        if is_date:
            return "temporel"

    # Binaire
    unique_vals = series.dropna().unique()
    if len(unique_vals) <= 2:
        return "binaire"

    # Numérique
    if pd.api.types.is_numeric_dtype(series):
        n_unique = series.nunique()
        ratio = n_unique / len(series.dropna()) if len(series.dropna()) > 0 else 0
        if pd.api.types.is_integer_dtype(series) and n_unique <= 20:
            return "discret"
        if ratio < 0.05 and n_unique <= 30:
            return "discret"
        return "continu"

    # Catégoriel
    n_unique = series.nunique()
    if n_unique <= 50:
        return "catégoriel_nominal"
    return "catégoriel_nominal"


def detect_regex_type(series: pd.Series) -> str | None:
    """Détecte un type sémantique par regex sur un échantillon."""
    sample = series.dropna().astype(str).head(50)
    if sample.empty:
        return None
    for type_name, pattern in REGEX_TYPE_PATTERNS.items():
        matches = sample.str.match(pattern).sum()
        if matches / len(sample) >= 0.8:
            return type_name
    return None


def compute_column_stats(series: pd.Series) -> dict[str, Any]:
    """Calcule les statistiques de profilage pour une colonne."""
    stats = {
        "count": int(len(series)),
        "null_count": int(series.isna().sum()),
        "null_rate": round(float(series.isna().mean()), 4),
        "cardinality": int(series.nunique()),
    }

    if pd.api.types.is_numeric_dtype(series):
        desc = series.describe(percentiles=[0.05, 0.25, 0.5, 0.75, 0.95])
        stats["min"] = _safe_float(desc.get("min"))
        stats["max"] = _safe_float(desc.get("max"))
        stats["mean"] = _safe_float(desc.get("mean"))
        stats["std"] = _safe_float(desc.get("std"))
        stats["median"] = _safe_float(desc.get("50%"))
        stats["p5"] = _safe_float(desc.get("5%"))
        stats["p25"] = _safe_float(desc.get("25%"))
        stats["p75"] = _safe_float(desc.get("75%"))
        stats["p95"] = _safe_float(desc.get("95%"))
        stats["skewness"] = _safe_float(series.skew())
        stats["kurtosis"] = _safe_float(series.kurtosis())
    elif pd.api.types.is_datetime64_any_dtype(series):
        valid = series.dropna()
        if not valid.empty:
            stats["min"] = str(valid.min())
            stats["max"] = str(valid.max())
    else:
        top_values = series.value_counts().head(10)
        stats["top_values"] = {str(k): int(v) for k, v in top_values.items()}

    return stats


def generate_data_dictionary(df: pd.DataFrame) -> list[dict]:
    """
    Génère le dictionnaire de données complet pour un DataFrame.
    Correspond au tableau de la Phase 1.4 de la spécification.
    """
    dictionary = []
    for col in df.columns:
        series = df[col]
        stat_type = infer_statistical_type(series, col)
        regex_type = detect_regex_type(series)
        unit_info = detect_unit_from_column_name(col)
        col_stats = compute_column_stats(series)

        # Détection du format de date si temporel
        date_format = None
        if stat_type == "temporel" and not pd.api.types.is_datetime64_any_dtype(series):
            _, date_format = try_parse_dates(series)

        entry = {
            "nom_brut": col,
            "nom_lisible": _humanize_column_name(col),
            "type_statistique": stat_type,
            "type_regex": regex_type,
            "unite_mesure": unit_info["unit"] if unit_info else None,
            "domaine_unite": unit_info["domain"] if unit_info else None,
            "date_format": date_format,
            "taux_nullite": col_stats["null_rate"],
            "cardinalite": col_stats["cardinality"],
            "stats": col_stats,
        }
        dictionary.append(entry)

    return dictionary


def profile_dataframe(df: pd.DataFrame) -> dict:
    """Profilage complet du DataFrame : structure + dictionnaire."""
    return {
        "shape": {"rows": df.shape[0], "columns": df.shape[1]},
        "memory_usage_mb": round(df.memory_usage(deep=True).sum() / 1024 / 1024, 2),
        "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
        "dictionary": generate_data_dictionary(df),
    }


def _humanize_column_name(name: str) -> str:
    """Convertit un nom technique en libellé lisible."""
    name = re.sub(r"[_(].*[)_]$", "", name)
    name = name.replace("_", " ").replace("-", " ")
    name = re.sub(r"([a-z])([A-Z])", r"\1 \2", name)
    return name.strip().title()


def _safe_float(val) -> float | None:
    if val is None or (isinstance(val, float) and np.isnan(val)):
        return None
    return round(float(val), 6)
