# Corpus de démonstration OpenStats

> Généré par ce module, écrit dans `data/demo/` (dossier non versionné : le
> corpus se reconstruit à l'identique avec `python -m scripts.demo_dataset`).

Trois tables liées, conçues pour que **toutes** les analyses de l'application
trouvent les conditions statistiques qu'elles exigent — et pour qu'aucune ne
soit invalidée par les garde-fous de la boucle de correction.

| Fichier | Grain | Lignes × colonnes | Ce qu'il alimente |
|---|---|---|---|
| `openstats_clients.csv` | 1 ligne = 1 client | 2 400 × 22 | descriptives, tests, ACP/AFC/ACM, clustering, régression, classification, SHAP, survie, DiD, 2SLS, PSM, simulation |
| `openstats_series.csv` | 1 ligne = 1 jour | 1 461 × 10 | stationnarité, ARIMA/SARIMA, décomposition, VAR, Johansen/VECM, Granger, Chow, GARCH |
| `openstats_panel.csv` | 1 ligne = 1 agence × 1 mois | 2 880 × 11 | panel FE/RE/Hausman, DiD sur panel, SQL de jointure |

> **Pourquoi trois fichiers et pas un seul ?** Une même table ne peut pas avoir
> *une* observation par date (ce qu'exigent les modèles temporels) et
> *plusieurs* entités par date (ce qu'exige le panel). Les trois tables
> partagent la colonne `region`, ce qui permet de les joindre en SQL/DuckDB.

## Conditions vérifiées

`python -m scripts.demo_dataset.validation` (depuis `backend/`) rejoue les
contrôles en appelant les moteurs réels de l'application. **41 contrôles, 0 échec.**

| Garde-fou (`pipeline/diagnostics.py`) | Seuil | Corpus |
|---|---|---|
| Colinéarité entre prédicteurs (retrait de colonne) | \|r\| ≥ 0.90 | max **0.60** (0.79 avec la cible, exclue de la règle) |
| VIF | > 10 | max **5.4** |
| Valeurs manquantes | > 5 % | max **2.5 %** |
| Doublons | > 1 % | **0 %** |
| Cardinalité (colonne prise pour un identifiant) | ≥ 95 % | aucune |

Aucun diagnostic ne bloque la modélisation. Les asymétries et valeurs extrêmes
qui subsistent sont **voulues** : elles donnent de la matière aux nœuds de
nettoyage, de transformation (log, Box-Cox, winsorisation) et à la boucle de
correction, sans jamais déclencher un retrait de colonne.

## `openstats_clients.csv`

Six variables qualitatives d'abord (les nœuds AFC, χ², ACM prennent les
premières par défaut), puis les quantitatives, et pour finir les deux cibles :
`valeur_client` est la dernière numérique (cible par défaut de la régression et
de SHAP), `churn` la dernière à faible cardinalité (cible par défaut de la
classification).

| Colonne | Rôle prévu |
|---|---|
| `segment`, `canal_prefere` | couple associé (χ² = 547, p ≈ 10⁻¹¹⁴) → AFC, test d'indépendance |
| `type_contrat`, `region`, `niveau_diplome`, `genre` | ACM (2 à 5 modalités chacune) ; `region` est indépendante des autres |
| `revenu_annuel` | log-normale, asymétrie **+2.1** → démonstration du log/Box-Cox ; forte différence entre segments (ANOVA F = 404) |
| `score_credit` | normale, Shapiro p = 0.28 **sur les 2 400 lignes** → cas « test de normalité accepté ». À cette taille d'échantillon, Shapiro rejette une normale parfaite une fois sur vingt : la graine retenue est vérifiée sur l'échantillon complet, pas sur un extrait |
| `montant_moyen_transaction` | queue lourde + 1.5 % de valeurs extrêmes injectées → nœud « valeurs aberrantes » |
| `age`, `nb_produits_detenus`, `nb_transactions_trimestre` | dotation, corrélations faibles entre elles |
| *bloc `revenu_annuel` / `score_credit` / `taux_epargne` / `montant_moyen_transaction`* | traversés par un même facteur latent d'aisance financière (r de 0.45 à 0.60) : c'est lui qui donne à l'ACP un premier axe à extraire (21 % de l'inertie) sans jamais approcher le seuil de 0.90 |
| `indice_satisfaction` (2.0 % manquants), `taux_epargne` (2.5 %) | nœud de nettoyage / imputation |
| `distance_agence_km` | **instrument** de la 2SLS (F de 1ʳᵉ étape ≈ 342) |
| `heures_conseil_annuel` | **régresseur endogène** : corrélé à une motivation non observée qui agit aussi sur `valeur_client` |
| `groupe_pilote` + `periode_post` | les deux binaires attendus par le nœud DiD (4 cellules pleines) |
| `depense_mensuelle` | résultat de la DiD, effet vrai **ATT = 45**, estimé 39.4 (± 4.2 d'erreur type) |
| `duree_relation_observee` + `churn` | durée et événement pour Kaplan-Meier / log-rank / Cox (54 % de censure à droite) |
| `valeur_client` | cible de régression, R² validé croisé ≈ **0.81** |
| `churn` | cible de classification, AUC hors échantillon ≈ **0.77** |

**Ce que la 2SLS doit montrer :** les MCO estiment l'effet du conseil à ≈ 39,
la 2SLS instrumentée le ramène à ≈ 15 pour une valeur vraie de **14**. L'écart
entre les deux est le biais d'endogénéité — c'est l'intérêt pédagogique du jeu.

**Ce que le Cox doit montrer :** les trois covariables ressortent
significatives (satisfaction HR ≈ 0.69, produits détenus HR ≈ 0.65, distance
HR ≈ 1.03).

## `openstats_series.csv`

Fréquence journalière continue du 2021-01-01 au 2024-12-31, sans trou.

| Colonne | Propriété construite |
|---|---|
| `cours_actif` | volatilité conditionnelle GARCH(1,1) (effet ARCH p ≈ 10⁻³¹). **Première colonne numérique**, donc celle que le nœud GARCH prend par défaut |
| `ventes_quotidiennes` | tendance + saisonnalité hebdomadaire (**période 7**, la valeur par défaut du nœud de décomposition, amplitude 54 %) + saisonnalité annuelle + **rupture structurelle au 2023-03-01** (Chow F = 92, p < 0.001) |
| `trafic_web` | précède les ventes de 2 jours. Granger `trafic → ventes` p < 0.001, `ventes → trafic` p = 0.81 : la causalité est **orientée**, pas réciproque |
| `indice_prix_matiere`, `indice_prix_concurrent`, `cout_logistique` | trois séries I(1) à **deux** tendances communes → rang de cointégration **1** (Johansen, VECM), avec \|r\| max de 0.74 seulement |
| `temperature_moyenne` | saisonnalité annuelle déterministe. Cas volontairement instructif : ADF ne rejette pas la racine unitaire alors que la série n'en a pas — c'est exactement pourquoi l'application croise ADF **et** KPSS |
| `stock_disponible`, `nb_reclamations` | stationnaires en niveau (ADF et KPSS d'accord), pilotées par le trafic retardé → système VAR propre à trois variables avec `trafic_web` |

## `openstats_panel.csv`

Panel cylindré : 60 agences × 48 mois, aucune observation manquante.

- `agence_id` (entité), `periode` (temps), `region` et `taille_agence` (attributs invariants) ;
- `budget_marketing` est **corrélé à l'effet fixe d'agence** : l'estimateur à
  effets aléatoires est donc inconsistant et le test de Hausman le dit
  (χ² = 336, p < 0.001 → effets fixes recommandés) ;
- `groupe_traite` (entité) × `apres_lancement` (à partir de 2023-01) : DiD sur
  panel, effet vrai **ATT = 38** sur `chiffre_affaires` — la DiD sans covariables
  l'estime à 39.4, et l'estimateur within retrouve les coefficients structurels
  (budget 2.77 pour 2.4 vrai, effectif 8.06 pour 8.4, concurrence −1.91 pour −1.9).

## Limites connues (côté application, pas côté données)

1. **Nœud 2SLS** — `IV2SLS(y, x, z)` est appelé sans constante
   (`advanced_analytics.py`). Le coefficient renvoyé n'est donc pas comparable
   à l'effet vrai tant que les variables ne sont pas centrées. Passer par le
   nœud Python donne la bonne estimation.
2. **DBSCAN** (`manifold`) — `eps = 0.5` est figé et s'applique à *toutes* les
   colonnes numériques standardisées : au-delà de 5 ou 6 dimensions, presque
   tous les points sont classés « bruit ». Le nœud de clustering K-means, lui,
   choisit son *k* par silhouette et fonctionne sur le corpus.
3. **Sonde d'intégration** — elle annonce `indice_prix_matiere` en I(2) alors
   qu'ADF la situe clairement en I(1) (p = 0.99 en niveau) : sur-différenciation
   de la sonde, pas défaut de la série.

## Régénérer le corpus

```bash
cd backend
python -m scripts.demo_dataset             # écrit les 3 CSV dans data/demo/
python -m scripts.demo_dataset.validation  # rejoue les 41 contrôles
```

Les graines sont figées dans chaque module (`clients.GRAINE`, `series.GRAINE`,
`panel.GRAINE`) : sur un échantillon fini, le rang de cointégration lu par
Johansen, l'orientation de la causalité de Granger et l'absence d'écart de
tendance entre groupe traité et témoin dépendent du tirage. Les
graines retenues sont celles dont les moteurs de l'application confirment les
propriétés annoncées ci-dessus.
