"""Opaque-box E2E test configuration and shared fixtures for Openstats."""

from __future__ import annotations

import io
import os
from pathlib import Path
import pytest

os.environ["OPENSTATS_PRELOAD"] = "0"
os.environ["LOCAL_DEV_MODE"] = "false"
os.environ["FLASK_ENV"] = "testing"

from app.config import Config
from app import create_app
from app.extensions import db
from app.services.storage_service import storage

E2E_SESSION_TOKEN = "e2e-session-token-secret-64-hex"


class E2EConfig(Config):
    """Isolated environment configuration for opaque-box E2E tests."""
    TESTING = False
    LOCAL_DEV_MODE = False
    SECRET_KEY = "e2e-secret-key-32-chars-strictly"


@pytest.fixture(scope="session")
def e2e_token() -> str:
    """Canonical session token for E2E tests."""
    return E2E_SESSION_TOKEN


@pytest.fixture
def e2e_headers(e2e_token: str) -> dict[str, str]:
    """Default authorized request headers for client 01."""
    return {
        "X-Session-Token": e2e_token,
        "X-Client-Id": "client01",
    }


@pytest.fixture
def e2e_headers_c2(e2e_token: str) -> dict[str, str]:
    """Authorized request headers for isolated client 02."""
    return {
        "X-Session-Token": e2e_token,
        "X-Client-Id": "client02",
    }


@pytest.fixture
def e2e_app(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """Creates a hermetic test app backed by temporary SQLite file and dirs."""
    monkeypatch.setenv("OPENSTATS_SESSION_TOKEN", E2E_SESSION_TOKEN)
    monkeypatch.setenv("OPENSTATS_PRELOAD", "0")

    db_path = tmp_path / "e2e_test.db"
    upload_path = tmp_path / "uploads"
    data_path = tmp_path / "data"
    reports_path = tmp_path / "reports"

    upload_path.mkdir(parents=True, exist_ok=True)
    data_path.mkdir(parents=True, exist_ok=True)
    reports_path.mkdir(parents=True, exist_ok=True)

    E2EConfig.SQLALCHEMY_DATABASE_URI = f"sqlite:///{db_path}"
    E2EConfig.UPLOAD_FOLDER = str(upload_path)
    E2EConfig.DATA_DIR = str(data_path)
    E2EConfig.REPORTS_DIR = str(reports_path)

    storage.data_dir = data_path
    storage.datasets_dir = data_path / "datasets"
    storage.datasets_dir.mkdir(parents=True, exist_ok=True)
    storage.clear_cache()

    app_instance = create_app(E2EConfig)

    with app_instance.app_context():
        db.create_all()
        yield app_instance
        db.session.remove()
        db.drop_all()
        storage.clear_cache()


@pytest.fixture
def e2e_client(e2e_app):
    """Opaque-box HTTP test client."""
    return e2e_app.test_client()


def upload_test_dataset(client, headers: dict[str, str], payload: dict) -> dict:
    """Helper to upload a dataset and return parsed JSON response dict.

    payload must contain:
        - 'bytes': bytes of file
        - optional 'filename': str (default 'dataset.csv')
        - optional 'name': str (default 'Test Dataset')
    """
    file_bytes = payload["bytes"]
    filename = payload.get("filename", "dataset.csv")
    name = payload.get("name", "Test Dataset")

    form_data = {
        "file": (io.BytesIO(file_bytes), filename),
        "name": name,
    }
    res = client.post(
        "/api/v1/datasets/upload",
        data=form_data,
        headers=headers,
        content_type="multipart/form-data",
    )
    if res.status_code != 201:
        raise RuntimeError(f"Upload failed: {res.status_code}, {res.get_data(as_text=True)}")
    return res.get_json()
