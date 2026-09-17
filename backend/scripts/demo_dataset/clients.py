"""Volet transversal du corpus de demonstration : une ligne = un client.

Concu pour que chaque analyse transversale de l'application trouve les
conditions qu'elle exige (descriptives, tests, ACP/AFC/ACM, clustering,
regression, classification, survie, DiD, 2SLS, SHAP, simulation) sans
qu'aucune paire de predicteurs n'atteigne le seuil de colinearite
(|r| = 0.90, `pipeline.diagnostics.THRESHOLDS`) au-dela duquel la boucle de
correction retire une colonne.

Contraintes de nommage respectees ici :
- aucune colonne entiere a cardinalite >= 98 % de N (sinon `_is_id_like` la
  retire des features) : les variables a forte cardinalite restent en float ;
- aucun nom ne contient de jeton temporel (`date`, `mois`, `annee`...) qui
  ferait passer la colonne pour un index temporel.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

N_DEFAULT = 2400
# Graine figee : sur ce tirage, aucun diagnostic ne bloque la modelisation et
# `score_credit` passe le test de normalite sur l'echantillon complet — a
# n = 2400, Shapiro rejette une normale parfaite une fois sur vingt, et le
# noeud de l'application teste bien les 2400 lignes, pas un sous-echantillon.
GRAINE = 20260924

SEGMENTS = ("Jeune actif", "Standard", "Patrimonial", "Senior")
SEGMENT_P = (0.24, 0.38, 0.18, 0.20)
CANAUX = ("Mobile", "Web", "Agence")
# Ligne = segment, colonne = canal : association forte, lisible sur le plan AFC.
CANAL_P = {
    "Jeune actif": (0.66, 0.24, 0.10),
    "Standard": (0.36, 0.40, 0.24),
    "Patrimonial": (0.19, 0.34, 0.47),
    "Senior": (0.09, 0.24, 0.67),
}
CONTRATS = ("Essentiel", "Confort", "Premium")
CONTRAT_P = {
    "Jeune actif": (0.58, 0.32, 0.10),
    "Standard": (0.42, 0.42, 0.16),
    "Patrimonial": (0.13, 0.38, 0.49),
    "Senior": (0.34, 0.42, 0.24),
}
REGIONS = ("Nord", "Sud", "Est", "Ouest", "Centre")
DIPLOMES = ("Sans diplome", "Bac", "Licence", "Master")
DIPLOME_P = {
    "Jeune actif": (0.10, 0.30, 0.38, 0.22),
    "Standard": (0.20, 0.38, 0.28, 0.14),
    "Patrimonial": (0.06, 0.20, 0.36, 0.38),
    "Senior": (0.30, 0.36, 0.22, 0.12),
}

AGE_PAR_SEGMENT = {
    "Jeune actif": (30.0, 5.0),
    "Standard": (43.0, 8.5),
    "Patrimonial": (52.0, 9.0),
    "Senior": (68.0, 7.0),
}
LOG_REVENU_PAR_SEGMENT = {
    "Jeune actif": 10.05,
    "Standard": 10.28,
    "Patrimonial": 10.92,
    "Senior": 10.30,
}
LAMBDA_PRODUITS = {
    "Jeune actif": 0.9,
    "Standard": 1.4,
    "Patrimonial": 2.6,
    "Senior": 1.6,
}

# Effet causal vrai de la DiD : ecart de depense attribuable au programme.
ATT_DID = 45.0
# Effet causal vrai de l'heure de conseil sur la valeur client (cible de la 2SLS).
BETA_CONSEIL = 14.0


def _choisir(rng: np.random.Generator, cles: np.ndarray, table: dict, modalites: tuple) -> np.ndarray:
    """Tire une modalite par ligne selon une loi conditionnelle a `cles`."""
    sortie = np.empty(len(cles), dtype=object)
    for cle, probas in table.items():
        masque = cles == cle
        sortie[masque] = rng.choice(modalites, size=int(masque.sum()), p=probas)
    return sortie


def _profil_categoriel(rng: np.random.Generator, n: int) -> dict[str, np.ndarray]:
    segment = rng.choice(SEGMENTS, size=n, p=SEGMENT_P)
    return {
        "segment": segment,
        "canal_prefere": _choisir(rng, segment, CANAL_P, CANAUX),
        "type_contrat": _choisir(rng, segment, CONTRAT_P, CONTRATS),
        "region": rng.choice(REGIONS, size=n, p=(0.22, 0.20, 0.18, 0.21, 0.19)),
        "niveau_diplome": _choisir(rng, segment, DIPLOME_P, DIPLOMES),
        "genre": rng.choice(("F", "H"), size=n, p=(0.51, 0.49)),
    }


def _socle_numerique(rng: np.random.Generator, cat: dict, n: int) -> dict[str, np.ndarray]:
    """Variables de dotation.

    Un facteur latent d'aisance financiere traverse le revenu, l'epargne, le
    montant des transactions et le score de credit : sans cette structure
    partagee, l'ACP n'aurait aucun axe a extraire. Les poids sont calibres pour
    que les correlations restent autour de 0.5-0.7, loin du seuil de 0.90 qui
    ferait retirer une colonne.
    """
    segment = cat["segment"]
    aisance = rng.normal(0, 1, n)
    rang_diplome = np.array([DIPLOMES.index(d) for d in cat["niveau_diplome"]], dtype=float)

    mu_age = np.array([AGE_PAR_SEGMENT[s][0] for s in segment])
    sd_age = np.array([AGE_PAR_SEGMENT[s][1] for s in segment])
    age = np.clip(rng.normal(mu_age, sd_age), 18, 88).round().astype(int)

    mu_log = np.array([LOG_REVENU_PAR_SEGMENT[s] for s in segment])
    revenu = np.exp(mu_log + 0.09 * rang_diplome + 0.42 * aisance + rng.normal(0, 0.18, n))

    score = 640 + 60 * aisance + rng.normal(0, 45, n)
    score = np.clip(score, 320, 850).round().astype(int)

    lam = np.array([LAMBDA_PRODUITS[s] for s in segment])
    produits = (rng.poisson(lam) + 1).clip(1, 9)

    base_tx = 26 + 9 * (cat["canal_prefere"] == "Mobile") - 5 * (segment == "Senior")
    transactions = rng.poisson(np.clip(base_tx, 4, None)).astype(int)

    montant = (np.exp(3.90 + 0.34 * aisance + rng.normal(0, 0.30, n))
               * rng.gamma(shape=6.0, scale=1 / 6.0, size=n))

    # Forme multiplicative plutot qu'additive : une forme additive tronquee a
    # zero accumulerait 7 % des clients sur la valeur exacte 0, un artefact de
    # troncature que les descriptives afficheraient comme un pic.
    epargne = (11.5 * np.exp(0.40 * aisance + rng.normal(0, 0.33, n))
               + 3.0 * (segment == "Patrimonial"))
    satisfaction = np.clip(6.4 + 0.9 * (cat["type_contrat"] == "Premium")
                           - 0.5 * (cat["canal_prefere"] == "Agence")
                           + rng.normal(0, 1.45, n), 0, 10)

    return {
        "age": age,
        "revenu_annuel": revenu.round(2),
        "score_credit": score,
        "nb_produits_detenus": produits,
        "nb_transactions_trimestre": transactions,
        "montant_moyen_transaction": np.clip(montant, 3, None).round(2),
        "taux_epargne": np.clip(epargne, 0, 60).round(2),
        "indice_satisfaction": satisfaction.round(2),
    }


def _bloc_causal(rng: np.random.Generator, cat: dict, num: dict, n: int) -> tuple[dict, np.ndarray]:
    """Instrument, regresseur endogene et dispositif DiD.

    `motivation` n'est jamais exportee : c'est le confondant qui rend les MCO
    biaisees sur `heures_conseil_annuel` et qui justifie la 2SLS instrumentee
    par `distance_agence_km`.
    """
    motivation = rng.normal(0, 1, n)
    distance = np.clip(rng.exponential(6.5, n) + rng.normal(0, 1.2, n), 0.3, 60).round(2)

    heures = (6.4 - 0.118 * distance + 1.55 * motivation
              + 0.9 * (cat["segment"] == "Patrimonial") + rng.normal(0, 1.25, n))
    heures = np.clip(heures, 0.2, None).round(2)

    pilote = rng.integers(0, 2, n)
    post = rng.integers(0, 2, n)
    depense = (182 + 0.00085 * num["revenu_annuel"] + 11 * pilote + 19 * post
               + ATT_DID * pilote * post + rng.normal(0, 52, n))

    return {
        "distance_agence_km": distance,
        "heures_conseil_annuel": heures,
        "groupe_pilote": pilote.astype(int),
        "periode_post": post.astype(int),
        "depense_mensuelle": depense.round(2),
    }, motivation


def _survie(rng: np.random.Generator, cat: dict, num: dict, bloc: dict, n: int) -> dict[str, np.ndarray]:
    """Duree observee + indicateur d'evenement, avec censure aleatoire.

    La censure est independante de la duree latente : `duree_observee` reste
    informative sur `churn` sans en etre une fonction deterministe (pas de
    fuite de cible en classification).
    """
    log_risque = (-0.34 * (num["indice_satisfaction"] - 6.5)
                  - 0.40 * (num["nb_produits_detenus"] - 2)
                  + 0.030 * (bloc["distance_agence_km"] - 7)
                  + 0.55 * (cat["segment"] == "Jeune actif")
                  - 0.45 * (cat["type_contrat"] == "Premium")
                  - 0.004 * (num["score_credit"] - 640))
    forme = 1.35
    echelle = 46.0 * np.exp(-log_risque / forme)
    latente = echelle * rng.weibull(forme, n)
    censure = rng.uniform(6, 74, n)

    duree = np.minimum(latente, censure)
    evenement = (latente <= censure).astype(int)
    return {
        "duree_relation_observee": duree.round(1),
        "churn": evenement,
    }


def _valeur_client(rng: np.random.Generator, num: dict, bloc: dict,
                   motivation: np.ndarray, n: int) -> np.ndarray:
    return (118 + 0.0052 * num["revenu_annuel"] + 17 * num["nb_produits_detenus"]
            + 8.5 * num["indice_satisfaction"] + BETA_CONSEIL * bloc["heures_conseil_annuel"]
            + 0.42 * num["montant_moyen_transaction"] + 58 * motivation
            + rng.normal(0, 72, n)).round(2)


def _injecter_imperfections(rng: np.random.Generator, df: pd.DataFrame) -> pd.DataFrame:
    """Manquants et valeurs extremes, calibres sous les seuils de declenchement.

    Les taux restent sous `missing_ratio` (5 %) et `outlier_ratio` (2 %) : les
    noeuds de nettoyage et de detection d'aberrants ont de la matiere, la
    boucle de correction ne declenche pas de remede destructif.
    """
    n = len(df)
    for colonne, taux in (("indice_satisfaction", 0.020), ("taux_epargne", 0.025)):
        cibles = rng.choice(n, size=int(round(taux * n)), replace=False)
        df.loc[cibles, colonne] = np.nan

    extremes = rng.choice(n, size=int(round(0.015 * n)), replace=False)
    df.loc[extremes, "montant_moyen_transaction"] *= rng.uniform(2.6, 4.2, len(extremes))
    df["montant_moyen_transaction"] = df["montant_moyen_transaction"].round(2)
    return df


def build(n: int = N_DEFAULT, seed: int = GRAINE) -> pd.DataFrame:
    """Construit le volet transversal.

    L'ordre des colonnes est significatif : les noeuds qui auto-selectionnent
    leurs variables prennent les premieres categorielles (AFC, chi2, ACM), la
    derniere numerique comme cible de regression (`valeur_client`) et la
    derniere colonne a faible cardinalite comme cible de classification
    (`churn`).
    """
    rng = np.random.default_rng(seed)
    cat = _profil_categoriel(rng, n)
    num = _socle_numerique(rng, cat, n)
    bloc, motivation = _bloc_causal(rng, cat, num, n)
    surv = _survie(rng, cat, num, bloc, n)

    donnees: dict[str, np.ndarray] = {}
    donnees.update(cat)
    donnees.update(num)
    donnees.update(bloc)
    donnees["duree_relation_observee"] = surv["duree_relation_observee"]
    donnees["churn"] = surv["churn"]
    donnees["valeur_client"] = _valeur_client(rng, num, bloc, motivation, n)

    ordre = [
        "segment", "canal_prefere", "type_contrat", "region", "niveau_diplome", "genre",
        "revenu_annuel", "score_credit", "age", "nb_produits_detenus",
        "nb_transactions_trimestre", "montant_moyen_transaction", "taux_epargne",
        "indice_satisfaction", "distance_agence_km", "heures_conseil_annuel",
        "groupe_pilote", "periode_post", "depense_mensuelle",
        "duree_relation_observee", "churn", "valeur_client",
    ]
    df = pd.DataFrame(donnees)[ordre]
    return _injecter_imperfections(rng, df)
