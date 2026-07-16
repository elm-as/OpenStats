"""Routes API pour les espaces de travail."""

from flask import request, jsonify, g

from app.api.v1 import api_v1_bp
from app.extensions import db
from app.models.workspace import Workspace, WorkspaceMember
from app.models.user import User
from app.core.auth import login_required


@api_v1_bp.route("/workspaces", methods=["GET"])
@login_required
def list_workspaces():
    """Liste les workspaces dont l'utilisateur est membre."""
    user = g.current_user

    # Workspaces dont l'utilisateur est propriétaire ou membre
    owned = db.session.query(Workspace).filter_by(owner_id=user.id).all()
    member_of = (
        db.session.query(Workspace)
        .join(WorkspaceMember)
        .filter(WorkspaceMember.user_id == user.id)
        .filter(Workspace.owner_id != user.id)
        .all()
    )

    workspaces = owned + member_of
    return jsonify({"workspaces": [w.to_dict() for w in workspaces]})


@api_v1_bp.route("/workspaces", methods=["POST"])
@login_required
def create_workspace():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Le nom est requis"}), 400

    ws = Workspace(
        name=name,
        description=(data.get("description") or "").strip(),
        owner_id=g.current_user.id,
    )
    db.session.add(ws)
    db.session.flush()

    # Le propriétaire est aussi membre avec rôle "owner"
    member = WorkspaceMember(
        workspace_id=ws.id,
        user_id=g.current_user.id,
        role="owner",
    )
    db.session.add(member)
    db.session.commit()

    return jsonify(ws.to_dict()), 201


@api_v1_bp.route("/workspaces/<workspace_id>", methods=["GET"])
@login_required
def get_workspace(workspace_id: str):
    ws = _get_workspace_for_user(workspace_id, g.current_user.id)
    if not ws:
        return jsonify({"error": "Workspace introuvable"}), 404

    members = [m.to_dict() for m in ws.members]
    result = ws.to_dict()
    result["members"] = members
    return jsonify(result)


@api_v1_bp.route("/workspaces/<workspace_id>", methods=["PUT"])
@login_required
def update_workspace(workspace_id: str):
    ws = _get_workspace_for_user(workspace_id, g.current_user.id, min_role="owner")
    if not ws:
        return jsonify({"error": "Workspace introuvable ou accès refusé"}), 404

    data = request.get_json(silent=True) or {}
    if "name" in data:
        ws.name = data["name"].strip() or ws.name
    if "description" in data:
        ws.description = data["description"].strip()
    db.session.commit()

    return jsonify(ws.to_dict())


@api_v1_bp.route("/workspaces/<workspace_id>", methods=["DELETE"])
@login_required
def delete_workspace(workspace_id: str):
    ws = _get_workspace_for_user(workspace_id, g.current_user.id, min_role="owner")
    if not ws:
        return jsonify({"error": "Workspace introuvable ou accès refusé"}), 404

    workspace_name = ws.name
    db.session.delete(ws)
    db.session.commit()

    return jsonify({
        "message": "Workspace supprimé",
        "workspace_id": workspace_id,
        "name": workspace_name,
    })


@api_v1_bp.route("/workspaces/<workspace_id>/members", methods=["POST"])
@login_required
def add_workspace_member(workspace_id: str):
    ws = _get_workspace_for_user(workspace_id, g.current_user.id, min_role="owner")
    if not ws:
        return jsonify({"error": "Workspace introuvable ou accès refusé"}), 404

    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    role = data.get("role", "viewer")
    if role not in ("editor", "viewer"):
        return jsonify({"error": "Rôle invalide (editor ou viewer)"}), 400

    target_user = db.session.query(User).filter_by(email=email).first()
    if not target_user:
        return jsonify({"error": "Utilisateur introuvable"}), 404

    existing = db.session.get(WorkspaceMember, (workspace_id, target_user.id))
    if existing:
        existing.role = role
    else:
        db.session.add(WorkspaceMember(
            workspace_id=workspace_id,
            user_id=target_user.id,
            role=role,
        ))
    db.session.commit()

    return jsonify({"message": "Membre ajouté", "user_id": target_user.id, "role": role})


@api_v1_bp.route("/workspaces/<workspace_id>/members/<user_id>", methods=["DELETE"])
@login_required
def remove_workspace_member(workspace_id: str, user_id: str):
    ws = _get_workspace_for_user(workspace_id, g.current_user.id, min_role="owner")
    if not ws:
        return jsonify({"error": "Workspace introuvable ou accès refusé"}), 404

    if user_id == ws.owner_id:
        return jsonify({"error": "Impossible de retirer le propriétaire"}), 400

    member = db.session.get(WorkspaceMember, (workspace_id, user_id))
    if not member:
        return jsonify({"error": "Membre introuvable"}), 404

    db.session.delete(member)
    db.session.commit()

    return jsonify({"message": "Membre retiré"})


def _get_workspace_for_user(workspace_id: str, user_id: str, min_role: str | None = None) -> Workspace | None:
    """Retourne le workspace si l'utilisateur y a accès, sinon None."""
    ws = db.session.get(Workspace, workspace_id)
    if not ws:
        return None

    member = db.session.get(WorkspaceMember, (workspace_id, user_id))
    if not member and ws.owner_id != user_id:
        return None

    if min_role:
        role_hierarchy = {"owner": 3, "editor": 2, "viewer": 1}
        user_level = role_hierarchy.get(member.role if member else "owner" if ws.owner_id == user_id else "", 0)
        required_level = role_hierarchy.get(min_role, 0)
        if user_level < required_level:
            return None

    return ws
