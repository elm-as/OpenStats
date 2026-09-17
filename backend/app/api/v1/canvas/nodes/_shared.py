"""
Utilitaires partagés pour l'exécution du Canvas.
"""

from typing import Any

# Un champ laissé vide dans l'interface arrive ici sous la forme d'une chaîne
# vide, pas d'une absence : `int(data.get("cvFolds", 5))` leve alors ValueError.
# Ces lecteurs rendent la valeur par defaut dans ce cas, ce qui permet de
# transmettre les reglages sans casser les noeuds quand l'utilisateur n'y
# touche pas.
VIDES = (None, "", "auto", "default", "defaut")


def lire_entier(data: dict, cle: str, defaut: Any = None) -> Any:
    """Lit un reglage entier, ou rend `defaut` si le champ est laisse vide."""
    brut = data.get(cle)
    if brut in VIDES:
        return defaut
    try:
        return int(float(brut))
    except (TypeError, ValueError):
        return defaut


def lire_decimal(data: dict, cle: str, defaut: Any = None) -> Any:
    """Lit un reglage decimal, ou rend `defaut` si le champ est laisse vide."""
    brut = data.get(cle)
    if brut in VIDES:
        return defaut
    try:
        return float(brut)
    except (TypeError, ValueError):
        return defaut


def lire_booleen(data: dict, cle: str, defaut: bool = False) -> bool:
    """Lit une case a cocher, tolerante aux formes textuelles du front."""
    brut = data.get(cle)
    if brut in VIDES:
        return defaut
    if isinstance(brut, bool):
        return brut
    return str(brut).strip().lower() in ("1", "true", "oui", "yes", "on")


def lire_texte(data: dict, cle: str, defaut: Any = None) -> Any:
    """Lit un reglage textuel non vide, ou rend `defaut`."""
    brut = data.get(cle)
    if brut in VIDES:
        return defaut
    texte = str(brut).strip()
    return texte or defaut

def _sanitize(obj, depth=0):
    """Nettoie récursivement un objet pour JSON."""
    import numpy as np
    if depth > 10:
        return str(obj)
    if obj is None or isinstance(obj, (bool, str)):
        return obj
    if isinstance(obj, int):
        return obj
    if isinstance(obj, float):
        return None if (np.isnan(obj) or np.isinf(obj)) else obj
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        v = float(obj)
        return None if (np.isnan(v) or np.isinf(v)) else v
    if isinstance(obj, np.ndarray):
        return _sanitize(obj.tolist(), depth + 1)
    if isinstance(obj, dict):
        return {k: _sanitize(v, depth + 1) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_sanitize(v, depth + 1) for v in obj]
    try:
        import json
        json.dumps(obj)
        return obj
    except (TypeError, ValueError):
        return None
