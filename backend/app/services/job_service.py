"""
Service de gestion des jobs — dispatch sync ou async selon disponibilité Celery.
"""

from __future__ import annotations

import logging
import time
import traceback
from datetime import datetime, timezone
from typing import Any, Callable

from app.extensions import db
from app.models.job import Job
from app.tasks import is_async_available

logger = logging.getLogger(__name__)

# ── Registre des exécuteurs ──────────────────────────────────

_executors: dict[str, Callable] = {}


def register_executor(task_type: str, fn: Callable):
    """Enregistre une fonction d'exécution pour un type de tâche."""
    _executors[task_type] = fn


def _run_sync(job_id: str) -> dict:
    """Exécute un job de façon synchrone."""
    job = db.session.get(Job, job_id)
    if job is None:
        raise ValueError(f"Job {job_id} introuvable")

    executor = _executors.get(job.task_type)
    if executor is None:
        job.status = "failed"
        job.error_message = f"Type de tâche inconnu: {job.task_type}"
        job.completed_at = datetime.now(timezone.utc)
        db.session.commit()
        return job.to_dict()

    job.status = "running"
    job.started_at = datetime.now(timezone.utc)
    job.progress = 0
    db.session.commit()

    try:
        result = executor(job.dataset_id, job.parameters, _make_progress_cb(job_id))
        job = db.session.get(Job, job_id)
        job.status = "completed"
        job.progress = 100
        job.completed_at = datetime.now(timezone.utc)
        if isinstance(result, dict):
            job.result_id = result.get("analysis_id")
        db.session.commit()
        return job.to_dict()

    except Exception as e:
        job = db.session.get(Job, job_id)
        job.status = "failed"
        job.error_message = str(e)
        job.completed_at = datetime.now(timezone.utc)
        db.session.commit()
        logger.error("Job %s failed: %s", job_id, traceback.format_exc())
        return job.to_dict()


def _make_progress_cb(job_id: str):
    """Crée un callback de progression pour un job."""
    def update(progress: int, message: str = None):
        job = db.session.get(Job, job_id)
        if job and job.status == "running":
            job.progress = min(progress, 99)
            if message:
                job.progress_message = message
            db.session.commit()
    return update


# ── API publique ─────────────────────────────────────────────

def submit_job(dataset_id: str, task_type: str, parameters: dict = None) -> dict:
    """Soumet un nouveau job. Retourne le job créé."""
    if task_type not in _executors:
        raise ValueError(f"Type de tâche inconnu: {task_type}")

    job = Job(
        dataset_id=dataset_id,
        task_type=task_type,
        parameters=parameters or {},
        status="pending",
    )
    db.session.add(job)
    db.session.commit()

    if is_async_available():
        # Dispatch vers Celery
        from app.tasks.worker import execute_job_task
        celery_result = execute_job_task.delay(job.id)
        job.celery_task_id = celery_result.id
        db.session.commit()
        logger.info("Job %s dispatché vers Celery (task_id=%s)", job.id, celery_result.id)
    else:
        # Exécution synchrone
        logger.info("Job %s exécuté en mode synchrone", job.id)
        _run_sync(job.id)
        job = db.session.get(Job, job.id)

    return job.to_dict()


def get_job(job_id: str) -> dict | None:
    """Récupère le statut d'un job."""
    job = db.session.get(Job, job_id)
    return job.to_dict() if job else None


def list_jobs(dataset_id: str = None, status: str = None, page: int = 1, per_page: int = 20) -> dict:
    """Liste les jobs avec filtres optionnels et pagination."""
    query = Job.query.order_by(Job.created_at.desc())
    if dataset_id:
        query = query.filter_by(dataset_id=dataset_id)
    if status:
        query = query.filter_by(status=status)
    total = query.count()
    items = query.offset((page - 1) * per_page).limit(per_page).all()
    return {
        "jobs": [j.to_dict() for j in items],
        "page": page,
        "per_page": per_page,
        "total": total,
        "pages": max(1, (total + per_page - 1) // per_page),
    }


def cancel_job(job_id: str) -> dict | None:
    """Annule un job en attente ou en cours."""
    job = db.session.get(Job, job_id)
    if job is None:
        return None
    if job.status in ("completed", "failed", "cancelled"):
        return job.to_dict()

    if job.celery_task_id and is_async_available():
        from app.tasks import get_celery
        celery = get_celery()
        if celery:
            celery.control.revoke(job.celery_task_id, terminate=True)

    job.status = "cancelled"
    job.completed_at = datetime.now(timezone.utc)
    db.session.commit()
    return job.to_dict()
