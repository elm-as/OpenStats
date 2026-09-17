"""Volet temporel du corpus de demonstration : une ligne = un jour.

Chaque serie porte une propriete que l'un des moteurs temporels exige :
- `cours_actif` : volatilite conditionnelle persistante (GARCH). Elle est la
  premiere colonne numerique parce que le noeud GARCH prend cette colonne par
  defaut et la transforme en rendements log ;
- `ventes_quotidiennes` : tendance + saisonnalite hebdomadaire (periode 7, la
  valeur par defaut du noeud de decomposition) + rupture structurelle datee,
  pour le test de Chow ;
- `trafic_web` : precede les ventes de deux jours, sans retroaction, pour que
  la causalite de Granger soit orientee ;
- `indice_prix_matiere`, `indice_prix_concurrent`, `cout_logistique` :
  systeme I(1) a deux tendances communes, donc de rang de cointegration 1
  (Johansen, VECM) tout en gardant |r| < 0.90 par paire ;
- `temperature_moyenne`, `stock_disponible`, `nb_reclamations` :
  stationnaires en niveau, utilisables directement en VAR.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

DEBUT = "2021-01-01"
FIN = "2024-12-31"
RUPTURE = "2023-03-01"
# Graine figee : sur un echantillon fini, le rang de cointegration lu par
# Johansen et l'orientation de la causalite de Granger dependent du tirage.
# Celle-ci donne le rang 1 attendu sous la specification du noeud
# (det_order=0, k_ar_diff=1) et une causalite trafic -> ventes strictement
# unidirectionnelle (verifie par scripts.demo_dataset.validation).
GRAINE = 20260955

# Profil hebdomadaire des ventes (lundi -> dimanche), en ecart multiplicatif.
PROFIL_SEMAINE = np.array([1.02, 0.98, 1.00, 1.06, 1.18, 1.12, 0.64])


def _ar1(rng: np.random.Generator, n: int, phi: float, sigma: float) -> np.ndarray:
    """Trajectoire AR(1) centree, demarree a sa variance stationnaire."""
    serie = np.zeros(n)
    serie[0] = rng.normal(0, sigma / np.sqrt(max(1e-6, 1 - phi**2)))
    innovations = rng.normal(0, sigma, n)
    for t in range(1, n):
        serie[t] = phi * serie[t - 1] + innovations[t]
    return serie


def _garch11(rng: np.random.Generator, n: int, omega: float,
             alpha: float, beta: float) -> np.ndarray:
    """Rendements GARCH(1,1) : les chocs se regroupent en periodes agitees."""
    rendements = np.zeros(n)
    variance = omega / max(1e-9, 1 - alpha - beta)
    for t in range(n):
        rendements[t] = np.sqrt(variance) * rng.normal()
        variance = omega + alpha * rendements[t] ** 2 + beta * variance
    return rendements


def _marche_aleatoire(rng: np.random.Generator, n: int, depart: float,
                      derive: float, sigma: float) -> np.ndarray:
    return depart + np.cumsum(rng.normal(derive, sigma, n))


def _systeme_cointegre(rng: np.random.Generator, n: int) -> dict[str, np.ndarray]:
    """Trois prix I(1) partageant deux tendances stochastiques.

    `indice_prix_concurrent` suit la meme tendance que `indice_prix_matiere` a
    un ecart stationnaire pres : c'est la relation de long terme que Johansen
    doit retrouver. L'ecart est volontairement large pour que la correlation
    de niveau reste sous le seuil de colinearite.
    """
    matiere = _marche_aleatoire(rng, n, depart=100.0, derive=0.0, sigma=0.90)
    # Ecart de long terme large et assez peu persistant : Johansen retrouve la
    # relation sans que la correlation de niveau atteigne 0.90.
    ecart = _ar1(rng, n, phi=0.70, sigma=11.0)
    concurrent = 8.0 + 0.92 * matiere + ecart

    # Tendance stochastique propre : c'est le deuxieme facteur commun, celui qui
    # empeche le rang de cointegration de depasser 1.
    tendance_propre = _marche_aleatoire(rng, n, depart=0.0, derive=0.0, sigma=0.75)
    logistique = 140.0 + 0.30 * matiere + tendance_propre + _ar1(rng, n, phi=0.55, sigma=1.4)

    return {
        "indice_prix_matiere": matiere.round(3),
        "indice_prix_concurrent": concurrent.round(3),
        "cout_logistique": logistique.round(3),
    }


def _ventes(rng: np.random.Generator, index: pd.DatetimeIndex,
            trafic: np.ndarray, temperature: np.ndarray) -> np.ndarray:
    """Tendance, saisonnalite hebdomadaire et annuelle, rupture structurelle.

    La rupture change a la fois le niveau et la pente : le test de Chow doit la
    rejeter nettement, et la decomposition reste lisible de part et d'autre.
    """
    n = len(index)
    t = np.arange(n, dtype=float)
    apres = np.asarray(index >= RUPTURE, dtype=float)
    rang_rupture = float(np.argmax(apres)) if apres.any() else 0.0

    niveau = 1180 + 0.21 * t + 165 * apres - 0.34 * apres * (t - rang_rupture)
    annuel = 58 * np.sin(2 * np.pi * (t - 20) / 365.25)
    hebdo = PROFIL_SEMAINE[index.dayofweek.to_numpy()]

    trafic_retarde = np.concatenate([np.full(2, trafic[:2].mean()), trafic[:-2]])
    effet_trafic = 0.22 * (trafic_retarde - trafic.mean())
    effet_meteo = 3.4 * (temperature - temperature.mean())

    # Le profil hebdomadaire module le niveau, pas l'effet du trafic : un effet
    # multiplie par un cycle deterministe se lit a rebours dans les retards et
    # rendrait la causalite de Granger reciproque.
    bruit = _ar1(rng, n, phi=0.42, sigma=46)
    return np.clip((niveau + annuel) * hebdo + effet_trafic + effet_meteo + bruit, 50, None)


def build(seed: int = GRAINE) -> pd.DataFrame:
    """Construit le volet temporel, a frequence journaliere reguliere et sans trou."""
    index = pd.date_range(DEBUT, FIN, freq="D")
    n = len(index)
    rng = np.random.default_rng(seed)
    t = np.arange(n, dtype=float)

    rendements = _garch11(rng, n, omega=1.2e-6, alpha=0.09, beta=0.885)
    cours = 100.0 * np.exp(np.cumsum(rendements + 0.00018))

    temperature = 12.6 + 8.0 * np.sin(2 * np.pi * (t - 110) / 365.25) + _ar1(rng, n, 0.40, 2.4)

    # Pas de profil hebdomadaire ici : un cycle deterministe partage avec les
    # ventes rendrait la causalite de Granger bidirectionnelle par construction.
    # Persistance faible pour la meme raison : si le trafic etait fortement
    # autocorrele, les ventes retardees (qui contiennent le trafic d'avant-hier)
    # predireraient le trafic d'aujourd'hui et la causalite paraitrait reciproque.
    trafic = 2900 + _ar1(rng, n, phi=0.25, sigma=273)

    ventes = _ventes(rng, index, trafic, temperature)

    # Stock et reclamations reagissent au trafic (stationnaire) et non aux
    # ventes : brancher un niveau tendanciel leur transmettrait sa tendance et
    # les rendrait non stationnaires.
    trafic_retarde = np.concatenate([[trafic[0]], trafic[:-1]]) - trafic.mean()
    stock = 840 - 0.16 * trafic_retarde + _ar1(rng, n, 0.74, 26)

    intensite = np.clip(11 + 0.006 * trafic_retarde, 1.0, None)
    reclamations = rng.poisson(intensite).astype(int)

    donnees = {
        "date": index.strftime("%Y-%m-%d"),
        "cours_actif": cours.round(4),
        "ventes_quotidiennes": ventes.round(2),
        "trafic_web": trafic.round(1),
        "temperature_moyenne": temperature.round(2),
        "stock_disponible": stock.round(1),
        "nb_reclamations": reclamations,
    }
    donnees.update(_systeme_cointegre(rng, n))

    ordre = [
        "date", "cours_actif", "ventes_quotidiennes", "trafic_web",
        "indice_prix_matiere", "indice_prix_concurrent", "cout_logistique",
        "temperature_moyenne", "stock_disponible", "nb_reclamations",
    ]
    return pd.DataFrame(donnees)[ordre]
