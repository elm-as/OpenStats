from flask import request, jsonify, g
from app.api.v1 import api_v1_bp
from app.services.extension_service import extension_service
from app.core.auth import login_required
from app.extensions import limiter

@api_v1_bp.route("/extensions/generate", methods=["POST"])
@login_required
@limiter.limit("5 per minute")
def generate_extension():
    """Génère un script d'extension via IA."""
    data = request.get_json()
    prompt = data.get("prompt")
    dataset_id = data.get("dataset_id")
    
    # Extraction des clés (BYOK)
    custom_api_key = request.headers.get("X-AI-API-Key")
    provider = request.headers.get("X-AI-Provider", "openai")
    
    if not prompt or not dataset_id:
        return jsonify({"error": "prompt et dataset_id requis"}), 400
        
    try:
        result = extension_service.generate_script_from_prompt(prompt, dataset_id, custom_api_key=custom_api_key, provider=provider)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api_v1_bp.route("/extensions/templates", methods=["GET"])
@login_required
def get_extension_templates():
    """Récupère les modèles de scripts prédéfinis."""
    templates = extension_service.get_templates()
    return jsonify(templates)

@api_v1_bp.route("/extensions", methods=["POST"])
@login_required
def save_extension():
    """Sauvegarde une nouvelle extension."""
    data = request.get_json()
    name = data.get("name")
    code = data.get("code")
    description = data.get("description", "")
    input_config = data.get("input_config", {})
    
    if not name or not code:
        return jsonify({"error": "name et code requis"}), 400
        
    script = extension_service.save_script(
        user_id=g.current_user.id,
        name=name,
        code=code,
        description=description,
        input_config=input_config
    )
    return jsonify(script.to_dict()), 201

@api_v1_bp.route("/extensions", methods=["GET"])
@login_required
def list_extensions():
    """Liste les extensions de l'utilisateur."""
    scripts = extension_service.list_scripts(g.current_user.id)
    return jsonify([s.to_dict() for s in scripts])

@api_v1_bp.route("/extensions/<script_id>/run", methods=["POST"])
@login_required
def run_extension(script_id):
    """Exécute une extension sur un dataset."""
    data = request.get_json()
    dataset_id = data.get("dataset_id")
    params = data.get("params", {})
    
    if not dataset_id:
        return jsonify({"error": "dataset_id requis"}), 400
        
    try:
        result = extension_service.execute_script(script_id, dataset_id, params)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api_v1_bp.route("/extensions/run-code", methods=["POST"])
@login_required
@limiter.limit("10 per minute")
def run_extension_code():
    """Exécute du code Python brut sur un dataset."""
    data = request.get_json()
    code = data.get("code")
    dataset_id = data.get("dataset_id")
    params = data.get("params", {})
    
    if not code or not dataset_id:
        return jsonify({"error": "code et dataset_id requis"}), 400
        
    try:
        result = extension_service.execute_raw_code(code, dataset_id, params)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
