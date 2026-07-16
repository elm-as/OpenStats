"""
Tests API pour les routes /workspaces.
Couvre : list, create, get, update, delete, add/remove member.
"""

import pytest
import os
from app.models.workspace import Workspace, WorkspaceMember
from app.models.user import User
from app.extensions import db
from tests.api.test_auth import create_valid_token


# ── Fixtures ──────────────────────────────────────────────────

pytestmark = pytest.mark.skipif(
    os.getenv("AUTH_ENABLED", "false").lower() != "true",
    reason="Tests workspaces désactivés en mode open-source local",
)

@pytest.fixture
def auth_headers():
    return {"Authorization": f"Bearer {create_valid_token()}"}


@pytest.fixture
def seeded_workspace(app, test_user):
    """Crée un workspace appartenant à test_user."""
    ws = Workspace(
        name="Mon Workspace",
        description="Description test",
        owner_id=test_user.id,
    )
    db.session.add(ws)
    db.session.flush()
    db.session.add(WorkspaceMember(
        workspace_id=ws.id,
        user_id=test_user.id,
        role="owner",
    ))
    db.session.commit()
    return ws


@pytest.fixture
def second_user(app):
    """Crée un second utilisateur pour tester l'ajout de membres."""
    user = User(
        id="second-usr",
        email="second@openstats.ai",
        display_name="Second User",
        role="user",
        is_active=True,
    )
    db.session.add(user)
    db.session.commit()
    return user


# ── GET /workspaces ───────────────────────────────────────────

def test_list_workspaces_empty(client, test_user, auth_headers):
    """Retourne une liste vide quand l'utilisateur n'a aucun workspace."""
    response = client.get("/api/v1/workspaces", headers=auth_headers)
    assert response.status_code == 200
    assert response.get_json()["workspaces"] == []


def test_list_workspaces_shows_owned(client, test_user, seeded_workspace, auth_headers):
    """Retourne le workspace dont l'utilisateur est propriétaire."""
    response = client.get("/api/v1/workspaces", headers=auth_headers)
    assert response.status_code == 200
    workspaces = response.get_json()["workspaces"]
    assert len(workspaces) == 1
    assert workspaces[0]["name"] == "Mon Workspace"


# ── POST /workspaces ──────────────────────────────────────────

