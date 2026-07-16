"""Modèles Dataset et DatasetVersion."""

from typing import Any

from app.extensions import db
from app.models.base import TimestampMixin, generate_uuid


class Dataset(db.Model, TimestampMixin):
    """Un jeu de données uploadé."""

    __tablename__ = "datasets"

    def __init__(self, **kwargs: Any) -> None:
        super().__init__(**kwargs)

    id = db.Column(db.String(8), primary_key=True, default=generate_uuid)
    name = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    file_size = db.Column(db.BigInteger)
    rows = db.Column(db.Integer)
    columns = db.Column(db.Integer)

    # Propriétaire et espace de travail
    workspace_id = db.Column(
        db.String(8), db.ForeignKey("workspaces.id", ondelete="SET NULL"), nullable=True,
    )
    uploaded_by = db.Column(
        db.String(8), db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )

    # Colonnes exclues et overrides de types (JSON)
    excluded_columns = db.Column(db.JSON, default=list)
    type_overrides = db.Column(db.JSON, default=dict)

    # Profil courant (JSON sérialisé)
    profile = db.Column(db.JSON)

    # Relations
    workspace = db.relationship("Workspace", back_populates="datasets")
    uploader = db.relationship("User", foreign_keys=[uploaded_by])
    versions = db.relationship(
        "DatasetVersion", back_populates="dataset",
        order_by="DatasetVersion.version_number", cascade="all, delete-orphan",
    )
    analyses = db.relationship(
        "AnalysisResult", back_populates="dataset", cascade="all, delete-orphan",
    )
    audit_logs = db.relationship(
        "AuditLog", back_populates="dataset", cascade="all, delete-orphan",
    )

    @property
    def current_version(self) -> "DatasetVersion | None":
        return self.versions[-1] if self.versions else None

    @property
    def shape(self) -> dict:
        return {"rows": self.rows or 0, "columns": self.columns or 0}

    def to_dict(self, include_profile: bool = False) -> dict:
        d = {
            "id": self.id,
            "name": self.name,
            "original_filename": self.original_filename,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "shape": self.shape,
            "file_size": self.file_size,
            "excluded_columns": self.excluded_columns or [],
            "versions_count": len(self.versions),
        }
        if include_profile and self.profile:
            d["profile"] = self.profile
        return d


class DatasetVersion(db.Model, TimestampMixin):
    """Version d'un dataset (raw, après nettoyage, après transformation)."""

    __tablename__ = "dataset_versions"

    def __init__(self, **kwargs: Any) -> None:
        super().__init__(**kwargs)

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    dataset_id = db.Column(
        db.String(8), db.ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False,
    )
    version_number = db.Column(db.Integer, nullable=False, default=1)
    label = db.Column(db.String(100), nullable=False, default="raw")  # raw, cleaned, transformed
    description = db.Column(db.Text)

    # Chemin fichier Parquet relatif à DATA_DIR
    parquet_path = db.Column(db.String(500), nullable=False)

    rows = db.Column(db.Integer)
    columns = db.Column(db.Integer)

    # Log des opérations ayant produit cette version (JSON)
    operations_log = db.Column(db.JSON, default=list)

    # Profil snapshot de cette version (JSON)
    profile_snapshot = db.Column(db.JSON)

    dataset = db.relationship("Dataset", back_populates="versions")

    __table_args__ = (
        db.UniqueConstraint("dataset_id", "version_number", name="uq_dataset_version"),
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "dataset_id": self.dataset_id,
            "version_number": self.version_number,
            "label": self.label,
            "description": self.description,
            "rows": self.rows,
            "columns": self.columns,
            "operations_log": self.operations_log or [],
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
