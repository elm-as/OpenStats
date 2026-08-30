"""
Fonctions de sérialisation sécurisée pour les analyses factorielles.
"""

from __future__ import annotations

import numpy as np


def _safe_float_val(v):
    """Conversion flottante sécurisée pour la sérialisation des résultats factoriels."""
    if isinstance(v, (np.floating, float)):
        if np.isnan(v) or np.isinf(v):
            return None
        return round(float(v), 6)
    if isinstance(v, (np.integer, int)):
        return int(v)
    return v
