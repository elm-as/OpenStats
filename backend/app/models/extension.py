"""Modèles ORM pour les extensions et scripts utilisateurs."""

from app.extensions import db
from app.models.base import TimestampMixin, generate_uuid

class UserScript(db.Model, TimestampMixin):
    """Représente un script d'analyse personnalisé créé par un utilisateur."""
    __tablename__ = "user_scripts"

    id = db.Column(db.String(8), primary_key=True, default=generate_uuid)
    user_id = db.Column(db.String(8), db.ForeignKey("users.id"), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    
    # Le code Python à exécuter
    code = db.Column(db.Text, nullable=False)
    
    # Configuration des entrées attendues (JSON)
    # Exemple : {"required_columns": [{"name": "col_x", "type": "numeric"}]}
    input_config = db.Column(db.JSON, default=dict)
    
    # Métadonnées sur la sortie (optionnel)
    output_config = db.Column(db.JSON, default=dict)
    
    # Version du script
    version = db.Column(db.Integer, default=1)
    
    # Visibilité : private | organization | public
    visibility = db.Column(db.String(20), default="private")

    # Relations
    author = db.relationship("User", backref="scripts")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.name,
            "description": self.description,
            "code": self.code,
            "input_config": self.input_config,
            "output_config": self.output_config,
            "version": self.version,
            "visibility": self.visibility,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
