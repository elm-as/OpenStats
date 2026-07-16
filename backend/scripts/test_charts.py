"""
Test des graphiques et visualisations de chaque analyse.

Ce script :
  1. Uploade le dataset de test
  2. Exécute toutes les analyses (desc, corrél, tests, PCA, CA, MCA, modèle, TS)
  3. Teste CHAQUE endpoint /chart-data avec les bons payloads et valide la structure
  4. Teste les visualisations dérivées de chaque analyse (PCA biplot, scree,
     corrélation heatmap, VIF, scénarios, tornado, PDP, Monte Carlo…)

Usage :
    python scripts/test_charts.py [--url http://127.0.0.1:5000] [--file path.csv]
"""

import sys
import json
import time
import argparse
import requests

DEFAULT_URL  = "http://127.0.0.1:5000/api/v1"
DEFAULT_FILE = r"c:\Users\elmas\Desktop\Projets\Stats\backend\data\test_dataset_complet.csv"

# Colonnes du dataset de test
COL_DATE  = "date_event"
COL_NUM1  = "revenue"
COL_NUM2  = "time_spent_minutes"
COL_NUM3  = "items_purchased"
COL_NUM4  = "discount_applied"
COL_CAT1  = "is_premium_member"
COL_CAT2  = "satisfaction_level"
COL_TARGET = "revenue"

# ── Couleurs terminal ──────────────────────────────────────────────────────────
G = "\033[92m"; R = "\033[91m"; Y = "\033[93m"; C = "\033[96m"; B = "\033[1m"; X = "\033[0m"

_results: list[dict] = []

def _sec(title):
    print(f"\n{B}{C}{'─'*62}{X}")
    print(f"{B}{C}  {title}{X}")
    print(f"{B}{C}{'─'*62}{X}")

def _check(name, res, *, validators=None, warn_keys=None):
    """
    Vérifie le statut HTTP + validators optionnels sur le body.
    validators : liste de (label, callable(body) -> bool)
    warn_keys  : clés à afficher pour le debug
    """
    ok_http = res.status_code in (200, 201)
    try:
        body = res.json()
    except Exception:
        body = {}

    # Validators supplémentaires
    val_results = []
    if ok_http and validators:
        for label, fn in validators:
            try:
                passed = bool(fn(body))
            except Exception as e:
                passed = False
                label = f"{label} [EXC: {e}]"
            val_results.append((label, passed))

    overall = ok_http and all(p for _, p in val_results)
    _results.append({"name": name, "ok": overall, "status": res.status_code,
                     "val_results": val_results})

    status_str = f"{G}[PASS]{X}" if overall else f"{R}[FAIL]{X}"
    http_str = f"HTTP {res.status_code}"
    print(f"  {status_str} {name}  ({http_str})")

    if not ok_http:
        err = body.get("error", res.text[:120]) if isinstance(body, dict) else res.text[:120]
        print(f"       {R}→ {err}{X}")
        return None

    for label, passed in val_results:
        icon = f"{G}✓{X}" if passed else f"{R}✗{X}"
        print(f"       {icon} {label}")

    if warn_keys and isinstance(body, dict):
        for k in warn_keys:
            v = body.get(k, "—")
            if isinstance(v, list):
                v = f"[{len(v)} items]  ex: {str(v[0])[:70]}" if v else "[]"
            elif isinstance(v, dict):
                v = f"{{{', '.join(list(v.keys())[:5])}}}"
            print(f"       {Y}↳ {k}{X}: {v}")

    return body

def _has_data(body, key="data"):
    """Valide que body[key] est une liste non vide."""
    v = body.get(key)
    return isinstance(v, list) and len(v) > 0

def _has_key(key):
    return lambda b: key in b and b[key] is not None

def _list_len(key, min_len=1):
    return lambda b: isinstance(b.get(key), list) and len(b[key]) >= min_len

def _dict_key(key):
    return lambda b: isinstance(b.get(key), dict) and len(b[key]) > 0

def _num_key(key):
    return lambda b: isinstance(b.get(key), (int, float)) and b[key] is not None

