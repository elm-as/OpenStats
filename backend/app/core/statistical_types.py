"""
Typage statistique robuste et conversions fiables et non-destructives.

Ce module est l'autorité centrale pour la détection et la conversion sécurisée
des types de colonnes (continu, discret, binaire, temporel, nominal, ordinal,
identifiant, ambigu). Aucune conversion ne doit détruire silencieusement l'information.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

import numpy as np
import pandas as pd

from app.core.temporal_typing import is_temporal_series, normalize_date_text, parse_compact_numeric, try_parse_dates

# Vocabulaire canonique des types statistiques
CANONICAL_TYPES = {
    "continu",
    "discret",
    "binaire",
    "temporel",
    "catégoriel_nominal",
    "catégoriel_ordinal",
    "identifiant",
    "ambigu",
}

TYPE_ALIASES: dict[str, str] = {
    "continu": "continu", "continuous": "continu", "numeric": "continu", "numérique": "continu",
    "numerique": "continu", "float": "continu", "reel": "continu", "discret": "discret",
    "discrete": "discret", "integer": "discret", "int": "discret", "binaire": "binaire",
    "binary": "binaire", "bool": "binaire", "booleen": "binaire",
    "catégoriel_nominal": "catégoriel_nominal", "categoriel_nominal": "catégoriel_nominal",
    "nominal": "catégoriel_nominal", "catégoriel": "catégoriel_nominal", "categoriel": "catégoriel_nominal",
    "categorical": "catégoriel_nominal", "texte": "catégoriel_nominal", "text": "catégoriel_nominal",
    "string": "catégoriel_nominal", "qualitative": "catégoriel_nominal", "qualitatif": "catégoriel_nominal",
    "catégoriel_ordinal": "catégoriel_ordinal", "categoriel_ordinal": "catégoriel_ordinal",
    "ordinal": "catégoriel_ordinal", "temporel": "temporel", "temporal": "temporel",
    "date": "temporel", "datetime": "temporel", "time": "temporel", "annee": "temporel",
    "identifiant": "identifiant", "identifier": "identifiant", "id": "identifiant",
    "cle": "identifiant", "key": "identifiant", "uuid": "identifiant", "ambigu": "ambigu",
    "ambiguous": "ambigu", "mixte": "ambigu", "mixed": "ambigu",
}

TRUE_VALUES = {"true", "1", "1.0", "vrai", "oui", "yes", "t", "v", "o", "y"}
FALSE_VALUES = {"false", "0", "0.0", "faux", "non", "no", "f", "n"}


@dataclass(frozen=True)
class ConversionReport:
    """Rapport de traçabilité d'une conversion de type pour éviter les pertes silencieuses."""

    column: str
    source_type: str
    target_type: str
    total_count: int
    valid_count: int
    coerced_null_count: int
    original_null_count: int
    loss_rate: float
    is_lossless: bool
    unparsed_samples: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """Sérialise le rapport sous forme de dictionnaire JSON-compatible."""
        return {
            "column": self.column, "source_type": self.source_type, "target_type": self.target_type,
            "total_count": self.total_count, "valid_count": self.valid_count,
            "coerced_null_count": self.coerced_null_count, "original_null_count": self.original_null_count,
            "loss_rate": round(self.loss_rate, 4), "is_lossless": self.is_lossless,
            "unparsed_samples": self.unparsed_samples,
        }


def canonical_statistical_type(raw_type: str) -> str:
    """Normalise un libellé de type statistique vers sa forme canonique."""
    return TYPE_ALIASES.get(str(raw_type or "").strip().lower(), str(raw_type or "").strip().lower())


def _build_report(
    series: pd.Series, converted: pd.Series, target_type: str, col_name: str,
    unparsed_samples: list[str] | None = None,
) -> ConversionReport:
    """Génère le rapport immuable pour une conversion effectuée."""
    orig_null = int(series.isna().sum())
    conv_null = int(converted.isna().sum())
    coerced = max(0, conv_null - orig_null)
    total = len(series)
    non_null_orig = max(1, total - orig_null)

    samples = unparsed_samples or []
    if not samples and coerced > 0:
        lost_idx = series.notna() & converted.isna()
        samples = [str(v) for v in series[lost_idx].head(5).tolist()]

    return ConversionReport(
        column=col_name or str(getattr(series, "name", "") or "unnamed"),
        source_type=str(series.dtype), target_type=target_type, total_count=total,
        valid_count=int(converted.notna().sum()), coerced_null_count=coerced,
        original_null_count=orig_null, loss_rate=float(coerced / non_null_orig),
        is_lossless=(coerced == 0), unparsed_samples=samples[:5],
    )


