"""
Routes API pour l'ingestion et le profilage des données.
"""

import os
from flask import request, jsonify, current_app
from werkzeug.utils import secure_filename

from app.api.v1 import api_v1_bp
from app.services.dataset_service import dataset_manager
from app.core.auth import login_required
from app.core.ingestion import validate_file_magic
from flask import g
from app.models.dataset import Dataset
from app.extensions import db


def _allowed_file(filename: str) -> bool:
    return "." in filename and \
        filename.rsplit(".", 1)[1].lower() in current_app.config["ALLOWED_EXTENSIONS"]


@api_v1_bp.route("/datasets/upload", methods=["POST"])
@login_required
def upload_dataset():
    """Upload un fichier et retourne le profilage."""
    try:
        if "file" not in request.files:
            return jsonify({"error": "Aucun fichier envoyé"}), 400

        user_id = g.current_user.id

        # Vérification des quotas (utile en mode multi-user / SaaS).
        # En mode open-source (sans auth), on reste volontairement simple.
        if current_app.config.get("AUTH_ENABLED", False):
            MAX_DATASETS_PER_USER = 10
            MAX_STORAGE_PER_USER_MB = 100

            user_datasets = Dataset.query.filter_by(uploaded_by=user_id).all()

            if len(user_datasets) >= MAX_DATASETS_PER_USER:
                return jsonify({"error": f"Quota atteint : maximum {MAX_DATASETS_PER_USER} datasets autorisés."}), 403

            total_size_mb = sum((ds.file_size or 0) for ds in user_datasets) / (1024 * 1024)

            # La taille du fichier uploadé est comptée dans le quota.
            file = request.files["file"]
            file.seek(0, os.SEEK_END)
            file_length = file.tell()
            file.seek(0)

            if total_size_mb + (file_length / (1024 * 1024)) > MAX_STORAGE_PER_USER_MB:
                return jsonify({"error": f"Quota de stockage atteint : maximum {MAX_STORAGE_PER_USER_MB} Mo autorisés."}), 403

        file = request.files["file"]
        if file.filename == "" or not _allowed_file(file.filename):
            return jsonify({"error": "Fichier invalide ou format non supporté"}), 400

        filename = secure_filename(file.filename)
        upload_dir = current_app.config["UPLOAD_FOLDER"]
        os.makedirs(upload_dir, exist_ok=True)
        filepath = os.path.join(upload_dir, filename)
        file.save(filepath)

        if not validate_file_magic(filepath, current_app.config["ALLOWED_EXTENSIONS"]):
            os.remove(filepath)
            return jsonify({"error": "Type de fichier invalide : le contenu ne correspond pas à l'extension"}), 400

        try:
            name = request.form.get("name", filename)
            dataset_id = dataset_manager.ingest(filepath, name=name, uploaded_by=user_id)
            ds = dataset_manager.get(dataset_id)

            return jsonify({
                "dataset_id": dataset_id,
                "name": ds["name"],
                "profile": ds["profile"],
            }), 201
        except Exception as e:
            return jsonify({"error": str(e)}), 422
    except Exception as e:
        current_app.logger.exception("Erreur upload_dataset: %s", e)
        return jsonify({"error": str(e)}), 500


@api_v1_bp.route("/datasets", methods=["GET"])
@login_required
def list_datasets():
    """Liste tous les datasets chargés (paginé)."""
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    return jsonify(dataset_manager.list_datasets(page=page, per_page=per_page))


@api_v1_bp.route("/datasets/<dataset_id>", methods=["DELETE"])
@login_required
def delete_dataset(dataset_id):
    """Supprime un dataset et ses fichiers associes."""
    try:
        result = dataset_manager.delete_dataset(dataset_id)
        return jsonify(result)
    except ValueError as e:
        return jsonify({"error": str(e)}), 404


@api_v1_bp.route("/datasets/<dataset_id>", methods=["GET"])
@login_required
def get_dataset(dataset_id):
    """Retourne les métadonnées d'un dataset."""
    result = dataset_manager.get(dataset_id)
    if not result:
        return jsonify({"error": "Dataset introuvable"}), 404
    return jsonify(result)


@api_v1_bp.route("/datasets/<dataset_id>/copy", methods=["POST"])
@login_required
def copy_dataset(dataset_id):
    """Crée une copie du dataset."""
    data = request.get_json() or {}
    new_name = data.get("new_name")
    
    try:
        new_id = dataset_manager.copy_dataset(dataset_id, new_name)
        new_ds = dataset_manager.get(new_id)
        return jsonify({
            "message": "Dataset copié avec succès",
            "dataset": new_ds
        }), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_v1_bp.route("/datasets/<dataset_id>/preview", methods=["GET"])
@login_required
def preview_dataset(dataset_id):
    """Aperçu des premières lignes du dataset."""
    n = request.args.get("n", 50, type=int)
    cleaned = request.args.get("cleaned", "true").lower() == "true"

    df = dataset_manager.get_df(dataset_id, cleaned=cleaned)
    if df is None:
        return jsonify({"error": "Dataset introuvable"}), 404

    return jsonify({
        "columns": df.columns.tolist(),
        "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
        "data": df.head(min(n, 200)).to_dict(orient="records"),
        "total_rows": len(df),
    })


@api_v1_bp.route("/datasets/<dataset_id>/column-type", methods=["PUT"])
@login_required
def update_column_type(dataset_id):
    """Met à jour le type statistique d'une colonne."""
    data = request.get_json(silent=True)
    if not data or "column" not in data or "new_type" not in data:
        return jsonify({"error": "Champs 'column' et 'new_type' requis"}), 400

    try:
        result = dataset_manager.update_column_type(
            dataset_id,
            column=data["column"],
            new_type=data["new_type"],
        )
        return jsonify(result)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


# ── Historique, versions et audit ─────────────────────────────


@api_v1_bp.route("/datasets/<dataset_id>/versions", methods=["GET"])
@login_required
def get_dataset_versions(dataset_id):
    """Liste les versions d'un dataset."""
    try:
        versions = dataset_manager.get_versions(dataset_id)
        return jsonify(versions)
    except ValueError as e:
        return jsonify({"error": str(e)}), 404


@api_v1_bp.route("/datasets/<dataset_id>/versions/<int:version_number>/restore", methods=["POST"])
@login_required
def restore_dataset_version(dataset_id, version_number):
    """Restaure une version comme copie de travail."""
    try:
        result = dataset_manager.restore_version(dataset_id, version_number)
        return jsonify(result)
    except ValueError as e:
        return jsonify({"error": str(e)}), 404


@api_v1_bp.route("/datasets/<dataset_id>/history", methods=["GET"])
@login_required
def get_dataset_history(dataset_id):
    """Historique des analyses exécutées sur ce dataset."""
    limit = request.args.get("limit", 50, type=int)
    try:
        history = dataset_manager.get_history(dataset_id, limit=limit)
        return jsonify(history)
    except ValueError as e:
        return jsonify({"error": str(e)}), 404


@api_v1_bp.route("/datasets/<dataset_id>/audit", methods=["GET"])
@login_required
def get_dataset_audit(dataset_id):
    """Journal d'audit complet du dataset."""
    limit = request.args.get("limit", 100, type=int)
    try:
        trail = dataset_manager.get_audit_trail(dataset_id, limit=limit)
        return jsonify(trail)
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
