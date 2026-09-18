"""Registre des bibliotheques chargees paresseusement par les moteurs d'analyse.

Les moteurs importent ces bibliotheques a l'interieur des fonctions, pour ne pas
payer leur cout au demarrage. PyInstaller n'analyse que les imports statiques :
sans declaration explicite, elles sont absentes du binaire Desktop et l'analyse
correspondante echoue — ou pire, retombe sur un repli degrade sans le dire.

Ce registre est l'autorite unique. Deux consommateurs en derivent :

- `openstats-backend.spec` construit sa liste `collect_all` a partir d'ici, au
  lieu de la recopier : les deux ne peuvent donc plus diverger ;
- la route `/health` publie les bibliotheques manquantes, ce qui rend un binaire
  installe auto-diagnosticable au lieu d'echouer au moment de l'analyse.
"""

from __future__ import annotations

import importlib.util
from dataclasses import dataclass


@dataclass(frozen=True)
class BibliothequeOptionnelle:
    """Une dependance importee a l'usage, et ce qu'on perd sans elle."""

    module: str
    usage: str
    consequence_si_absente: str


BIBLIOTHEQUES: tuple[BibliothequeOptionnelle, ...] = (
    BibliothequeOptionnelle(
        module="arch",
        usage="Estimation GARCH(1,1) par maximum de vraisemblance (app/core/volatility.py)",
        consequence_si_absente=(
            "La volatilite conditionnelle est filtree avec des coefficients figes "
            "au lieu d'etre estimee : les parametres affiches ne viennent pas des donnees."
        ),
    ),
    BibliothequeOptionnelle(
        module="xgboost",
        usage="Modele XGBoost du catalogue supervise",
        consequence_si_absente="XGBoost est retire de la competition de modeles.",
    ),
    BibliothequeOptionnelle(
        module="lightgbm",
        usage="Modele LightGBM du catalogue supervise",
        consequence_si_absente="LightGBM est retire de la competition de modeles.",
    ),
    BibliothequeOptionnelle(
        module="lifelines",
        usage="Analyse de survie (Kaplan-Meier, Cox)",
        consequence_si_absente="Le noeud de survie echoue.",
    ),
    BibliothequeOptionnelle(
        module="prophet",
        usage="Modele de prevision Prophet",
        consequence_si_absente="Prophet est retire du classement des previsions.",
    ),
)

MODULES = tuple(b.module for b in BIBLIOTHEQUES)


def est_disponible(module: str) -> bool:
    """La bibliotheque est-elle installee ? Sans l'importer, donc sans cout memoire."""
    try:
        return importlib.util.find_spec(module) is not None
    except (ImportError, ValueError):
        return False


def bibliotheques_absentes() -> list[dict[str, str]]:
    """Bibliotheques manquantes, avec ce que leur absence retire a l'utilisateur."""
    return [
        {
            "module": b.module,
            "usage": b.usage,
            "consequence": b.consequence_si_absente,
        }
        for b in BIBLIOTHEQUES
        if not est_disponible(b.module)
    ]