def safe_convert_boolean(series: pd.Series, col_name: str = "") -> tuple[pd.Series, ConversionReport]:
    """Convertit une série en booléens stricts sans forcer arbitrairement à True."""
    if series.empty or pd.api.types.is_bool_dtype(series):
        rep = _build_report(series, series, "binaire", col_name)
        return series.copy(), rep

    mapping = {**{v: True for v in TRUE_VALUES}, **{v: False for v in FALSE_VALUES}}
    result = pd.Series(index=series.index, dtype="object")
    unparsed = []

    for idx, orig_val in series.items():
        if pd.isna(orig_val):
            result.at[idx] = pd.NA
            continue
        cleaned = str(orig_val).strip().lower()
        if cleaned in mapping:
            result.at[idx] = mapping[cleaned]
        else:
            result.at[idx] = pd.NA
            if len(unparsed) < 5:
                unparsed.append(str(orig_val))

    # Essayer de typer en booléen nullable
    try:
        converted = result.astype("boolean")
    except Exception:
        converted = result

    report = _build_report(series, converted, "binaire", col_name, unparsed_samples=unparsed)
    return converted, report


def _clean_numeric_text(series: pd.Series) -> pd.Series:
    """Harmonise le texte numérique (espaces insécables, virgule décimale, pourcentages)."""
    text = series.astype(str).str.strip()
    # Retirer les espaces standards et insécables (\u00a0, \u202f)
    text = text.str.replace(r"[\s\u00a0\u202f]+", "", regex=True)
    # Pourcentages : "75%" -> "75.0"
    text = text.str.replace(r"%$", "", regex=True)
    # Virgule décimale entre chiffres : "12,5" -> "12.5"
    text = text.str.replace(r"(?<=\d),(?=\d)", ".", regex=True)
    return text


def safe_convert_numeric(
    series: pd.Series,
    integer_only: bool = False,
    col_name: str = "",
) -> tuple[pd.Series, ConversionReport]:
    """Convertit en numérique en protégeant les formats régionaux et en traçant les pertes."""
    target_type = "discret" if integer_only else "continu"
    if series.empty:
        rep = _build_report(series, series, target_type, col_name)
        return series.copy(), rep

    if pd.api.types.is_numeric_dtype(series):
        if integer_only:
            valid = series.dropna()
            if (valid == valid.round()).all():
                converted = series.round().astype("Int64")
                rep = _build_report(series, converted, target_type, col_name)
                return converted, rep
        converted = series.astype(float) if not integer_only else series
        rep = _build_report(series, converted, target_type, col_name)
        return converted, rep

    cleaned_text = _clean_numeric_text(series)
    numeric_result = pd.to_numeric(cleaned_text, errors="coerce")

    if integer_only:
        numeric_result = numeric_result.round().astype("Int64")
    else:
        numeric_result = numeric_result.astype(float)

    # Réinjecter les valeurs initialement nulles
    numeric_result[series.isna()] = np.nan

    report = _build_report(series, numeric_result, target_type, col_name)
    return numeric_result, report


def safe_convert_temporal(series: pd.Series, col_name: str = "") -> tuple[pd.Series, ConversionReport]:
    """Convertit en dates/heures via les heuristiques robustes du projet."""
    if series.empty or pd.api.types.is_datetime64_any_dtype(series):
        rep = _build_report(series, series, "temporel", col_name)
        return series.copy(), rep

    if pd.api.types.is_numeric_dtype(series):
        compact = parse_compact_numeric(series)
        if compact is not None:
            rep = _build_report(series, compact, "temporel", col_name)
            return compact, rep

    # Traduction française et parsing tolérant
    normalized = series.dropna().apply(normalize_date_text)
    for dayfirst in (True, False):
        try:
            parsed = pd.to_datetime(normalized, errors="coerce", dayfirst=dayfirst)
            if parsed.notna().mean() >= 0.7:
                full = pd.Series(pd.NaT, index=series.index, dtype="datetime64[ns]")
                full.loc[parsed.index] = parsed
                rep = _build_report(series, full, "temporel", col_name)
                return full, rep
        except Exception:
            continue

    rep = _build_report(series, pd.Series(pd.NaT, index=series.index), "temporel", col_name)
    return series.copy(), rep


