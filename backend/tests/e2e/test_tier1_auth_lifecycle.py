"""Tier 1: Authentication enforcement, client isolation, and dataset lifecycle tests."""

from __future__ import annotations

import io
from tests.e2e.conftest import upload_test_dataset
from tests.e2e.dataset_factories import make_regression_dataset


def test_auth_token_rejected_when_missing(e2e_client):
    """Endpoints under /api/v1 must reject unauthenticated requests with 401."""
    res = e2e_client.get("/api/v1/datasets")
    assert res.status_code == 401
    body = res.get_json()
    assert body.get("code") == "invalid_session_token"


def test_auth_token_rejected_when_invalid(e2e_client):
    """Endpoints under /api/v1 must reject forged or mismatched session tokens."""
    bad_headers = {
        "X-Session-Token": "completely-invalid-token-value",
        "X-Client-Id": "client01",
    }
    res = e2e_client.get("/api/v1/datasets", headers=bad_headers)
    assert res.status_code == 401
    assert res.get_json().get("code") == "invalid_session_token"


def test_auth_health_check_public(e2e_client):
    """Health check route /health must always be accessible without session tokens."""
    res = e2e_client.get("/health")
    assert res.status_code == 200
    payload = res.get_json()
    assert payload.get("status") == "ok"
    assert "version" in payload


def test_client_workspace_isolation(e2e_client, e2e_headers, e2e_headers_c2):
    """Datasets uploaded by client01 must not leak into client02's workspace."""
    csv_bytes = make_regression_dataset(n_samples=50, seed=101)

    ds1 = upload_test_dataset(
        e2e_client,
        e2e_headers,
        {"bytes": csv_bytes, "filename": "ds1.csv", "name": "Client1 Dataset"},
    )
    ds2 = upload_test_dataset(
        e2e_client,
        e2e_headers_c2,
        {"bytes": csv_bytes, "filename": "ds2.csv", "name": "Client2 Dataset"},
    )

    list1 = e2e_client.get("/api/v1/datasets", headers=e2e_headers).get_json()["datasets"]
    list2 = e2e_client.get("/api/v1/datasets", headers=e2e_headers_c2).get_json()["datasets"]

    ids1 = [d["id"] for d in list1]
    ids2 = [d["id"] for d in list2]

    assert ds1["dataset_id"] in ids1
    assert ds1["dataset_id"] not in ids2
    assert ds2["dataset_id"] in ids2
    assert ds2["dataset_id"] not in ids1


def test_upload_magic_bytes_forgery_rejected(e2e_client, e2e_headers):
    """Files with forged extensions not matching file signatures must return 400."""
    fake_parquet = b"THIS_IS_PLAIN_TEXT_NOT_PARQUET_MAGIC_BYTES"
    form_data = {
        "file": (io.BytesIO(fake_parquet), "forged.parquet"),
        "name": "Forged Dataset",
    }
    res = e2e_client.post(
        "/api/v1/datasets/upload",
        data=form_data,
        headers=e2e_headers,
        content_type="multipart/form-data",
    )
    assert res.status_code == 400
    assert "invalide" in res.get_json().get("error", "").lower()


def test_upload_parquet_format_accepted(e2e_client, e2e_headers):
    """Valid Parquet binary payloads must be successfully ingested."""
    parquet_bytes = make_regression_dataset(n_samples=60, seed=102, as_format="parquet")
    res = upload_test_dataset(
        e2e_client,
        e2e_headers,
        {"bytes": parquet_bytes, "filename": "valid.parquet", "name": "Valid Parquet"},
    )
    assert "dataset_id" in res
    assert res["name"] == "Valid Parquet"
    assert "profile" in res


def test_dataset_metadata_and_preview(e2e_client, e2e_headers):
    """Metadata inspection and preview endpoints must return schema and rows."""
    csv_bytes = make_regression_dataset(n_samples=80, seed=103)
    created = upload_test_dataset(
        e2e_client,
        e2e_headers,
        {"bytes": csv_bytes, "name": "Metadata Preview DS"},
    )
    dataset_id = created["dataset_id"]

    res_meta = e2e_client.get(f"/api/v1/datasets/{dataset_id}", headers=e2e_headers)
    assert res_meta.status_code == 200
    meta = res_meta.get_json()
    assert meta["id"] == dataset_id
    assert meta["shape"]["rows"] == 80
    assert meta["shape"]["columns"] == 5

    res_prev = e2e_client.get(f"/api/v1/datasets/{dataset_id}/preview?n=15", headers=e2e_headers)
    assert res_prev.status_code == 200
    prev = res_prev.get_json()
    assert len(prev["data"]) == 15
    assert "x1" in prev["columns"]
    assert prev["total_rows"] == 80


def test_column_type_update_and_dataset_copy(e2e_client, e2e_headers):
    """Column semantic types can be overridden and datasets cloned."""
    csv_bytes = make_regression_dataset(n_samples=50, seed=104)
    ds = upload_test_dataset(e2e_client, e2e_headers, {"bytes": csv_bytes, "name": "Copy Base"})
    dataset_id = ds["dataset_id"]

    type_update = {"column": "x1", "new_type": "continu"}
    res_type = e2e_client.put(
        f"/api/v1/datasets/{dataset_id}/column-type",
        json=type_update,
        headers=e2e_headers,
    )
    assert res_type.status_code == 200

    copy_payload = {"new_name": "Cloned Copy Dataset"}
    res_copy = e2e_client.post(
        f"/api/v1/datasets/{dataset_id}/copy",
        json=copy_payload,
        headers=e2e_headers,
    )
    assert res_copy.status_code == 201
    copy_payload_res = res_copy.get_json()
    copy_ds = copy_payload_res["dataset"]
    assert copy_ds["name"] == "Cloned Copy Dataset"
    assert copy_ds["id"] != dataset_id


def test_dataset_versions_audit_and_delete(e2e_client, e2e_headers):
    """Full lifecycle: audit tracking, version inspection, and deletion."""
    csv_bytes = make_regression_dataset(n_samples=50, seed=105)
    ds = upload_test_dataset(e2e_client, e2e_headers, {"bytes": csv_bytes, "name": "Lifecycle DS"})
    dataset_id = ds["dataset_id"]

    res_ver = e2e_client.get(f"/api/v1/datasets/{dataset_id}/versions", headers=e2e_headers)
    assert res_ver.status_code == 200
    versions = res_ver.get_json()
    assert len(versions) >= 2  # raw (v1) and cleaned (v2)

    res_audit = e2e_client.get(f"/api/v1/datasets/{dataset_id}/audit", headers=e2e_headers)
    assert res_audit.status_code == 200
    audit_logs = res_audit.get_json()
    assert any(log.get("action") == "upload" for log in audit_logs)

    res_del = e2e_client.delete(f"/api/v1/datasets/{dataset_id}", headers=e2e_headers)
    assert res_del.status_code == 200

    res_missing = e2e_client.get(f"/api/v1/datasets/{dataset_id}", headers=e2e_headers)
    assert res_missing.status_code == 404
