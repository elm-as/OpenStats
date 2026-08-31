"""
Tests unitaires pour les modèles économétriques de panel et le test de Hausman.
"""

import numpy as np
import pandas as pd
import pytest
from app.core.panel_models import fit_panel_models


@pytest.fixture
def sample_panel_data():
    """Génère un panel synthétique de 10 entités observées sur 8 périodes."""
    np.random.seed(42)
    n_entities = 10
    n_periods = 8

    records = []
    for i in range(n_entities):
        alpha_i = np.random.normal(5.0, 2.0)  # Effet fixe individuel
        for t in range(n_periods):
            x1 = np.random.normal(10.0, 3.0)
            x2 = np.random.normal(2.0, 1.0)
            eps = np.random.normal(0, 0.5)
            y = alpha_i + 1.5 * x1 - 0.8 * x2 + eps
            records.append({
                "entity_id": f"entity_{i}",
                "year": 2010 + t,
                "x1": x1,
                "x2": x2,
                "target": y,
            })
    return pd.DataFrame(records)


def test_panel_models_basic_fit(sample_panel_data):
    """Vérifie le bon calcul des 3 modèles et du test de Hausman."""
    res = fit_panel_models(
        df=sample_panel_data,
        entity_col="entity_id",
        time_col="year",
        target_col="target",
        covariates=["x1", "x2"],
    )

    assert "error" not in res
    assert res["n_observations"] == 80
    assert res["n_entities"] == 10
    assert res["is_balanced"] is True

    # Vérification Pooled OLS
    pooled = res["pooled_ols"]
    assert len(pooled["coefficients"]) == 3  # const + x1 + x2
    assert pooled["r2"] is not None

    # Vérification Fixed Effects
    fe = res["fixed_effects"]
    assert len(fe["coefficients"]) == 2  # x1 + x2
    fe_x1 = next(c for c in fe["coefficients"] if c["variable"] == "x1")
    assert pytest.approx(fe_x1["coefficient"], abs=0.1) == 1.5
    assert fe_x1["significant"] is True

    # Vérification Random Effects
    re_res = res["random_effects"]
    assert len(re_res["coefficients"]) == 2
    assert re_res["theta_weight"] is not None

    # Vérification Test de Hausman
    hausman = res["hausman_test"]
    assert hausman["statistic"] is not None
    assert hausman["p_value"] is not None
    assert "prefer_fixed_effects" in hausman
    assert isinstance(hausman["conclusion"], str)


def test_panel_insufficient_data():
    """Vérifie la gestion gracieuse d'un échantillon trop petit."""
    df_small = pd.DataFrame({
        "entity": ["A", "A", "B"],
        "year": [2020, 2021, 2020],
        "x": [1, 2, 3],
        "y": [2, 3, 4],
    })
    res = fit_panel_models(df_small, "entity", "year", "y", ["x"])
    assert "error" in res
