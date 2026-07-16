"""
Routes API pour la Marketplace de templates et extensions.
"""

from flask import request, jsonify
from app.api.v1 import api_v1_bp
from app.services.marketplace_service import list_items, get_item, export_item, import_item


@api_v1_bp.route("/marketplace", methods=["GET"])
def list_marketplace_items():
    """Liste les items marketplace avec filtres et pagination."""
    category = request.args.get("category")
    item_type = request.args.get("type")
    featured = request.args.get("featured")
    if featured is not None:
        featured = featured.lower() == "true"
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    search = request.args.get("search")

    result = list_items(
        category=category,
        item_type=item_type,
        featured=featured,
        page=page,
        per_page=per_page,
        search=search,
    )
    return jsonify(result)


@api_v1_bp.route("/marketplace/<item_id>", methods=["GET"])
def get_marketplace_item(item_id):
    """Récupère un item marketplace avec son payload complet."""
    item = get_item(item_id)
    if item is None:
        return jsonify({"error": "Item introuvable"}), 404
    return jsonify(item)


@api_v1_bp.route("/marketplace/<item_id>/export", methods=["GET"])
def export_marketplace_item(item_id):
    """Exporte un item au format JSON (incrémente le compteur de téléchargements)."""
    item = export_item(item_id)
    if item is None:
        return jsonify({"error": "Item introuvable"}), 404
    return jsonify(item)


@api_v1_bp.route("/marketplace/import", methods=["POST"])
def import_marketplace_item():
    """Importe un item depuis un JSON."""
    data = request.get_json()
    if not data or "payload" not in data or "name" not in data:
        return jsonify({"error": "JSON invalide : 'name' et 'payload' requis"}), 400

    try:
        item = import_item(data)
        return jsonify(item), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500
