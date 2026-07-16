import io
import pytest
import os
import pandas as pd
from unittest.mock import patch
from app.services.dataset_service import DatasetManager
from app.models.dataset import Dataset
from app.extensions import db

@pytest.fixture
def mock_storage():
    """Mock le service de stockage pour éviter d'écrire sur le disque."""
    with patch("app.services.dataset_service.storage") as mock_storage:
        mock_storage.save_dataframe.return_value = "mocked_path.parquet"
        mock_storage.load_dataframe.return_value = pd.DataFrame({"col1": [1, 2], "col2": [3, 4]})
        yield mock_storage

@pytest.fixture
def mock_ingest_file():
    """Mock la fonction ingest_file."""
    with patch("app.services.dataset_service.ingest_file") as mock_ingest:
        mock_ingest.return_value = pd.DataFrame({"col1": [1, 2], "col2": [3, 4]})
        yield mock_ingest

def test_ingest_creates_dataset(app, test_user, mock_storage, mock_ingest_file):
    """Vérifie que l'ingestion crée bien un dataset et ses versions."""
    manager = DatasetManager()
    mock_profile = {"columns": {}, "rows": 2}

    # Simuler la taille du fichier et le profilage (évite de dépendre du vrai profiler)
    with patch("os.path.getsize", return_value=1024), \
         patch("app.services.dataset_service.profile_dataframe", return_value=mock_profile):
        dataset_id = manager.ingest("dummy_path.csv", name="Test Dataset", uploaded_by=test_user.id)
        
    ds = db.session.get(Dataset, dataset_id)
    assert ds is not None
    assert ds.name == "Test Dataset"
    assert ds.uploaded_by == test_user.id
    assert len(ds.versions) == 2  # raw + cleaned

def test_quota_limits(client, test_user, mock_storage, mock_ingest_file):
    """Vérifie que le quota de 10 datasets maximum est respecté (SaaS only)."""
    if not os.getenv("AUTH_ENABLED", "").lower() == "true":
        pytest.skip("Test quota SaaS — mode local sans limites par utilisateur")
    # Créer 10 datasets pour cet utilisateur
    for i in range(10):
        ds = Dataset(
            name=f"Dataset {i}",
            original_filename="test.csv",
            file_size=1024,
            rows=2,
            columns=2,
            uploaded_by=test_user.id
        )
        db.session.add(ds)
    db.session.commit()
    
    # Tenter d'uploader un 11ème dataset via l'API
    from tests.api.test_auth import create_valid_token
    token = create_valid_token()
    
    # Nous simulons une requête multipart
    data = {
        'file': (io.BytesIO(b"dummy content"), 'test.csv')
    }
    response = client.post(
        "/api/v1/datasets/upload", 
        data=data,
        headers={"Authorization": f"Bearer {token}"},
        content_type="multipart/form-data"
    )
    
    assert response.status_code == 403
    assert "Quota atteint" in response.get_json()["error"]
