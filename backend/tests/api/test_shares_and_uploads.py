"""
Tests API de persistance des liens de partage canvas et de sécurité des uploads (Parquet + collisions).
"""

import io
import os
import pandas as pd
import app.api.v1.ingestion as ingestion_api
from app.config import Config
from app.core.ingestion import validate_file_magic


def test_canvas_share_uses_configured_data_dir(client, app, tmp_path, monkeypatch):
    """Vérifie que /canvas/share écrit dans DATA_DIR et non dans os.getcwd()/data."""
    data_dir = tmp_path / "persistent_data"
    fake_cwd = tmp_path / "unrelated_cwd"
    fake_cwd.mkdir()

    app.config["DATA_DIR"] = str(data_dir)
    monkeypatch.chdir(fake_cwd)

    res_create = client.post("/api/v1/canvas/share", json={"nodes": [{"id": "n1"}], "edges": []})
    assert res_create.status_code == 200
    payload = res_create.get_json()
    assert payload["success"] is True
    share_id = payload["share_id"]

    assert (data_dir / "shares" / f"{share_id}.json").exists()
    assert not (fake_cwd / "data" / "shares").exists()

    res_get = client.get(f"/api/v1/canvas/share/{share_id}")
    assert res_get.status_code == 200
    assert res_get.get_json()["data"]["nodes"] == [{"id": "n1"}]


def test_parquet_extension_enabled_and_magic_checked(tmp_path):
    """Vérifie que .parquet est autorisé par la config et validé par magic bytes PAR1."""
    assert "parquet" in Config.ALLOWED_EXTENSIONS

    valid_path = tmp_path / "sample.parquet"
    pd.DataFrame({"a": [1, 2], "b": ["x", "y"]}).to_parquet(valid_path, index=False)
    assert validate_file_magic(str(valid_path), Config.ALLOWED_EXTENSIONS) is True

    forged_path = tmp_path / "forged.parquet"
    forged_path.write_bytes(b"NOT_PARQUET_BYTES")
    assert validate_file_magic(str(forged_path), Config.ALLOWED_EXTENSIONS) is False


def test_upload_same_filename_uses_distinct_paths(client, app, tmp_path, monkeypatch):
    """Vérifie que deux uploads avec le même nom ne s'écrasent pas dans UPLOAD_FOLDER."""
    upload_dir = tmp_path / "uploads"
    app.config["UPLOAD_FOLDER"] = str(upload_dir)

    seen_paths: list[str] = []

    def fake_ingest(filepath: str, **kwargs):
        seen_paths.append(filepath)
        return f"ds_{len(seen_paths)}"

    monkeypatch.setattr(ingestion_api.dataset_manager, "ingest", fake_ingest)
    monkeypatch.setattr(
        ingestion_api.dataset_manager,
        "get",
        lambda ds_id: {"name": "sample.parquet", "profile": {}},
    )

    parquet_buf = io.BytesIO()
    pd.DataFrame({"val": [10, 20]}).to_parquet(parquet_buf, index=False)
    parquet_bytes = parquet_buf.getvalue()

    headers = {"X-Client-Id": "ab12cd34"}
    r1 = client.post(
        "/api/v1/datasets/upload",
        headers=headers,
        data={"file": (io.BytesIO(parquet_bytes), "sample.parquet")},
        content_type="multipart/form-data",
    )
    r2 = client.post(
        "/api/v1/datasets/upload",
        headers=headers,
        data={"file": (io.BytesIO(parquet_bytes), "sample.parquet")},
        content_type="multipart/form-data",
    )

    assert r1.status_code == 201
    assert r2.status_code == 201
    assert len(seen_paths) == 2
    assert seen_paths[0] != seen_paths[1]
    assert os.path.basename(seen_paths[0]).endswith("_sample.parquet")
    assert os.path.basename(seen_paths[1]).endswith("_sample.parquet")
