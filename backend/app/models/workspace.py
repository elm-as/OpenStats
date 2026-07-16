"""Modèles ORM pour les espaces de travail."""

from app.extensions import db
from app.models.base import TimestampMixin, generate_uuid


class Workspace(db.Model, TimestampMixin):
    __tablename__ = "workspaces"

    id = db.Column(db.String(8), primary_key=True, default=generate_uuid)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, default="")
    owner_id = db.Column(
        db.String(8), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
    )

    # Relations
    owner = db.relationship("User", back_populates="owned_workspaces")
    members = db.relationship(
        "WorkspaceMember", back_populates="workspace", cascade="all, delete-orphan",
    )
    datasets = db.relationship(
        "Dataset", back_populates="workspace", cascade="all, delete-orphan",
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "owner_id": self.owner_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "members_count": len(self.members),
            "datasets_count": len(self.datasets),
        }


class WorkspaceMember(db.Model):
    __tablename__ = "workspace_members"

    workspace_id = db.Column(
        db.String(8), db.ForeignKey("workspaces.id", ondelete="CASCADE"),
        primary_key=True,
    )
    user_id = db.Column(
        db.String(8), db.ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    role = db.Column(
        db.String(20), nullable=False, default="viewer",
    )  # owner | editor | viewer

    workspace = db.relationship("Workspace", back_populates="members")
    user = db.relationship("User", back_populates="workspace_memberships")

    def to_dict(self) -> dict:
        return {
            "workspace_id": self.workspace_id,
            "user_id": self.user_id,
            "role": self.role,
            "user": self.user.to_dict(include_email=False) if self.user else None,
        }
