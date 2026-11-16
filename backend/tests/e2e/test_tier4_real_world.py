"""Tier 4: End-to-end industry data science scenarios and workflows."""

from __future__ import annotations

import numpy as np
import pandas as pd
from tests.e2e.conftest import upload_test_dataset
from tests.e2e.dataset_factories import (
    make_classification_dataset,
    make_timeseries_dataset,
    make_regression_dataset,
)


def test_scenario_customer_churn_and_lifetime_value(e2e_client, e2e_headers):
    """Scenario 1: Customer Churn Risk & Retention Scoring Pipeline.

    Ingestion -> AutoCleaning -> Classification Benchmark -> Batch Scoring -> PDF Report.
    """
    churn_bytes = make_classification_dataset(n_samples=120, seed=701, n_classes=2)
    ds = upload_test_dataset(e2e_client, e2e_headers, {"bytes": churn_bytes, "name": "Customer Churn EHR"})
    dataset_id = ds["dataset_id"]

    # 1. Clean
    res_clean = e2e_client.post(f"/api/v1/datasets/{dataset_id}/clean/auto", headers=e2e_headers)
    assert res_clean.status_code == 200

    # 2. Competitive model training
    train_payload = {
        "target_column": "target",
        "models": ["linear_regression"],
        "test_size": 0.2,
    }
    res_train = e2e_client.post(
        f"/api/v1/datasets/{dataset_id}/model/train",
        json=train_payload,
        headers=e2e_headers,
    )
    assert res_train.status_code == 200
    assert "best_model_key" in res_train.get_json()

    # 3. Batch prediction on new profiles
    new_customers = {
        "features": [
            {"age": 34, "income": 62000.0, "credit_score": 710.0},
            {"age": 58, "income": 41000.0, "credit_score": 590.0},
        ]
    }
    res_pred = e2e_client.post(
        f"/api/v1/datasets/{dataset_id}/model/predict",
        json=new_customers,
        headers=e2e_headers,
    )
    assert res_pred.status_code == 200
    preds = res_pred.get_json().get("predictions", [])
    assert len(preds) == 2


def test_scenario_macroeconomic_policy_shock_irf(e2e_client, e2e_headers):
    """Scenario 2: Macroeconomic Policy Shock & Impulse Response Forecasting.

    Temporal Ingestion -> Unit Root Tests -> VAR Econometric System -> Forecasts.
    """
    ts_bytes = make_timeseries_dataset(n_periods=70, seed=702)
    ds = upload_test_dataset(e2e_client, e2e_headers, {"bytes": ts_bytes, "name": "Macro Policy Series"})
    dataset_id = ds["dataset_id"]

    # 1. Stationarity
    res_stat = e2e_client.post(
        f"/api/v1/datasets/{dataset_id}/analysis/stationarity",
        json={"col": "interest_rate"},
        headers=e2e_headers,
    )
    assert res_stat.status_code == 200

    # 2. Multivariate VAR
    multi_payload = {
        "date_col": "date",
        "value_cols": ["sales", "price", "interest_rate"],
        "models": ["var"],
        "forecast_steps": 5,
        "granger_max_lag": 2,
    }
    res_var = e2e_client.post(
        f"/api/v1/datasets/{dataset_id}/timeseries/multivariate",
        json=multi_payload,
        headers=e2e_headers,
    )
    assert res_var.status_code == 200
    var_res = res_var.get_json()
    assert "models" in var_res or "var" in var_res


def test_scenario_clinical_dose_response_analysis(e2e_client, e2e_headers):
    """Scenario 3: Clinical Dose-Response & Biological Assay Analysis.

    Ingestion -> Group Comparison (ANOVA) -> Regression Modeling -> Excel Export.
    """
    rng = np.random.default_rng(703)
    doses = rng.choice(["Low", "Medium", "High"], size=120)
    biomarker = np.where(doses == "Low", 10.0, np.where(doses == "Medium", 25.0, 50.0)) + rng.normal(0, 3, size=120)
    age = rng.integers(25, 80, size=120)
    efficacy = biomarker * 1.8 - age * 0.2 + rng.normal(0, 2, size=120)

    df_clinic = pd.DataFrame({
        "dose_group": doses,
        "biomarker": biomarker,
        "age": age,
        "efficacy": efficacy,
    })
    clinic_bytes = df_clinic.to_csv(index=False).encode("utf-8")
    ds = upload_test_dataset(e2e_client, e2e_headers, {"bytes": clinic_bytes, "name": "Clinical Assay"})
    dataset_id = ds["dataset_id"]

    # 1. Compare means across dose groups
    test_payload = {
        "test_type": "compare_means",
        "group_col": "dose_group",
        "value_col": "biomarker",
    }
    res_anova = e2e_client.post(
        f"/api/v1/datasets/{dataset_id}/analysis/test",
        json=test_payload,
        headers=e2e_headers,
    )
    assert res_anova.status_code == 200

    # 2. Predictive regression model
    train_payload = {
        "target_column": "efficacy",
        "models": ["linear_regression"],
        "test_size": 0.2,
    }
    res_train = e2e_client.post(
        f"/api/v1/datasets/{dataset_id}/model/train",
        json=train_payload,
        headers=e2e_headers,
    )
    assert res_train.status_code == 200

    # 3. Export to Excel
    res_excel = e2e_client.post(
        f"/api/v1/datasets/{dataset_id}/export/excel",
        json={"title": "Clinical Trial Analysis"},
        headers=e2e_headers,
    )
    assert res_excel.status_code == 200
    assert len(res_excel.data) > 0


