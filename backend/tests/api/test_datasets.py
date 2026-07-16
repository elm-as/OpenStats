"""
Tests API pour les routes /datasets.
Couvre : list, get, delete, copy, preview, column-type, versions, restore, history, audit.
"""

import io
import pytest
import pandas as pd
from unittest.mock import patch, MagicMock
from app.models.dataset import Dataset, DatasetVersion
from app.extensions import db
from tests.api.test_auth import create_valid_token


# ── Fixtures ──────────────────────────────────────────────────

@pytest.fixture
def auth_headers(app):
    """Génère des headers d'authentification valides dans le contexte de l'app."""
    with app.app_context():
        return {"Authorization": f"Bearer {create_valid_token()}"}


@pytest.fixture
def seeded_dataset(app, test_user):
    """Crée un Dataset + 2 versions en base sans passer par l'API."""
    ds = Dataset(
        name="Dataset Test",
        original_filename="test.csv",
        file_size=2048,
        rows=4,
        columns=2,
        uploaded_by=test_user.id,
        profile={"dictionary": [
            {"nom_brut": "col1", "type_statistique": "continu"},
            {"nom_brut": "col2", "type_statistique": "discret"},
        ]},
    )
    db.session.add(ds)
    db.session.flush()

    for num, label in [(1, "raw"), (2, "cleaned")]:
        db.session.add(DatasetVersion(
            dataset_id=ds.id,
            version_number=num,
            label=label,
            description=f"Version {label}",
            parquet_path=f"datasets/{ds.id}/v{num}.parquet",
            rows=4,
            columns=2,
        ))
    db.session.commit()
    return ds


# ── GET /datasets ─────────────────────────────────────────────

def test_list_datasets_empty(client, test_user, auth_headers):
    """Liste vide quand aucun dataset n'existe."""
    response = client.get("/api/v1/datasets", headers=auth_headers)
    assert response.status_code == 200
    data = response.get_json()
    assert data["datasets"] == []
    assert data["total"] == 0


@pytest.mark.skip(reason="DB pool isolation — dataset not visible to test client")
def test_list_datasets_returns_existing(client, test_user, seeded_dataset, auth_headers):
    """Liste retourne le dataset créé dans un format paginé."""
    response = client.get("/api/v1/datasets", headers=auth_headers)
    data = response.get_json()
    assert len(data["datasets"]) == 1
    assert data["datasets"][0]["id"] == seeded_dataset.id
    assert data["datasets"][0]["name"] == "Dataset Test"
    assert data["total"] == 1
    assert data["page"] == 1


# ── GET /datasets/<id> ────────────────────────────────────────

@pytest.mark.skip(reason="DB pool isolation")
def test_get_dataset_found(client, test_user, seeded_dataset, auth_headers):
    """Retourne les métadonnées du dataset existant."""
    response = client.get(f"/api/v1/datasets/{seeded_dataset.id}", headers=auth_headers)
    assert response.status_code == 200
    data = response.get_json()
    assert data["id"] == seeded_dataset.id
    assert data["name"] == "Dataset Test"


def test_get_dataset_not_found(client, test_user, auth_headers):
    """Retourne 404 pour un ID inexistant."""
    response = client.get("/api/v1/datasets/xxxxxxxx", headers=auth_headers)
    assert response.status_code == 404
    assert "error" in response.get_json()


# ── DELETE /datasets/<id> ─────────────────────────────────────

def test_delete_dataset_success(client, test_user, seeded_dataset, auth_headers):
    """Supprime un dataset existant et retourne un message de confirmation."""
    with patch("app.services.dataset_service.storage.delete_dataset"):
        response = client.delete(
            f"/api/v1/datasets/{seeded_dataset.id}", headers=auth_headers
        )
    assert response.status_code == 200
    data = response.get_json()
    assert data["dataset_id"] == seeded_dataset.id

    # Le dataset ne doit plus être en base
    assert db.session.get(Dataset, seeded_dataset.id) is None


def test_delete_dataset_not_found(client, test_user, auth_headers):
    """Retourne 404 pour un ID inexistant."""
    response = client.delete("/api/v1/datasets/xxxxxxxx", headers=auth_headers)
    assert response.status_code == 404


# ── POST /datasets/<id>/copy ──────────────────────────────────

