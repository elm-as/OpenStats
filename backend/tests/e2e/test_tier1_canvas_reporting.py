"""Tier 1: Canvas DAG execution, code generation exports, and reporting."""

from __future__ import annotations

from tests.e2e.conftest import upload_test_dataset
from tests.e2e.dataset_factories import make_regression_dataset


def test_canvas_dag_pipeline_execution(e2e_client, e2e_headers):
    """Executes a multi-node Canvas DAG propagating dataset state across nodes."""
    csv_bytes = make_regression_dataset(n_samples=80, seed=401)
    ds = upload_test_dataset(e2e_client, e2e_headers, {"bytes": csv_bytes, "name": "Canvas DS"})
    dataset_id = ds["dataset_id"]

    dag_payload = {
        "nodes": [
            {
                "id": "node_source",
                "type": "dataset",
                "data": {"datasetId": dataset_id, "title": "Raw Data"},
            },
            {
                "id": "node_desc",
                "type": "descriptiveNumeric",
                "data": {"title": "Numeric Summary"},
            },
        ],
        "edges": [
            {"source": "node_source", "target": "node_desc"},
        ],
    }
    res = e2e_client.post(
        "/api/v1/canvas/run_pipeline",
        json=dag_payload,
        headers=e2e_headers,
    )
    assert res.status_code == 200
    dag_res = res.get_json()
    assert dag_res.get("success") is True
    assert dag_res.get("executed", 0) >= 1
    assert "node_desc" in dag_res.get("results", {})


def test_canvas_export_python_r_and_notebook(e2e_client, e2e_headers):
    """Exports Canvas graph to standalone reproducible Python, R, and Jupyter files."""
    canvas_graph = {
        "dataset_name": "survey_data.csv",
        "nodes": [
            {"id": "n1", "type": "dataset", "data": {"title": "Dataset Loader"}},
            {"id": "n2", "type": "descriptiveNumeric", "data": {"title": "Descriptive Analysis"}},
        ],
        "edges": [
            {"source": "n1", "target": "n2"},
        ],
    }

    # 1. Python export
    py_payload = {**canvas_graph, "language": "python"}
    res_py = e2e_client.post("/api/v1/canvas/export_code", json=py_payload, headers=e2e_headers)
    assert res_py.status_code == 200
    py_data = res_py.get_json()
    assert py_data.get("success") is True
    assert "pandas" in py_data.get("code", "")

    # 2. R script export
    r_payload = {**canvas_graph, "language": "r"}
    res_r = e2e_client.post("/api/v1/canvas/export_code", json=r_payload, headers=e2e_headers)
    assert res_r.status_code == 200
    r_data = res_r.get_json()
    assert r_data.get("success") is True
    assert "read_csv" in r_data.get("code", "")

    # 3. Jupyter Notebook export
    nb_payload = {**canvas_graph, "language": "notebook"}
    res_nb = e2e_client.post("/api/v1/canvas/export_code", json=nb_payload, headers=e2e_headers)
    assert res_nb.status_code == 200
    nb_data = res_nb.get_json()
    assert nb_data.get("success") is True
    assert "cells" in nb_data.get("notebook_json", {})


def test_canvas_share_and_retrieve_snapshot(e2e_client, e2e_headers):
    """Publishes a public read-only workflow snapshot and verifies unauthenticated retrieval."""
    share_payload = {
        "nodes": [{"id": "n1", "type": "dataset", "data": {"label": "Shared Ingestion"}}],
        "edges": [],
        "metadata": {"title": "Public Audit Pipeline", "author": "Analyst"},
    }
    res_share = e2e_client.post("/api/v1/canvas/share", json=share_payload, headers=e2e_headers)
    assert res_share.status_code == 200
    share_info = res_share.get_json()
    assert share_info.get("success") is True
    share_id = share_info["share_id"]

    # Public read without auth token
    res_get = e2e_client.get(f"/api/v1/canvas/share/{share_id}")
    assert res_get.status_code == 200
    get_data = res_get.get_json()
    assert get_data.get("success") is True
    assert get_data.get("data", {}).get("metadata", {}).get("title") == "Public Audit Pipeline"


def test_reports_pdf_excel_and_json(e2e_client, e2e_headers):
    """Generates PDF, Excel, and JSON reports from ingested dataset."""
    csv_bytes = make_regression_dataset(n_samples=80, seed=402)
    ds = upload_test_dataset(e2e_client, e2e_headers, {"bytes": csv_bytes, "name": "Report DS"})
    dataset_id = ds["dataset_id"]

    # Compute analysis first so report has data to format
    e2e_client.post(f"/api/v1/datasets/{dataset_id}/analysis", json={}, headers=e2e_headers)

    # 1. Executive PDF report
    pdf_payload = {"title": "Executive Summary", "organization": "Openstats Enterprise"}
    res_pdf = e2e_client.post(
        f"/api/v1/datasets/{dataset_id}/report",
        json=pdf_payload,
        headers=e2e_headers,
    )
    assert res_pdf.status_code == 200
    assert res_pdf.mimetype == "application/pdf"
    assert res_pdf.data.startswith(b"%PDF")

    # 2. Excel export
    res_excel = e2e_client.post(
        f"/api/v1/datasets/{dataset_id}/export/excel",
        json={"title": "Excel Audit"},
        headers=e2e_headers,
    )
    assert res_excel.status_code == 200
    assert len(res_excel.data) > 0

    # 3. JSON export
    res_json = e2e_client.post(
        f"/api/v1/datasets/{dataset_id}/export/json",
        json={"title": "JSON Audit"},
        headers=e2e_headers,
    )
    assert res_json.status_code == 200
    assert len(res_json.data) > 0


def test_health_check_endpoint(e2e_client):
    """Verifies that the core health endpoint returns 200 OK without auth."""
    res = e2e_client.get("/health")
    assert res.status_code == 200
    payload = res.get_json()
    assert payload.get("status") == "ok"
    assert "version" in payload
