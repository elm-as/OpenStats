"""
Tests unitaires pour la fiabilisation du typage statistique et des conversions non-destructives.
Sous-chantier 1.4 : Typage explicite, arrêt des coercitions aveugles, traçabilité des pertes.
"""

import numpy as np
import pandas as pd
import pytest

from app.core.statistical_types import (
    ConversionReport,
    canonical_statistical_type,
    safe_convert_boolean,
    safe_convert_numeric,
    safe_convert_temporal,
    safe_convert_series,
    apply_type_overrides_to_dataframe,
    infer_column_statistical_type,
)


def test_canonical_statistical_type():
    """Vérifie la normalisation des alias français et anglais."""
    assert canonical_statistical_type("continu") == "continu"
    assert canonical_statistical_type("Continuous") == "continu"
    assert canonical_statistical_type("NUMERIC") == "continu"
    assert canonical_statistical_type("discret") == "discret"
    assert canonical_statistical_type("Integer") == "discret"
    assert canonical_statistical_type("binaire") == "binaire"
    assert canonical_statistical_type("bool") == "binaire"
    assert canonical_statistical_type("temporel") == "temporel"
    assert canonical_statistical_type("datetime") == "temporel"
    assert canonical_statistical_type("identifiant") == "identifiant"
    assert canonical_statistical_type("id") == "identifiant"
    assert canonical_statistical_type("mixte") == "ambigu"
    assert canonical_statistical_type("ambiguous") == "ambigu"


def test_safe_convert_boolean_strings_without_data_loss():
    """Vérifie que les chaînes booléennes françaises et anglaises sont converties sans perte."""
    series = pd.Series(["oui", "non", "OUI", "NON", "vrai", "faux", "true", "false", "1", "0", None])
    converted, report = safe_convert_boolean(series, col_name="actif")

    assert report.is_lossless is True
    assert report.coerced_null_count == 0
    assert report.original_null_count == 1
    assert bool(converted.iloc[0]) is True
    assert bool(converted.iloc[1]) is False
    assert bool(converted.iloc[2]) is True
    assert bool(converted.iloc[3]) is False
    assert bool(converted.iloc[4]) is True
    assert bool(converted.iloc[5]) is False
    assert bool(converted.iloc[6]) is True
    assert bool(converted.iloc[7]) is False
    assert bool(converted.iloc[8]) is True
    assert bool(converted.iloc[9]) is False
    assert pd.isna(converted.iloc[10])


def test_safe_convert_boolean_tracks_unparseable_values():
    """Vérifie que les valeurs inconnues sont signalées et tracées au lieu d'être avalées."""
    series = pd.Series(["oui", "non", "peut-être", "inconnu", None])
    converted, report = safe_convert_boolean(series, col_name="decision")

    assert report.is_lossless is False
    assert report.coerced_null_count == 2
    assert "peut-être" in report.unparsed_samples
    assert "inconnu" in report.unparsed_samples
    assert pd.isna(converted.iloc[2])
    assert pd.isna(converted.iloc[3])


def test_safe_convert_numeric_french_formatting():
    """Vérifie la gestion des espaces insécables, virgules décimales et pourcentages."""
    series = pd.Series(["1 250,50", "3 400,00", "12,75", "75%", " 42 "])
    converted, report = safe_convert_numeric(series, integer_only=False, col_name="montant")

    assert report.is_lossless is True
    assert report.coerced_null_count == 0
    assert converted.iloc[0] == 1250.50
    assert converted.iloc[1] == 3400.00
    assert converted.iloc[2] == 12.75
    assert converted.iloc[3] == 75.0
    assert converted.iloc[4] == 42.0


def test_safe_convert_numeric_tracks_coercion_loss():
    """Vérifie que la conversion numérique d'une colonne polluée trace exactement chaque valeur rejetée."""
    series = pd.Series(["100", "200", "N/A", "erreur_saisie", "500"])
    converted, report = safe_convert_numeric(series, integer_only=False, col_name="mesure")

    assert report.is_lossless is False
    assert report.coerced_null_count == 2
    assert report.valid_count == 3
    assert set(report.unparsed_samples) == {"N/A", "erreur_saisie"}
    assert converted.iloc[0] == 100.0
    assert converted.iloc[1] == 200.0
    assert pd.isna(converted.iloc[2])
    assert pd.isna(converted.iloc[3])
    assert converted.iloc[4] == 500.0


def test_safe_convert_discrete_integers():
    """Vérifie la conversion en entiers sans perte."""
    series = pd.Series(["1", "2", "3", "4", None])
    converted, report = safe_convert_numeric(series, integer_only=True, col_name="nb_enfants")

    assert report.is_lossless is True
    assert report.coerced_null_count == 0
    assert converted.iloc[0] == 1
    assert converted.iloc[1] == 2
    assert pd.isna(converted.iloc[4])


def test_detect_ambiguous_and_identifier_columns():
    """Vérifie la détection explicite des identifiants et des colonnes ambiguës."""
    # Identifiant
    id_series = pd.Series([f"CLI_{i:04d}" for i in range(100)], name="client_id")
    assert infer_column_statistical_type(id_series, "client_id") == "identifiant"

    # Colonne mixte / ambiguë : mélange de chiffres et de commentaires textuels
    mixed_series = pd.Series(["100", "200", "300", "non_disponible", "en_attente", "450"] * 10, name="statut")
    assert infer_column_statistical_type(mixed_series, "statut") == "ambigu"

    # Colonne binaire textuelle
    bool_series = pd.Series(["oui", "non", "oui", "oui", "non"], name="accord")
    assert infer_column_statistical_type(bool_series, "accord") == "binaire"

    # Colonne continue standard
    num_series = pd.Series(np.linspace(10.0, 50.0, 50), name="temperature")
    assert infer_column_statistical_type(num_series, "temperature") == "continu"


def test_apply_type_overrides_to_dataframe_traceability():
    """Vérifie l'application globale des surcharges et la production des rapports de traçabilité."""
    df = pd.DataFrame({
        "taux": ["10,5%", "20,0%", "30,5%"],
        "admis": ["oui", "non", "oui"],
        "id_etudiant": ["ETU001", "ETU002", "ETU003"],
        "annee": [2020, 2021, 2022],
    })

    overrides = {
        "taux": "continu",
        "admis": "binaire",
        "annee": "temporel",
    }

    out, reports = apply_type_overrides_to_dataframe(df, overrides)

    assert len(reports) == 3
    assert all(r.is_lossless for r in reports)
    assert out["taux"].iloc[0] == 10.5
    assert bool(out["admis"].iloc[0]) is True
    assert pd.api.types.is_datetime64_any_dtype(out["annee"])
