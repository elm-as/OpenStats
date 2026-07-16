import os
import logging
import uuid
import time
from flask import Flask, send_from_directory, request, g, jsonify
from flask_cors import CORS
from sqlalchemy import inspect, text
from werkzeug.exceptions import HTTPException

from app.config import Config
from app.extensions import db, migrate, limiter


def _ensure_legacy_schema_compatibility(app: Flask):
    """Met a niveau une base SQLite existante avec les colonnes/tables recentes."""
    engine = db.engine
    if engine.dialect.name != "sqlite":
        return

    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    statements: list[str] = []

    if "datasets" in existing_tables:
        dataset_columns = {col["name"] for col in inspector.get_columns("datasets")}
        if "workspace_id" not in dataset_columns:
            statements.append("ALTER TABLE datasets ADD COLUMN workspace_id VARCHAR(8)")
        if "uploaded_by" not in dataset_columns:
            statements.append("ALTER TABLE datasets ADD COLUMN uploaded_by VARCHAR(8)")

    if "users" in existing_tables:
        user_columns = {col["name"] for col in inspector.get_columns("users")}
        if "google_id" not in user_columns:
            statements.append("ALTER TABLE users ADD COLUMN google_id VARCHAR(255)")
        if "preferences" not in user_columns:
            statements.append("ALTER TABLE users ADD COLUMN preferences JSON")
        if "last_login" not in user_columns:
            statements.append("ALTER TABLE users ADD COLUMN last_login DATETIME")
        if "password_hash" not in user_columns:
            statements.append("ALTER TABLE users ADD COLUMN password_hash VARCHAR(255)")

    if statements:
        with engine.begin() as connection:
            for statement in statements:
                connection.execute(text(statement))
            app.logger.info("Schema SQLite mis a niveau automatiquement: %s", ", ".join(statements))




def _setup_logging(app: Flask):
    """Configure le logging structuré avec request_id."""
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()
    logging.basicConfig(
        level=getattr(logging, log_level, logging.INFO),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    # Réduire le bruit des libs tierces
    logging.getLogger("werkzeug").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

    @app.before_request
    def _before_request():
        g.request_id = request.headers.get("X-Request-Id", uuid.uuid4().hex[:12])
        g.request_start = time.time()

    @app.after_request
    def _after_request(response):
        duration = int((time.time() - getattr(g, "request_start", time.time())) * 1000)
        if request.path.startswith("/api/"):
            app.logger.info(
                "request_id=%s method=%s path=%s status=%s duration_ms=%d",
                getattr(g, "request_id", "-"),
                request.method,
                request.path,
                response.status_code,
                duration,
            )
        return response


def create_app(config_class=Config):
    app = Flask(
        __name__,
        static_folder=config_class.FRONTEND_DIST_DIR,
        static_url_path="/",
    )
    app.config.from_object(config_class)

    if app.config.get("LOCAL_DEV_MODE", False) and os.getenv("FLASK_ENV") == "production":
        raise RuntimeError("LOCAL_DEV_MODE=true est interdit avec FLASK_ENV=production.")

    # CORS : en LOCAL_DEV_MODE, accepter tous les localhost (quel que soit le port)
    if app.config.get("LOCAL_DEV_MODE", False):
        import re
        CORS(app, resources={
            r"/api/*": {
                "origins": re.compile(r"https?://localhost(:\d+)?$"),
            }
        })
    else:
        allowed_origins_raw = os.getenv("CORS_ORIGINS", "http://localhost:5173")
        allowed_origins = [o.strip() for o in allowed_origins_raw.split(",") if o.strip()]
        CORS(app, resources={r"/api/*": {"origins": allowed_origins}})

    # Ensure directories exist
    for d in [app.config["UPLOAD_FOLDER"], app.config["DATA_DIR"], app.config["REPORTS_DIR"]]:
        os.makedirs(d, exist_ok=True)

    # Initialiser les extensions
    db.init_app(app)
    migrate.init_app(app, db)

    # Flask-Limiter : désactivé par défaut en mode local (pas d'attaques à limiter).
    limiter.enabled = False
    limiter.init_app(app)

    # Logging structuré
    _setup_logging(app)

    # Importer les modèles pour Alembic
    with app.app_context():
        from app import models  # noqa: F401
        _ensure_legacy_schema_compatibility(app)

        is_sqlite = db.engine.dialect.name == "sqlite"
        if is_sqlite and app.config.get("LOCAL_DEV_MODE", False):
            db.create_all()
            app.logger.info("SQLite local: tables créées via create_all()")
        else:
            from flask_migrate import upgrade as _migrate_upgrade
            try:
                _migrate_upgrade()
                app.logger.info("Migrations appliquées via flask db upgrade")
            except Exception as exc:
                app.logger.warning("flask db upgrade a échoué: %s. Fallback sur create_all().", exc)
                db.create_all()

        from app.services.marketplace_service import seed_marketplace
        seed_marketplace()

        # Enregistrer les exécuteurs de jobs
        from app.tasks.executors import register_all_executors
        register_all_executors()

    # Register API blueprints
    from app.api.v1 import api_v1_bp
    app.register_blueprint(api_v1_bp, url_prefix="/api/v1")

    # Toujours renvoyer du JSON sur /api/* même en cas d'exception non gérée,
    # sinon le frontend reçoit une page HTML et RTK Query plante en "PARSING_ERROR".
    @app.errorhandler(Exception)
    def _handle_unexpected_error(err):  # type: ignore[override]
        if isinstance(err, HTTPException):
            return err
        if request.path.startswith("/api/"):
            app.logger.exception("Unhandled API error on %s %s", request.method, request.path)
            return jsonify({
                "error": "Erreur interne du serveur",
                "request_id": getattr(g, "request_id", None),
            }), 500
        # Pour les routes frontend, conserver le comportement standard (page HTML 500)
        raise err

    @app.route("/health")
    def health():
        return {"status": "ok"}

    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_frontend(path: str):
        dist_dir = app.config["FRONTEND_DIST_DIR"]
        if not os.path.isdir(dist_dir):
            if not path:
                return {
                    "status": "api_only",
                    "message": "Backend deploye sans frontend statique.",
                    "health": "/health",
                    "api": "/api/v1",
                }
            return {"error": "resource_not_found"}, 404

        requested = os.path.join(dist_dir, path)
        if path and os.path.exists(requested) and os.path.isfile(requested):
            return send_from_directory(dist_dir, path)

        return send_from_directory(dist_dir, "index.html")

    return app
