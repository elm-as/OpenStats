"""
Configuration Celery avec mode dégradé (synchrone si Redis indisponible).
"""

from __future__ import annotations

import os
import logging

logger = logging.getLogger(__name__)

_celery_available = False
_celery_app = None
_checked = False


def _make_celery():
    """Crée l'instance Celery si Redis est disponible."""
    global _celery_available, _celery_app, _checked

    if _checked:
        return _celery_app
    
    _checked = True
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    try:
        from celery import Celery

        app = Celery("openstats")
        app.conf.update(
            broker_url=redis_url,
            result_backend=redis_url,
            task_serializer="json",
            accept_content=["json"],
            result_serializer="json",
            timezone="UTC",
            task_track_started=True,
            task_acks_late=True,
            worker_prefetch_multiplier=1,
            # Limites raisonnables
            task_soft_time_limit=300,  # 5 min
            task_time_limit=600,  # 10 min hard limit
        )

        # Tester la connexion Redis
        import redis
        r = redis.from_url(redis_url, socket_connect_timeout=2)
        r.ping()

        _celery_available = True
        _celery_app = app
        logger.info("Celery configuré avec Redis: %s", redis_url)
        return app

    except Exception as e:
        logger.warning("Celery indisponible (%s) — mode synchrone activé", e)
        _celery_available = False
        _celery_app = None
        return None


def get_celery():
    """Retourne l'instance Celery (ou None si indisponible)."""
    global _celery_app
    if _celery_app is None:
        _make_celery()
    return _celery_app


def is_async_available() -> bool:
    """True si Celery + Redis sont opérationnels."""
    if _celery_app is None:
        _make_celery()
    return _celery_available
