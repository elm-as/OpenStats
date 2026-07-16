"""Modèle AnalysisResult — historique des analyses exécutées."""

from typing import Any

from app.extensions import db
from app.models.base import TimestampMixin, generate_uuid


class AnalysisResult(db.Model, TimestampMixin):
    """Résultat d'une analyse persisté."""

    __tablename__ = "analysis_results"

    def __init__(self, **kwargs: Any) -> None:
        super().__init__(**kwargs)

    id = db.Column(db.String(16), primary_key=True, default=lambda: generate_uuid() + generate_uuid())
    dataset_id = db.Column(
        db.String(8), db.ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False,
    )
    dataset_version = db.Column(db.Integer, nullable=False)

    # Type : descriptive, correlation, test, modeling, timeseries,
    #        multivariate_ts, pca, ca, mca, transforms, report
    analysis_type = db.Column(db.String(50), nullable=False, index=True)

    # Paramètres utilisés pour cette analyse (JSON)
    parameters = db.Column(db.JSON, default=dict)

    # Résumé léger stocké en DB (JSON)
    result_summary = db.Column(db.JSON)

    # Chemin vers le fichier de résultats complets (relatif à DATA_DIR)
    result_path = db.Column(db.String(500))

    # Durée d'exécution
    duration_ms = db.Column(db.Integer)

    # Statut
    status = db.Column(db.String(20), nullable=False, default="completed")  # completed, failed, running

    error_message = db.Column(db.Text)

    dataset = db.relationship("Dataset", back_populates="analyses")

    def to_dict(self, include_summary: bool = True) -> dict:
        d = {
            "id": self.id,
            "dataset_id": self.dataset_id,
            "dataset_version": self.dataset_version,
            "analysis_type": self.analysis_type,
            "parameters": self.parameters or {},
            "status": self.status,
            "duration_ms": self.duration_ms,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_summary and self.result_summary:
            d["result_summary"] = self.result_summary
        if self.error_message:
            d["error_message"] = self.error_message
        return d
