# Guide Utilisateur OpenStats — Manuel de Référence

Bienvenue dans le manuel d'utilisation complet d'**OpenStats**, la plateforme d'analyse statistique, de modélisation économétrique et de Data Science conçue pour les professionnels, chercheurs et analystes de données.

Signée par la charte d'ingénierie logicielle [ELMAS.md](../ELMAS.md) (*"From Data to Systems"*), OpenStats allie la rigueur mathématique des logiciels universitaires (dans l'esprit de Jamovi et R) à la flexibilité moderne d'un canvas visuel nodal et d'un moteur SQL OLAP ultra-rapide (DuckDB).

---

## Table des Matières

1. [Prise en main & Ergonomie Native](#1-prise-en-main--ergonomie-native)
2. [Formats de Données, Ingestion & Sécurité](#2-formats-de-données-ingestion--sécurité)
3. [L'Analyse Méthodique en 11 Étapes](#3-lanalyse-méthodique-en-11-étapes)
4. [L'Explorateur Adaptatif & Contrôle FDR](#4-lexplorateur-adaptatif--contrôle-fdr)
5. [Atelier Statistique Libre & Tests d'Hypothèses](#5-atelier-statistique-libre--tests-dhypothèses)
6. [Analyses Post-Hoc, Tests d'Équivalence & Puissance](#6-analyses-post-hoc-tests-déquivalence--puissance)
7. [Analyses Factorielles Multivariées](#7-analyses-factorielles-multivariées)
8. [Économétrie, Causalité & Régressions Avancées](#8-économétrie-causalité--régressions-avancées)
9. [Analyse des Séries Temporelles](#9-analyse-des-séries-temporelles)
10. [Machine Learning, AutoML & Explicabilité SHAP](#10-machine-learning-automl--explicabilité-shap)
11. [Canvas Nodal & Simulations Stochastiques](#11-canvas-nodal--simulations-stochastiques)
12. [Exports, Rapports Automatisés & Génération de Code](#12-exports-rapports-automatisés--génération-de-code)
13. [Raccourcis Clavier & Dépannage](#13-raccourcis-clavier--dépannage)

---

## 1. Prise en main & Ergonomie Native

OpenStats propose une expérience de bureau native, exempte des artifices web superflus (dégradés décoratifs, ombres portées inutiles, marges démesurées). L'interface privilégie la **densité d'information**, la **lisibilité immédiate** et la **précision tabulaire**.

### 1.1 Architecture de l'Interface Bureau (AppShell & Ruban Jamovi)

L'espace de travail Desktop s'inspire des logiciels statistiques de référence (ergonomie à double panneau type Jamovi, sans barre latérale redondante) et s'articule autour de cinq zones structurantes, complétées sous Windows Electron par une **barre de menus native** (*Fichier*, *Analyses*, *Affichage*, *Aide*) :

```
┌────────────────────────────────────────────────────────────────────────┐
│ Menu natif Electron : Fichier | Analyses | Affichage | Aide            │
├────────────────────────────────────────────────────────────────────────┤
│ ContextBar : Dataset actif (30 × 7) | v2 | Commandes Ctrl+K | Thème    │
├────────────────────────────────────────────────────────────────────────┤
│ DesktopRibbon : Données | Typage | Explorateur | Méthodologie | Canvas │
├───────────────┬────────────────────────────────────────┬───────────────┤
│ Dock gauche   │                                        │ PinnedDrawer  │
│ • Sessions    │   Zone de Travail Principale           │ (Résultats    │
│ • Variables   │                                        │  épinglés,    │
│   CONT/DISC/  │  • Tableur interactif synchronisé      │  comparaisons,│
│   DATE/CAT/BIN│    (Nettoyées | Brutes, NA alignés)    │  historique)  │
│   + % NA      │  • Ou Atelier / Méthodologie / Canvas  │               │
├───────────────┴────────────────────────────────────────┴───────────────┤
│ StatusBar : ● Prêt | Tableur DuckDB / Parquet prêt | Variables | Nom   │
└────────────────────────────────────────────────────────────────────────┘
```

- **Barre de menus native Desktop (`desktopMenu.cjs`)** : Accessible en mode Electron autonome (`Fichier`, `Analyses`, `Affichage`, `Aide`), avec raccourcis clavier globaux (`Ctrl+Shift+T` pour basculer le thème Sombre/Clair, `Ctrl+Shift+D` pour basculer la densité Compact/Confortable, `Alt+1` à `Alt+8` pour changer de vue, `F1` pour ouvrir le guide).
- **ContextBar (Bandeau supérieur)** : Affiche l'état de la session locale, le jeu de données actif, ses dimensions (`N × P`), sa version courante, la palette `Ctrl+K`, la bascule de thème et l'accès au Bloc-notes.
- **DesktopRibbon (Ruban supérieur de 36 px)** : Donne un accès immédiat en un clic aux modules principaux (*Données*, *Typage & Nettoyage*, *Explorateur FDR*, *Méthodologie (11 ét.)*, *Tests, Séries & Modèles*, *Canvas Nodal*, *Recettes*) ainsi qu'aux raccourcis *Importer*, *Guide* et *Paramètres*.
- **Établi Données & Tableur (`/` — Split Workbench)** : Lorsque des données sont chargées, l'accueil affiche directement au bord gauche le dock (`DatasetSessionList` + `VariableDockList` filtrable avec codes d'échelle `CONT`, `DISC`, `DATE`, `CAT`, `BIN` et badge `% NA`) couplé au tableur (`SpreadsheetWorkbench` à colonne `#` figée, colonnes typées, surbrillance synchronisée variable ↔ colonne, bascule **Nettoyées | Brutes** et sélecteur **50 / 100 / 250 lignes**).
- **PinnedDrawer (Volet latéral escamotable)** : Permet d'épingler des résultats d'analyses ou des graphiques pour les comparer côte à côte, quel que soit l'onglet actif.
- **StatusBar (Pied de page technique)** : Indique en temps réel l'état du backend local, le statut du tableur DuckDB / Parquet, le nombre de variables et le nom du jeu actif.

### 1.2 Palette de Commandes (`Ctrl+K` / `Cmd+K`)

La palette de commandes universelle permet de naviguer au clavier dans l'intégralité du logiciel sans quitter les mains des touches :
- Ouvrir un jeu de données récemment utilisé.
- Lancer directement un test statistique (ex: `> ANOVA`, `> Test de Shapiro-Wilk`).
- Insérer un nouveau nœud sur le canvas visuel.
- Basculer entre le thème clair et le thème sombre.
- Exporter les résultats au format PDF, Word ou Excel.

### 1.3 Typographie Tabulaire & Respect Visuel

Conformément à la charte [ELMAS.md](../ELMAS.md), toutes les valeurs numériques (p-values, statistiques de test, coefficients, métriques d'erreur) sont rendues en police à chasse numérique fixe (`font-variant-numeric: tabular-nums` / classe CSS `.ui-num`). Ce choix garantit que les colonnes de chiffres restent parfaitement alignées verticalement, facilitant la comparaison visuelle des ordres de grandeur.

Les thèmes **Sombre** (conçu pour réduire la fatigue oculaire lors des longues sessions d'analyse) et **Clair** (idéal pour les environnements fortement éclairés ou les présentations sur projecteur) disposent d'un contraste conforme aux exigences WCAG AA.

---

## 2. Formats de Données, Ingestion & Sécurité

OpenStats intègre un pipeline d'ingestion robuste qui prend en charge les formats de données standards de l'industrie tout en garantissant une étanchéité stricte contre les fichiers malveillants.

### 2.1 Formats Pris en Charge

| Format | Extension | Caractéristiques & Détection |
|---|---|---|
| **CSV** | `.csv` | Détection automatique du séparateur (virgule, point-virgule, tabulation, pipe) et de l'encodage de caractères (`utf-8`, `cp1252`, `iso-8859-1`) via analyse statistique des fréquences. |
| **Excel** | `.xlsx`, `.xls` | Détection automatique des feuilles. Une boîte de dialogue modale permet de sélectionner la feuille d'intérêt ou d'inspecter les plages nommées. |
| **JSON** | `.json` | Normalisation automatique des structures imbriquées (`pd.json_normalize`) avec profondeur maximale configurable. |
| **JSON Lines** | `.jsonl` | Ingestion streaming ligne à ligne pour les jeux de données volumineux ou les logs applicatifs. |
| **Apache Parquet** | `.parquet` | Format natif interne. Chargement binaire ultra-rapide avec conservation stricte des métadonnées de colonnes et des types primitifs. |

> **Formats propriétaires (SPSS `.sav`, Jamovi `.omv`, Stata `.dta`, SAS `.sas7bdat`)** :  
> Ces formats ne sont pas directement ingérés par le moteur de base. Pour les importer dans OpenStats, veuillez les exporter préalablement au format CSV ou Parquet depuis leur logiciel d'origine.

### 2.2 Validation par Magic Bytes

Avant toute tentative de désérialisation, le moteur d'ingestion vérifie l'en-tête binaire (*magic bytes*) de chaque fichier téléversé (`validate_file_magic`) :
- Les fichiers `.xlsx` doivent impérativement débuter par la signature PKZIP (`PK\x03\x04`).
- Les fichiers `.xls` doivent posséder la signature OLE2 (`\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1`).
- Les fichiers `.parquet` doivent respecter l'en-tête officiel `PAR1`.
- Les fichiers textuels (`.csv`, `.json`) subissent une analyse préventive de conformité structurelle. Tout fichier binaire renommé frauduleusement en `.csv` est immédiatement rejeté avec une erreur explicite.

### 2.3 Stockage Versionné & Moteur DuckDB

Lorsque des transformations (nettoyage, imputation, encodage) sont appliquées à un jeu de données :
1. Une nouvelle version immuable est enregistrée sur disque au format Apache Parquet dans `%APPDATA%\OpenStats\data\`.
2. L'historique des versions et la traçabilité des transformations sont persistés dans la base SQLite locale `openstats.db`.
3. Le moteur analytique **DuckDB** exécute les calculs statistiques et les filtres SQL directement sur les fichiers Parquet sans dupliquer l'intégralité du DataFrame en mémoire RAM, permettant de manipuler des tables de plusieurs centaines de milliers de lignes avec une empreinte mémoire inférieure à 200 Mo.

---

## 3. L'Analyse Méthodique en 11 Étapes

L'Analyse Méthodique (`backend/app/core/pipeline/`) constitue le cœur guidé d'OpenStats. Elle accompagne l'analyste à travers un protocole scientifique rigoureux, garantissant qu'aucune étape préparatoire indispensable n'est omise avant la modélisation.

```
[1. Problème] ──> [2. Données] ──> [3. Nettoyage] ──> [4. Univarié] ──> [5. Bivarié]
                                                                            │
┌─────────────────────── [Boucle de Remédiation] ───────────────────────────┘
│
├───> [6. Diagnostics] ──> [7. Transformations] ──> [8. Re-diagnostic] ──┐
│                                                           │             │
│                                           (Qualité en     │ (Qualité    │
│                                            progrès)       │  stagne)    │
│                                                           ▼             ▼
└───────────────────────────────────────────────────────────┘       [9. Modélisation]
                                                                            │
                                                                            ▼
                                                                    [10. Validation]
                                                                            │
                                                                            ▼
                                                                  [11. Interprétation]
```

### Étape 1 : Comprendre le Problème
L'utilisateur formule son objectif de recherche :
- Choix de la variable cible ($Y$) ou mode non supervisé.
- Qualification du type de problème : régression continue, classification binaire/multiclasse, prévision de séries chronologiques ou analyse descriptive pure.

### Étape 2 : Comprendre les Données & Profilage
Le moteur analyse chaque colonne et infère un type sémantique :
- **Continu** : variable numérique d'échelle ou de ratio.
- **Catégoriel** : modalité discrète, facteur ou variable ordinale.
- **Temporel** : horodatage ou date. Le jeu de données est automatiquement ordonné chronologiquement.
- **Identifiant** : clé primaire, matricule ou identifiant technique. Ces variables sont automatiquement exclues de la modélisation pour prévenir le surapprentissage trivial.

*L'utilisateur a le pouvoir de rectifier manuellement tout type inféré.*

### Étape 3 : Nettoyage & Qualité des Données
Vérification de l'intégrité fondamentale :
- Taux de valeurs manquantes par variable et par ligne.
- Détection des doublons stricts et quasi-doublons.
- Identification des colonnes constantes ou à variance quasi-nulle.
- Détection des identifiants déguisés (ex: code numérique incrémental à 100% d'unicité).

### Étape 4 : Analyse Univariée
Calcul systématique des indicateurs statistiques fondamentaux pour chaque variable :
- Position : moyenne, médiane, mode, quantiles (10%, 25%, 50%, 75%, 90%).
- Dispersion : écart-type, variance, étendue interquartile (IQR).
- Forme : asymétrie (*skewness* de Fisher-Pearson) et aplatissement (*kurtosis* de Pearson).
- Taux de valeurs aberrantes selon la règle de Tukey ($1.5 \times \text{IQR}$).

### Étape 5 : Analyse Bivariée
Exploration des relations croisées :
- Matrice de corrélations de Pearson et de Spearman pour les variables continues.
- Tableau de contingence et statistique du $\chi^2$ pour les couples catégoriels.
- Calcul de l'**Information Mutuelle** (MI) pour détecter les dépendances non linéaires (ex: relations paraboliques où Pearson est proche de zéro mais la relation est déterministe).

### Étape 6 : Diagnostics Statistiques Avancés
Détection ciblée des violations d'hypothèses statistiques :
- Non-normalité (test de Shapiro-Wilk).
- Hétéroscédasticité (variances inégales entre groupes via test de Levene).
- Multicolinéarité sévère (Facteur d'Inflation de la Variance, VIF > 5 ou 10).
- Présence d'observations à fort levier ou forte influence (distance de Cook).
- Déséquilibre prononcé de la variable cible en classification.

### Étape 7 : Transformations & Sélection des Remèdes
Pour chaque problème diagnostiqué à l'étape 6, le système propose une liste de remèdes recommandés :
- Transformation logarithmique ($\ln(x)$ ou $\ln(1+x)$) ou Box-Cox pour corriger l'asymétrie positive.
- Winsorisation ou découpage quantile pour tempérer les valeurs extrêmes.
- Imputation médiane (variables continues) ou modale (catégorielles).
- Encodage One-Hot ou Target Encoding.

**Règles strictes de sécurité** :
1. La variable cible ne peut *jamais* être supprimée.
2. Une seule transformation de forme (log, racine, Box-Cox) est autorisée par variable et par session.

### Étape 8 : Re-diagnostic & Boucle de Remédiation
L'étape 4 est rejouée sur le jeu de données transformé. La gravité cumulée des anomalies résiduelles est comparée à la situation initiale :
- **Si la qualité progresse** : les transformations sont validées et l'analyse continue.
- **Si la gravité stagne ou s'aggrave** : l'itération est automatiquement annulée (`kept: false`), protégeant l'utilisateur contre des manipulations contre-productives.

### Étape 9 : Modélisation
Entraînement d'un éventail d'algorithmes adaptés au problème (jusqu'à 15 modèles supervisés ou 6 modèles temporels). Chaque modèle exclu indique explicitement son motif (ex: *"Effectif insuffisant : $N < 80$"*).

### Étape 10 : Validation Rigoureuse & Référence Naïve
Tout score de performance ($R^2$, RMSE, Précision, AUC) est obligatoirement mis en miroir face à une **référence naïve** (*dummy baseline*) :
- En régression : prédiction constante de la moyenne.
- En classification : prédiction constante de la classe majoritaire.
- En séries temporelles : modèle de persistance (la valeur de demain égale celle d'aujourd'hui).

*Un score n'a aucune valeur statistique sans sa référence.*

### Étape 11 : Interprétation Analytique Automatisée
Synthèse narrative rédigée en langage clair résumant les découvertes majeures, la qualité du modèle retenu, les variables les plus influentes et les réserves méthodologiques à formuler.

---

## 4. L'Explorateur Adaptatif & Contrôle FDR

À l'inverse de l'Analyse Méthodique qui suit un plan prédéfini, l'**Explorateur Adaptatif** (`core/exploration/`) est un moteur de découverte opportuniste : il cherche ce qu'il y a d'intéressant dans vos données sans altérer le DataFrame d'origine.

```
       [Contexte & Matrice d'Information Mutuelle]
                            │
                            ▼
      [Sélection de la sonde optimale Coût / Bénéfice]
                            │
                            ▼
              [Exécution de la Sonde]
                            │
                            ▼
           [Collecte des Découvertes (Findings)]
                            │
                            ▼
        [Mise à jour du Graphe de Faits Établis]
                            │
        ┌───────────────────┴───────────────────┐
        ▼                                       ▼
[Déblocage de Nouvelles Sondes]       [Contrôle Global FDR]
 (ex: VIF, Interaction, Granger)      (Benjamini-Hochberg 5%)
```

### 4.1 Mécanisme des Sondes et Déblocage Conditionnel

L'exploration est régie par un graphe orienté de sondes statistiques. Chaque sonde déclare les faits qui la déclenchent (`triggered_by`) et les faits qu'elle produit (`yields`) :
- Une sonde initiale de corrélation linéaire qui découvre une liaison forte débloque les sondes d'interaction et de redondance (multicolinéarité).
- Une sonde de comparaison de groupes significative débloque la sonde de segmentation fine.
- Une sonde temporelle qui identifie une corrélation débloque le test de causalité de Granger.

Deux jeux de données différents n'exécutent jamais les mêmes sondes ni dans le même ordre.

### 4.2 Contrôle Global du Taux de Fausses Découvertes (FDR)

Le problème majeur du *data mining* non supervisé est le risque de faux positifs : en testant 100 relations aléatoires au seuil $\alpha = 0.05$, environ 5 relations apparaîtront significatives par pur hasard (*p-hacking* mécanique).

OpenStats apporte une solution rigoureuse :
1. **Comptabilisation exhaustive** : chaque hypothèse évaluée est enregistrée dans le dénominateur de session, y compris les tests non concluants.
2. **Correction de Benjamini-Hochberg** : appliquée globalement à l'ensemble de la session d'exploration (via `statsmodels.stats.multitest.multipletests`).
3. **Transparence totale** : l'écran affiche en permanence le bilan complet, par exemple :  
   `"48 hypothèses testées — 4 découvertes confirmées au seuil FDR de 5 %"`.

### 4.3 Classement des Découvertes

Les découvertes (*findings*) sont triées selon un indice d'intérêt composite :

$$\text{Intérêt} = |\text{Taille de l'effet}| \times \text{Confiance} \times \text{Nouveauté}$$

Le facteur de **nouveauté** applique une pénalité progressive aux variables déjà surreprésentées dans les découvertes précédentes, évitant ainsi que dix variantes de la même corrélation ne monopolisent les dix premières places du classement.

---

## 5. Atelier Statistique Libre & Tests d'Hypothèses

Accessible via l'onglet **Studio**, l'Atelier Statistique Libre permet d'exécuter des tests d'hypothèses ciblés à la demande avec sélection automatique des tests paramétriques ou non paramétriques en fonction des postulats de distribution.

### 5.1 Test de Normalité (Shapiro-Wilk)

- **Objectif** : Évaluer si une série quantitative continue suit une distribution normale gaussienne.
- **Sous-échantillonnage intelligent** : Pour les échantillons volumineux ($N > 5000$), le test de Shapiro-Wilk devient artificiellement hypersensible aux écarts microscopiques. OpenStats applique automatiquement un sous-échantillonnage stratifié représentatif ($N=5000$) tout en affichant l'asymétrie et l'aplatissement réels de l'échantillon complet.
- **Règle de décision** : Si $p \ge 0.05$, l'hypothèse nulle de normalité est conservée.

### 5.2 Comparaisons de Deux Groupes Indépendants

Pour comparer une variable quantitative $Y$ entre deux groupes d'une variable binaire $X$ :

```
                  [Vérification de la Normalité]
                    (Shapiro-Wilk ou TCL N >= 50)
                                 │
                 ┌───────────────┴───────────────┐
                 ▼                               ▼
             [Normale]                     [Non Normale]
                 │                               │
       [Test de Levene (Variances)]              ▼
                 │                          Test U de
        ┌────────┴────────┐               Mann-Whitney
        ▼                 ▼              (Rank-Biserial r)
    [Égales]         [Inégales]
        │                 │
    Test t de         Test t de
     Student            Welch
  (Cohen's d)        (Cohen's d)
```

1. **Test t de Student** : Appliqué si la normalité est respectée et que les variances sont égales ($p_{\text{Levene}} \ge 0.05$).  
   *Taille d'effet* : $d$ de Cohen (calculé avec l'écart-type groupé pondéré).
2. **Test t de Welch** : Appliqué si la normalité est respectée mais que les variances sont hétéroscédastiques ($p_{\text{Levene}} < 0.05$). Ajuste les degrés de liberté via la formule de Welch-Satterthwaite.
3. **Test U de Mann-Whitney (Wilcoxon)** : Test non paramétrique sur les rangs appliqué si la normalité est rejetée.  
   *Taille d'effet* : Corrélation de rang bisériale $r = 1 - \frac{2U}{n_1 n_2}$.

### 5.3 Comparaisons de Plus de Deux Groupes (K Groupes)

1. **ANOVA à un facteur (One-way ANOVA)** :  
   Modèle linéaire décomposant la somme des carrés inter-groupes et intra-groupes ($F$-test).  
   *Taille d'effet* : $\eta^2$ (Eta-carré) et $\eta^2$ partiel.
2. **Test de Kruskal-Wallis** :  
   Équivalent non paramétrique basé sur les sommes des rangs.  
   *Taille d'effet* : $\eta^2_H = \frac{H - k + 1}{N - k}$.

### 5.4 Analyse d'Indépendance & Contingence

1. **Test du $\chi^2$ de Pearson** :  
   Évalue l'indépendance statistique entre deux variables qualitatives à partir du tableau croisé des effectifs observés vs attendus.  
   *Taille d'effet* : $V$ de Cramér ($0 \le V \le 1$).
2. **Test Exact de Fisher** :  
   Déclenché automatiquement sur les tables $2 \times 2$ lorsqu'au moins une case présente un effectif théorique inférieur à 5, là où le test du $\chi^2$ perd sa validité asymptotique.

---

## 6. Analyses Post-Hoc, Tests d'Équivalence & Puissance

Lorsque les tests globaux (ANOVA, Kruskal-Wallis) rejettent l'hypothèse nulle ($p < 0.05$), il est nécessaire d'identifier précisément quelles paires de groupes diffèrent significativement.

### 6.1 Tests Post-Hoc par Paires

- **Test de Tukey HSD (Honestly Significant Difference)** :  
  Contrôle le taux d'erreur par famille (*Family-Wise Error Rate*) pour toutes les comparaisons par paires lorsque l'hypothèse d'homogénéité des variances de Levene est validée ($p \ge 0.05$).
- **Test de Games-Howell** :  
  Test post-hoc robuste utilisé impérativement lorsque les variances sont hétérogènes ($p_{\text{Levene}} < 0.05$) ou que les effectifs des groupes sont fortement inégaux. Utilise les degrés de liberté de Welch-Satterthwaite et la distribution de l'amplitude studentisée.

### 6.2 Tests d'Équivalence (TOST — Two One-Sided Tests)

Une p-value non significative ($p > 0.05$) dans un test t classique ne démontre **jamais** que deux moyennes sont égales : elle indique seulement un manque de preuve pour affirmer leur différence.

Pour prouver rigoureusement que deux groupes sont équivalents :
- L'utilisateur définit une borne d'équivalence $\Delta$ (ou accepte la marge par défaut d'OpenStats fixée à $0.2 \sigma$, correspondant au seuil conventionnel d'effet négligeable de Cohen).
- Le moteur exécute **deux tests t unilatéraux simultanés** :
  1. $H_{01} : \mu_1 - \mu_2 \le -\Delta$
  2. $H_{02} : \mu_1 - \mu_2 \ge +\Delta$
- Si les deux p-values sont inférieures à $\alpha = 0.05$, l'équivalence pratique est statistiquement établie à 95% de confiance.

### 6.3 Puissance Statistique & Dimensionnement d'Échantillon

L'Atelier intègre un module de planification statistique (`core/statistical_power.py`) :
- **Puissance observée post-hoc** ($1 - \beta$) : Calcule la probabilité qu'avait l'étude de détecter l'effet observé compte tenu de la taille réelle de l'échantillon.
- **Effet Minimum Détectable (MDE)** : Détermine la plus petite taille d'effet ($d$ de Cohen) que votre échantillon permet de détecter avec une puissance garantie de 80% à $\alpha = 0.05$.
- **Calcul prévisionnel de taille d'échantillon ($N$)** : Indique le nombre de sujets requis par groupe pour garantir une puissance cible ($80\%$ ou $90\%$) pour un effet attendu donné.

---

## 7. Analyses Factorielles Multivariées

OpenStats fournit une suite complète d'analyses factorielles géométriques (`core/factor_*.py`) permettant de réduire la dimensionnalité et de visualiser les proximités entre individus et variables.

```
       [Tableau de Données Multivarié]
                      │
     ┌────────────────┼────────────────┐
     ▼                ▼                ▼
  [ACP/PCA]        [AFC/CA]        [ACM/MCA]
(Numériques)     (Tableau de     (Qualitatives
                 Contingence)      Multiples)
     │                │                │
     ▼                ▼                ▼
• Scree plot     • Profils lignes • Tableau de Burt
• Cercle de corr.  & colonnes     • Matrice indicatrice
• Biplot 2D/3D   • Inertie totale • Mesures eta^2
```

### 7.1 Analyse en Composantes Principales (ACP / PCA)

Dédiée aux tableaux d'individus $\times$ variables quantitatives continues.
- **Standardisation** : Centrage et réduction systématiques (matrice de corrélation) pour neutraliser les effets d'échelle.
- **Critère de Kaiser** : Sélection des axes ayant une valeur propre $\lambda > 1$.
- **Graphique des éboulis (*Scree Plot*)** : Visualisation du pourcentage de variance restitué par chaque composante avec détection automatique du point d'inflexion (coude de Cattell).
- **Cercle des corrélations** : Représentation des variables sur le plan factoriel avec coefficients de corrélation, cosinus carrés ($\cos^2$, qualité de représentation) et contributions relatives ($Ctr\%$).
- **Biplot interactif 2D & 3D** : Projection simultanée des individus et des vecteurs variables via Plotly.

### 7.2 Analyse Factorielle des Correspondances (AFC / CA)

Dédiée à l'étude des liaisons entre deux variables qualitatives à travers leur tableau de contingence croisé.
- Calcul des masses et des profils lignes et colonnes.
- Décomposition de l'inertie totale via la métrique du $\chi^2$.
- Représentation conjointe des modalités lignes et colonnes sur le plan factoriel optimal.

### 7.3 Analyse des Correspondances Multiples (ACM / MCA)

Extension de l'AFC à un ensemble de plus de deux variables catégorielles.
- Construction automatique du tableau disjonctif complet (matrice indicatrice) et du tableau de Burt.
- Correction des valeurs propres pour restituer les parts d'inertie réelles.
- Calcul des rapports de corrélation ($\eta^2$) de chaque variable avec les axes factoriels.

---

## 8. Économétrie, Causalité & Régressions Avancées

Pour les économistes, biostatisticiens et chercheurs en sciences sociales, OpenStats implémente les méthodes économétriques les plus rigoureuses.

### 8.1 Régression Linéaire OLS & Erreurs Standards Robustes

En présence d'hétéroscédasticité, les erreurs-types standards de la régression OLS classique sous-estiment la variance des estimateurs, rendant les p-values trop optimistes. OpenStats intègre les matrices de covariance robustes de White :
- **HC0** : Estimateur originel de White (1980).
- **HC1** : Ajustement par les degrés de liberté $\frac{N}{N - k}$.
- **HC3** (Recommandé par défaut) : Correction par le levier $(1 - h_{ii})^2$, offrant d'excellentes propriétés en petit échantillon ($N < 250$).

### 8.2 Batterie Complète de Diagnostics de Régression

1. **Test de Breusch-Pagan** : Détection formelle de l'hétéroscédasticité des résidus.
2. **Test de Jarque-Bera** : Vérification de la normalité conjointe de l'asymétrie et de l'aplatissement des résidus.
3. **Tests de Durbin-Watson & Ljung-Box** : Détection de l'autocorrélation résiduelle d'ordre 1 et supérieur.
4. **Test RESET de Ramsey** : Test de spécification fonctionnelle (détection de termes non linéaires omis ou de mauvaise forme mathématique).
5. **Distance de Cook & Levier** : Détection des points influents et aberrants multivariés pouvant faire basculer la droite de régression.

### 8.3 Régression Quantile

La régression OLS modélise uniquement l'espérance conditionnelle $E[Y|X]$. La régression quantile modélise les quantiles conditionnels de la cible :

$$\tau \in \{0.10, 0.25, 0.50, 0.75, 0.90\}$$

Permet d'étudier l'impact des prédicteurs sur les extrêmes de la distribution (ex: impact d'une politique publique sur les 10% des revenus les plus bas vs la médiane).

### 8.4 Modèles de Données de Comptage (Poisson & Négative Binomiale)

- **Régression de Poisson** : Pour les variables dépendantes à valeurs entières positives ($\mathbb{N}_0$, ex: nombre d'accidents, nombre de consultations).
- **Test de Surdispersion de Cameron-Trivedi** : Vérifie l'hypothèse d'équidispersion de Poisson ($\text{Var}(Y) = E[Y]$).
- **Régression Négative Binomiale** : Déclenchée si la surdispersion est significative, intégrant un paramètre de dispersion $\alpha$ pour corriger les erreurs standards.

### 8.5 Modèles de Données de Panel

Pour les données répétées dans le temps sur plusieurs individus/entités :
- **Pooled OLS** : Modèle groupé avec erreurs standards regroupées (*clustered SE*) par entité.
- **Effets Fixes (Within Estimator)** : Élimine tous les biais invariants dans le temps propres à chaque individu (facteurs inobservés constants).
- **Effets Aléatoires (GLS)** : Modélise la variance inter et intra-individuelle.
- **Test de Spécification de Hausman** : Arbitre rigoureusement entre Effets Fixes et Effets Aléatoires. Si $p < 0.05$, les effets fixes sont obligatoires (incompatibilité de l'hypothèse d'orthogonalité des effets aléatoires).

### 8.6 Analyse de Survie (Biostatistique)

- **Estimateur de Kaplan-Meier** : Tracé non paramétrique des courbes de survie avec bandes de confiance à 95% calculées via la formule de Greenwood.
- **Test du Log-Rank** : Comparaison statistique non paramétrique de plusieurs courbes de survie de groupes de patients ou de composants industriels.
- **Modèle à Risques Proportionnels de Cox** : Régression semi-paramétrique estimant les *Hazard Ratios* (HR) avec intervalles de confiance à 95% et vérification de l'hypothèse de proportionnalité des risques.

### 8.7 Inférence Causale

1. **Appariement sur Score de Propension (PSM — Propensity Score Matching)** :
   - Estimation du score de propension par régression logistique.
   - Appariement 1:1 au plus proche voisin (*nearest neighbor*) avec application d'un **caliper** strict pour éviter les mauvais appariements.
   - Vérification de l'équilibrage des covariables via le tracé d'un **Love Plot** (différences moyennes standardisées SMD $< 0.1$).
2. **Différence des Différences (Diff-in-Diff)** :  
   Estimation de l'effet causal de traitement moyen (ATT) en exploitant l'interaction entre groupe traité/contrôle et période pré/post-intervention avec validation des tendances parallèles.
3. **Moindres Carrés à Deux Étapes (2SLS — Two-Stage Least Squares)** :  
   Régression à variables instrumentales pour corriger l'endogénéité (biais de variable omise ou causalité inverse). Évalue la force de l'instrument via le test $F$ de première étape ($F > 10$).

### 8.8 Classification Ascendante Hiérarchique (CAH / HAC)

Regroupement non supervisé d'individus ou de variables :
- Critères d'agrégation supportés : Ward (minimisation de la variance intra-classe), Lien Complet, Lien Moyen, Lien Simple.
- Tracé interactif du dendrogramme avec coloration des clusters optimaux.
- Évaluation de la compacité des partitions par coefficient de silhouette et corrélation cophénétique.

---

## 9. Analyse des Séries Temporelles

Le module de séries temporelles (`backend/app/core/timeseries/`) offre une couverture complète de l'économétrie univariée et multivariée.

### 9.1 Diagnostics de Stationnarité & Décomposition

- **Test ADF (Augmented Dickey-Fuller)** : Test de présence de racine unitaire avec régression incluant constante et tendance temporelle.
- **Test KPSS** : Test complémentaire où l'hypothèse nulle est la stationnarité.
- **Règle méthodologique de l'ordre $d$** : Le degré de différenciation $d$ d'un modèle ARIMA est strictement déterminé par ces tests de racine unitaire, et **jamais** par comparaison aveugle d'AIC. Des modèles d'ordres $d$ différents ne portent pas sur les mêmes données transformées et leurs critères d'information ne sont pas comparables.
- **Décomposition Saisonière** : Séparation additive ($Y = T + S + R$) ou multiplicative ($Y = T \times S \times R$) avec estimation de la tendance lissée et du profil périodique.

### 9.2 Modèles Prévisionnels Univariés

1. **ARIMA & SARIMA** : Intégration des ordres autorégressifs ($p$), de différenciation ($d$), de moyenne mobile ($q$) et de leur pendant saisonnier $(P, D, Q)_s$.
2. **Prophet** (Meta) : Modèle additif décomposable robuste aux données manquantes, aux valeurs aberrantes et aux vacances, avec modélisation automatique des points d'inflexion (*changepoints*).
3. **Lissage Exponentiel de Holt-Winters** : Prise en compte de la tendance locale (additive ou amortie) et de la saisonnalité.

### 9.3 Modèles Multivariés & Causalité Temporelle

1. **Vecteurs Autorégressifs (VAR)** : Modélisation des interactions dynamiques croisées entre plusieurs séries temporelles stationnaires.
2. **Modèle Vectoriel à Correction d'Erreur (VECM)** : Déclenché lorsque des séries non stationnaires sont liées par une relation de long terme.
3. **Test de Cointégration de Johansen** : Détermine le rang de cointégration via la statistique de la Trace et de la Valeur Propre Maximale.
4. **Causalité au sens de Granger** : Évalue si l'historique d'une variable $X$ améliore significativement la prévision d'une variable $Y$ par rapport à l'historique de $Y$ seul.
5. **Fonctions de Réponse aux Impulsions (IRF)** : Simule l'effet dans le temps d'un choc exogène d'un écart-type sur les autres variables du système.
6. **Décomposition de la Variance de l'Erreur de Prévision (FEVD)** : Mesure la part d'incertitude d'une variable attribuable à ses propres chocs vs les chocs des autres variables.
7. **BVAR & ARDL** : VAR Bayésien avec prior de Minnesota pour grands systèmes, et modèle autorégressif à retards échelonnés.

### 9.4 Ruptures Structurelles

- **Test de Chow** : Test d'égalité des paramètres avant et après une date de choc connue (ex: crise financière, confinement).
- **Test QLR (Quandt Likelihood Ratio)** : Recherche automatique de date de rupture inconnue par calcul du sup-Wald sur l'ensemble de la chronique.

---

## 10. Machine Learning, AutoML & Explicabilité SHAP

OpenStats démystifie le Machine Learning en l'ancrant dans une culture de preuve et d'explicabilité.

### 10.1 Catalogue des Modèles Supervisés

- **12 Modèles de Régression** : OLS, Ridge, Lasso, ElasticNet, Régression Polynomiale, Arbre de Décision (CART), Forêt Aléatoire, Gradient Boosting, XGBoost, LightGBM, Support Vector Regression (SVR), K-Plus Proches Voisins (KNN).
- **11 Modèles de Classification** : Régression Logistique, Arbre de Décision, Forêt Aléatoire, Gradient Boosting, AdaBoost, XGBoost, LightGBM, SVM (noyaux linéaire et RBF), KNN, Analyse Discriminante Linéaire (LDA), Analyse Discriminante Quadratique (QDA).

### 10.2 AutoML Compétitif & Garde-Fou Temporel

Le moteur d'AutoML évalue l'ensemble des algorithmes éligibles par validation croisée :
- **Budget temps strict** : Un compteur en temps réel interrompt proprement la recherche si le budget alloué par l'utilisateur est atteint.
- **Validation temporelle étanche** : Pour les données horodatées, la validation croisée utilise exclusivement une origine glissante (*rolling-origin*) ou `TimeSeriesSplit`. Le mélange aléatoire (*K-Fold* standard) est formellement banni pour éliminer tout risque de fuite de données vers le passé.

### 10.3 Explicabilité SHAP (Shapley Additive exPlanations)

Pour ouvrir les « boîtes noires » :
- **TreeExplainer** : Calcul ultra-rapide et exact des valeurs de Shapley pour les modèles ensemblistes (Forêts, XGBoost, LightGBM).
- **KernelExplainer** : Approximation universelle pour les modèles non arborescents (SVM, réseaux, régressions régularisées).
- **Visualisations disponibles** :
  - *Summary Plot (Beeswarm)* : Montre l'impact positif ou négatif de chaque variable sur la prédiction pour chaque individu.
  - *Dependence Plot* : Visualise l'effet non linéaire d'une variable et ses interactions avec une seconde variable.
  - *Importance par Permutation* : Mesure la perte de performance empirique lorsque les valeurs d'une variable sont mélangées au hasard.

---

## 11. Canvas Nodal & Simulations Stochastiques

Pour les analyses sur-mesure et l'exploration visuelle, OpenStats propose un environnement de programmation visuelle par flux de données (*dataflow canvas*).

### 11.1 Manipulation du Canvas Nodal

- **Ajout de nœuds** : Clic droit sur le canvas ou appui sur `Espace` / palette de commandes.
- **Connexion** : Glissez-déposez une arête entre la sortie d'un nœud amont et l'entrée d'un nœud aval compatible.
- **Exécution réactive** : Chaque nœud calcule son état dès que ses entrées sont satisfaites.
- **Inspecteur de données** : Cliquez sur un nœud pour ouvrir son volet de configuration et visualiser son DataFrame résultant ou son graphique interactif Plotly.

### 11.2 Nœud de Scripting Python Intégré

Le **PythonNode** intègre l'éditeur de code professionnel Monaco (le cœur de VS Code) :
- Accès direct au DataFrame amont via la variable `df`.
- Modification en place ou création d'une nouvelle table retournée dans `out_df`.
- Coloration syntaxique, autocomplétion et indentation automatique.

> ⚠️ **Avertissement de Sécurité** :  
> L'exécution du code dans le nœud Python s'effectue localement via l'interpréteur Python du poste sans confinement (*sandbox*). Cet outil est réservé à votre propre usage d'analyste sur vos données personnelles. Ne collez jamais de code Python non audité provenant de sources inconnues.

### 11.3 Simulations Stochastiques & Scénarios What-If

1. **Simulation Monte Carlo** :
   - Définition de lois de probabilité sur les paramètres d'entrée (Normale, Log-Normale, Uniforme, Triangulaire, Beta).
   - Tirage de 1 000 à 100 000 itérations pseudo-aléatoires.
   - Tracé de la distribution de probabilité cumulée des résultats, calcul de la Value at Risk (VaR) et des intervalles de confiance empiriques.
2. **Bootstrapping Non Paramétrique** :
   - Rééchantillonnage avec remise de l'échantillon d'origine ($B = 2000$ répliques).
   - Construction d'intervalles de confiance empiriques à 95% pour des estimateurs complexes (médiane, ratio, coefficient de corrélation) sans formuler aucune hypothèse de normalité asymptotique.
3. **Générateur de Scénarios What-If** :
   - Définition de courbes de sensibilité multi-variables.
   - Simulation de chocs conjoints (ex: *« Que devient le résultat d'exploitation si l'inflation augmente de +2% et les ventes baissent de -5% ? »*).

---

## 12. Exports, Rapports Automatisés & Génération de Code

OpenStats met un point d'honneur à ne jamais enfermer l'analyste dans un écosystème propriétaire : toutes vos analyses sont intégralement exportables sous forme de documents prêts à publier ou de code source indépendant.

### 12.1 Rapports Professionnels Prêts à Publier

Générez en un clic des livrables de haute tenue visuelle :
- **PDF** : Mise en page élégante générée via ReportLab, intégrant les tableaux typographiques, les graphiques vectoriels et les synthèses narratives.
- **Word (.docx)** : Document modifiable structuré selon les chartes de traitement de texte officielles (styles hiérarchiques, tables de contingence éditables).
- **PowerPoint (.pptx)** : Présentation de diapositives calibrée pour les comités de direction ou les soutenances universitaires.

### 12.2 Moteur de Génération de Code Source

OpenStats peut traduire l'intégralité de votre canvas visuel ou de votre analyse méthodique en un script autonome exécutable hors du logiciel :

| Cible | Extension | Technologie & Caractéristiques |
|---|---|---|
| **Python** | `.py` | Script propre utilisant Pandas, Scikit-Learn et Statsmodels. |
| **Notebook Jupyter** | `.ipynb` | Document interactif avec cellules de code documentées et visualisations intégrées. |
| **R** | `.R` | Script utilisant `tidyverse`, `ggplot2` et les packages statistiques de R. |

**Garanties de l'Assembleur Topologique (`core/code_generation/emitter.py`)** :
1. **Tri topologique strict** : Les instructions sont ordonnées selon les dépendances réelles du graphe, et non selon l'ordre chronologique d'ajout des nœuds sur l'écran.
2. **Imports groupés en tête** : Toutes les bibliothèques requises sont collectées et déclarées proprement au début du fichier.
3. **Fidélité numérique vérifiée** : Le script exporté reproduit exactement les résultats numériques calculés dans l'interface (écart inférieur à $10^{-15}$).

---

## 13. Raccourcis Clavier & Dépannage

### 13.1 Raccourcis Clavier Principaux

| Raccourci | Action |
|---|---|
| `Ctrl + K` / `Cmd + K` | Ouvrir la Palette de Commandes Universelle. |
| `Ctrl + O` | Importer un nouveau jeu de données. |
| `Ctrl + S` | Sauvegarder l'état du projet ou du canvas nodal. |
| `Ctrl + E` | Exporter le rapport ou générer le code source. |
| `Espace` (sur le Canvas) | Ouvrir le menu d'ajout de nœuds contextuel. |
| `Suppr` / `Backspace` | Supprimer le nœud ou l'arête sélectionné(e). |
| `Ctrl + Z` / `Ctrl + Y` | Annuler / Rétablir la dernière action sur le canvas. |
| `F11` | Basculer en mode Plein Écran. |

### 13.2 Questions Fréquentes & Dépannage

**Q : L'application affiche un message « Port déjà utilisé » au démarrage.**  
*R : OpenStats résout automatiquement ce conflit en négociant dynamiquement un port libre avec le système d'exploitation lors du lancement.*

**Q : Mon fichier CSV s'affiche dans une seule colonne mal découpée.**  
*R : Lors de l'ingestion, cliquez sur les options avancées et forcez explicitement le délimiteur (ex: point-virgule `;`) ou l'encodage (ex: `ISO-8859-1`) si la détection statistique automatique a été trompée par un fichier trop hétérogène.*

**Q : Pourquoi mon modèle XGBoost ou Prophet est-il marqué comme « indisponible » ?**  
*R : Si vous utilisez la version de développement Python, assurez-vous d'avoir installé les dépendances optionnelles (`pip install xgboost lightgbm prophet lifelines`). Dans la version installée Windows (`.exe`), ces bibliothèques sont pré-packagées.*

---

*OpenStats — "From Data to Systems" — Conçu et développé sous la charte de qualité ElmasCore.*
