"""
Audit Suite exhaustif pour OpenStats :
Teste tous les pipelines, tous les types de cibles, toutes les étapes et les cas limites.
"""

import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import numpy as np
import pandas as pd
import traceback

from app.core.auto_pipeline.detector import detect_dataset_profile
from app.core.auto_pipeline.recipe import build_recipe
from app.core.auto_pipeline.executor import execute_recipe
from app.core.auto_pipeline.heuristics import _detect_problem_type
from app.core.modeling_preparation import prepare_data
from app.core.modeling_competitive import train_competitive

def log_test(name: str):
    print(f"\n========================================================")
    print(f"AUDIT TEST: {name}")
    print(f"========================================================")

failed_tests = []
passed_tests = []

def run_pipeline_test(name: str, df: pd.DataFrame, target: str | None = None, task_type: str | None = None):
    log_test(name)
    try:
        profile = detect_dataset_profile(df, user_hint_target=target)
        recipe = build_recipe(profile, target=target, task_type=task_type, df=df)
        print(f"-> Recette générée: '{recipe.title}' (problem_type={recipe.problem_type}, target={recipe.target})")
        print(f"-> Étapes ({len(recipe.steps)}): {[s.key for s in recipe.steps]}")
        
        result = execute_recipe(df, recipe, execute_optional=True)
        steps_res = result.get("steps", {})
        
        step_failures = []
        for k, v in steps_res.items():
            status = v.get("status")
            dur = v.get("duration_ms", 0)
            err = v.get("error")
            print(f"   [{status.upper()}] {k} ({dur}ms) {err if err else ''}")
            if status == "error":
                step_failures.append(f"Étape {k}: {err}")
                
        if step_failures:
            raise RuntimeError(f"Échec sur {len(step_failures)} étape(s): {', '.join(step_failures)}")
            
        # Si étape model présente, vérifier qu'au moins 1 modèle est classé
        if "model" in steps_res:
            m_res = steps_res["model"].get("result", {})
            ranking = m_res.get("ranking", [])
            print(f"   -> {len(ranking)} modèle(s) classé(s): {[r['model_name'] for r in ranking]}")
            if not ranking:
                raise RuntimeError("L'étape model n'a classé aucun modèle !")
                
        passed_tests.append(name)
        print(f"[OK] {name} : SUCCES")
    except Exception as e:
        failed_tests.append((name, str(e)))
        print(f"[FAIL] {name} : ECHEC -> {e}")
        traceback.print_exc()

# ─────────────────────────────────────────────────────────────────────────────
# 1. Classification Binaire avec Cible Chaîne de Caractères
# ─────────────────────────────────────────────────────────────────────────────
np.random.seed(42)
n = 120
df_binary_str = pd.DataFrame({
    "age": np.random.randint(18, 70, size=n),
    "revenu": np.random.uniform(20000, 80000, size=n),
    "score_credit": np.random.uniform(300, 850, size=n),
    "categorie": np.random.choice(["Gold", "Silver", "Bronze"], size=n),
    "statut": np.random.choice(["actif", "resilie"], size=n),
})
run_pipeline_test("Classification Binaire (Cible string)", df_binary_str, target="statut", task_type="classification")

# ─────────────────────────────────────────────────────────────────────────────
# 2. Classification Multi-classes (3+ classes textuelles)
# ─────────────────────────────────────────────────────────────────────────────
df_multiclass = pd.DataFrame({
    "x1": np.random.randn(n),
    "x2": np.random.randn(n),
    "x3": np.random.randn(n),
    "priorite": np.random.choice(["Basse", "Moyenne", "Haute", "Urgente"], size=n),
})
run_pipeline_test("Classification Multi-classes (4 classes textuelles)", df_multiclass, target="priorite", task_type="classification")

# ─────────────────────────────────────────────────────────────────────────────
# 3. Régression Continue Standard
# ─────────────────────────────────────────────────────────────────────────────
df_regression = pd.DataFrame({
    "surface": np.random.uniform(20, 200, size=n),
    "pieces": np.random.randint(1, 6, size=n),
    "etage": np.random.randint(0, 10, size=n),
    "secteur": np.random.choice(["Nord", "Sud", "Est", "Ouest"], size=n),
    "prix": np.random.uniform(100000, 600000, size=n),
})
run_pipeline_test("Régression Standard Continue", df_regression, target="prix", task_type="regression")