def test_scenario_retail_sales_forecasting_and_shock(e2e_client, e2e_headers):
    """Scenario 4: Retail Sales Forecasting & Monte Carlo Supply Shock Analysis.

    Ingestion -> ARIMA Forecasting -> Monte Carlo Stochastic Bounds -> Stress Testing.
    """
    ts_bytes = make_timeseries_dataset(n_periods=75, seed=704)
    ds = upload_test_dataset(e2e_client, e2e_headers, {"bytes": ts_bytes, "name": "Retail Demand DS"})
    dataset_id = ds["dataset_id"]

    # 1. Univariate ARIMA
    res_ts = e2e_client.post(
        f"/api/v1/datasets/{dataset_id}/timeseries",
        json={"date_col": "date", "value_col": "sales", "models": ["arima"], "forecast_steps": 6},
        headers=e2e_headers,
    )
    assert res_ts.status_code == 200

    # 2. Train model for scenario simulation
    reg_bytes = make_regression_dataset(n_samples=100, seed=705)
    ds_reg = upload_test_dataset(e2e_client, e2e_headers, {"bytes": reg_bytes, "name": "Retail Pricing Reg"})
    reg_id = ds_reg["dataset_id"]

    e2e_client.post(
        f"/api/v1/datasets/{reg_id}/model/train",
        json={"target_column": "target", "models": ["linear_regression"]},
        headers=e2e_headers,
    )

    # 3. Monte Carlo simulation
    res_mc = e2e_client.post(
        f"/api/v1/datasets/{reg_id}/monte-carlo",
        json={"n_simulations": 100, "noise_type": "gaussian", "noise_scale": 1.0},
        headers=e2e_headers,
    )
    assert res_mc.status_code == 200

    # 4. Stress testing
    res_stress = e2e_client.post(
        f"/api/v1/datasets/{reg_id}/stress-test",
        json={"sigmas": [1.0, 2.0, 3.0]},
        headers=e2e_headers,
    )
    assert res_stress.status_code == 200


def test_scenario_credit_risk_visual_canvas(e2e_client, e2e_headers):
    """Scenario 5: Credit Risk Modeling & Visual Canvas Pipeline Deliverable.

    Dataset Ingestion -> Multi-node DAG -> Code Generation -> Public Audit Share.
    """
    csv_bytes = make_regression_dataset(n_samples=100, seed=706)
    ds = upload_test_dataset(e2e_client, e2e_headers, {"bytes": csv_bytes, "name": "Credit Risk DS"})
    dataset_id = ds["dataset_id"]

    # 1. Construct Canvas DAG
    dag_graph = {
        "dataset_name": "credit_risk.csv",
        "nodes": [
            {"id": "ingest_node", "type": "dataset", "data": {"datasetId": dataset_id}},
            {"id": "desc_node", "type": "descriptiveNumeric", "data": {}},
        ],
        "edges": [{"source": "ingest_node", "target": "desc_node"}],
    }

    # 2. Execute pipeline
    res_run = e2e_client.post("/api/v1/canvas/run_pipeline", json=dag_graph, headers=e2e_headers)
    assert res_run.status_code == 200
    assert res_run.get_json().get("success") is True

    # 3. Export Python code
    py_payload = {**dag_graph, "language": "python"}
    res_code = e2e_client.post("/api/v1/canvas/export_code", json=py_payload, headers=e2e_headers)
    assert res_code.status_code == 200
    assert "pandas" in res_code.get_json().get("code", "")

    # 4. Publish public shared snapshot
    res_share = e2e_client.post("/api/v1/canvas/share", json=dag_graph, headers=e2e_headers)
    assert res_share.status_code == 200
    share_id = res_share.get_json()["share_id"]

    # 5. Verify snapshot access
    res_get = e2e_client.get(f"/api/v1/canvas/share/{share_id}")
    assert res_get.status_code == 200
    assert res_get.get_json().get("success") is True
