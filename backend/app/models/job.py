"""Modèle ORM pour les jobs asynchrones."""

from app.extensions import db
from app.models.base import TimestampMixin, generate_uuid


class Job(TimestampMixin, db.Model):
    __tablename__ = "jobs"

    id = db.Column(db.String(16), primary_key=True, default=lambda: generate_uuid() + generate_uuid())
    dataset_id = db.Column(db.String(8), db.ForeignKey("datasets.id"), nullable=False)
    task_type = db.Column(db.String(50), nullable=False, index=True)
    status = db.Column(
        db.String(20), nullable=False, default="pending",
        index=True,
    )  # pending | running | completed | failed | cancelled
    celery_task_id = db.Column(db.String(255), nullable=True)
    parameters = db.Column(db.JSON, default=dict)
    progress = db.Column(db.Integer, default=0)  # 0-100
    progress_message = db.Column(db.String(255), nullable=True)
    result_id = db.Column(db.String(16), nullable=True)  # FK vers AnalysisResult si applicable
    started_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    error_message = db.Column(db.Text, nullable=True)

    dataset = db.relationship("Dataset", backref=db.backref("jobs", lazy="dynamic", cascade="all, delete-orphan"))

    def to_dict(self):
        return {
            "id": self.id,
            "dataset_id": self.dataset_id,
            "task_type": self.task_type,
            "status": self.status,
            "progress": self.progress,
            "progress_message": self.progress_message,
            "parameters": self.parameters,
            "result_id": self.result_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "error_message": self.error_message,
        }