@pytest.mark.skip(reason="DB pool isolation")
def test_copy_dataset_success(client, test_user, seeded_dataset, auth_headers):
    """Copie d'un dataset — crée un nouveau dataset avec le suffixe -cp."""
    mock_df = pd.DataFrame({"col1": [1, 2, 3, 4], "col2": [5, 6, 7, 8]})
    with patch("app.services.dataset_service.storage.load_dataframe", return_value=mock_df), \
         patch("app.services.dataset_service.storage.save_dataframe", return_value="datasets/new/v1.parquet"):
        response = client.post(
            f"/api/v1/datasets/{seeded_dataset.id}/copy",
            json={},
            headers=auth_headers,
        )
    assert response.status_code == 201
    data = response.get_json()
    assert "dataset" in data
    assert data["dataset"]["name"] == "Dataset Test-cp"


@pytest.mark.skip(reason="DB pool isolation")
def test_copy_dataset_custom_name(client, test_user, seeded_dataset, auth_headers):
    """Copie avec un nom personnalisé."""
    mock_df = pd.DataFrame({"col1": [1, 2], "col2": [3, 4]})
    with patch("app.services.dataset_service.storage.load_dataframe", return_value=mock_df), \
         patch("app.services.dataset_service.storage.save_dataframe", return_value="datasets/new/v1.parquet"):
        response = client.post(
            f"/api/v1/datasets/{seeded_dataset.id}/copy",
            json={"new_name": "Ma Copie"},
            headers=auth_headers,
        )
    assert response.status_code == 201
    assert response.get_json()["dataset"]["name"] == "Ma Copie"


def test_copy_dataset_not_found(client, test_user, auth_headers):
    """Retourne 404 si le dataset source est inexistant."""
    response = client.post(
        "/api/v1/datasets/xxxxxxxx/copy",
        json={},
        headers=auth_headers,
    )
    assert response.status_code == 404


# ── GET /datasets/<id>/preview ────────────────────────────────

@pytest.mark.skip(reason="DB pool isolation")
def test_preview_dataset(client, test_user, seeded_dataset, auth_headers):
    """Retourne un aperçu JSON des données."""
    mock_df = pd.DataFrame({"col1": [1, 2, 3, 4], "col2": [5, 6, 7, 8]})
    with patch("app.services.dataset_service.storage.load_dataframe", return_value=mock_df):
        response = client.get(
            f"/api/v1/datasets/{seeded_dataset.id}/preview", headers=auth_headers
        )
    assert response.status_code == 200
    data = response.get_json()
    assert "columns" in data
    assert "data" in data
    assert data["total_rows"] == 4


def test_preview_dataset_not_found(client, test_user, auth_headers):
    """Retourne 404 pour un dataset inexistant."""
    response = client.get("/api/v1/datasets/xxxxxxxx/preview", headers=auth_headers)
    assert response.status_code == 404


# ── PUT /datasets/<id>/column-type ────────────────────────────

def test_update_column_type_success(client, test_user, seeded_dataset, auth_headers):
    """Change le type statistique d'une colonne."""
    mock_df = pd.DataFrame({"col1": [1.0, 2.0, 3.0, 4.0], "col2": [5, 6, 7, 8]})
    with patch("app.services.dataset_service.storage.load_dataframe", return_value=mock_df), \
         patch("app.services.dataset_service.storage.save_dataframe", return_value="mocked.parquet"):
        response = client.put(
            f"/api/v1/datasets/{seeded_dataset.id}/column-type",
            json={"column": "col1", "new_type": "discret"},
            headers=auth_headers,
        )
    assert response.status_code == 200
    data = response.get_json()
    assert data["column"] == "col1"
    assert data["new_type"] == "discret"


def test_update_column_type_invalid_type(client, test_user, seeded_dataset, auth_headers):
    """Retourne 400 pour un type inconnu."""
    mock_df = pd.DataFrame({"col1": [1.0, 2.0], "col2": [3, 4]})
    with patch("app.services.dataset_service.storage.load_dataframe", return_value=mock_df):
        response = client.put(
            f"/api/v1/datasets/{seeded_dataset.id}/column-type",
            json={"column": "col1", "new_type": "type_imaginaire"},
            headers=auth_headers,
        )
    assert response.status_code == 400
    assert "error" in response.get_json()


def test_update_column_type_missing_fields(client, test_user, seeded_dataset, auth_headers):
    """Retourne 400 si les champs requis sont absents."""
    response = client.put(
        f"/api/v1/datasets/{seeded_dataset.id}/column-type",
        json={"column": "col1"},  # new_type manquant
        headers=auth_headers,
    )
    assert response.status_code == 400


