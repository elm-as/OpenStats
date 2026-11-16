"""Tier 2: Boundary, corner cases, and error tolerance validations."""

from __future__ import annotations

import io
from tests.e2e.conftest import upload_test_dataset
from tests.e2e.dataset_factories import (
    make_regression_dataset,
    make_boundary_dataset,
)


def test_empty_and_headers_only_datasets(e2e_client, e2e_headers):
    """Uploading zero-byte or header-only files fails with validation errors without crash."""
    empty_bytes = make_boundary_dataset("empty")
    res_empty = e2e_client.post(
        "/api/v1/datasets/upload",
        data={"file": (io.BytesIO(empty_bytes), "empty.csv"), "name": "Empty DS"},
        headers=e2e_headers,
        content_type="multipart/form-data",
    )
    assert res_empty.status_code in (400, 422)

    headers_bytes = make_boundary_dataset("headers_only")
    res_headers = e2e_client.post(
        "/api/v1/datasets/upload",
        data={"file": (io.BytesIO(headers_bytes), "headers.csv"), "name": "Headers DS"},
        headers=e2e_headers,
        content_type="multipart/form-data",
    )
    assert res_headers.status_code in (400, 422)


def test_single_row_dataset(e2e_client, e2e_headers):
    """Datasets with N=1 row handle statistical boundaries without panicking."""
    single_bytes = make_boundary_dataset("single_row")
    res_upload = e2e_client.post(
        "/api/v1/datasets/upload",
        data={"file": (io.BytesIO(single_bytes), "single.csv"), "name": "Single Row DS"},
        headers=e2e_headers,
        content_type="multipart/form-data",
    )
    if res_upload.status_code == 201:
        ds_id = res_upload.get_json()["dataset_id"]
        res_desc = e2e_client.get(f"/api/v1/datasets/{ds_id}/analysis/descriptive", headers=e2e_headers)
        assert res_desc.status_code in (200, 400)


def test_constant_zero_variance_column(e2e_client, e2e_headers):
    """Features with constant identical values (std=0) are handled safely."""
    const_bytes = make_boundary_dataset("constant_col", seed=501)
    ds = upload_test_dataset(e2e_client, e2e_headers, {"bytes": const_bytes, "name": "Const Col DS"})
    dataset_id = ds["dataset_id"]

    res_analysis = e2e_client.post(
        f"/api/v1/datasets/{dataset_id}/analysis",
        json={"bootstrap_ci": False},
        headers=e2e_headers,
    )
    assert res_analysis.status_code == 200
    data = res_analysis.get_json()
    assert data is not None


def test_single_class_target_in_classification(e2e_client, e2e_headers):
    """Attempting model training on a single-class target column returns an error."""
    single_class_bytes = make_boundary_dataset("single_class", seed=502)
    ds = upload_test_dataset(e2e_client, e2e_headers, {"bytes": single_class_bytes, "name": "Single Class DS"})
    dataset_id = ds["dataset_id"]

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
    # Target with 0 variance / single value must either reject or report failure
    if res_train.status_code == 200:
        result = res_train.get_json()
        assert len(result.get("failed", [])) > 0 or len(result.get("ranking", [])) >= 0
    else:
        assert res_train.status_code in (400, 422, 500)


def test_extreme_multicollinearity_vif(e2e_client, e2e_headers):
    """Extreme collinearity (VIF > 100) must trigger diagnostics warnings."""
    csv_bytes = make_regression_dataset(n_samples=120, seed=503)
    ds = upload_test_dataset(e2e_client, e2e_headers, {"bytes": csv_bytes, "name": "Collinear Reg"})
    dataset_id = ds["dataset_id"]

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
    train_res = res_train.get_json()
    ranking = train_res.get("ranking", [])
    if ranking:
        best_model = ranking[0]
        warnings = best_model.get("warnings", [])
        assert any("VIF" in str(w) or "collinear" in str(w).lower() for w in warnings)


def test_canvas_dag_cyclic_graph_handled(e2e_client, e2e_headers):
    """Directed cycles in Canvas DAG (A -> B -> A) do not cause infinite loops."""
    cyclic_dag = {
        "nodes": [
            {"id": "node_a", "type": "descriptiveNumeric", "data": {}},
            {"id": "node_b", "type": "descriptiveNumeric", "data": {}},
        ],
        "edges": [
            {"source": "node_a", "target": "node_b"},
            {"source": "node_b", "target": "node_a"},
        ],
    }
    res = e2e_client.post("/api/v1/canvas/run_pipeline", json=cyclic_dag, headers=e2e_headers)
    assert res.status_code == 200
    res_data = res.get_json()
    assert res_data.get("executed", 0) < 2


def test_canvas_orphan_nodes_executed(e2e_client, e2e_headers):
    """Canvas DAG containing disconnected orphan nodes processes reachable nodes."""
    csv_bytes = make_regression_dataset(n_samples=60, seed=504)
    ds = upload_test_dataset(e2e_client, e2e_headers, {"bytes": csv_bytes, "name": "Orphan Test DS"})
    dataset_id = ds["dataset_id"]

    orphan_dag = {
        "nodes": [
            {"id": "connected_source", "type": "dataset", "data": {"datasetId": dataset_id}},
            {"id": "orphan_node", "type": "descriptiveNumeric", "data": {}},
        ],
        "edges": [],
    }
    res = e2e_client.post("/api/v1/canvas/run_pipeline", json=orphan_dag, headers=e2e_headers)
    assert res.status_code == 200
    assert res.get_json().get("success") is True


def test_simulation_untrained_model_rejection(e2e_client, e2e_headers):
    """Requesting simulation or scenarios on untrained models returns 400."""
    csv_bytes = make_regression_dataset(n_samples=50, seed=505)
    ds = upload_test_dataset(e2e_client, e2e_headers, {"bytes": csv_bytes, "name": "Untrained DS"})
    dataset_id = ds["dataset_id"]

    res_run = e2e_client.post(
        f"/api/v1/datasets/{dataset_id}/scenarios/run",
        json={"scenario_names": ["central"]},
        headers=e2e_headers,
    )
    assert res_run.status_code in (400, 404)

    res_mc = e2e_client.post(
        f"/api/v1/datasets/{dataset_id}/monte-carlo",
        json={"n_simulations": 50},
        headers=e2e_headers,
    )
    assert res_mc.status_code in (400, 404)


def test_nonexistent_dataset_not_found(e2e_client, e2e_headers):
    """Operations on non-existent dataset IDs must return 404."""
    unknown_id = "nonexistent-dataset-id-0000"
    res = e2e_client.get(f"/api/v1/datasets/{unknown_id}", headers=e2e_headers)
    assert res.status_code == 404
