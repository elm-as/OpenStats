from flask import Blueprint

api_v1_bp = Blueprint("api_v1", __name__)

# Import des routes (le simple import enregistre les endpoints sur le Blueprint).
from app.api.v1 import ingestion, cleaning, analysis, modeling, reports, jobs, extensions, canvas, marketplace, workspaces  # noqa: E402, F401
