<div align="center">

# 🌌 OpenStats
[<img src="https://readme-typing-svg.herokuapp.com?font=Fira+Code&pause=1000&color=10b981&width=435&lines=OpenStats;SYSTEM+INITIALIZED;DATA+INTELLIGENCE" alt="Typing SVG" />](https://git.io/typing-svg)

**Plateforme d'analyse statistique et de Machine Learning avec interface nodale interactive.**

Importez vos données, construisez vos pipelines visuellement, exécutez des analyses avancées et générez des rapports professionnels.

[![Status](https://img.shields.io/badge/Status-Operational-10b981?style=for-the-badge&logo=statuspage&logoColor=white)](#)
[![Category](https://img.shields.io/badge/Category-Data_Science-black?style=for-the-badge&logo=micro-soft-academic&logoColor=white)](#)
[![Build](https://img.shields.io/badge/Build-v1.1.0-gray?style=for-the-badge&logo=githubactions&logoColor=white)](#)
[![Tests](https://img.shields.io/badge/Tests-120%20passed-10b981?style=for-the-badge&logo=pytest&logoColor=white)](#)

</div>

---

![OpenStats Demo](assets/demo.gif)

> **💡 Try it out!** Importez notre [Dataset d'Exemple (Titanic.csv)](assets/titanic_example.csv) pour tester immédiatement la puissance du nettoyage auto et des analyses descriptives.

---

## ✨ Ce qu'OpenStats sait déjà faire

- **Canvas nodal configurable** interactif et fluide (ReactFlow + Plotly)
- **30+ analyses statistiques et ML** (Séries temporelles, Régression, Classification, Clustering, Factorielle, Simulation Monte Carlo...)
- **Pipeline automatique intelligent** — détection du type de problème et construction de recette
- **Nettoyage automatique** et préparation des données (typage, valeurs manquantes, outliers)
- **Import** depuis des fichiers CSV / XLSX / JSON / JSONL (validation par magic bytes)
- **Interprétation IA** (via Claude / LLM) intégrée pour générer des insights textuels statistiques clairs
- **Rapports automatiques** et export PDF, DOCX, PPTX professionnels
- **🧩 Marketplace** de templates et extensions partageables — catalogue intégré, import/export JSON
- **Suspense & lazy-loading** pour des performances optimales sur les pages lourdes

---

## 🔄 Démo du workflow

```text
       Données brutes (CSV/XLSX/JSON)
                  ↓
Nettoyage & Préparation automatique
                  ↓
Construction du Pipeline Visuel (Nœuds)
                  ↓
Analyses Statistiques & Machine Learning
                  ↓
 Génération de Rapport & Interprétation IA
```

---

## 🧩 Marketplace

OpenStats intègre une marketplace locale de **templates de pipeline** et **extensions** :

| Template | Type | Description |
|----------|------|-------------|
| Analyse Descriptive Rapide | `descriptive` | Stats, corrélations, VIF, heatmap automatique |
| Pipeline de Classification | `classification` | Nettoyage → entraînement compétitif → SHAP |
| Prévision de Séries Temporelles | `timeseries` | Stationnarité → ARIMA/SARIMA → prévisions |
| Analyse Factorielle (PCA) | `pca` | Scree plot, biplot, cercle de corrélations |
| Nettoyage Automatique | `cleaning` | Typage → nettoyage → export propre |
| Simulation Monte Carlo | `simulation` | Régression → sensibilité → distribution |

- 📥 **Import/Export JSON** — partagez vos templates entre utilisateurs
- ⭐ **Featured** — les templates les plus utiles en vedette
- 🔍 **Recherche et filtres** par catégorie, type ou mot-clé

---

## 🛠️ Philosophie Open Source

OpenStats est pensé comme une **app locale, gratuite et open-source** pour Data Scientists : pas de comptes, pas de paywall, pas de dépendance SaaS obligatoire.

- Licence : **AGPLv3** (si quelqu'un modifie et redistribue, ou déploie une version accessible via réseau, il doit publier le code source des modifications).
- Sécurité : validation des fichiers par **magic bytes**, pas de `os.urandom()` en fallback production, caches thread-safe.

---

## 🛠️ Stack Technique

**Frontend**
- ![React](https://img.shields.io/badge/-React-10b981?style=for-the-badge&logo=react&logoColor=white) React 18 + TypeScript (strict mode)
- ![Vite](https://img.shields.io/badge/-Vite-10b981?style=for-the-badge&logo=vite&logoColor=white) Vite + TailwindCSS (dark theme custom)
- ![Redux](https://img.shields.io/badge/-Redux_Toolkit-10b981?style=for-the-badge&logo=redux&logoColor=white) Redux Toolkit + RTK Query
- ReactFlow (canvas nodal), Plotly.js (visualisations), Monaco Editor

**Backend**
- ![Flask](https://img.shields.io/badge/-Flask-10b981?style=for-the-badge&logo=flask&logoColor=white) Flask / Python 3.10+
- ![Celery](https://img.shields.io/badge/-Celery-10b981?style=for-the-badge&logo=celery&logoColor=white) Celery / Redis (jobs asynchrones)

**Stockage**
- SQLite (par défaut) ou PostgreSQL + fichiers Parquet versionnés

**Machine Learning & Data**
- Pandas, NumPy, Scikit-Learn, SciPy, Statsmodels, XGBoost, LightGBM, SHAP

**Qualité**
- ![Vitest](https://img.shields.io/badge/-Vitest-10b981?style=for-the-badge&logo=vitest&logoColor=white) Vitest + Testing Library (frontend)
- ![Pytest](https://img.shields.io/badge/-Pytest-10b981?style=for-the-badge&logo=pytest&logoColor=white) Pytest 120+ tests (backend)
- ![Playwright](https://img.shields.io/badge/-Playwright-10b981?style=for-the-badge&logo=playwright&logoColor=white) Playwright (E2E)

---

## 🚀 Installation

Si vous souhaitez faire tourner le projet en local, voici comment procéder :

```bash
# 1. Cloner le projet
git clone https://github.com/elm-as/Stats.git
cd Stats

# 2. Configuration (optionnel — des valeurs par défaut sont fournies pour le dev local)
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 3. Installer les dépendances Backend
cd backend
python -m venv venv
# Activer l'environnement virtuel (Windows: venv\Scripts\activate, Linux/Mac: source venv/bin/activate)
pip install -r requirements.txt

# 4. Installer les dépendances Frontend
cd ../frontend
npm install

# 5. Lancer l'environnement de développement
# Backend (dans un terminal)
cd backend
python run.py

# Frontend (dans un autre terminal)
cd frontend
npm run dev
```

### Variables d'environnement clés

| Variable | Défaut | Description |
|----------|--------|-------------|
| `SECRET_KEY` | auto (dev) | Clé secrète Flask — **obligatoire en production** |
| `LOCAL_DEV_MODE` | `false` | Mode développement (admin auto-créé, SQLite, pas d'auth) |
| `DATABASE_URL` | SQLite locale | PostgreSQL supporté (`postgresql://...`) |
| `MAX_UPLOAD_MB` | `200` | Taille max des fichiers uploadés |
| `ANTHROPIC_API_KEY` | — | Clé API Anthropic pour les insights IA |

## 🧪 Tests

```bash
# Backend — 120+ tests
cd backend
pytest tests/ -v

# Frontend — tests unitaires
cd frontend
npm run test

# Frontend — tests E2E
npm run test:e2e
```

---

## 🗺️ Roadmap

- [x] Canvas nodal interactif (ReactFlow)
- [x] Import/Export de données (CSV, XLSX, JSON, JSONL)
- [x] 30+ Analyses statistiques et modèles ML
- [x] Rapports PDF, DOCX, PPTX automatiques avec IA
- [x] Marketplace de modules et templates (import/export JSON)
- [x] Pipeline automatique intelligent (auto-détection + recette)
- [x] Validation des fichiers par magic bytes
- [x] Cache thread-safe, pagination des APIs
- [ ] Collaboration en temps réel
- [ ] Export/import de workspace complet
- [ ] Packaging desktop (Electron/Tauri)

---

## 🔗 Liens Utiles

<div align="center">

[![Website](https://img.shields.io/badge/Laboratory-elmas.solutions-3b82f6?style=for-the-badge&logo=google-chrome&logoColor=white)](https://elmas.solutions)
[![LinkedIn](https://img.shields.io/badge/Founder-LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/elmas-dev)
[![Twitter](https://img.shields.io/badge/Intelligence-Twitter-1DA1F2?style=for-the-badge&logo=twitter&logoColor=white)](https://twitter.com)

</div>

---

<div align="center">
  <img src="https://capsule-render.vercel.app/render?type=rect&color=10b981&height=2&section=footer&fontSize=10&text=" width="100%" />
  <br/>

```text
[EMERALD_PROTOCOL]
> Initializing sequence... 4F8A2D7B9E1C5A30
> Environment: PRODUCTION_READY
> Security Protocol: API_SECURE
> Status: OPERATIONAL
```

  <sub><b>ELMAS CORE LABORATORY</b> // <i>Proprietary Technology</i></sub><br/>
  <sub>SYSTEM_STATUS: OPERATIONAL // AUTH_CODE: 4F8A2D7B9E1C5A30</sub>
</div>
