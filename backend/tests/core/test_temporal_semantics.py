"""
Tests unitaires pour la gestion sémantique rigoureuse des colonnes temporelles et identifiants.
Vérifie l'absence d'incohérences (pas de moyenne sur les dates/IDs, isolation des tendances temporelles,
exclusion de l'index temporel de la matrice X de modélisation).
"""

import numpy as np
import pandas as pd
import pytest

from app.core.analysis import (
    compute_descriptive_stats,
    compute_correlation_matrix,
    compute_vif,
)
from app.core.modeling_preparation import prepare_data


@pytest.fixture
def econometric_df():
    np.random.seed(42)
    n = 30
    years = np.arange(1995, 1995 + n)
    ids = np.arange(1, n + 1)
    rainfall = np.random.normal(1200, 150, n)
    temperature = np.random.normal(26.5, 1.2, n)
    price = 1000 + (years - 1995) * 50 + np.random.normal(0, 30, n)
    production = 500 + 0.4 * rainfall - 10 * temperature + 0.2 * price + np.random.normal(0, 20, n)

    return pd.DataFrame({
        "id_observation": ids,
        "annee": years,
        "precip_mm": rainfall,
        "temp_moyen": temperature,
        "prix_prod": price,
        "production": production,
    })


class TestTemporalAndIdSemantics:
    def test_descriptive_stats_categorizes_temporal_and_id(self, econometric_df):
        stats = compute_descriptive_stats(econometric_df)

        # L'index temporel 'annee' doit avoir le type 'temporal' et non 'numeric'
        assert stats["annee"]["type"] == "temporal"
        assert stats["annee"]["min"] == "1995"
        assert stats["annee"]["max"] == "2024"
        assert stats["annee"]["periods_count"] == 30
        assert "mean" not in stats["annee"]
        assert "std" not in stats["annee"]

        # L'identifiant 'id_observation' doit avoir le type 'id'
        assert stats["id_observation"]["type"] == "id"
        assert stats["id_observation"]["cardinality"] == 30
        assert stats["id_observation"]["uniqueness_rate"] == 1.0
        assert "mean" not in stats["id_observation"]

        # Les vraies variables physiques/économiques doivent avoir le type 'numeric'
        assert stats["production"]["type"] == "numeric"
        assert "mean" in stats["production"]
        assert "std" in stats["production"]

    def test_correlation_isolates_temporal_trends_and_drops_ids(self, econometric_df):
        res = compute_correlation_matrix(econometric_df)

        # Les IDs ne doivent pas être dans les colonnes corrélées
        assert "id_observation" not in res["columns"]

        # La matrice croisée se concentre sur les variables physiques/économiques
        assert "production" in res["columns"]
        assert "precip_mm" in res["columns"]

        # Les tendances temporelles doivent être isolées dans 'temporal_trends'
        assert "temporal_trends" in res
        trends = {t["variable"]: t for t in res["temporal_trends"]}
        assert "prix_prod" in trends
        assert trends["prix_prod"]["time_col"] == "annee"
        assert trends["prix_prod"]["direction"] == "croissante"

    def test_vif_excludes_temporal_and_id_columns(self, econometric_df):
        vifs = compute_vif(econometric_df)
        vif_vars = [v["variable"] for v in vifs]

        # 'annee' et 'id_observation' ne doivent pas figurer dans le VIF des prédicteurs
        assert "annee" not in vif_vars
        assert "id_observation" not in vif_vars

        # Seules les variables explicatives physiques/économiques sont testées
        assert set(vif_vars).issubset({"precip_mm", "temp_moyen", "prix_prod", "production"})

    def test_prepare_data_excludes_time_col_and_ids_from_features(self, econometric_df):
        prep = prepare_data(
            econometric_df,
            target_col="production",
            split_strategy="time",
        )

        # X_train et X_test ne doivent contenir ni 'annee' ni 'id_observation'
        features = list(prep["X_train"].columns)
        assert "annee" not in features
        assert "id_observation" not in features
        assert "production" not in features
        assert "precip_mm" in features
        assert "temp_moyen" in features
        assert "prix_prod" in features

        # Le split temporel doit bien utiliser 'annee' pour ordonner
        assert prep["split_info"]["temporal_column"] == "annee"
        assert prep["split_info"]["strategy"] == "time"
