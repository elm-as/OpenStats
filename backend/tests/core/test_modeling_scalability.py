"""
Tests de scalabilité et de streaming pour la modélisation compétitive.
Valide que les datasets volumineux ne provoquent pas de blocage infini
et que les callbacks de progression sont bien émis.
"""

import time
import numpy as np
import pandas as pd
import pytest
from app.core.modeling import prepare_data, train_competitive


class TestCompetitiveScalabilityAndStreaming:
    def test_competitive_classification_large_dataset_fast_completion(self):
        """Vérifie que la modélisation compétitive sur 12 000 lignes se termine rapidement."""
        np.random.seed(42)
        n = 12000
        X = np.random.randn(n, 5)
        logits = X @ np.array([1.2, -0.8, 0.5, -1.0, 0.3])
        y = (logits > 0).astype(int)

        df = pd.DataFrame(X, columns=[f"feat_{i}" for i in range(5)])
        df["target"] = y

        data = prepare_data(df, target_col="target", test_size=0.2)

        logs = []

        def on_progress(msg: str, level: str = "info"):
            logs.append((msg, level))

        t0 = time.time()
        # Modèles avec SVM (qui bloquait auparavant à 50k lignes) et Random Forest
        res = train_competitive(
            data,
            model_keys=["logistic_regression", "decision_tree", "svm", "random_forest"],
            progress_callback=on_progress,
            timeout_per_model=30.0,
        )
        duration = time.time() - t0

        assert duration < 25.0, f"Le tournoi a pris trop de temps ({duration:.1f}s)"
        assert len(res["ranking"]) >= 3
        assert len(logs) > 0
        # Vérifie qu'au moins un log de fin de modèle a été capturé
        assert any("terminé en" in msg for msg, _ in logs)
        assert res["best_model_key"] is not None

    def test_competitive_timeout_circuit_breaker(self):
        """Vérifie que le circuit-breaker interrompt un modèle qui dépasse le timeout."""
        np.random.seed(42)
        n = 200
        df = pd.DataFrame(np.random.randn(n, 3), columns=["x1", "x2", "x3"])
        df["target"] = (df["x1"] > 0).astype(int)
        data = prepare_data(df, target_col="target")

        logs = []

        def on_progress(msg: str, level: str = "info"):
            logs.append((msg, level))

        # Avec un timeout intentionnellement minuscule (ex: 0.0001s), le modèle doit être interrompu
        res = train_competitive(
            data,
            model_keys=["random_forest"],
            progress_callback=on_progress,
            timeout_per_model=0.0001,
        )

        assert len(res["failed"]) == 1
        assert "Temps limite dépassé" in res["failed"][0]["error"]
        assert any("temps limite dépassé" in msg.lower() for msg, _ in logs)
