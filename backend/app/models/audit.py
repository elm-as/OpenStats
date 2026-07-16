"""Modèle AuditLog — traçabilité complète des opérations."""

from typing import Any

from app.extensions import db
from app.models.base import TimestampMixin


class AuditLog(db.Model, TimestampMixin):
    """Journal d'audit pour la reproductibilité."""

    __tablename__ = "audit_logs"

    def __init__(self, **kwargs: Any) -> None:
        super().__init__(**kwargs)

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    dataset_id = db.Column(
        db.String(8), db.ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False,
    )

    # Action : upload, clean, transform, analyze, train, type_change, exclude_columns, report
    action = db.Column(db.String(50), nullable=False, index=True)

    # Détails de l'opération (JSON)
    parameters = db.Column(db.JSON, default=dict)

    # Versions avant/après
    version_before = db.Column(db.Integer)
    version_after = db.Column(db.Integer)

    dataset = db.relationship("Dataset", back_populates="audit_logs")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "dataset_id": self.dataset_id,
            "action": self.action,
            "parameters": self.parameters or {},
            "version_before": self.version_before,
            "version_after": self.version_after,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
