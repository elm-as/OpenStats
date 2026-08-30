"""
Tests unitaires pour les modules d'analyses avancées :
- Clustering hiérarchique (HAC)
- Analyse de survie (Kaplan-Meier, Greenwood, Log-Rank)
- Inférence causale (PSM, Love plot, DiD)
"""

import numpy as np
import pandas as pd
import pytest

from app.core.clustering_hierarchical import run_hierarchical_clustering
from app.core.survival_analysis import run_survival_analysis, compute_kaplan_meier_table
from app.core.causal_inference import run_propensity_score_matching


def test_hierarchical_clustering():
    np.random.seed(42)
    df = pd.DataFrame({
        "x": np.concatenate([np.random.normal(0, 1, 30), np.random.normal(5, 1, 30)]),
        "y": np.concatenate([np.random.normal(0, 1, 30), np.random.normal(5, 1, 30)]),
        "z": np.random.normal(2, 1, 60),
    })

    res = run_hierarchical_clustering(df, n_clusters=2, method="ward")
    assert res["status"] == "success"
    assert res["n_clusters"] == 2
    assert "dendrogram" in res
    assert len(res["dendrogram"]["icoord"]) > 0
    assert len(res["dendrogram"]["dcoord"]) > 0
    assert res["silhouette_score"] is not None
    assert res["silhouette_score"] > 0.3
    assert len(res["cluster_summary"]) == 2
    assert "projection_2d" in res


def test_survival_analysis():
    np.random.seed(42)
    n = 60
    df = pd.DataFrame({
        "time": np.random.exponential(15, size=n),
        "event": np.random.binomial(1, 0.7, size=n),
        "group": np.random.choice(["Control", "Treated"], size=n),
    })

    res = run_survival_analysis(df, duration_col="time", event_col="event", group_col="group")
    assert res["status"] == "success"
    assert "km_table" in res
    assert len(res["km_table"]) > 0

    first = res["km_table"][0]
    assert first["survival_probability"] == 1.0
    assert first["ci_lower"] == 1.0

    last = res["km_table"][-1]
    assert last["ci_lower"] <= last["survival_probability"] <= last["ci_upper"]

    assert "group_curves" in res
    assert "Control" in res["group_curves"]
    assert "Treated" in res["group_curves"]
    assert res["log_rank_test"] is not None
    assert "chi2_statistic" in res["log_rank_test"]


def test_propensity_score_matching():
    np.random.seed(42)
    n = 80
    age = np.random.normal(45, 10, size=n)
    income = np.random.normal(50000, 15000, size=n)

    # Treatment depends on age and income
    z = 0.05 * (age - 45) + 0.00005 * (income - 50000)
    p = 1 / (1 + np.exp(-z))
    treat = np.random.binomial(1, p, size=n)
    outcome = 100 + 20 * treat + 0.5 * age + np.random.normal(0, 5, size=n)

    df = pd.DataFrame({
        "age": age,
        "income": income,
        "treated": treat,
        "outcome": outcome,
    })

    res = run_propensity_score_matching(
        df=df,
        treatment_col="treated",
        outcome_col="outcome",
        covariates=["age", "income"],
    )

    assert res["status"] == "success"
    assert "att" in res
    assert "p_value" in res
    assert "love_plot" in res
    assert len(res["love_plot"]) == 2
    assert "common_support" in res