# ─────────────────────────────────────────────────────────────────────────────
# 4. Séries Temporelles Univariées (ARIMA / Holt-Winters)
# ─────────────────────────────────────────────────────────────────────────────
dates = pd.date_range(start="2022-01-01", periods=100, freq="D")
df_ts = pd.DataFrame({
    "date": dates,
    "ventes": 100 + np.cumsum(np.random.randn(100)) + 10 * np.sin(np.linspace(0, 20, 100)),
    "temperature": 15 + 10 * np.cos(np.linspace(0, 20, 100)) + np.random.randn(100),
})
run_pipeline_test("Séries Temporelles Univariées", df_ts, target="ventes", task_type="forecast")

# ─────────────────────────────────────────────────────────────────────────────
# 5. Séries Temporelles Multivariées (VAR / VECM)
# ─────────────────────────────────────────────────────────────────────────────
run_pipeline_test("Séries Temporelles Multivariées", df_ts, target="ventes", task_type="auto")

# ─────────────────────────────────────────────────────────────────────────────
# 6. Mode Exploration Sans Cible (ACP, Corrélations, Descriptif)
# ─────────────────────────────────────────────────────────────────────────────
df_explore = pd.DataFrame({
    "feat_1": np.random.randn(n),
    "feat_2": np.random.randn(n),
    "feat_3": np.random.randn(n),
    "feat_4": np.random.randn(n),
    "feat_5": np.random.randn(n),
})
run_pipeline_test("Exploration Sans Cible", df_explore, target=None, task_type="exploration")

# ─────────────────────────────────────────────────────────────────────────────
# 7. Données avec Valeurs Manquantes (NaNs) & Imputation
# ─────────────────────────────────────────────────────────────────────────────
df_nans = df_binary_str.copy()
df_nans.loc[5:15, "age"] = np.nan
df_nans.loc[20:30, "categorie"] = np.nan
run_pipeline_test("Robustesse NaNs & Imputation", df_nans, target="statut", task_type="classification")

# ─────────────────────────────────────────────────────────────────────────────
# 8. Modèle de Comptage (Poisson / Binomiale Négative)
# ─────────────────────────────────────────────────────────────────────────────
df_count = pd.DataFrame({
    "age": np.random.randint(20, 60, size=n),
    "visites": np.random.poisson(lam=3.5, size=n),
    "revenu": np.random.uniform(20000, 60000, size=n),
})
run_pipeline_test("Modèle de Comptage", df_count, target="visites", task_type="auto")

# ─────────────────────────────────────────────────────────────────────────────
# 9. Structure de Panel (Entités x Périodes)
# ─────────────────────────────────────────────────────────────────────────────
entities = ["ENT_" + str(i) for i in range(10)]
periods = pd.date_range("2020-01-01", periods=10, freq="M")
panel_data = []
for e in entities:
    for p in periods:
        panel_data.append({
            "entite": e,
            "date": p,
            "pib": np.random.uniform(10, 50),
            "inflation": np.random.uniform(1, 5),
            "chomage": np.random.uniform(4, 12),
        })
df_panel = pd.DataFrame(panel_data)
run_pipeline_test("Économétrie de Panel", df_panel, target="chomage", task_type="auto")

# ─────────────────────────────────────────────────────────────────────────────
# Synthese Finale de l'Audit
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print(f"RESULTATS DE L'AUDIT COMPLET : {len(passed_tests)}/{len(passed_tests) + len(failed_tests)} TESTS REUSSIS")
print("=" * 60)
for p in passed_tests:
    print(f"  [PASS] {p}")
for f, err in failed_tests:
    print(f"  [FAIL] {f} -> {err}")

if failed_tests:
    sys.exit(1)
print("\nTOUS LES TESTS DE L'AUDIT SONT VALIDES A 100% !")
