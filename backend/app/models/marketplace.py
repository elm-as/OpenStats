"""Modèle MarketplaceItem — templates et extensions partagés."""

from app.extensions import db
from app.models.base import TimestampMixin, generate_uuid


class MarketplaceItem(db.Model, TimestampMixin):
    """Un item de la marketplace (template de pipeline ou extension)."""

    __tablename__ = "marketplace_items"

    id = db.Column(db.String(8), primary_key=True, default=generate_uuid)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=False, default="")
    category = db.Column(db.String(50), nullable=False)  # template, extension
    item_type = db.Column(db.String(50), nullable=False)  # classification, timeseries, cleaning, ...
    author = db.Column(db.String(255), default="OpenStats")
    version = db.Column(db.String(20), default="1.0.0")
    icon = db.Column(db.String(50), default="package")  # lucide icon name
    tags = db.Column(db.JSON, default=list)
    featured = db.Column(db.Boolean, default=False)
    downloads = db.Column(db.Integer, default=0)

    # Le payload dépend du type
    payload = db.Column(db.JSON, nullable=False)

    def to_dict(self, include_payload: bool = True) -> dict:
        d = {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "category": self.category,
            "item_type": self.item_type,
            "author": self.author,
            "version": self.version,
            "icon": self.icon,
            "tags": self.tags or [],
            "featured": self.featured,
            "downloads": self.downloads,
        }
        if include_payload:
            d["payload"] = self.payload
        return d
