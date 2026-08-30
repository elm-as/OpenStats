"""
Tests de cohérence des types statistiques (Profilage vs Auto-Pipeline).
"""

import numpy as np
import pandas as pd
import pytest

from app.core.profiling import infer_statistical_type
from app.core.auto_pipeline.detector import detect_dataset_profile, _is_temporal, _classify_column, _score_target_candidate


def test_infer_statistical_type_cacao_dataset():
    """Vérifie le typage statistique correct sur un dataset de type cacao/climat."""
    annees = pd.Series(list(range(1995, 2025)), name="annee")
    prix_cacao = pd.Series(np.linspace(1213.05, 5450.28, 30), name="prix_cacao")
    precip_mm = pd.Series(np.linspace(327.60, 1540.68, 30), name="precip_mm")
    temp_moyen = pd.Series(np.linspace(26.56, 27.38, 30), name="temp_moyen")
    prix_prod = pd.Series(np.linspace(320.00, 1384.00, 30), name="prix_prod")
    production = pd.Series(np.linspace(1090304, 2248600, 30), name="production")
    volatilite = pd.Series(np.linspace(-0.17, 2.37, 30), name="volatilite_prix")

    # Inférence profilage
    assert infer_statistical_type(annees, "annee") == "temporel"
    assert infer_statistical_type(prix_cacao, "prix_cacao") == "continu"
    assert infer_statistical_type(precip_mm, "precip_mm") == "continu"
    assert infer_statistical_type(temp_moyen, "temp_moyen") == "continu"
    assert infer_statistical_type(prix_prod, "prix_prod") == "continu"
    assert infer_statistical_type(production, "production") == "continu"
    assert infer_statistical_type(volatilite, "volatilite_prix") == "continu"


def test_auto_pipeline_detector_cacao_dataset():
    """Vérifie que l'Auto-Pipeline classifie correctement les colonnes continues et temporelles."""
    df = pd.DataFrame({
        "annee": list(range(1995, 2025)),
        "prix_cacao": np.linspace(1213.05, 5450.28, 30),
        "precip_mm": np.linspace(327.60, 1540.68, 30),
        "temp_moyen": np.linspace(26.56, 27.38, 30),
        "prix_prod": np.linspace(320.00, 1384.00, 30),
        "production": np.linspace(1090304, 2248600, 30),
        "volatilite_prix": np.linspace(-0.17, 2.37, 30),
    })

    # Test des fonctions heuristiques unitaires
    assert _is_temporal(df["annee"], name="annee") is True
    assert _is_temporal(df["prix_cacao"], name="prix_cacao") is False
    assert _is_temporal(df["precip_mm"], name="precip_mm") is False
    assert _is_temporal(df["temp_moyen"], name="temp_moyen") is False

    assert _classify_column(df["annee"], name="annee") == "temporal"
    assert _classify_column(df["prix_cacao"], name="prix_cacao") == "numeric"
    assert _classify_column(df["precip_mm"], name="precip_mm") == "numeric"
    assert _classify_column(df["temp_moyen"], name="temp_moyen") == "numeric"

    profile = detect_dataset_profile(df)
    assert profile.temporal_cols == ["annee"]
    assert set(profile.numeric_cols) == {"prix_cacao", "precip_mm", "temp_moyen", "prix_prod", "production", "volatilite_prix"}

    # Prix cacao doit avoir un score élevé de candidat cible
    target_cands = {c["column"]: c for c in profile.candidate_targets}
    assert target_cands["prix_cacao"]["type"] == "numeric"
    assert target_cands["prix_cacao"]["score"] >= 70
    assert target_cands["annee"]["type"] == "temporal"


def test_detect_dataset_profile_with_stored_profile():
    """Vérifie que detect_dataset_profile respecte le dictionnaire de profil stocké."""
    df = pd.DataFrame({
        "col_a": [1.0, 2.0, 3.0, 4.0],
        "col_b": ["A", "B", "A", "B"],
        "col_c": [1990, 1991, 1992, 1993],
    })

    stored_profile = {
        "dictionary": [
            {"nom_brut": "col_a", "type_statistique": "continu"},
            {"nom_brut": "col_b", "type_statistique": "catégoriel_nominal"},
            {"nom_brut": "col_c", "type_statistique": "temporel"},
        ]
    }

    profile = detect_dataset_profile(df, ds_profile=stored_profile)
    assert profile.column_types["col_a"] == "numeric"
    assert profile.column_types["col_b"] == "categorical"
    assert profile.column_types["col_c"] == "temporal"


def test_detect_dataset_profile_with_type_overrides():
    """Vérifie que les type_overrides prévalent sur le profil stocké."""
    df = pd.DataFrame({
        "col_a": [1, 2, 3, 4],
    })

    stored_profile = {
        "dictionary": [
            {"nom_brut": "col_a", "type_statistique": "continu"},
        ]
    }

    profile = detect_dataset_profile(
        df,
        ds_profile=stored_profile,
        type_overrides={"col_a": "catégoriel_nominal"}
    )
    assert profile.column_types["col_a"] == "categorical"
    assert profile.categorical_cols == ["col_a"]
    assert profile.numeric_cols == []
