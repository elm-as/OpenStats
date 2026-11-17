"""Tests de cohérence Canvas / DuckDB et scalabilité de comparaison des modèles."""

import numpy as np
import pandas as pd

from app.api.v1.canvas.graph import _resolve_cleaned_flag
from app.core.pipeline.models_comparison import MAX_BENCHMARK_ROWS, compare_models


def test_resolve_cleaned_flag_uses_active_version_unless_raw():
    nodes = {
        "n_ds": {"id": "n_ds", "type": "dataset", "data": {}},
        "n_stats": {"id": "n_stats", "type": "descriptiveNumeric", "data": {}},
    }
    parents = {"n_ds": [], "n_stats": ["n_ds"]}
    assert _resolve_cleaned_flag("n_stats", parents, nodes) is True

    nodes["n_ds"]["data"]["useRaw"] = True
    assert _resolve_cleaned_flag("n_stats", parents, nodes) is False

    nodes["n_clean"] = {"id": "n_clean", "type": "cleaning", "data": {}}
    parents = {"n_ds": [], "n_clean": ["n_ds"], "n_stats": ["n_clean"]}
    assert _resolve_cleaned_flag("n_stats", parents, nodes) is True


def test_compare_models_subsamples_large_datasets_fast():
    rng = np.random.default_rng(7)
    n = MAX_BENCHMARK_ROWS + 5000
    x1 = rng.normal(size=n)
    x2 = rng.normal(size=n)
    X = pd.DataFrame({"x1": x1, "x2": x2})
    y = pd.Series((x1 + 0.5 * x2 > 0).astype(int))

    result = compare_models(
        X, y, "classification_binaire", budget_sec=30.0, keys=["logistic", "lgbm_clf"]
    )
    assert result["n_rows"] == n
    assert "échantillon" in result["validation"]
    assert result["n_evaluated"] >= 1
    assert result["elapsed_sec"] < 30.0
