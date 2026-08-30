<div align="center">

# 🌌 OpenStats
[<img src="https://readme-typing-svg.herokuapp.com?font=Fira+Code&pause=1000&color=10b981&width=435&lines=OpenStats;SYSTEM+INITIALIZED;DATA+INTELLIGENCE;DESKTOP+%26+WEB+READY" alt="Typing SVG" />](https://git.io/typing-svg)

**Plateforme d'analyse statistique, de Data Science et de Machine Learning avec canvas nodal visuel et application Desktop autonome.**

*Signée par la charte de développement [ELMAS.md](ELMAS.md) — "From Data to Systems".*

Importez vos données, construisez vos pipelines visuellement, exécutez des requêtes SQL ultra-rapides via DuckDB, entraînez des modèles ML explicables, réalisez des simulations avancées et générez des rapports professionnels ou du code source exportable.

[![Status](https://img.shields.io/badge/Status-Operational-10b981?style=for-the-badge&logo=statuspage&logoColor=white)](#)
[![Version](https://img.shields.io/badge/Version-v1.2.0-blue?style=for-the-badge&logo=github&logoColor=white)](#)
[![Desktop](https://img.shields.io/badge/Desktop-Windows_.exe-0078D4?style=for-the-badge&logo=windows&logoColor=white)](#)
[![Tests](https://img.shields.io/badge/Tests-Pytest_%7C_Vitest-10b981?style=for-the-badge&logo=pytest&logoColor=white)](#)
[![Code Quality](https://img.shields.io/badge/Max_Lines-350L_Strict-purple?style=for-the-badge)](#)

</div>

---

![OpenStats Demo](assets/demo.gif)

> **💡 Démarrez immédiatement !** Importez notre [Dataset d'Exemple (Titanic.csv)](assets/titanic_example.csv) pour tester le nettoyage automatique, l'AutoML, les visualisations Plotly et l'interprétation IA.

---

## ✨ Ce qu'OpenStats sait faire

- **🎨 Canvas Nodal Interactif et Fluide** — Interface visuelle basée sur ReactFlow, Plotly.js et Monaco Editor pour connecter vos étapes d'analyse.
- **⚡ Moteur SQL DuckDB Intégré** — Exécution de requêtes SQL complexes ultra-rapides directement sur des fichiers CSV, Parquet, JSON ou SQLite sans configuration.
- **🤖 Machine Learning & SHAP Explainability** — Classification & Régression (Scikit-Learn, XGBoost, LightGBM), AutoML compétitif, clustering (K-Means, DBSCAN) et valeurs SHAP / Feature Importance.
- **📈 Séries Temporelles Univariées & Multivariées** — Tests de stationnarité (ADF, KPSS), décomposition saisonnière, modèles univariés (ARIMA, SARIMA, Prophet, Holt-Winters) et multivariés avancés (VAR, VECM, ARDL, BVAR, VARMAX, cointégration de Johansen, causalité de Granger).
- **🧬 Analyses Factorielles Complètes** — Analyse en Composantes Principales (ACP/PCA), Analyse Factorielle des Correspondances (AFC/CA) et Analyse des Correspondances Multiples (ACM/MCA) avec représentations graphiques biplots et cercles de corrélation.
- **🎲 Analytics Avancées & Simulations** — Simulation Monte Carlo, Bootstrapping (intervalles de confiance empiriques) et Scenario Builder (analyse prospective What-If & stress-testing).
- **🐍 Nœud Python Sur-Mesure** — Éditeur Monaco complet avec coloration syntaxique et exécution sécurisée de scripts Python personnalisés sur les DataFrames.
- **📜 Génération de Code Source Exportable** — Exportez votre canvas nodal visuel en un clic sous forme de script Python autonome (`.py`), script R (`.R`) ou Notebook Jupyter (`.ipynb`).
- **📊 Rapports Professionnels Multi-Formats & IA** — Génération automatique de rapports aux formats **PDF**, **DOCX (Word)** ou **PPTX (PowerPoint)** enrichis par une interprétation analytique automatisée par IA.
- **🖥️ Application Desktop Windows Autonome** — Binaire Windows `.exe` prêt à l'emploi (Electron + PyInstaller), fonctionnant sans prérequis Node/Python sur la machine utilisateur.
- **🧩 Marketplace Local & Auto-Pipeline Intelligent** — Catalogue de templates de pipelines réutilisables (import/export JSON) et assistant de création automatique de recettes adaptées au jeu de données.

---

## 🏛️ Architecture Modulaire (Charte ElmasCore)

Le projet respecte à 100% les standards de rigueur d'[ELMAS.md](ELMAS.md) :
1. **Plafond strict de 350 lignes** par fichier sur l'intégralité du code (Backend & Frontend).
2. **Organisation par domaine métier** : aucun dossier ou fichier fourre-tout (`helpers`, `utils`, `misc`, `common`).
3. **Séparation stricte des responsabilités** : UI $\rightarrow$ services/logique métier $\rightarrow$ accès aux données.
4. **Source unique de vérité** : un seul moteur unifié pour les exports et la génération de code.

```text
Stats/
├── backend/                              # Serveur Python & Moteurs Statistiques
│   ├── app/
│   │   ├── api/v1/                       # Contrôleurs API REST segmentés
│   │   │   ├── analysis/                 # Routes descriptives, corrélations, charts
│   │   │   ├── canvas/                   # Exécution, streaming, graphe et export canvas
│   │   │   ├── datasets/                 # Ingestion, versions, requêtes DuckDB
│   │   │   ├── modeling/                 # Entraînement et scoring de modèles ML
│   │   │   ├── scenarios/                # Moteur de simulation stochastique
│   │   │   └── timeseries/               # Endpoints séries temporelles uni/multivariées
│   │   ├── core/                         # Logique métier pure (tous <= 350 lignes)
│   │   │   ├── timeseries/               # ARIMA, SARIMA, VAR, VECM, ARDL, BVAR, etc.
│   │   │   ├── auto_pipeline/            # Profilage heuristique, recettes et reporting
│   │   │   ├── code_generation/          # Générateurs Python, R et Jupyter
│   │   │   ├── interpretation/           # Moteur narratif d'insights statistiques
│   │   │   ├── modeling_*.py             # Entraînement ML, métriques, SHAP, préparation
│   │   │   ├── export_*.py               # Générateurs de rapports PDF, DOCX, Excel, HTML
│   │   │   ├── transformations_*.py      # Catalogue et application de transformations
│   │   │   ├── factor_*.py               # ACP, AFC, ACM et sérialisation
│   │   │   └── hypothesis_testing.py     # Tests d'hypothèses et tailles d'effet (Cohen, etc.)
│   │   └── services/                     # Couche service & persistance des datasets
│   └── tests/                            # 120+ tests Pytest (core, services, api, e2e)
│
├── frontend/                             # Interface SPA React + TypeScript
│   └── src/
│       ├── components/                   # Composants modulaires par domaine métier
│       │   ├── canvas/                   # Canvas nodal, nœuds visuels, modales de résultats
│       │   ├── pipeline/                 # Assistant Auto-Pipeline et étapes
│       │   ├── wizard/                   # Wizard d'analyse pas-à-pas
│       │   ├── results/                  # Visualisation des résultats et interprétations
│       │   ├── multivariateTS/           # Panneau dédié aux séries multivariées
│       │   ├── factorAnalysis/           # Vues ACP, AFC, ACM et Scree plot
│       │   ├── chartBuilder/             # Constructeur de graphiques interactifs
│       │   ├── scenarios/                # Courbes de sensibilité et simulation
│       │   ├── transform/                # Préparation et transformations de colonnes
│       │   ├── extension/                # Extensions Python personnalisées
│       │   ├── viz/                      # Wrappers Plotly, thèmes et outils d'export
│       │   └── ui/                       # Composants atomiques (Toast, Tabs, Modal)
│       ├── store/                        # Redux Toolkit & RTK Query segmenté (baseApi + endpoints)
│       ├── styles/                       # Feuilles CSS modulaires (base, thème, canvas)
│       └── types/                        # Typage strict segmenté (dataset, timeseries, platform)
└── ELMAS.md                              # Charte d'architecture et de qualité ElmasCore
```

---

## 🧩 Catalogue des Nœuds du Canvas Nodal

| Catégorie | Nœuds disponibles | Description |
|-----------|-------------------|-------------|
| 📥 **Source & Ingestion** | `DatasetNode`, `SqlNode` | Ingestion CSV, XLSX, JSON, JSONL, Parquet + Requêtes SQL DuckDB interactives. |
| 🧹 **Data Prep & Nettoyage** | `TypingNode`, `CleaningNode`, `PreparationNodes` | Nettoyage auto (typage, outliers, valeurs manquantes), encodage, normalisation, jointures, filtrage. |
| 📊 **Stats Descriptives & Tests** | `DescriptiveNodes`, `TestNodes` | Statistiques descriptives, matrices de corrélation, tables croisées (Khi-2), tests de normalité, ANOVA, tests t, Wilcoxon. |
| 🧬 **Analyse Factorielle** | `FactorielleNodes` | Analyse en Composantes Principales (ACP/PCA), AFC, ACM, Scree plot, biplots et cercles de corrélation. |
| 🤖 **Machine Learning & SHAP** | `ModelingNodes` | Algorithmes de régression/classification, AutoML compétitif, K-Means/DBSCAN, et explicabilité SHAP. |
| 📈 **Séries Temporelles** | `TimeSeriesNodes` | Décomposition, tests ADF/KPSS, modèles ARIMA, SARIMA, Prophet, VAR, VECM, ARDL, BVAR. |
| 🎲 **Simulations & Scénarios** | `SimulationNodes`, `AdvancedAnalyticsNodes` | Simulation Monte Carlo, rééchantillonnage Bootstrap et simulateur de scénarios What-If. |
| 💻 **Custom Code** | `PythonNode`, `SqlNode` | Éditeurs interactifs (Monaco Editor) avec exécution directe sur les données du flux. |
| 📉 **Visualisation & Export** | `VisualizationNodes`, `OutputNodes` | Visualisations Plotly (Scatter, Line, Bar, Box, Heatmap, 3D), export de code Python/R/Jupyter et rapports PDF/DOCX/PPTX. |

---

## 🛠️ Stack Technique

### Frontend & UI Visuelle
- **React 18** + **TypeScript** (mode strict)
- **Vite** + **Vanilla CSS / Styles modulaires** (design épuré, chiffres tabulaires)
- **ReactFlow** (`@xyflow/react`) — Canvas nodal visuel interactif
- **Plotly.js** — Visualisations graphiques haute performance
- **Monaco Editor** — Éditeur de code intégré avec coloration syntaxique
- **Redux Toolkit** + RTK Query (endpoints injectés par domaine)
- **KaTeX** — Rendu des formules mathématiques

### Desktop Packaging
- **Electron** (v43+) + **Electron Builder**
- **PyInstaller** — Compilation de l'exécutable backend Python autonome sous Windows

### Backend & Analytics Engine
- **Flask** / Python 3.10+ (Architecture Blueprint par domaine & Services)
- **DuckDB** — Moteur SQL analytique embarqué ultra-rapide
- **Pandas**, **NumPy**, **PyArrow** — Manipulation de DataFrames et stockage Parquet versionné
- **Scikit-Learn**, **XGBoost**, **LightGBM**, **Statsmodels**, **Prophet**, **SciPy** — ML, statistiques et séries temporelles
- **SHAP** — Explicabilité des modèles de Machine Learning
- **SQLite / PostgreSQL** + SQLAlchemy & Flask-Migrate

### Exportation & Intégration IA
- **ReportLab**, **python-docx**, **python-pptx**, **openpyxl** — Générateurs de rapports PDF, Word, PowerPoint et Excel
- **Anthropic (Claude)** & **OpenAI** API — Génération d'interprétations analytiques automatisées

---

## 🚀 Installation & Démarrage

### 🌐 Mode Web (Développement Local)

```bash
# 1. Cloner le dépôt
git clone https://github.com/elm-as/Stats.git
cd Stats

# 2. Configurer les variables d'environnement (optionnel)
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 3. Backend Python
cd backend
python -m venv venv
# Activer le venv :
# Windows : venv\Scripts\activate | Linux/Mac : source venv/bin/activate
pip install -r requirements.txt
python run.py

# 4. Frontend React (dans un second terminal)
cd ../frontend
npm install
npm run dev
```

Accédez ensuite à `http://localhost:5173`.

### 🖥️ Mode Desktop (Electron + PyInstaller)

```bash
# Lancement de développement Desktop :
cd backend && python run_desktop.py 5000  # Terminal 1
cd frontend && npm run electron:dev       # Terminal 2

# Compilation de l'installateur Windows .exe complet :
cd backend && python build_backend.py
cd ../frontend && npm run build:desktop
```
L'installateur généré se trouve dans `frontend/release/OpenStats Desktop Setup 1.0.0.exe`.

---

## 🧪 Validation Qualité & Tests

Conformément à la charte ElmasCore, toute modification doit valider l'ensemble des suites de tests :

```bash
# 1. Backend (120+ tests Pytest)
cd backend
python -m pytest -p no:qt -q

# 2. Frontend (Tests unitaires Vitest)
cd frontend
npx vitest run

# 3. Compilation TypeScript (Zéro erreur requise)
cd frontend
npx tsc -b

# 4. Packaging de Production Vite
cd frontend
npm run build
```

---

## 🛡️ Licence & Philosophie

OpenStats est développé dans une optique **local-first, gratuite et open-source** : pas de compte obligatoire, pas de paywall, pas d'envoi forcé de vos données vers le cloud.

- Licence : **AGPLv3**
- Sécurité : validation par magic bytes, isolation du code utilisateur, caches thread-safe.

---

<div align="center">
  <sub><b>ELMAS CORE LABORATORY</b> // <i>"From Data to Systems"</i></sub><br/>
  <sub>SYSTEM_STATUS: OPERATIONAL // QUALITY_GATE: 100% COMPLIANT</sub>
</div>
