"""Authentication domain logic: route guards (simplified for Open Source)."""

from functools import wraps
from flask import current_app, g, request
from app.models.user import User

def _get_dev_user():
    """Mode open-source : utilisateur par navigateur (X-Client-Id).
    
    Chaque navigateur reçoit un ID unique stocké en localStorage côté frontend.
    Le backend lit cet ID, crée un User correspondant, et isole les datasets
    (uploaded_by, list_datasets, delete, etc.) via cet ID.

    Fallback : si pas de X-Client-Id (ancien frontend, tests), premier User existant.
    """
    from app.extensions import db

    # ── 1) Lire le X-Client-Id envoyé par le frontend ──
    client_id = "dev-admin"  # fallback
    try:
        header_val = (request.headers.get("X-Client-Id") or "").strip().lower()
        if header_val and len(header_val) <= 8 and header_val.isalnum():
            client_id = header_val
    except Exception:
        pass

    # ── 2) Chercher ou créer l'utilisateur ──
    user = db.session.get(User, client_id)
    if user:
        return user

    # Fallback : premier User existant (tests sans X-Client-Id).
    user = db.session.query(User).first()
    if user:
        return user

    # ── 3) Création automatique ──
    from flask import current_app
    current_app.logger.info("Nouveau navigateur: création user_id=%s", client_id)
    user = User(  # type: ignore
        id=client_id,
        email=f"local+{client_id}@openstats.local",
        display_name=f"Local {client_id}",
        role="admin",
        is_active=True,
    )
    db.session.add(user)
    db.session.commit()
    return user


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        # Mode open-source : pas de comptes, pas de tokens.
        # On utilise un utilisateur local unique pour garder la compatibilité
        # avec les champs (uploaded_by, audits, etc.).
        g.current_user = _get_dev_user()
        return f(*args, **kwargs)

    return decorated
