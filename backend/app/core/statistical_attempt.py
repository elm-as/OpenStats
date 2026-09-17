"""
Echec d'un calcul statistique : un resultat, pas un accident.

Les routines de statsmodels, scipy et scikit-learn levent sur des donnees
degenerees — serie constante, matrice singuliere, echantillon trop court,
classe absente d'un pli. Ce sont des situations normales sur des donnees
reelles, pas des bugs : le pipeline doit continuer et *dire* ce qui a echoue.

Ce module donne le seul motif autorise pour intercepter ces echecs, afin que le
reste du code n'ait pas a repeter `try/except Exception` — pratique qui masque
aussi bien une matrice singuliere qu'une faute de frappe dans un nom d'attribut.

Usage :

    outcome = attempt(adfuller, series, autolag="AIC")
    if not outcome:
        notes.append(f"ADF indisponible : {outcome.reason}")
        return []
    p_value = outcome.value[1]

Ce qui n'est PAS couvert ici — `AttributeError`, `NameError`, `ImportError` —
remonte normalement : ce sont des defauts de programmation, et les masquer
transformerait un bug en resultat silencieusement faux.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Generic, TypeVar

import numpy as np

T = TypeVar("T")

# Erreurs levees par les bibliotheques de calcul sur des donnees degenerees.
# La liste est deliberement fermee : tout ce qui n'y figure pas est un bug.
DEGENERATE_DATA_ERRORS: tuple[type[BaseException], ...] = (
    ValueError,              # echantillon trop court, parametre hors domaine
    TypeError,               # dtype inattendu dans une colonne mixte
    ZeroDivisionError,       # variance nulle
    ArithmeticError,         # inclut FloatingPointError et OverflowError
    np.linalg.LinAlgError,   # matrice singuliere, non convergence
    IndexError,              # pli vide, classe absente
    KeyError,                # colonne disparue apres une transformation
)


@dataclass(frozen=True)
class Attempt(Generic[T]):
    """Resultat d'un calcul qui pouvait echouer, avec le motif en cas d'echec."""

    value: T | None
    reason: str = ""

    @property
    def failed(self) -> bool:
        return bool(self.reason)

    def __bool__(self) -> bool:
        """Vrai si le calcul a abouti : `if not outcome:` se lit naturellement."""
        return not self.failed

    def or_else(self, fallback: T) -> T:
        """Valeur obtenue, ou repli explicite. A n'utiliser que si le repli a un sens."""
        return fallback if self.failed else self.value  # type: ignore[return-value]


def attempt(function: Callable[..., T], *args: Any, **kwargs: Any) -> Attempt[T]:
    """Execute un calcul statistique en transformant un echec en resultat decrit."""
    try:
        return Attempt(function(*args, **kwargs))
    except DEGENERATE_DATA_ERRORS as exc:
        return Attempt(None, f"{type(exc).__name__}: {exc}"[:160])


def describe(exc: BaseException, limit: int = 160) -> str:
    """Motif court et lisible d'une exception, pour les rapports et les journaux."""
    return f"{type(exc).__name__}: {exc}"[:limit]