def safe_convert_series(
    series: pd.Series,
    target_type: str,
    col_name: str = "",
) -> tuple[pd.Series, ConversionReport]:
    """Point d'entrée sécurisé pour convertir une colonne vers un type cible sans perte silencieuse."""
    canonical = canonical_statistical_type(target_type)

    if canonical == "binaire":
        return safe_convert_boolean(series, col_name=col_name)
    if canonical == "continu":
        return safe_convert_numeric(series, integer_only=False, col_name=col_name)
    if canonical == "discret":
        return safe_convert_numeric(series, integer_only=True, col_name=col_name)
    if canonical == "temporel":
        return safe_convert_temporal(series, col_name=col_name)

    # Catégoriel ou Identifiant : préservation stricte du texte sans nullification
    converted = series.astype(str).replace({"nan": pd.NA, "None": pd.NA, "<NA>": pd.NA})
    converted[series.isna()] = pd.NA
    rep = _build_report(series, converted, canonical, col_name)
    return converted, rep


def apply_type_overrides_to_dataframe(
    df: pd.DataFrame,
    overrides: dict[str, str] | None,
) -> tuple[pd.DataFrame, list[ConversionReport]]:
    """Applique des surcharges de types sur une copie du DataFrame en traçant les conversions."""
    if not overrides or df.empty:
        return df.copy(), []

    out = df.copy()
    reports: list[ConversionReport] = []

    for col, raw_type in overrides.items():
        if col not in out.columns or not raw_type or raw_type == "auto":
            continue
        conv_series, report = safe_convert_series(out[col], raw_type, col_name=col)
        # Si la conversion échoue totalement (100% de perte sur données valides), conserver la colonne d'origine
        if not report.is_lossless and report.loss_rate >= 0.99 and report.valid_count == 0:
            reports.append(report)
            continue
        out[col] = conv_series
        reports.append(report)

    return out, reports


def infer_column_statistical_type(series: pd.Series, col_name: str = "") -> str:
    """Détecte le type statistique exact (y compris identifiants, colonnes ambiguës ou mixtes)."""
    clean_s = series.dropna()
    if clean_s.empty:
        return "inconnu"

    name_lower = (col_name or str(getattr(series, "name", ""))).lower()

    if is_temporal_series(series, col_name=name_lower):
        return "temporel"

    n_total = len(series)
    n_unique = clean_s.nunique()

    # Détection des identifiants
    if any(k in name_lower for k in ["id", "code", "uuid", "identifiant", "num_", "ref_"]):
        if n_unique >= 0.75 * len(clean_s):
            return "identifiant"
    if n_unique >= 0.98 * n_total and n_total >= 50:
        if pd.api.types.is_string_dtype(series) or pd.api.types.is_integer_dtype(series):
            return "identifiant"

    # Détection des binaires
    if n_unique == 2:
        return "binaire"
    if pd.api.types.is_string_dtype(series) or series.dtype == object:
        sample_vals = set(clean_s.head(50).astype(str).str.strip().str.lower())
        if sample_vals.issubset(TRUE_VALUES | FALSE_VALUES):
            return "binaire"

    # Détection des numériques et mixtes/ambigus
    if pd.api.types.is_numeric_dtype(series):
        if pd.api.types.is_integer_dtype(series) and n_unique <= 20:
            return "discret"
        ratio = n_unique / max(len(clean_s), 1)
        if ratio < 0.05 and n_unique <= 30:
            return "discret"
        return "continu"

    # Vérification si un objet/texte contient des nombres ou est ambigu
    if series.dtype == object or pd.api.types.is_string_dtype(series):
        cleaned_text = _clean_numeric_text(clean_s)
        test_numeric = pd.to_numeric(cleaned_text, errors="coerce")
        success_rate = float(test_numeric.notna().mean())

        if success_rate >= 0.95:
            # Véritable colonne numérique stockée en chaîne
            is_int = (test_numeric.dropna() == test_numeric.dropna().round()).all()
            return "discret" if is_int and test_numeric.nunique() <= 20 else "continu"
        if 0.15 <= success_rate < 0.95:
            # Colonne mixte : chiffres + texte ou valeurs polluées -> ambigu
            return "ambigu"

    return "catégoriel_nominal"
