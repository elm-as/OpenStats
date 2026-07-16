import os
import pytest
from flask import Flask
from app import create_app
from app.extensions import db
from app.models.user import User

@pytest.fixture
def app():
    """Crée et configure une nouvelle instance de l'application pour chaque test."""
    os.environ["DATABASE_URL"] = "sqlite:///:memory:?cache=shared"
    os.environ["LOCAL_DEV_MODE"] = "false"
    os.environ["FLASK_ENV"] = "testing"
    os.environ["SECRET_KEY"] = "test-secret-key"
    
    app = create_app()
    
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()

@pytest.fixture
def client(app):
    """Un client de test pour l'application."""
    return app.test_client()

@pytest.fixture
def runner(app):
    """Un runner de test pour les commandes CLI de l'application."""
    return app.test_cli_runner()

@pytest.fixture
def test_user(app):
    """Crée un utilisateur de test dans la base de données."""
    user = User(
        id="test-user-id",
        email="test@openstats.ai",
        display_name="Test User",
        role="user",
        is_active=True
    )
    db.session.add(user)
    db.session.commit()
    return user
