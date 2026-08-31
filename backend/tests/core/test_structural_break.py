"""
Tests unitaires pour le Test de Rupture Structurelle de Chow :
- Calcul de la F-statistique et p-valeur sur régression stable (pas de rejet H0)
- Détection d'un choc structurel simulé (rejet net H0, détection du breakpoint)
- Comportement avec et sans date_col
"""

import numpy as np
import pandas as pd
import pytest

from app.core.timeseries.structural_break import compute_chow_test


class TestStructuralBreakChow:
    def test_chow_test_stable_data(self):
        """Sur un processus sans choc, H0 (stabilité) ne doit pas être rejeté."""
        np.random.seed(42)
        n = 60
        x = np.linspace(0, 10, n)
        # Relation stable : y = 2x + 5 + bruit
        y = 2.0 * x + 5.0 + np.random.normal(0, 0.5, n)
        df = pd.DataFrame({"y": y, "x": x})

        res = compute_chow_test(df, target_col="y", feature_cols=["x"], break_point=30)
        assert res["f_statistic"] is not None
        assert res["p_value"] is not None
        assert res["p_value"] > 0.05
        assert res["is_significant"] is False

    def test_chow_test_structural_shock_detection(self):
        """Avec un choc brutal à mi-parcours (changement de pente), le test doit détecter la rupture."""
        np.random.seed(42)
        n = 60
        x = np.linspace(0, 10, n)
        # Première moitié : pente = 2.0, Seconde moitié : pente = -4.0 (choc violent)
        y = np.empty(n)
        y[:30] = 2.0 * x[:30] + 5.0 + np.random.normal(0, 0.5, 30)
        y[30:] = -4.0 * x[30:] + 35.0 + np.random.normal(0, 0.5, 30)

        df = pd.DataFrame({"y": y, "x": x})

        # 1. Test avec break_point spécifié à 30
        res = compute_chow_test(df, target_col="y", feature_cols=["x"], break_point=30)
        assert res["is_significant"] is True
        assert res["p_value"] < 0.001
        assert res["f_statistic"] > 20.0

        # 2. Test avec scan automatique (Supremum Chow test)
        res_scan = compute_chow_test(df, target_col="y", feature_cols=["x"], break_point=None)
        assert res_scan["is_significant"] is True
        # Le point détecté doit être très proche de 30 (entre 28 et 32)
        assert abs(res_scan["break_index"] - 30) <= 2

    def test_chow_test_with_date_column(self):
        np.random.seed(42)
        n = 40
        years = np.arange(1980, 1980 + n)
        x = np.random.normal(50, 5, n)
        y = 1.5 * x + np.random.normal(0, 2, n)
        # Choc en 2000
        y[years >= 2000] += 25.0

        df = pd.DataFrame({"annee": years, "x": x, "y": y})
        res = compute_chow_test(df, target_col="y", feature_cols=["x"], date_col="annee", break_point="2000")
        assert res["break_label"] == "2000"
        assert res["is_significant"] is True
