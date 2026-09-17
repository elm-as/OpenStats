"""Volet de panel du corpus de demonstration : une ligne = une agence x un mois.

Ce volet existe parce qu'aucune table ne peut etre a la fois une serie
temporelle (une observation par date) et un panel (plusieurs entites par
date). Il alimente l'econometrie de panel et la DiD :

- l'effet fixe d'agence est correle a `budget_marketing` : l'estimateur a
  effets aleatoires est donc inconsistant et le test de Hausman doit trancher
  en faveur des effets fixes ;
- `groupe_traite` (entite) et `apres_lancement` (temps) sont deux binaires
  separes, comme l'attend le noeud DiD, qui construit lui-meme l'interaction.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

N_AGENCES = 60
DEBUT = "2021-01-01"
N_PERIODES = 48
LANCEMENT = "2023-01-01"
# Graine figee : sur 60 agences, l'ecart de tendance entre groupe traite et
# groupe temoin depend du tirage. Celle-ci laisse la DiD sans covariables
# retrouver l'effet vrai (verifie par scripts.demo_dataset.validation).
GRAINE = 20260917

REGIONS = ("Nord", "Sud", "Est", "Ouest", "Centre")
# Effet causal vrai du programme sur le chiffre d'affaires mensuel (k€).
ATT_PROGRAMME = 38.0


def _ar1(rng: np.random.Generator, n: int, phi: float, sigma: float) -> np.ndarray:
    serie = np.zeros(n)
    serie[0] = rng.normal(0, sigma / np.sqrt(max(1e-6, 1 - phi**2)))
    for t in range(1, n):
        serie[t] = phi * serie[t - 1] + rng.normal(0, sigma)
    return serie


def _entites(rng: np.random.Generator) -> pd.DataFrame:
    """Caracteristiques invariantes dans le temps, dont l'effet fixe latent."""
    effet_fixe = rng.normal(0, 1, N_AGENCES)
    taille = pd.cut(effet_fixe + rng.normal(0, 0.45, N_AGENCES),
                    bins=(-np.inf, -0.5, 0.6, np.inf),
                    labels=("Petite", "Moyenne", "Grande"))
    return pd.DataFrame({
        "agence_id": [f"AG-{i:02d}" for i in range(1, N_AGENCES + 1)],
        "region": rng.choice(REGIONS, size=N_AGENCES),
        "taille_agence": taille.astype(str),
        "groupe_traite": rng.permutation(np.r_[np.ones(N_AGENCES // 2),
                                               np.zeros(N_AGENCES - N_AGENCES // 2)]).astype(int),
        "_effet_fixe": effet_fixe,
    })


def build(seed: int = GRAINE) -> pd.DataFrame:
    """Construit un panel cylindre : toutes les agences observees sur tous les mois."""
    rng = np.random.default_rng(seed)
    periodes = pd.date_range(DEBUT, periods=N_PERIODES, freq="MS")
    entites = _entites(rng)
    apres_seuil = np.asarray(periodes >= LANCEMENT, dtype=int)

    lignes = []
    for _, agence in entites.iterrows():
        alpha = float(agence["_effet_fixe"])
        t = np.arange(N_PERIODES, dtype=float)

        # Correlation voulue entre le regresseur et l'effet fixe : c'est elle
        # que le test de Hausman doit detecter. La part qui varie dans le temps
        # reste modeste pour que les tendances des deux groupes restent
        # paralleles : sinon la DiD sans covariables serait biaisee.
        budget = 42 + 11.5 * alpha + 0.09 * t + _ar1(rng, N_PERIODES, 0.55, 6.0)
        effectif = np.clip(9 + 1.6 * alpha + _ar1(rng, N_PERIODES, 0.80, 0.9), 3, None)
        penetration = np.clip(18 + 4.2 * alpha + 0.05 * t + _ar1(rng, N_PERIODES, 0.70, 2.0), 1, 95)
        concurrence = 50 + _ar1(rng, N_PERIODES, 0.65, 6.0)

        saison = 26 * np.sin(2 * np.pi * (t % 12) / 12)
        traite = int(agence["groupe_traite"])
        chiffre = (520 + 58 * alpha + 2.4 * budget + 8.4 * effectif
                   - 1.9 * concurrence + 2.2 * penetration + saison
                   + ATT_PROGRAMME * traite * apres_seuil
                   + rng.normal(0, 45, N_PERIODES))

        lignes.append(pd.DataFrame({
            "agence_id": agence["agence_id"],
            "periode": periodes.strftime("%Y-%m-%d"),
            "region": agence["region"],
            "taille_agence": agence["taille_agence"],
            "effectif": effectif.round(1),
            "budget_marketing": budget.round(2),
            "taux_penetration_marche": penetration.round(2),
            "indice_concurrence": concurrence.round(2),
            "groupe_traite": traite,
            "apres_lancement": apres_seuil,
            "chiffre_affaires": chiffre.round(2),
        }))

    return pd.concat(lignes, ignore_index=True)
