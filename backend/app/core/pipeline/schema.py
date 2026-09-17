"""
Prise en compte du profilage declare par l'utilisateur.

Quand une colonne a ete retypee apres l'import (« annee » passee en temporel,
un code numerique passe en categoriel), ce choix fait autorite sur l'inference
automatique de pandas. Deux consequences :

  - la colonne est **reellement convertie** (une date declaree devient une vraie
    date, sinon les tests de stationnarite ne s'appliquent pas) ;
  - elle est rangee dans la bonne famille pour toutes les etapes suivantes.

Sans cela, declarer un type n'aurait aucun effet sur l'analyse.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import numpy as np
import pandas as pd

# Vocabulaire de types du projet -> familles utilisees par le pipeline.
TYPE_ALIASES: dict[str, str] = {
    "continu": "numeric", "numérique": "numeric", "numerique": "numeric",
    "numeric": "numeric", "float": "numeric", "reel": "numeric",
    "discret": "numeric", "integer": "numeric", "int": "numeric",
    "binaire": "categorical", "binary": "categorical", "bool": "categorical",
    "booleen": "categorical",
    "catégoriel_nominal": "categorical", "categoriel_nominal": "categorical",
    "catégoriel_ordinal": "categorical", "categoriel_ordinal": "categorical",
    "catégoriel": "categorical", "categoriel": "categorical",
    "categorical": "categorical", "texte": "categorical", "text": "categorical",
    "string": "categorical", "nominal": "categorical", "ordinal": "categorical",
    "temporel": "temporal", "temporal": "temporal", "date": "temporal",
    "datetime": "temporal", "time": "temporal", "annee": "temporal",
    "identifiant": "identifier", "id": "identifier", "identifier": "identifier",
    "cle": "identifier", "key": "identifier",
}

FRENCH_MONTHS = {
    "janvier": "january", "fevrier": "february", "février": "february",
    "mars": "march", "avril": "april", "mai": "may", "juin": "june",
    "juillet": "july", "aout": "august", "août": "august",
    "septembre": "september", "octobre": "october", "novembre": "november",
    "decembre": "december", "décembre": "december",
}


@dataclass
class Schema:
    """Typage effectif du jeu de donnees, apres prise en compte du profilage."""

    kinds: dict[str, str] = field(default_factory=dict)     # colonne -> famille
    declared: dict[str, str] = field(default_factory=dict)  # colonne -> famille declaree
    coerced: list[str] = field(default_factory=list)        # colonnes reellement converties
    failures: list[str] = field(default_factory=list)       # conversions impossibles

    def of(self, kind: str) -> list[str]:
        return [column for column, value in self.kinds.items() if value == kind]

    @property
    def numeric(self) -> list[str]:
        return self.of("numeric")

    @property
    def categorical(self) -> list[str]:
        return self.of("categorical")

    @property
    def temporal(self) -> list[str]:
        return self.of("temporal")

    @property
    def identifiers(self) -> list[str]:
        return self.of("identifier")

    def to_dict(self) -> dict[str, Any]:
        return {
            "kinds": self.kinds,
            "declared": self.declared,
            "coerced": self.coerced,
            "failures": self.failures,
        }


def normalize_declared(overrides: dict[str, Any] | None,
                       stored_profile: dict[str, Any] | None) -> dict[str, str]:
    """Fusionne le dictionnaire du profil et les surcharges explicites.

    Les surcharges de l'utilisateur priment sur le profil calcule a l'import.
    """
    declared: dict[str, str] = {}

    for entry in ((stored_profile or {}).get("dictionary") or []):
        if not isinstance(entry, dict):
            continue
        column = entry.get("nom_brut")
        raw = str(entry.get("type_statistique") or "").strip().lower()
        family = TYPE_ALIASES.get(raw)
        if column and family:
            declared[str(column)] = family

    for column, raw in (overrides or {}).items():
        value = str(raw or "").strip().lower()
        if not value or value == "auto":
            continue
        family = TYPE_ALIASES.get(value)
        if family:
            declared[str(column)] = family

    return declared


def _parse_temporal(series: pd.Series) -> pd.Series | None:
    """Convertit une colonne en dates, y compris annees nues et mois francais."""
    if pd.api.types.is_datetime64_any_dtype(series):
        return series

    valid = series.dropna()
    if valid.empty:
        return None

    # Annees nues (1990, 2024...) : une annee seule n'est pas parsable telle quelle.
    numeric = pd.to_numeric(valid, errors="coerce")
    if numeric.notna().mean() > 0.9:
        rounded = numeric.dropna().round()
        if rounded.between(1000, 3000).mean() > 0.9 and (rounded % 1 == 0).all():
            parsed = pd.to_datetime(
                pd.to_numeric(series, errors="coerce").round().astype("Int64").astype("string"),
                format="%Y", errors="coerce",
            )
            if parsed.notna().mean() > 0.8:
                return parsed
        return None

    text = series.astype("string").str.strip().str.lower()
    for french, english in FRENCH_MONTHS.items():
        text = text.str.replace(french, english, regex=False)

    for dayfirst in (True, False):
        parsed = pd.to_datetime(text, errors="coerce", dayfirst=dayfirst)
        if parsed.notna().mean() > 0.7:
            return parsed

    return None


def apply_schema(df: pd.DataFrame, declared: dict[str, str] | None) -> tuple[pd.DataFrame, Schema]:
    """Applique le typage declare au dataframe et renvoie (df converti, schema).

    Le dataframe renvoye est une copie : le jeu de donnees d'origine n'est pas
    modifie.
    """
    declared = declared or {}
    out = df.copy()
    schema = Schema(declared={c: k for c, k in declared.items() if c in df.columns})

    for column in out.columns:
        family = declared.get(column)

        if family == "temporal":
            parsed = _parse_temporal(out[column])
            if parsed is not None:
                out[column] = parsed
                schema.coerced.append(column)
                schema.kinds[column] = "temporal"
            else:
                schema.failures.append(column)
                schema.kinds[column] = _infer(out[column])
            continue

        if family == "numeric":
            converted = pd.to_numeric(out[column], errors="coerce")
            if converted.notna().mean() >= 0.5:
                if not pd.api.types.is_numeric_dtype(out[column]):
                    out[column] = converted
                    schema.coerced.append(column)
                schema.kinds[column] = "numeric"
            else:
                schema.failures.append(column)
                schema.kinds[column] = _infer(out[column])
            continue

        if family == "categorical":
            if pd.api.types.is_numeric_dtype(out[column]):
                # Un code numerique declare categoriel doit cesser d'etre traite
                # comme une grandeur : moyennes et correlations n'auraient aucun sens.
                out[column] = out[column].astype("string")
                schema.coerced.append(column)
            schema.kinds[column] = "categorical"
            continue

        if family == "identifier":
            schema.kinds[column] = "identifier"
            continue

        schema.kinds[column] = _infer(out[column])

    return out, schema


def _infer(series: pd.Series) -> str:
    """Famille deduite du contenu, quand aucun type n'a ete declare."""
    if pd.api.types.is_datetime64_any_dtype(series):
        return "temporal"
    if pd.api.types.is_numeric_dtype(series):
        return "numeric" if series.nunique(dropna=True) > 2 else "categorical"
    return "categorical"


def analysable_columns(df: pd.DataFrame, schema: Schema) -> list[str]:
    """Colonnes exploitables pour l'analyse : les identifiants sont ecartes."""
    return [c for c in df.columns if schema.kinds.get(c) != "identifier"]


def sort_by_time(df: pd.DataFrame, schema: Schema) -> pd.DataFrame:
    """Trie le jeu de donnees sur l'axe temporel, condition des tests de series.

    Un test de stationnarite sur des lignes en desordre ne mesure rien.
    """
    temporal = schema.temporal
    if not temporal:
        return df
    axis = temporal[0]
    if not pd.api.types.is_datetime64_any_dtype(df[axis]):
        return df
    return df.sort_values(axis).reset_index(drop=True)
