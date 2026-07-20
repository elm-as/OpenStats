import os
from dotenv import load_dotenv

load_dotenv()

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_REPO_DIR = os.path.dirname(_BASE_DIR)


class Config:
    _secret = os.getenv("SECRET_KEY")
    _is_local_dev = os.getenv("LOCAL_DEV_MODE", "false").lower() == "true"
    if not _secret:
        if _is_local_dev:
            _secret = os.urandom(32).hex()
        else:
            raise RuntimeError("SECRET_KEY must be set in production (non LOCAL_DEV_MODE)")
    SECRET_KEY = _secret
    LOCAL_DEV_MODE = _is_local_dev
    UPLOAD_FOLDER = os.path.abspath(os.getenv("UPLOAD_FOLDER", os.path.join(_BASE_DIR, "uploads")))
    MAX_CONTENT_LENGTH = int(os.getenv("MAX_UPLOAD_MB", "200")) * 1024 * 1024  # 200 MB par défaut en local
    ALLOWED_EXTENSIONS = {"csv", "xlsx", "xls", "json", "jsonl"}
    FRONTEND_DIST_DIR = os.path.abspath(os.getenv(
        "FRONTEND_DIST_DIR",
        os.path.join(_REPO_DIR, "frontend", "dist"),
    ))

    _db_url = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{os.path.join(_BASE_DIR, 'data', 'openstats.db')}",
    )
    if _db_url.startswith("postgres://"):
        _db_url = _db_url.replace("postgres://", "postgresql://", 1)
        
    SQLALCHEMY_DATABASE_URI = _db_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Redis / Celery
    CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
    CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")
    RATELIMIT_STORAGE_URI = os.getenv("RATELIMIT_STORAGE_URI", "memory://")

    # Anthropic LLM
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
    LLM_MODEL = os.getenv("LLM_MODEL", "claude-sonnet-4-20250514")

    # Datasets storage
    DATA_DIR = os.path.abspath(os.getenv("DATA_DIR", os.path.join(_BASE_DIR, "data")))

    # Reports output
    REPORTS_DIR = os.path.abspath(os.getenv("REPORTS_DIR", os.path.join(_BASE_DIR, "reports")))
    
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")