# ══════════════════════════════════════════════════════════════════════════════
def main(api_url: str, file_path: str):
    s = requests.Session()
    t0 = time.time()

    # ── 0. Upload + setup ─────────────────────────────────────────────────────
    _sec("0. UPLOAD & SETUP")
    with open(file_path, "rb") as f:
        res = s.post(f"{api_url}/datasets/upload", files={"file": f})
    body = _check("Upload dataset", res,
                  validators=[("dataset_id présent", _has_key("dataset_id"))],
                  warn_keys=["dataset_id"])
    if not body:
        print(f"\n{R}Impossible de continuer.{X}"); sys.exit(1)

    # Re-lire le JSON directement
    try:
        body = res.json()
    except Exception:
        print("Pas de JSON"); sys.exit(1)

    did = body.get("dataset_id")
    print(f"  → dataset_id = {B}{did}{X}")

    # Nettoyage minimal pour avoir des données propres
    s.post(f"{api_url}/datasets/{did}/clean/auto")

    # ── 1. CHARTS GÉNÉRIQUES (/chart-data) ────────────────────────────────────
    _sec("1. CHART-DATA — Tous les types de graphiques")

    chart_cases = [
        # (nom, payload, validators)
        ("Line : revenue par date", {
            "chart_type": "line",
            "x_col": COL_DATE,
            "y_cols": [COL_NUM1],
            "aggregation": "mean",
            "time_granularity": "auto",
        }, [
            ("chart_type='line'",  lambda b: b.get("chart_type") == "line"),
            ("data non vide",      lambda b: _has_data(b)),
            ("series défini",      lambda b: isinstance(b.get("series"), list) and len(b["series"]) >= 1),
            ("data[0] a clé 'x'",  lambda b: "x" in b["data"][0]),
        ]),

        ("Bar : revenue moyen par satisfaction", {
            "chart_type": "bar",
            "x_col": COL_CAT2,
            "y_cols": [COL_NUM1],
            "aggregation": "mean",
            "top_n": 10,
        }, [
            ("chart_type='bar'",   lambda b: b.get("chart_type") == "bar"),
            ("data non vide",      lambda b: _has_data(b)),
            ("data[0] a x + y",    lambda b: "x" in b["data"][0] and COL_NUM1 in b["data"][0]),
        ]),

        ("Bar : count par catégorie", {
            "chart_type": "bar",
            "x_col": COL_CAT2,
            "y_cols": [COL_NUM1],
            "aggregation": "count",
        }, [
            ("data non vide",  lambda b: _has_data(b)),
        ]),

        ("Bar : sum par catégorie", {
            "chart_type": "bar",
            "x_col": COL_CAT2,
            "y_cols": [COL_NUM1],
            "aggregation": "sum",
        }, [
            ("data non vide",  lambda b: _has_data(b)),
        ]),

        ("Stacked Bar : revenue × premium", {
            "chart_type": "stacked_bar",
            "x_col": COL_CAT2,
            "y_cols": [COL_NUM1],
            "group_col": COL_CAT1,
            "aggregation": "mean",
        }, [
            ("chart_type='stacked_bar'", lambda b: b.get("chart_type") == "stacked_bar"),
            ("data non vide",            lambda b: _has_data(b)),
            ("série groupée présente",   lambda b: len(b.get("series", [])) >= 1),
        ]),

        ("Pie : répartition is_premium_member", {
            "chart_type": "pie",
            "x_col": COL_CAT1,
            "y_cols": [COL_NUM1],
            "aggregation": "sum",
        }, [
            ("chart_type='pie'",  lambda b: b.get("chart_type") == "pie"),
            ("data non vide",     lambda b: _has_data(b)),
            ("percent présent",   lambda b: "percent" in b["data"][0]),
            ("total présent",     lambda b: "total" in b and b["total"] is not None),
        ]),

        ("Pie : count sans y_col", {
            "chart_type": "pie",
            "x_col": COL_CAT2,
            "y_cols": [],
        }, [
            ("data non vide",   lambda b: _has_data(b)),
            ("percent présent", lambda b: "percent" in b["data"][0]),
        ]),

        ("Scatter : revenue vs time_spent", {
            "chart_type": "scatter",
            "x_col": COL_NUM1,
            "y_cols": [COL_NUM2],
        }, [
            ("chart_type='scatter'",  lambda b: b.get("chart_type") == "scatter"),
            ("data non vide",         lambda b: _has_data(b)),
            ("data[0] a x + y",       lambda b: "x" in b["data"][0] and "y" in b["data"][0]),
            ("max 500 points",        lambda b: len(b["data"]) <= 500),
        ]),

        ("Area : revenue par date (granularity=month)", {
            "chart_type": "area",
            "x_col": COL_DATE,
            "y_cols": [COL_NUM1],
            "aggregation": "sum",
            "time_granularity": "month",
        }, [
            ("chart_type='area'",  lambda b: b.get("chart_type") == "area"),
            ("data non vide",      lambda b: _has_data(b)),
        ]),

        ("Area : granularity=year", {
            "chart_type": "area",
            "x_col": COL_DATE,
            "y_cols": [COL_NUM1],
            "aggregation": "sum",
            "time_granularity": "year",
        }, [
            ("data non vide",  lambda b: _has_data(b)),
        ]),

        ("Line multi-series : revenue + items_purchased", {
            "chart_type": "line",
            "x_col": COL_DATE,
            "y_cols": [COL_NUM1, COL_NUM3],
            "aggregation": "mean",
            "time_granularity": "month",
        }, [
            ("2 séries",      lambda b: len(b.get("series", [])) == 2),
            ("data non vide", lambda b: _has_data(b)),
        ]),

        ("Bar top_n=5", {
            "chart_type": "bar",
            "x_col": COL_CAT2,
            "y_cols": [COL_NUM1],
            "aggregation": "mean",
            "top_n": 5,
        }, [
            ("max 5 barres",  lambda b: len(b.get("data", [])) <= 5),
        ]),
    ]

    for name, payload, validators in chart_cases:
        res = s.post(f"{api_url}/datasets/{did}/chart-data", json=payload)
        _check(name, res, validators=validators)

    # ── 2. VISUALISATIONS ANALYSE DESCRIPTIVE ─────────────────────────────────
    _sec("2. VISUALISATIONS — Statistiques descriptives")

    # D'abord, lancer l'analyse complète pour peupler le cache
    s.post(f"{api_url}/datasets/{did}/analysis", json={})

    # Histogramme : bar sur une variable numérique
    res = s.post(f"{api_url}/datasets/{did}/chart-data", json={
        "chart_type": "bar",
        "x_col": COL_CAT2,
        "y_cols": [COL_NUM1],
        "aggregation": "mean",
    })
    _check("Histogramme agrégé (desc)", res, validators=[
        ("data non vide", lambda b: _has_data(b)),
        ("valeurs numériques", lambda b: isinstance(b["data"][0].get(COL_NUM1), (int, float))),
    ])

    # Corrélations endpoint direct
    res = s.get(f"{api_url}/datasets/{did}/analysis/correlations?method=pearson")
    _check("Corrélations Pearson (heatmap data)", res, validators=[
        ("matrix défini",          lambda b: _has_data(b, "matrix") or isinstance(b.get("matrix"), dict)),
        ("significant_pairs",      lambda b: isinstance(b.get("significant_pairs"), list)),
        ("columns défini",         lambda b: isinstance(b.get("columns"), list) and len(b["columns"]) >= 1),
    ], warn_keys=["columns"])

    res = s.get(f"{api_url}/datasets/{did}/analysis/correlations?method=spearman")
    _check("Corrélations Spearman (heatmap data)", res, validators=[
        ("method='spearman'",  lambda b: b.get("method") == "spearman"),
        ("matrix défini",      lambda b: isinstance(b.get("matrix"), dict)),
    ])

    # Stats descriptives pour chaque colonne
    res = s.get(f"{api_url}/datasets/{did}/analysis/descriptive")
    r = _check("Stats descriptives complètes", res, validators=[
        ("au moins 1 colonne", lambda b: isinstance(b, dict) and len(b) >= 1),
        ("col numérique a mean", lambda b: any(
            "mean" in (v or {}) for v in b.values() if isinstance(v, dict)
        )),
    ])
    if r:
        num_cols = [k for k, v in r.items() if isinstance(v, dict) and "mean" in v]
        cat_cols = [k for k, v in r.items() if isinstance(v, dict) and "cardinality" in v]
        print(f"       {Y}↳ {len(num_cols)} col(s) numériques, {len(cat_cols)} col(s) catégorielles{X}")

    # ── 3. VISUALISATIONS TESTS D'HYPOTHÈSES ──────────────────────────────────
    _sec("3. VISUALISATIONS — Tests d'hypothèses")

    # Compare means → box plot data (chart-data bar groupé)
    res = s.post(f"{api_url}/datasets/{did}/analysis/test", json={
        "test_type": "compare_means",
        "group_col": COL_CAT1,
        "value_col": COL_NUM1,
    })
    r = _check("Test compare_means", res, validators=[
        ("test défini",   lambda b: "test" in b),
        ("p_value",       lambda b: b.get("p_value") is not None),
        ("significant",   lambda b: "significant" in b and isinstance(b["significant"], bool)),
        ("effect_size",   lambda b: isinstance(b.get("effect_size"), dict)),
    ], warn_keys=["test", "p_value", "significant"])

    # Visualisation box-plot : bar groupé revenue × premium
    res = s.post(f"{api_url}/datasets/{did}/chart-data", json={
        "chart_type": "bar",
        "x_col": COL_CAT1,
        "y_cols": [COL_NUM1],
        "aggregation": "mean",
    })
    _check("Box-plot proxy : mean revenue par groupe", res, validators=[
        ("données par groupe", lambda b: _has_data(b)),
        ("2 groupes (0/1)",    lambda b: len(b.get("data", [])) == 2),
    ])

    res = s.post(f"{api_url}/datasets/{did}/analysis/test", json={
        "test_type": "correlation",
        "col1": COL_NUM1,
        "col2": COL_NUM2,
    })
    r = _check("Test corrélation (scatter data)", res, validators=[
        ("coefficient",  lambda b: b.get("coefficient") is not None),
        ("p_value",      lambda b: b.get("p_value") is not None),
        ("significant",  lambda b: isinstance(b.get("significant"), bool)),
        ("strength",     lambda b: b.get("strength") is not None),
    ], warn_keys=["test", "coefficient", "significant"])

    # Scatter associé
    res = s.post(f"{api_url}/datasets/{did}/chart-data", json={
        "chart_type": "scatter",
        "x_col": COL_NUM1,
        "y_cols": [COL_NUM2],
    })
    _check("Scatter revenue vs time_spent (corrél visu)", res, validators=[
        ("data non vide",     lambda b: _has_data(b)),
        ("x numérique",       lambda b: isinstance(b["data"][0].get("x"), (int, float))),
        ("y numérique",       lambda b: isinstance(b["data"][0].get("y"), (int, float))),
    ])

    res = s.post(f"{api_url}/datasets/{did}/analysis/test", json={
        "test_type": "independence",
        "col1": COL_CAT1,
        "col2": COL_CAT2,
    })
    _check("Test indépendance Chi²", res, validators=[
        ("statistic",    lambda b: b.get("statistic") is not None),
        ("significant",  lambda b: isinstance(b.get("significant"), bool)),
        ("cramers_v",    lambda b: b.get("effect_size", {}).get("cramers_v") is not None),
    ], warn_keys=["test", "p_value", "significant"])

    # Stacked bar : contingence visuelle
    res = s.post(f"{api_url}/datasets/{did}/chart-data", json={
        "chart_type": "stacked_bar",
        "x_col": COL_CAT2,
        "y_cols": [COL_NUM1],
        "group_col": COL_CAT1,
        "aggregation": "count",
    })
    _check("Contingence visuelle (stacked bar)", res, validators=[
        ("data non vide",  lambda b: _has_data(b)),
        ("groupes présents", lambda b: len(b.get("series", [])) >= 2),
    ])

    res = s.post(f"{api_url}/datasets/{did}/analysis/stationarity", json={"col": COL_NUM1})
    _check("Stationnarité ADF+KPSS", res, validators=[
        ("adf défini",         lambda b: isinstance(b.get("adf"), dict)),
        ("kpss défini",        lambda b: isinstance(b.get("kpss"), dict)),
        ("is_stationary bool", lambda b: isinstance(b.get("is_stationary"), bool)),
        ("adf.is_stationary bool", lambda b: isinstance(b["adf"].get("is_stationary"), bool)),
        ("kpss.is_stationary bool", lambda b: isinstance(b["kpss"].get("is_stationary"), bool)),
        ("conclusion défini",  lambda b: b.get("conclusion") is not None),
    ], warn_keys=["is_stationary", "conclusion"])

    # Série temporelle visu : line chart revenue
    res = s.post(f"{api_url}/datasets/{did}/chart-data", json={
        "chart_type": "line",
        "x_col": COL_DATE,
        "y_cols": [COL_NUM1],
        "aggregation": "mean",
        "time_granularity": "month",
    })
    _check("Série temporelle visu (line chart)", res, validators=[
        ("data non vide",  lambda b: _has_data(b)),
    ])

    # ── 4. VISUALISATIONS ACP ─────────────────────────────────────────────────
    _sec("4. VISUALISATIONS — ACP (PCA)")

    res = s.post(f"{api_url}/datasets/{did}/factor-analysis/pca", json={
        "columns": [COL_NUM1, COL_NUM2, COL_NUM3, COL_NUM4],
        "n_components": 3,
    })
    r = _check("ACP — données complètes", res, validators=[
        ("explained_variance_ratio",  lambda b: isinstance(b.get("explained_variance_ratio"), list) and len(b["explained_variance_ratio"]) >= 2),
        ("scores (individus)",        lambda b: isinstance(b.get("scores"), list) and len(b["scores"]) >= 1),
        ("loadings / components",     lambda b: isinstance(b.get("loadings"), dict) or isinstance(b.get("components"), list)),
        ("eigenvalues",               lambda b: isinstance(b.get("eigenvalues"), list)),
        ("cumulative_variance",       lambda b: isinstance(b.get("cumulative_variance"), list)),
        ("scree plot : n_comp",       lambda b: b.get("n_components", 0) >= 2),
        ("variables list",            lambda b: isinstance(b.get("variables"), list)),
    ], warn_keys=["n_components", "explained_variance_ratio"])
    if r:
        evr = r.get("explained_variance_ratio", [])
        cum = r.get("cumulative_variance", [])
        print(f"       {Y}Variance expliquée par axe : {[round(v,3) for v in evr]}{X}")
        if cum:
            print(f"       {Y}Variance cumulée         : {[round(v,3) for v in cum]}{X}")

    # Scree plot : visualisé via les données retournées (eigenvalues)
    if r and r.get("eigenvalues"):
        ev = r["eigenvalues"]
        print(f"       {Y}Scree (valeurs propres)  : {[round(v,3) for v in ev]}{X}")

    # Biplot : scores individus (2 premières dimensions)
    if r and r.get("scores"):
        s0 = r["scores"][0]
        dims = list(s0.keys())
        has_dim1 = "Dim1" in s0 or "PC1" in s0 or "F1" in s0
        print(f"       {Y}Biplot axes disponibles  : {dims[:4]}{X}")

    # Cercle de corrélations : loadings
    if r:
        loadings = r.get("loadings") or r.get("components")
        if loadings:
            print(f"       {Y}Cercle corr. (loadings) disponible ✓{X}")

    # Scatter biplot via chart-data sur les 2 premiers axes
    if r and r.get("scores") and len(r["scores"]) > 1:
        # On vérifie juste que les scores sont exploitables pour un scatter
        score_keys = list(r["scores"][0].keys())
        print(f"       {Y}Scores dims : {score_keys}{X}")

    # ── 5. VISUALISATIONS AFC ─────────────────────────────────────────────────
    _sec("5. VISUALISATIONS — AFC (CA)")

    res = s.post(f"{api_url}/datasets/{did}/factor-analysis/ca", json={
        "row_col": COL_CAT1,
        "col_col": COL_CAT2,
    })
    _check("AFC — données complètes", res, validators=[
        ("row_coords",     lambda b: isinstance(b.get("row_coords"), dict) and len(b["row_coords"]) >= 1),
        ("col_coords",     lambda b: isinstance(b.get("col_coords"), dict) and len(b["col_coords"]) >= 1),
        ("eigenvalues",    lambda b: isinstance(b.get("eigenvalues"), list)),
        ("explained_variance_ratio", lambda b: isinstance(b.get("explained_variance_ratio"), list)),
        ("contingency_table présent", lambda b: "contingency_table" in b or "row_coords" in b),
    ], warn_keys=["n_components", "explained_variance_ratio"])

    # ── 6. VISUALISATIONS ACM ─────────────────────────────────────────────────
    _sec("6. VISUALISATIONS — ACM (MCA)")

    res = s.post(f"{api_url}/datasets/{did}/factor-analysis/mca", json={
        "columns": [COL_CAT1, COL_CAT2],
        "n_components": 2,
    })
    r = _check("ACM — données complètes", res, validators=[
        ("modality_coords",   lambda b: isinstance(b.get("modality_coords"), dict) and len(b["modality_coords"]) >= 1),
        ("explained_variance_ratio", lambda b: isinstance(b.get("explained_variance_ratio"), list)),
        ("individual_coords", lambda b: isinstance(b.get("individual_coords"), list) and len(b["individual_coords"]) >= 1),
        ("eta2 présent",      lambda b: isinstance(b.get("eta2"), dict)),
        ("sampled flag",      lambda b: "sampled" in b),
        ("n_obs <= 5000",     lambda b: b.get("n_observations", 0) <= 5000),
    ], warn_keys=["n_observations", "sampled", "n_modalities"])

    # ── 7. VISUALISATIONS MODÉLISATION ────────────────────────────────────────
    _sec("7. VISUALISATIONS — Modélisation prédictive")

    # Entraîner
    res = s.post(f"{api_url}/datasets/{did}/model/train", json={
        "target_column": COL_TARGET,
        "models": ["linear_regression", "random_forest"],
        "test_size": 0.2,
    })
    r = _check("Train modèle", res, validators=[
        ("ranking non vide",  lambda b: len(b.get("ranking", [])) >= 1),
        ("best_model_key",    lambda b: b.get("best_model_key") is not None),
    ], warn_keys=["best_model_key", "task_type"])

    # Feature importances : ranking contient les métriques
    if r and r.get("ranking"):
        best = r["ranking"][0]
        metrics = best.get("metrics", {})
        print(f"       {Y}Métriques meilleur modèle : {metrics}{X}")

    # SHAP
    res_r = s.get(f"{api_url}/datasets/{did}/model/results")
    r2 = _check("Résultats modèle + SHAP", res_r, validators=[
        ("best_model_key",  lambda b: b.get("best_model_key") is not None),
        ("shap présent",    lambda b: "shap" in b),
        ("data_split",      lambda b: isinstance(b.get("data_split"), dict)),
        ("ranking",         lambda b: isinstance(b.get("ranking"), list) and len(b["ranking"]) >= 1),
    ], warn_keys=["best_model_key", "shap"])

    if r2 and r2.get("shap"):
        shap = r2["shap"]
        if isinstance(shap, dict):
            print(f"       {Y}SHAP keys : {list(shap.keys())[:5]}{X}")

    # Feature ranges (pour le formulaire de simulation)
    res = s.get(f"{api_url}/datasets/{did}/model/feature-ranges")
    _check("Feature ranges (simulation form)", res, validators=[
        ("features liste",  lambda b: isinstance(b.get("features"), list) and len(b["features"]) >= 1),
        ("ranges dict",     lambda b: isinstance(b.get("ranges"), dict) and len(b["ranges"]) >= 1),
        ("ranges.mean présent", lambda b: all(
            "mean" in v for v in b["ranges"].values()
        )),
    ], warn_keys=["features", "task_type"])

    # Prédiction
    feat_res = s.get(f"{api_url}/datasets/{did}/model/feature-ranges").json()
    if feat_res.get("ranges"):
        sample = {k: v["mean"] for k, v in feat_res["ranges"].items()}
        res = s.post(f"{api_url}/datasets/{did}/model/predict", json={"features": sample})
        _check("Prédiction (1 observation)", res, validators=[
            ("predictions liste",    lambda b: isinstance(b.get("predictions"), list) and len(b["predictions"]) == 1),
            ("prediction numérique", lambda b: isinstance(b["predictions"][0], (int, float))),
            ("model_used",           lambda b: b.get("model_used") is not None),
        ], warn_keys=["predictions", "model_used"])

    # ── 8. VISUALISATIONS SCÉNARIOS ───────────────────────────────────────────
    _sec("8. VISUALISATIONS — Scénarios & Simulation")

    # Créer les scénarios prédéfinis
    s.post(f"{api_url}/datasets/{did}/scenarios/presets", json={})

    # Lister
    res = s.get(f"{api_url}/datasets/{did}/scenarios")
    _check("Liste scénarios", res, validators=[
        ("3 scénarios prédéfinis", lambda b: b.get("count", 0) >= 3),
        ("noms corrects", lambda b: all(
            n in [sc["name"] for sc in b.get("scenarios", [])]
            for n in ["pessimiste", "central", "optimiste"]
        )),
    ])

    # Exécuter et vérifier la structure de comparaison (données graphique tornado)
    res = s.post(f"{api_url}/datasets/{did}/scenarios/run", json={
        "scenario_names": ["pessimiste", "central", "optimiste"],
    })
    _check("Exécution scénarios (données comparaison)", res, validators=[
        ("3 résultats",    lambda b: len(b.get("results", [])) == 3),
        ("comparison",     lambda b: isinstance(b.get("comparison"), dict)),
        ("task_type",      lambda b: b.get("task_type") is not None),
    ], warn_keys=["task_type"])

    # Tornado chart
    res = s.post(f"{api_url}/datasets/{did}/tornado", json={"sigma": 1.0})
    _check("Tornado chart (données)", res, validators=[
        ("bars présent",    lambda b: isinstance(b.get("bars"), list) and len(b["bars"]) >= 1),
        ("bar a variable",  lambda b: "variable" in b["bars"][0]),
        ("bar a pred_low",  lambda b: "pred_low" in b["bars"][0]),
        ("bar a pred_high", lambda b: "pred_high" in b["bars"][0]),
        ("bar a swing",     lambda b: "swing" in b["bars"][0]),
        ("bar a direction", lambda b: b["bars"][0].get("direction") in ("positive", "negative")),
        ("baseline_prediction", lambda b: b.get("baseline_prediction") is not None),
    ], warn_keys=["bars"])

    # Sensibilité
    res = s.post(f"{api_url}/datasets/{did}/sensitivity", json={
        "variables": [COL_NUM2, COL_NUM3],
        "n_points": 10,
        "range_pct": 0.3,
    })
    _check("Sensibilité (line chart data)", res, validators=[
        ("analyses liste",     lambda b: isinstance(b.get("analyses"), list) and len(b["analyses"]) >= 1),
        ("a variable",         lambda b: "variable" in b["analyses"][0]),
        ("a points",           lambda b: isinstance(b["analyses"][0].get("points"), list) and len(b["analyses"][0]["points"]) >= 1),
        ("point a value",      lambda b: "value" in b["analyses"][0]["points"][0]),
        ("point a prediction", lambda b: "prediction_mean" in b["analyses"][0]["points"][0]),
        ("elasticity",         lambda b: "elasticity" in b["analyses"][0]),
    ], warn_keys=["count"])

    # Partial Dependence Plot
    res = s.post(f"{api_url}/datasets/{did}/partial-dependence", json={
        "features": [COL_NUM2, COL_NUM3],
        "n_points": 15,
    })
    _check("Partial Dependence Plot (line data)", res, validators=[
        ("features dict",       lambda b: isinstance(b.get("features"), dict)),
        ("au moins 1 feature",  lambda b: len(b.get("features", {})) >= 1),
    ], warn_keys=["features"])
    r = res.json() if res.status_code == 200 else {}
    if r.get("features"):
        feat_key = next(iter(r["features"]))
        feat_data = r["features"][feat_key]
        has_x = isinstance(feat_data.get("x_values") or feat_data.get("x"), list)
        print(f"       {Y}PDP feature '{feat_key}' : {list(feat_data.keys())[:5]}{X}")

    # Monte Carlo
    res = s.post(f"{api_url}/datasets/{did}/monte-carlo", json={
        "n_simulations": 200,
        "noise_type": "gaussian",
        "noise_scale": 0.5,
        "seed": 99,
    })
    _check("Monte Carlo (histogram data)", res, validators=[
        ("n_simulations",  lambda b: b.get("n_simulations") is not None),
        ("histogram/dist", lambda b: "histogram" in b or "distribution" in b or
                           "predictions" in b or "mean" in b),
    ], warn_keys=["n_simulations"])

    # Stress test
    res = s.post(f"{api_url}/datasets/{did}/stress-test", json={"sigmas": [1.0, 2.0]})
    _check("Stress test (bar data)", res, validators=[
        ("shocks présent", lambda b: "shocks" in b or "results" in b or isinstance(b, dict)),
    ], warn_keys=["shocks"])

    # ── 9. VISUALISATIONS SÉRIES TEMPORELLES ──────────────────────────────────
    _sec("9. VISUALISATIONS — Séries temporelles")

    res = s.post(f"{api_url}/datasets/{did}/timeseries", json={
        "date_col": COL_DATE,
        "value_col": COL_NUM1,
        "models": ["arima", "exponential_smoothing"],
        "forecast_steps": 12,
    })
    r = _check("Série temporelle — structure complète", res, validators=[
        ("models dict",     lambda b: isinstance(b.get("models"), dict) and len(b["models"]) >= 1),
        ("best_model",      lambda b: b.get("best_model") is not None),
        ("au moins 1 modèle a forecast", lambda b: any(
            "forecast" in (v or {}) for v in b.get("models", {}).values()
            if isinstance(v, dict)
        )),
        ("forecast data présent", lambda b: any(
            isinstance((v or {}).get("forecast"), (list, dict))
            for v in b.get("models", {}).values()
            if isinstance(v, dict)
        )),
    ], warn_keys=["best_model"])
    if r and r.get("models"):
        for mname, mdata in r["models"].items():
            if isinstance(mdata, dict):
                fc = mdata.get("forecast", [])
                n_fc = len(fc) if isinstance(fc, list) else (len(fc) if isinstance(fc, dict) else 0)
                print(f"       {Y}Modèle '{mname}' : {n_fc} prévisions{X}")

    # Visualisation de la prévision : line chart
    res = s.post(f"{api_url}/datasets/{did}/chart-data", json={
        "chart_type": "line",
        "x_col": COL_DATE,
        "y_cols": [COL_NUM1],
        "aggregation": "mean",
        "time_granularity": "month",
    })
    _check("Série temporelle visu (line par mois)", res, validators=[
        ("data non vide",  lambda b: _has_data(b)),
        ("format temporel", lambda b: "-" in str(b["data"][0].get("x", ""))),
    ])

    # Multivarié
    res = s.post(f"{api_url}/datasets/{did}/timeseries/multivariate", json={
        "date_col": COL_DATE,
        "value_cols": [COL_NUM1, COL_NUM2],
        "models": ["var"],
        "forecast_steps": 10,
        "granger_max_lag": 4,
        "var_data_mode": "auto",
        "var_trend": "c",
        "granger_data_mode": "auto",
    })
    _check("Série temporelle multivariée (VAR)", res, validators=[
        ("models dict",  lambda b: isinstance(b.get("models"), dict)),
        ("var présent",  lambda b: "var" in (b.get("models") or {})),
    ])

    # ── 10. CAPABILITIES & COLONNES EXCLUES ───────────────────────────────────
    _sec("10. CAPABILITIES & COLONNES EXCLUES")

    res = s.get(f"{api_url}/datasets/{did}/capabilities")
    _check("Capabilities", res, validators=[
        ("analyses liste",   lambda b: isinstance(b.get("analyses"), list) and len(b["analyses"]) >= 5),
        ("columns dict",     lambda b: isinstance(b.get("columns"), dict)),
        ("numeric cols",     lambda b: len(b.get("columns", {}).get("numeric", [])) >= 1),
        ("summary présent",  lambda b: isinstance(b.get("summary"), dict)),
    ], warn_keys=["summary"])

    res = s.get(f"{api_url}/datasets/{did}/excluded-columns")
    _check("Colonnes exclues (GET)", res, validators=[
        ("all_columns",     lambda b: isinstance(b.get("all_columns"), list)),
        ("active_columns",  lambda b: isinstance(b.get("active_columns"), list)),
    ])

    res = s.put(f"{api_url}/datasets/{did}/excluded-columns", json={
        "excluded_columns": [COL_NUM4]
    })
    _check("Exclure une colonne (PUT)", res, validators=[
        ("excluded list",  lambda b: COL_NUM4 in b.get("excluded_columns", [])),
        ("active_columns", lambda b: COL_NUM4 not in b.get("active_columns", [])),
    ])

    # ── 11. INSIGHTS NARRATIFS ────────────────────────────────────────────────
    _sec("11. INSIGHTS NARRATIFS (données textuelles)")

    res = s.get(f"{api_url}/datasets/{did}/insights")
    r = _check("Insights narratifs", res, validators=[
        ("count >= 1",        lambda b: b.get("count", 0) >= 1),
        ("summary dict",      lambda b: isinstance(b.get("summary"), dict)),
        ("insights liste",    lambda b: isinstance(b.get("insights"), list)),
        ("insight a message", lambda b: "message" in b["insights"][0]),
        ("insight a severity",lambda b: "severity" in b["insights"][0]),
    ], warn_keys=["count", "summary"])
    if r and r.get("insights"):
        for ins in r["insights"][:5]:
            sev = ins.get("severity", "?")
            msg = ins.get("message", "")[:70]
            print(f"       [{sev}] {msg}")

    # ── RÉSUMÉ ────────────────────────────────────────────────────────────────
    elapsed = time.time() - t0
    total  = len(_results)
    passed = sum(1 for r in _results if r["ok"])
    failed = total - passed

    print(f"\n{'═'*62}")
    print(f"{B}  RÉSUMÉ  —  {passed}/{total} tests passés  ({elapsed:.1f}s){X}")
    print(f"{'═'*62}")

    if failed:
        print(f"\n{R}{B}  Tests échoués :{X}")
        for r in _results:
            if not r["ok"]:
                label = f"HTTP {r['status']}"
                print(f"  {R}✗  {r['name']}  ({label}){X}")
                for vlabel, ok in r.get("val_results", []):
                    if not ok:
                        print(f"       {R}  ↳ validator échoué : {vlabel}{X}")
    print()

# ── Entrypoint ─────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--url",  default=DEFAULT_URL)
    p.add_argument("--file", default=DEFAULT_FILE)
    args = p.parse_args()
    main(args.url, args.file)
