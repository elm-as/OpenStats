"""
Moteur de recommandations méthodologiques (Façade publique).
Découpé en sous-modules pour respecter la limite de 350 lignes :
- recommendations_diagnosis : diagnostics automatiques d'intégrité du dataset
- recommendations_tests : recommandations de tests d'hypothèses et vérification des hypothèses
- recommendations_models : sélection de modèles optimaux et avertissements méthodologiques
"""

from __future__ import annotations

from app.core.recommendations_diagnosis import (
    SEVERITY_CRITICAL,
    SEVERITY_WARNING,
    SEVERITY_INFO,
    SEVERITY_METHOD,
    _advisory,
    diagnose_dataset,
)
from app.core.recommendations_tests import (
    recommend_tests,
    check_normality,
    check_homoscedasticity,
    check_assumptions_for_test,
)
from app.core.recommendations_models import (
    recommend_models,
    get_methodology_warnings,
)

__all__ = [
    "SEVERITY_CRITICAL",
    "SEVERITY_WARNING",
    "SEVERITY_INFO",
    "SEVERITY_METHOD",
    "_advisory",
    "diagnose_dataset",
    "recommend_tests",
    "check_normality",
    "check_homoscedasticity",
    "check_assumptions_for_test",
    "recommend_models",
    "get_methodology_warnings",
]
