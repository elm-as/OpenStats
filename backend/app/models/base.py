"""Mixins et utilitaires pour les modèles ORM."""

import uuid
from datetime import datetime, timezone

from app.extensions import db


def generate_uuid() -> str:
    return uuid.uuid4().hex[:8]


class TimestampMixin:
    """Ajoute created_at / updated_at automatiques."""

    created_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
