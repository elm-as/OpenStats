"""
Tâche Celery générique pour l'exécution de jobs.
"""

from app.tasks import get_celery

celery = get_celery()


if celery:
    @celery.task(bind=True, name="openstats.execute_job")
    def execute_job_task(self, job_id: str):
        """Exécute un job dans le contexte Flask + Celery."""
        from app import create_app
        app = create_app()
        with app.app_context():
            from app.services.job_service import _run_sync
            _run_sync(job_id)
else:
    # Stub si Celery n'est pas disponible
    def execute_job_task(job_id: str):
        pass
