"""
Module d'analyse factorielle (Façade publique) : ACP, AFC, ACM.
Découpé en sous-modules pour respecter la limite de 350 lignes :
- factor_helpers : fonctions de sérialisation sécurisée
- factor_pca : Analyse en Composantes Principales (ACP)
- factor_ca : Analyse Factorielle des Correspondances (AFC)
- factor_mca : Analyse des Correspondances Multiples (ACM)
"""

from __future__ import annotations

from app.core.factor_serialization import _safe_float_val
from app.core.factor_pca import run_pca
from app.core.factor_ca import run_ca
from app.core.factor_mca import run_mca, _compute_eta2

__all__ = [
    "run_pca",
    "run_ca",
    "run_mca",
    "_compute_eta2",
    "_safe_float_val",
]
