# Architecture Technique OpenStats — Spécifications d'Ingénierie

Ce document constitue la référence technique officielle d'**OpenStats**. Il détaille l'architecture système globale, les mécanismes de communication inter-processus (IPC), la sécurité des échanges locaux, le moteur de calcul analytique haute performance, ainsi que les protocoles de compilation, de packaging et de validation qualité.

Conçu selon les principes de la charte de développement [ELMAS.md](../ELMAS.md) (*"From Data to Systems"*), le système respecte une séparation stricte des responsabilités, une modularité par domaine métier et un contrôle rigoureux des flux de données.

---

## Table des Matières

1. [Vue d'Ensemble & Topologie Système](#1-vue-densemble--topologie-système)
2. [Communication Inter-Processus (IPC) & Sécurité](#2-communication-inter-processus-ipc--sécurité)
3. [Moteur Analytique Haute Performance (DuckDB & Parquet)](#3-moteur-analytique-haute-performance-duckdb--parquet)
4. [Génération de Code & Discipline des Exceptions](#4-génération-de-code--discipline-des-exceptions)
5. [Chaîne de Compilation & Packaging Windows](#5-chaîne-de-compilation--packaging-windows)
6. [Assurance Qualité, Métrologie & Suites de Tests](#6-assurance-qualité-métrologie--suites-de-tests)

---

## 1. Vue d'Ensemble & Topologie Système

OpenStats adopte une architecture hybride desktop découplée combinant un shell natif Chromium/Node.js pour l'expérience utilisateur et un moteur de calcul scientifique Python/C++ embarqué.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            SHELL DESKTOP ELECTRON                           │
│  (Electron 43 / Node.js 20 - Confinement de Processus & Context Isolation) │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    Frontend SPA (React 18 / Vite 7)                   │  │
│  │   • Tailwind CSS Design System (Theming Clair / Sombre, .ui-num)       │  │
│  │   • Redux Toolkit & RTK Query (Cache & Injection par Domaine)         │  │
│  │   • ReactFlow Canvas Nodal (@xyflow/react)                            │  │
│  │   • Visualisations Interactives Plotly.js                             │  │
│  │   • Éditeur Monaco (Scripting Python)                                 │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                         Requêtes HTTP / Flux SSE (127.0.0.1)
                         En-tête de Sécurité : X-Session-Token
                         Port Dynamique : <port> (argument positionnel)
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SERVEUR ANALYTIQUE PYTHON (FLASK 3.10)                   │
│                                                                             │
│  ┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────┐  │
│  │    Couche API REST    │ │  Moteurs Métier Core  │ │  Services Métier  │  │
│  │   (/api/v1/* modulaire│ │  • Pipeline 11 Étapes │ │  • Ingestion      │  │
│  │    Flask Blueprints)  │ │  • Explorateur Adapt. │ │  • Versioning     │  │
│  │                       │ │  • Modélisation ML/TS │ │  • Cache          │  │
│  └───────────┬───────────┘ └───────────┬───────────┘ └─────────┬─────────┘  │
│              │                         │                       │            │
│              └─────────────────────────┼───────────────────────┘            │
│                                        ▼                                    │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     COUCHE DE DONNÉES & PERSISTANCE                   │  │
│  │   • DuckDB SQL Engine : Requêtes analytiques vectorisées In-Memory    │  │
│  │   • Stockage Parquet Versionné : Fichiers immuables compressés        │  │
│  │   • Métadonnées SQLite : Base openstats.db (%APPDATA%\OpenStats\)     │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.1 Composants Techniques

- **Shell Desktop** : Electron 43+, assurant le cycle de vie de la fenêtre principale, la résolution de port réseau, l'orchestration du binaire backend et l'isolation des contextes de sécurité (`contextIsolation: true`, `nodeIntegration: false`).
- **Frontend SPA** : Développé en React 18, TypeScript (mode strict), Vite 7 et Tailwind CSS. La gestion d'état serveur s'appuie sur RTK Query avec injection d'endpoints segmentés par domaine (`store/baseApi.ts`).
- **Moteur Backend** : Serveur d'application Flask modulaire sous Python 3.10.11, structuré selon les normes architecturales de la charte ElmasCore (séparation API / Core / Services).
- **Moteur OLAP** : DuckDB 0.9+, exécutant des requêtes SQL vectorisées en C++ directement sur les fichiers Parquet sur disque.
- **Stockage Persistant** : Apache Parquet pour les tables volumineuses et SQLite (`openstats.db`) pour la topologie des graphes de nœuds, les préférences et les métadonnées de projet.

---

## 2. Communication Inter-Processus (IPC) & Sécurité

L'interaction entre l'interface utilisateur et le moteur de calcul scientifique repose sur un protocole HTTP/SSE local ultra-sécurisé, garantissant une étanchéité absolue contre les attaques locales et les processus orphelins.

### 2.1 Résolution Dynamique des Ports Réseau

Pour éliminer définitivement les échecs de démarrage consécutifs à un conflit de port (`Address already in use`), OpenStats ne dépend d'aucun port codé en dur :
1. Au lancement, le processus principal Electron (`electron/main.cjs`) interroge le sous-système réseau du système d'exploitation via un serveur d'écoute éphémère (`server.listen(0, '127.0.0.1')`) pour réserver un port TCP disponible aléatoire.
2. Ce port est transmis en argument CLI positionnel au binaire backend lors de son instanciation (`openstats-backend.exe <port>`), puis validé et extrait directement via `sys.argv[1].isdigit()` dans `backend/run_desktop.py` (sans drapeau `--port`).
3. En mode développement, le script de démarrage `backend/run_desktop.py` implémente une fonction miroir `find_free_port()` bindant sur `('127.0.0.1', 0)` pour attribuer le port avec certitude.
4. Le port est exposé au frontend via le script de préchargement sécurisé (`preload.cjs`) sous la variable globale `window.OPENSTATS_API_URL`.

### 2.2 Sécurisation par Jeton de Session Éphémère (Protection Anti-CSRF)

Dans une application de bureau exécutant un serveur HTTP local, toute page web malveillante ouverte simultanément dans le navigateur de l'utilisateur pourrait tenter d'attaquer `http://127.0.0.1:<port>` via des requêtes forgées (*Cross-Site Request Forgery*).

OpenStats neutralise ce vecteur d'attaque via un jeton de session cryptographique :
1. **Génération** : Au démarrage, Electron génère un jeton aléatoire de 32 octets encodé en hexadécimal (64 caractères hexadécimaux) via `crypto.randomBytes(32).toString('hex')`.
2. **Transmission sécurisée** : Le jeton est injecté dans les variables d'environnement du sous-processus backend (`OPENSTATS_SESSION_TOKEN`) et exposé dans le renderer uniquement via le `contextBridge` de `preload.cjs` (`window.OPENSTATS_SESSION_TOKEN`).
3. **Injection des requêtes** : Toutes les requêtes HTTP et connexions SSE sortantes du frontend injectent l'en-tête `X-Session-Token` (orchestré dans `frontend/src/lib/apiBase.ts`).
4. **Validation constante en backend** : Dans `backend/app/__init__.py`, le middleware `@app.before_request` intercepte chaque appel entrant :
   ```python
   expected_token = os.getenv("OPENSTATS_SESSION_TOKEN", "").strip()
   if expected_token and not app.config.get("TESTING"):
       client_token = request.headers.get("X-Session-Token", "").strip() or bearer
       if not client_token or not hmac.compare_digest(client_token, expected_token):
           return jsonify({
               "error": "Non autorisé : jeton de session éphémère manquant ou invalide.",
               "code": "invalid_session_token",
           }), 401
   ```
   L'utilisation de `hmac.compare_digest` prévient toute attaque par canal auxiliaire d'analyse temporelle (*timing attack*).

### 2.3 Mécanisme de Chien de Garde (Watchdog sur Stdin)

Pour empêcher qu'un plantage brutal du frontend ou une fermeture impromptue d'Electron ne laisse tourner un processus Python « zombie » en tâche de fond consommant CPU et mémoire :
1. Electron lance le processus backend avec redirection de flux `stdio: ['pipe', 'pipe', 'pipe']`.
2. L'environnement backend active le drapeau `OPENSTATS_WATCH_PARENT_STDIN=1`.
3. Un thread démon dédié (`start_parent_watchdog` dans `run_desktop.py`) surveille en continu le descripteur d'entrée standard :
   ```python
   def _watch():
       try:
           while sys.stdin.buffer.read(1):
               pass
       except Exception:
           pass
       os._exit(0)
   ```
4. Dès qu'Electron se termine ou crashe, le descripteur `stdin` émet un signal de fin de flux (EOF). Le thread de surveillance lève ou termine sa boucle et invoque immédiatement `os._exit(0)`, garantissant l'extinction instantanée de la machine virtuelle Python.

### 2.4 Arrêt Propre de l'Arborescence sous Windows

Sous Windows, le module Python `multiprocessing` (utilisé par Scikit-Learn, PyTorch ou le compilateur PyInstaller) instancie des sous-processus qui ne sont pas automatiquement rattachés à un groupe de processus lors d'un `proc.kill()` standard.

Pour garantir une purge propre :
Dans `electron/main.cjs`, la fermeture de l'application invoque l'outil système Windows `taskkill.exe` avec les drapeaux `/T` (arborescence récursive) et `/F` (fermeture forcée) :
```javascript
execFile('taskkill', ['/pid', String(proc.pid), '/T', '/F'], () => {});
```
De même, l'installateur Windows Inno Setup (`installer.iss`) exécute une fonction préventive `KillRunningProcesses` avant toute installation ou désinstallation pour libérer les verrous de fichiers.

---

## 3. Moteur Analytique Haute Performance (DuckDB & Parquet)

OpenStats est conçu pour éliminer les goulots d'étranglement de la sérialisation mémoire propre à Pandas sur les volumétries de données moyennes à grandes ($10^4$ à $10^7$ lignes).

### 3.1 Requêtes SQL Vectorisées Zero-Copy (`core/duckdb_analysis.py`)

Plutôt que de charger un DataFrame Pandas de plusieurs gigaoctets en RAM pour calculer de simples statistiques descriptives, OpenStats délègue ces opérations à **DuckDB** :
- Le moteur établit une connexion mémoire éphémère ultra-légère (`duckdb.connect(":memory:")`).
- Les tables sont requêtées directement depuis leur fichier Parquet sur disque (`SELECT ... FROM 'path/to/data.parquet'`).
- Les fonctions d'agrégation natives DuckDB (`avg`, `stddev_samp`, `quantile_cont`, `skewness`, `kurtosis`) s'exécutent en code C++ optimisé multi-cœur et vectorisé SIMD.
- Les identifiants de colonnes sont protégés contre l'injection SQL via la fonction d'échappement rigoureuse `_escape_col(col_name)`.

### 3.2 Gestion Mémoire & Cycle de Vie des Connexions

- Chaque requête analytique DuckDB est encapsulée dans un bloc `try ... finally` garantissant la clôture explicite de la connexion (`conn.close()`), évitant toute fuite de descripteurs de fichiers sous Windows.
- Les conversions vers Pandas ne sont déclenchées qu'au moment de l'entraînement des modèles de Machine Learning nécessitant des matrices Scikit-Learn denses en mémoire continue.

### 3.3 Streaming d'Analyses Longues via Server-Sent Events (SSE)

Certains traitements statistiques (l'exploration combinatoire de l'Explorateur Adaptatif, l'AutoML compétitif, le calcul exact des valeurs SHAP) requièrent plusieurs dizaines de secondes. Une requête HTTP POST classique bloquante risquerait de déclencher un timeout réseau ou de figer l'interface.

OpenStats résout ce défi via le protocole SSE (`text/event-stream`) :
1. Le client envoie une requête d'initialisation vers `/api/v1/analysis/explore/stream`.
2. Le backend instancie un thread de calcul en arrière-plan et établit une file de messages thread-safe (`queue.Queue`).
3. Le flux HTTP émet un paquet `data: {...}` à chaque fois qu'une nouvelle découverte (*finding*) est confirmée.
4. En cas d'inactivité temporaire, le générateur émet des pulsations de maintien de liaison (`: keep-alive\n\n`) toutes les 2 secondes pour empêcher la fermeture de la connexion par les couches de transport intermédiaires.

---

## 4. Génération de Code & Discipline des Exceptions

### 4.1 Assembleur Topologique de Code Source (`core/code_generation/emitter.py`)

OpenStats garantit la reproductibilité scientifique intégrale de ses analyses en permettant d'exporter n'importe quel canvas visuel ou pipeline sous forme de script Python, R ou de Notebook Jupyter autonome.

Le générateur de code respecte trois garanties formelles :
1. **Ordre topologique garanti** : Le graphe orienté acyclique (DAG) des nœuds est trié topologiquement via l'algorithme de Kahn. Les instructions du script généré s'exécutent dans l'ordre strict des dépendances de données, et non dans l'ordre arbitraire d'instanciation des nœuds par l'utilisateur.
2. **Agrégation des dépendances** : Toutes les directives d'importation (`import pandas as pd`, `from sklearn...`) sont collectées auprès des nœuds du graphe et dédupliquées en en-tête du fichier.
3. **Fidélité arithmétique** : Les scripts exportés reproduisent les mêmes opérations numériques de prétraitement (décalage automatique des séries négatives avant transformation logarithmique ou Box-Cox), garantissant une identité numérique parfaite ($|Y_{\text{app}} - Y_{\text{script}}| < 10^{-15}$).

### 4.2 Discipline Stricte d'Interception des Exceptions (`core/statistical_attempt.py`)

L'un des anti-patterns les plus destructeurs en calcul scientifique consiste à capturer aveuglément les exceptions (`except Exception:` ou `except: pass`), masquant les erreurs de syntaxe, les variables non définies ou les bugs internes sous l'apparence trompeuse de calculs réussis.

Dans OpenStats :
1. **Wrapper Unique `attempt()`** : Toute routine statistique susceptible d'échouer sur des données dégénérées (matrice singulière, variance nulle) doit impérativement être encapsulée via la fonction canonique `attempt(func, *args, **kwargs)`.
2. **Liste Blanche Fermée d'Erreurs Mathématiques** : Seules les exceptions mathématiques légitimes sont interceptées (`ValueError`, `LinAlgError`, `ZeroDivisionError`, `FloatingPointError`).
3. **Interdiction Formelle des Erreurs de Programmation** : `AttributeError`, `NameError`, `TypeError`, `ImportError` ne sont **jamais** interceptées par `attempt()`. Elles doivent remonter immédiatement pour signaler le défaut de code.
4. **Vérification Statique par AST (`tests/core/test_exception_discipline.py`)** : La suite de tests analyse l'arbre syntaxique abstrait (AST) de l'intégralité du code d'analyse backend et fait échouer la compilation si un bloc `except Exception` non autorisé ou un `pass` silencieux est introduit.

---

## 5. Chaîne de Compilation & Packaging Windows

Pour fonctionner sur n'importe quel PC Windows sans exiger l'installation préalable de Python, Node.js ou de bibliothèques tierces, OpenStats est distribué sous la forme d'un installeur Windows tout-en-un (`OpenStats_Setup_v1.0.0-rc.1.exe`).

### 5.1 Compilation du Backend via PyInstaller

Le script `backend/build_backend.py` compile le serveur Python en un répertoire binaire autonome `backend/dist/openstats-backend/` :
- **Fichier de spécification (`openstats-backend.spec`)** : Orchestre la collecte des dépendances.
- **Collecte explicite des dépendances chargées paresseusement (*Lazy Imports*)** :  
  Afin d'accélérer le temps de démarrage, XGBoost, LightGBM, Prophet et lifelines sont importés dynamiquement à l'intérieur des fonctions de modélisation. PyInstaller n'analysant que l'arbre d'importation statique, `openstats-backend.spec` applique impérativement la directive `collect_all` sur ces paquets :
  ```python
  from PyInstaller.utils.hooks import collect_all
  for pkg in ['xgboost', 'lightgbm', 'prophet', 'lifelines']:
      d, b, h = collect_all(pkg)
      datas += d; binaries += b; hiddenimports += h
  ```
- **Fonctionnement Local et Autonome sans DRM** : Conformément à la philosophie open-source sous licence AGPLv3 et aux spécifications de packaging (`openstats-backend.spec`), OpenStats fonctionne à 100 % en local et de manière autonome, sans DRM, sans verrouillage matériel ni module de licence.

### 5.2 Assemblage du Shell Electron

1. **Menu et fenêtre Desktop** : `frontend/electron/main.cjs` orchestre le lancement, le splash screen (`splash.html`), la barre de menus native Windows (`desktopMenu.cjs`, canalisant `openstats:menu-action` via `preload.cjs`) et le cycle de vie du backend PyInstaller.
2. **Compilation Frontend** : `npm run build:pack` enchaîne `tsc -b`, `vite build --mode desktop` (produisant les assets relatifs dans `frontend/dist/`) et `electron-builder --dir`.
3. **Packaging Electron Unpacked** : Génère l'exécutable natif et les ressources packagées sous `frontend/release/win-unpacked/`.

### 5.3 Compilation de l'Installeur Inno Setup

L'orchestrateur `scripts/build_installer.py` assemble la distribution finale :
1. Détection automatique du compilateur Inno Setup 6 (`ISCC.exe`) dans les chemins standards système (`LOCALAPPDATA`, `Program Files`).
2. Lecture du script de configuration `installer.iss`.
3. Compression **`lzma2/max`** (`SolidCompression=yes`) produisant l'installeur Windows autonome `OpenStats_Setup_v1.0.0-rc.1.exe` embarquant l'interpréteur Python compilé, les bibliothèques scientifiques (DuckDB, Scikit-Learn, Statsmodels, Plotly) et le shell Electron.

---

## 6. Assurance Qualité, Métrologie & Suites de Tests

OpenStats applique une méthodologie d'assurance qualité exhaustive à tous les niveaux de la pile logicielle.

### 6.1 Audit Strict de Taille de Fichier (`backend/scripts/check_line_counts.py`)

Conformément à l'article 2 de la charte [ELMAS.md](../ELMAS.md), **aucun fichier du projet ne doit dépasser 350 lignes**.  
Le script d'audit vérifie l'ensemble des couches du dépôt (`backend/app`, `backend/tests`, `backend/scripts`, `frontend/src`, `frontend/electron`, `scripts/` — extensions `.py`, `.ts`, `.tsx`, `.js`, `.jsx`, `.cjs`, `.mjs`, `.css`) ainsi que l'absence de dossiers ou fichiers génériques interdits :
```bash
python scripts/check_line_counts.py
# ou directement : python backend/scripts/check_line_counts.py
```

### 6.2 Suite Pytest Backend & Validation Globale

La suite de tests Python (`backend/tests/`) couvre l'ensemble des fonctionnalités selon une pyramide de tests en 4 niveaux :
- **Niveau 1 (Unit)** : Validation unitaire des fonctions mathématiques pures (`measurements`, `hypothesis_testing`, `posthoc_tests`, `equivalence_tests`), ainsi que la vérification statique par AST (`tests/core/test_exception_discipline.py`).
- **Niveau 2 (Core Engines)** : Tests d'intégration de l'Explorateur Adaptatif, convergence et annulation de la boucle de remédiation, génération de code topologique.
- **Niveau 3 (Services & Data)** : Tests d'ingestion multiformats, étanchéité des magic bytes, requêtes DuckDB, persistance SQLite.
- **Niveau 4 (API Endpoints & E2E)** : Tests complets des contrôleurs Flask, simulation des flux SSE, validation du cycle de vie des sessions (également orchestrables via `python scripts/run_e2e_tests.py`).

*Commande d'exécution* :
```bash
python -m pytest backend/tests/ -q --tb=short -p no:qt
```

### 6.3 Vérification Statique Frontend & Tests Vitest

- **Compilation TypeScript Strict** : Aucune tolérance pour le type `any` implicite ou les erreurs de types nullables.
  ```bash
  cd frontend && npx tsc -b --noEmit
  ```
- **Tests Unitaires Frontend (Vitest)** : Validation des utilitaires de gestion d'en-têtes HTTP, de synchronisation des tokens et de formatage des données numériques.
  ```bash
  cd frontend && npx vitest run
  ```

---

*OpenStats — Architecture Technique v1.0.0-rc.1 — Document établi sous la charte de qualité logicielle ElmasCore.*
