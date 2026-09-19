# 🖥️ OpenStats Desktop — Guide de Démarrage & Compilation (.exe)

Ce guide explique comment développer, tester et générer le fichier d'installation Windows autonome (`OpenStats_Setup_v1.0.0.exe`).

---

## 🛠️ Préréquis sur votre PC de développement

- **Node.js** (v18+) & **npm**
- **Python 3.10+** avec `pip`
- **PyInstaller** (`pip install pyinstaller`)

---

## 🚀 1. Lancer l'Application en Mode Développement Desktop

Pour développer l'application avec rechargement automatique (Hot Reload) :

### A. Démarrer le Backend Python Desktop
Dans un terminal :
```bash
cd backend
python run_desktop.py 5000
```

### B. Démarrer le Frontend Electron
Dans un second terminal :
```bash
cd frontend
npm install
npm run electron:dev
```

> **Résultat** : Le Launcher / Splash Screen s'affiche, puis la fenêtre principale d'OpenStats Desktop s'ouvre connectée à votre code Vite/React.

---

---

## ⚠️ Dépendances chargées paresseusement

Les moteurs d'analyse importent XGBoost, LightGBM, Prophet et lifelines **à l'intérieur des
fonctions**, pour ne pas alourdir le démarrage de l'application. PyInstaller n'analyse que
les imports statiques : sans déclaration explicite, ces bibliothèques seraient absentes du
binaire et les modèles correspondants échoueraient chez l'utilisateur final — silencieusement,
puisque l'application signale simplement « bibliothèque absente » et écarte le candidat.

`openstats-backend.spec` les déclare donc explicitement (`collect_all`). **Si vous ajoutez un
modèle reposant sur une nouvelle bibliothèque, ajoutez-la à cette liste**, sinon il
fonctionnera en développement et disparaîtra du binaire.

Vérification après compilation :

```bash
# Depuis le dossier de l'exécutable généré
./openstats-backend/openstats-backend.exe
# puis, dans un autre terminal :
curl -X POST http://localhost:5000/api/v1/datasets/<id>/methodology -d '{"target":"..."}'      -H "Content-Type: application/json" | grep -o '"applicable":false[^}]*'
```

Une bibliothèque manquante apparaît dans le motif d'exclusion des modèles.

---

## 📦 2. Générer l'Installateur `.exe` Windows complet

Pour produire un fichier d'installation tout-en-un que vous pouvez partager :

### Étape 0 : Sceller le secret de licence

La version installée exige une clé d'activation. Sa vérification hors ligne repose sur un
secret partagé avec le site de vente, qu'il faut sceller **avant** la compilation :

```bash
cd backend
OPENSTATS_SECRET_JETON=<ACTIVATION_SECRET du site> python scripts/sceller_secret_licence.py
```

Ce doit être exactement la valeur `ACTIVATION_SECRET` du fichier d'environnement du site :
si les deux diffèrent, le binaire se construit sans erreur mais **aucune licence ne peut y
être activée** — la panne n'apparaîtrait que chez le premier client. Le `.spec` refuse
désormais de construire si ce secret est absent, mais il ne peut pas vérifier qu'il est le bon.

Le module généré (`backend/app/core/_secret_licence.py`) n'est pas versionné. Un secret
commité est un secret public.

### Étape 1 : Compiler le backend Python avec PyInstaller
Dans le terminal :
```bash
cd backend
python build_backend.py
```
*Cela génère le dossier autonome `backend/dist/openstats-backend/` contenant Python et toutes ses dépendances (Pandas, DuckDB, Scikit-Learn, ReportLab, etc.).*

### Étape 2 : Assembler l'installateur Windows Inno Setup
Dans le terminal :
```bash
python scripts/build_installer.py
# ou depuis frontend : npm run build:desktop
```
*Cela compile le frontend React/Vite, assemble le paquet Electron autonome (`electron-builder --dir`), puis génère l'installateur Windows final avec Inno Setup.*

---

## 🎯 Résultat de la compilation

Le fichier d'installation généré se trouve dans :
`frontend/release/OpenStats_Setup_v1.0.0.exe` (~315 Mo avec compression ultra LZMA2)

Lorsque l'utilisateur exécute cet installateur :
1. L'application s'installe proprement sans demander Python ou Node.
2. Un raccourci **OpenStats Desktop** est créé sur le bureau et dans le Menu Démarrer.
3. Les données et bases SQLite locales sont stockées dans `%APPDATA%\OpenStats\`.
