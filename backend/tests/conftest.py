import os

# Définir explicitement l'environnement de test avant tout import
os.environ["DATABASE_URL"] = "sqlite:///:memory:?cache=shared"
os.environ["LOCAL_DEV_MODE"] = "false"
os.environ["FLASK_ENV"] = "testing"
os.environ["SECRET_KEY"] = "test-secret-key"

import pytest
from app.config import Config


class TestConfig(Config):
    """Configuration de test totalement isolée en mémoire."""
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:?cache=shared"
    TESTING = True
    LOCAL_DEV_MODE = False
    SECRET_KEY = "test-secret-key"


from app import create_app
from app.extensions import db
from app.models.user import User


@pytest.fixture
def app():
    """Crée et configure une nouvelle instance de test en mémoire."""
    app_instance = create_app(TestConfig)

    with app_instance.app_context():
        from app.models.dataset import Dataset
        db.create_all()
        db.session.query(Dataset).delete()
        db.session.commit()
        yield app_instance
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    """Client HTTP de test."""
    return app.test_client()


@pytest.fixture
def runner(app):
    """Runner CLI de test."""
    return app.test_cli_runner()


@pytest.fixture
def test_user(app):
    """Utilisateur de test en mémoire."""
    user = User(
        id="test-user-id",
        email="test@openstats.ai",
        display_name="Test User",
        role="user",
        is_active=True,
    )
    db.session.add(user)
    db.session.commit()
    return user
