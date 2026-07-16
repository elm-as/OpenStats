"""Modèle ORM pour les utilisateurs."""

from datetime import datetime, timezone

from app.extensions import db
from app.models.base import TimestampMixin, generate_uuid


class User(db.Model, TimestampMixin):
    __tablename__ = "users"

    id = db.Column(db.String(8), primary_key=True, default=generate_uuid)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=True)
    google_id = db.Column(db.String(255), unique=True, nullable=True, index=True)
    display_name = db.Column(db.String(100), nullable=False)
    role = db.Column(
        db.String(20), nullable=False, default="analyst",
    )  # admin | analyst | viewer
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    last_login = db.Column(db.DateTime(timezone=True), nullable=True)
    preferences = db.Column(db.JSON, default=dict)

    # Relations
    owned_workspaces = db.relationship(
        "Workspace", back_populates="owner", cascade="all, delete-orphan",
    )
    workspace_memberships = db.relationship(
        "WorkspaceMember", back_populates="user", cascade="all, delete-orphan",
    )

    def update_last_login(self):
        self.last_login = datetime.now(timezone.utc)

    def to_dict(self, include_email: bool = True) -> dict:
        d = {
            "id": self.id,
            "display_name": self.display_name,
            "role": self.role,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_login": self.last_login.isoformat() if self.last_login else None,
            "google_id": self.google_id,
        }
        if include_email:
            d["email"] = self.email
        return d