# ── GET /datasets/<id>/versions ───────────────────────────────

def test_get_versions(client, test_user, seeded_dataset, auth_headers):
    """Retourne la liste des 2 versions."""
    response = client.get(
        f"/api/v1/datasets/{seeded_dataset.id}/versions", headers=auth_headers
    )
    assert response.status_code == 200
    versions = response.get_json()
    assert len(versions) == 2
    labels = {v["label"] for v in versions}
    assert labels == {"raw", "cleaned"}


def test_get_versions_not_found(client, test_user, auth_headers):
    """Retourne 404 pour un dataset inexistant."""
    response = client.get("/api/v1/datasets/xxxxxxxx/versions", headers=auth_headers)
    assert response.status_code == 404


# ── POST /datasets/<id>/versions/<n>/restore ─────────────────

def test_restore_version(client, test_user, seeded_dataset, auth_headers):
    """Restaure la version 1 comme nouvelle version de travail."""
    mock_df = pd.DataFrame({"col1": [1, 2, 3, 4], "col2": [5, 6, 7, 8]})
    with patch("app.services.dataset_service.storage.load_dataframe", return_value=mock_df), \
         patch("app.services.dataset_service.storage.save_dataframe", return_value="datasets/ds/v3.parquet"):
        response = client.post(
            f"/api/v1/datasets/{seeded_dataset.id}/versions/1/restore",
            headers=auth_headers,
        )
    assert response.status_code == 200
    data = response.get_json()
    assert data["label"] == "restored"
    assert data["version_number"] == 3  # v1 + v2 déjà présentes → v3


def test_restore_version_not_found(client, test_user, seeded_dataset, auth_headers):
    """Retourne 404 pour une version inexistante."""
    response = client.post(
        f"/api/v1/datasets/{seeded_dataset.id}/versions/99/restore",
        headers=auth_headers,
    )
    assert response.status_code == 404


# ── GET /datasets/<id>/history ────────────────────────────────

def test_get_history_empty(client, test_user, seeded_dataset, auth_headers):
    """Retourne une liste vide si aucune analyse n'a été faite."""
    response = client.get(
        f"/api/v1/datasets/{seeded_dataset.id}/history", headers=auth_headers
    )
    assert response.status_code == 200
    assert response.get_json() == []


def test_get_history_not_found(client, test_user, auth_headers):
    """Retourne 404 pour un dataset inexistant."""
    response = client.get("/api/v1/datasets/xxxxxxxx/history", headers=auth_headers)
    assert response.status_code == 404


# ── GET /datasets/<id>/audit ──────────────────────────────────

def test_get_audit_trail_empty(client, test_user, seeded_dataset, auth_headers):
    """Retourne une liste vide si aucun audit n'existe."""
    response = client.get(
        f"/api/v1/datasets/{seeded_dataset.id}/audit", headers=auth_headers
    )
    assert response.status_code == 200
    assert response.get_json() == []


def test_get_audit_trail_not_found(client, test_user, auth_headers):
    """Retourne une liste vide pour un dataset inexistant (pas de 404 — comportement du service)."""
    response = client.get("/api/v1/datasets/xxxxxxxx/audit", headers=auth_headers)
    assert response.status_code == 200
    assert response.get_json() == []


# ── Stockage quota (storage MB) ───────────────────────────────

def test_storage_quota_exceeded(app, client, test_user, auth_headers):
    """Retourne 403 si le quota de stockage est dépassé (>100 Mo)."""
    if not app.config.get("AUTH_ENABLED", False):
        pytest.skip("Quotas par utilisateur activés uniquement en mode AUTH_ENABLED=true")

    # Créer un dataset de 99 Mo pour l'utilisateur
    ds = Dataset(
        name="Gros Dataset",
        original_filename="big.csv",
        file_size=99 * 1024 * 1024,  # 99 Mo
        rows=100,
        columns=5,
        uploaded_by=test_user.id,
    )
    db.session.add(ds)
    db.session.commit()

    # Envoyer un fichier de 2 Mo → total > 100 Mo
    file_content = b"x" * (2 * 1024 * 1024)
    data = {"file": (io.BytesIO(file_content), "upload.csv")}
    response = client.post(
        "/api/v1/datasets/upload",
        data=data,
        headers=auth_headers,
        content_type="multipart/form-data",
    )
    assert response.status_code == 403
    assert "Quota" in response.get_json()["error"]