def test_create_workspace_success(client, test_user, auth_headers):
    """Crée un workspace et retourne 201 avec les données."""
    response = client.post(
        "/api/v1/workspaces",
        json={"name": "Nouveau WS", "description": "Test desc"},
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.get_json()
    assert data["name"] == "Nouveau WS"
    assert "id" in data


def test_create_workspace_missing_name(client, test_user, auth_headers):
    """Retourne 400 si le nom est absent."""
    response = client.post(
        "/api/v1/workspaces",
        json={"description": "Pas de nom"},
        headers=auth_headers,
    )
    assert response.status_code == 400
    assert "error" in response.get_json()


def test_create_workspace_empty_name(client, test_user, auth_headers):
    """Retourne 400 si le nom est une chaîne vide."""
    response = client.post(
        "/api/v1/workspaces",
        json={"name": "   "},
        headers=auth_headers,
    )
    assert response.status_code == 400


# ── GET /workspaces/<id> ──────────────────────────────────────

def test_get_workspace_found(client, test_user, seeded_workspace, auth_headers):
    """Retourne le workspace avec ses membres."""
    response = client.get(
        f"/api/v1/workspaces/{seeded_workspace.id}", headers=auth_headers
    )
    assert response.status_code == 200
    data = response.get_json()
    assert data["id"] == seeded_workspace.id
    assert "members" in data
    assert len(data["members"]) == 1


def test_get_workspace_not_found(client, test_user, auth_headers):
    """Retourne 404 pour un ID inexistant."""
    response = client.get("/api/v1/workspaces/xxxxxxxx", headers=auth_headers)
    assert response.status_code == 404


def test_get_workspace_unauthorized(client, test_user, app, auth_headers):
    """Retourne 404 (accès refusé) pour un workspace qui n'appartient pas à l'utilisateur."""
    # Crée un autre utilisateur et son workspace
    other_user = User(id="other-usr", email="other@test.ai", display_name="Other", role="user", is_active=True)
    db.session.add(other_user)
    db.session.flush()
    other_ws = Workspace(name="Private WS", owner_id=other_user.id)
    db.session.add(other_ws)
    db.session.commit()

    response = client.get(f"/api/v1/workspaces/{other_ws.id}", headers=auth_headers)
    assert response.status_code == 404


# ── PUT /workspaces/<id> ──────────────────────────────────────

def test_update_workspace_name(client, test_user, seeded_workspace, auth_headers):
    """Met à jour le nom du workspace."""
    response = client.put(
        f"/api/v1/workspaces/{seeded_workspace.id}",
        json={"name": "Nouveau Nom"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.get_json()["name"] == "Nouveau Nom"


def test_update_workspace_not_found(client, test_user, auth_headers):
    """Retourne 404 pour un workspace inexistant."""
    response = client.put(
        "/api/v1/workspaces/xxxxxxxx",
        json={"name": "X"},
        headers=auth_headers,
    )
    assert response.status_code == 404


# ── DELETE /workspaces/<id> ───────────────────────────────────

def test_delete_workspace_success(client, test_user, seeded_workspace, auth_headers):
    """Supprime un workspace et retourne un message de confirmation."""
    response = client.delete(
        f"/api/v1/workspaces/{seeded_workspace.id}", headers=auth_headers
    )
    assert response.status_code == 200
    data = response.get_json()
    assert data["workspace_id"] == seeded_workspace.id
    assert db.session.get(Workspace, seeded_workspace.id) is None


def test_delete_workspace_not_found(client, test_user, auth_headers):
    """Retourne 404 pour un workspace inexistant."""
    response = client.delete("/api/v1/workspaces/xxxxxxxx", headers=auth_headers)
    assert response.status_code == 404


# ── POST /workspaces/<id>/members ─────────────────────────────

def test_add_member_success(client, test_user, seeded_workspace, second_user, auth_headers):
    """Ajoute un membre au workspace."""
    response = client.post(
        f"/api/v1/workspaces/{seeded_workspace.id}/members",
        json={"email": second_user.email, "role": "viewer"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.get_json()
    assert data["user_id"] == second_user.id
    assert data["role"] == "viewer"


def test_add_member_invalid_role(client, test_user, seeded_workspace, second_user, auth_headers):
    """Retourne 400 pour un rôle invalide."""
    response = client.post(
        f"/api/v1/workspaces/{seeded_workspace.id}/members",
        json={"email": second_user.email, "role": "superadmin"},
        headers=auth_headers,
    )
    assert response.status_code == 400


def test_add_member_user_not_found(client, test_user, seeded_workspace, auth_headers):
    """Retourne 404 si l'email n'existe pas."""
    response = client.post(
        f"/api/v1/workspaces/{seeded_workspace.id}/members",
        json={"email": "nobody@nowhere.com", "role": "viewer"},
        headers=auth_headers,
    )
    assert response.status_code == 404


def test_update_existing_member_role(client, test_user, seeded_workspace, second_user, auth_headers):
    """Met à jour le rôle d'un membre déjà présent."""
    # Ajouter le membre d'abord
    db.session.add(WorkspaceMember(
        workspace_id=seeded_workspace.id, user_id=second_user.id, role="viewer"
    ))
    db.session.commit()

    response = client.post(
        f"/api/v1/workspaces/{seeded_workspace.id}/members",
        json={"email": second_user.email, "role": "editor"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.get_json()["role"] == "editor"


# ── DELETE /workspaces/<id>/members/<user_id> ─────────────────

def test_remove_member_success(client, test_user, seeded_workspace, second_user, auth_headers):
    """Retire un membre du workspace."""
    db.session.add(WorkspaceMember(
        workspace_id=seeded_workspace.id, user_id=second_user.id, role="viewer"
    ))
    db.session.commit()

    response = client.delete(
        f"/api/v1/workspaces/{seeded_workspace.id}/members/{second_user.id}",
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.get_json()["message"] == "Membre retiré"


def test_cannot_remove_owner(client, test_user, seeded_workspace, auth_headers):
    """Retourne 400 si on tente de retirer le propriétaire."""
    response = client.delete(
        f"/api/v1/workspaces/{seeded_workspace.id}/members/{test_user.id}",
        headers=auth_headers,
    )
    assert response.status_code == 400
    assert "propriétaire" in response.get_json()["error"]


def test_remove_member_not_found(client, test_user, seeded_workspace, auth_headers):
    """Retourne 404 si le membre n'existe pas dans ce workspace."""
    response = client.delete(
        f"/api/v1/workspaces/{seeded_workspace.id}/members/nonexist",
        headers=auth_headers,
    )
    assert response.status_code == 404
