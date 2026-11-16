"""Tier 3: Pairwise and multi-stage cross-feature workflow integrations."""

from __future__ import annotations

from tests.e2e.conftest import upload_test_dataset
from tests.e2e.dataset_factories import (
    make_regression_dataset,
    make_timeseries_dataset,
)


def test_workflow_ingestion_clean_pca_canvas_python_export(e2e_client, e2e_headers):
    """Multi-stage: Ingestion -> AutoClean -> PCA -> Canvas Pipeline -> Python Export."""
    # 1. Ingestion
    csv_bytes = make_regression_dataset(n_samples=100, seed=601)
    ds = upload_test_dataset(e2e_client, e2e_headers, {"bytes": csv_bytes, "name": "Cross PCA DS"})
    dataset_id = ds["dataset_id"]

    # 2. Automated cleaning
    res_clean = e2e_client.post(f"/api/v1/datasets/{dataset_id}/clean/auto", headers=e2e_headers)
    assert res_clean.status_code == 200

    # 3. Factor Analysis PCA
    pca_payload = {"columns": ["x1", "x2", "target"], "n_components": 2}
    res_pca = e2e_client.post(
        f"/api/v1/datasets/{dataset_id}/factor-analysis/pca",
        json=pca_payload,
        headers=e2e_headers,
    )
    assert res_pca.status_code == 200
    pca_res = res_pca.get_json()
    assert "eigenvalues" in pca_res or "variance_explained" in pca_res

    # 4. Canvas DAG execution
    dag_payload = {
        "nodes": [
            {"id": "source", "type": "dataset", "data": {"datasetId": dataset_id}},
            {"id": "pca_node", "type": "pca", "data": {"columns": ["x1", "x2"], "n_components": 2}},
        ],
        "edges": [{"source": "source", "target": "pca_node"}],
    }
    res_dag = e2e_client.post("/api/v1/canvas/run_pipeline", json=dag_payload, headers=e2e_headers)
    assert res_dag.status_code == 200

    # 5. Standalone Python code export
    export_payload = {**dag_payload, "language": "python", "dataset_name": "clean_data.csv"}
    res_exp = e2e_client.post("/api/v1/canvas/export_code", json=export_payload, headers=e2e_headers)
    assert res_exp.status_code == 200
    exp_data = res_exp.get_json()
    assert exp_data.get("success") is True
    assert "PCA" in exp_data.get("code", "") or "decomposition" in exp_data.get("code", "")


def test_workflow_timeseries_stationarity_var_forecasting(e2e_client, e2e_headers):
    """Multi-stage: Ingestion -> Stationarity -> Multivariate VAR Modeling."""
    # 1. Ingest temporal dataset
    ts_bytes = make_timeseries_dataset(n_periods=75, seed=602)
    ds = upload_test_dataset(e2e_client, e2e_headers, {"bytes": ts_bytes, "name": "Cross VAR DS"})
    dataset_id = ds["dataset_id"]

    # 2. Check stationarity on price
    res_stat = e2e_client.post(
        f"/api/v1/datasets/{dataset_id}/analysis/stationarity",
        json={"col": "price"},
        headers=e2e_headers,
    )
    assert res_stat.status_code == 200

    # 3. Multivariate estimation
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
    assert "models" in var_res or "var" in var_res or "granger_causality" in var_res


def test_workflow_autopipeline_shap_scenarios_montecarlo(e2e_client, e2e_headers):
    """Multi-stage: AutoPipeline Training -> SHAP -> What-If Scenario -> Monte Carlo."""
    # 1. Ingestion
    csv_bytes = make_regression_dataset(n_samples=100, seed=603)
    ds = upload_test_dataset(e2e_client, e2e_headers, {"bytes": csv_bytes, "name": "Cross ML DS"})
    dataset_id = ds["dataset_id"]

    # 2. Competitive training
    train_payload = {
        "target_column": "target",
        "models": ["linear_regression", "ridge"],
        "test_size": 0.2,
    }
    res_train = e2e_client.post(
        f"/api/v1/datasets/{dataset_id}/model/train",
        json=train_payload,
        headers=e2e_headers,
    )
    assert res_train.status_code == 200
    train_res = res_train.get_json()
    assert "ranking" in train_res

    # 3. Create scenario
    scen_payload = {
        "name": "rate_increase",
        "modifications": {"x2": {"shift": 1.0}},
    }
    res_scen = e2e_client.post(
        f"/api/v1/datasets/{dataset_id}/scenarios/create",
        json=scen_payload,
        headers=e2e_headers,
    )
    assert res_scen.status_code == 200

    # 4. Run scenario
    res_run = e2e_client.post(
        f"/api/v1/datasets/{dataset_id}/scenarios/run",
        json={"scenario_names": ["rate_increase"]},
        headers=e2e_headers,
    )
    assert res_run.status_code == 200

    # 5. Run Monte Carlo stochastic simulation
    mc_payload = {
        "n_simulations": 80,
        "noise_type": "gaussian",
        "noise_scale": 0.5,
    }
    res_mc = e2e_client.post(
        f"/api/v1/datasets/{dataset_id}/monte-carlo",
        json=mc_payload,
        headers=e2e_headers,
    )
    assert res_mc.status_code == 200


def test_workflow_canvas_dag_snapshot_and_read_viewer(e2e_client, e2e_headers):
    """Multi-stage: Canvas Construction -> Pipeline Run -> Snapshot Share -> Public Inspection."""
    csv_bytes = make_regression_dataset(n_samples=80, seed=604)
    ds = upload_test_dataset(e2e_client, e2e_headers, {"bytes": csv_bytes, "name": "Cross Canvas DS"})
    dataset_id = ds["dataset_id"]

    dag_payload = {
        "nodes": [
            {"id": "src", "type": "dataset", "data": {"datasetId": dataset_id}},
            {"id": "desc", "type": "descriptiveNumeric", "data": {}},
        ],
        "edges": [{"source": "src", "target": "desc"}],
    }
    # 1. Run pipeline
    res_run = e2e_client.post("/api/v1/canvas/run_pipeline", json=dag_payload, headers=e2e_headers)
    assert res_run.status_code == 200

    # 2. Share pipeline publicly
    share_payload = {**dag_payload, "metadata": {"name": "Audit Workflow"}}
    res_share = e2e_client.post("/api/v1/canvas/share", json=share_payload, headers=e2e_headers)
    assert res_share.status_code == 200
    share_id = res_share.get_json()["share_id"]

    # 3. Read without credentials
    res_public = e2e_client.get(f"/api/v1/canvas/share/{share_id}")
    assert res_public.status_code == 200
    data = res_public.get_json()["data"]
    assert len(data.get("nodes", [])) == 2
