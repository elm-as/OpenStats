"""
Script de test complet des endpoints API — debug terminal.

Usage :
    python scripts/test_all_endpoints.py [--url http://127.0.0.1:5000] [--file path/to/file.csv]

Pré-requis : serveur Flask en cours d'exécution avec LOCAL_DEV_MODE=true.
"""

import sys
import json
import time
import argparse
import textwrap
import requests

# ── Configuration ──────────────────────────────────────────────────────────────

DEFAULT_URL  = "http://127.0.0.1:5000/api/v1"
DEFAULT_FILE = r"c:\Users\elmas\Desktop\Projets\Stats\backend\data\test_dataset_complet.csv"

# Colonnes connues du dataset de test
COL_DATE     = "date_event"
COL_NUM1     = "revenue"
COL_NUM2     = "time_spent_minutes"
COL_NUM3     = "items_purchased"
COL_NUM4     = "discount_applied"
COL_CAT1     = "is_premium_member"
COL_CAT2     = "satisfaction_level"
COL_TARGET   = "revenue"

# ── Helpers affichage ──────────────────────────────────────────────────────────

GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

_results: list[dict] = []

def _label(ok: bool) -> str:
    return f"{GREEN}[PASS]{RESET}" if ok else f"{RED}[FAIL]{RESET}"

def _section(title: str) -> None:
    print(f"\n{BOLD}{CYAN}{'─'*60}{RESET}")
    print(f"{BOLD}{CYAN}  {title}{RESET}")
    print(f"{BOLD}{CYAN}{'─'*60}{RESET}")

def _check(name: str, res: requests.Response, *, show_keys: list[str] | None = None,
           expect: int = 200) -> dict | None:
    ok = res.status_code in ([expect] if isinstance(expect, int) else expect)
    _results.append({"name": name, "ok": ok, "status": res.status_code})
    try:
        body = res.json()
    except Exception:
        body = {}

    if ok:
        # Aperçu compact des clés retournées
        if isinstance(body, dict):
            keys = list(body.keys())[:8]
            preview = ", ".join(keys)
        elif isinstance(body, list):
            preview = f"[liste de {len(body)} éléments]"
        else:
            preview = str(body)[:120]

        if show_keys:
            for k in show_keys:
                val = body.get(k, "—") if isinstance(body, dict) else "—"
                if isinstance(val, (dict, list)):
                    val = f"({type(val).__name__}, {len(val)} items)"
                preview_line = f"    {YELLOW}{k}{RESET}: {val}"
                print(f"{_label(ok)} {name} ({res.status_code})")
                print(preview_line)
            return body
        print(f"{_label(ok)} {name} ({res.status_code})  →  {preview}")
    else:
        err = body.get("error", res.text[:200]) if isinstance(body, dict) else res.text[:200]
        print(f"{_label(ok)} {name} ({res.status_code})  →  {RED}{err}{RESET}")

    return body if ok else None


def _dump(label: str, data: dict | None, keys: list[str]) -> None:
    """Affiche des sous-clés d'un résultat de manière lisible."""
    if data is None:
        return
    print(f"    {YELLOW}↳ {label}{RESET}")
    for k in keys:
        val = data.get(k)
        if val is None:
            continue
        if isinstance(val, list):
            print(f"      {k}: [{len(val)} items]  ex: {str(val[0])[:80]}" if val else f"      {k}: []")
        elif isinstance(val, dict):
            sub = list(val.keys())[:5]
            print(f"      {k}: {{{', '.join(sub)}{'...' if len(val) > 5 else ''}}}")
        else:
            print(f"      {k}: {str(val)[:100]}")

# ── Main ───────────────────────────────────────────────────────────────────────

def main(api_url: str, file_path: str) -> None:
    s = requests.Session()
    t0_global = time.time()

    # ══════════════════════════════════════════════════════════════════════════
    _section("1. UPLOAD")
    # ══════════════════════════════════════════════════════════════════════════
    with open(file_path, "rb") as f:
        res = s.post(f"{api_url}/datasets/upload", files={"file": f})

    body = _check("Upload dataset", res, expect=[200, 201], show_keys=["dataset_id", "name"])
    if body is None:
        print(f"\n{RED}Impossible de continuer sans dataset_id.{RESET}")
        sys.exit(1)

    dataset_id = body["dataset_id"]
    print(f"  → dataset_id = {BOLD}{dataset_id}{RESET}")

    # ══════════════════════════════════════════════════════════════════════════
    _section("2. DATASET — Lecture & Gestion")
    # ══════════════════════════════════════════════════════════════════════════
    _check("Liste datasets",  s.get(f"{api_url}/datasets"))
    _check("Détail dataset",  s.get(f"{api_url}/datasets/{dataset_id}"))
    _check("Preview (50 lignes)", s.get(f"{api_url}/datasets/{dataset_id}/preview?n=50"),
           show_keys=["columns", "total_rows"])
    _check("Liste versions", s.get(f"{api_url}/datasets/{dataset_id}/versions"))

    # ══════════════════════════════════════════════════════════════════════════
    _section("3. NETTOYAGE")
    # ══════════════════════════════════════════════════════════════════════════
    pipeline = {
        "pipeline": [
            {"step": "deduplication", "config": {}},
            {"step": "missing_values", "config": {"default_strategy": "median"}},
            {"step": "outliers", "config": {"method": "iqr", "treatment": "cap", "threshold": 1.5}},
        ]
    }
    res = s.post(f"{api_url}/datasets/{dataset_id}/clean", json=pipeline)
    r = _check("Pipeline nettoyage", res, show_keys=["shape_before", "shape_after", "logs"])
    if r:
        _dump("shape", r, ["shape_before", "shape_after"])

    res = s.post(f"{api_url}/datasets/{dataset_id}/clean/auto")
    _check("Auto-clean", res, show_keys=["shape_before", "shape_after"])

    # ══════════════════════════════════════════════════════════════════════════
    _section("4. DIAGNOSTICS & RECOMMANDATIONS")
    # ══════════════════════════════════════════════════════════════════════════
    res = s.get(f"{api_url}/datasets/{dataset_id}/diagnostics")
    r = _check("Diagnostics", res, show_keys=["count", "advisories"])
    if r:
        print(f"      → {r.get('count', 0)} advisory(ies)")

    res = s.get(f"{api_url}/datasets/{dataset_id}/auto-pipeline/detect")
    r = _check("Auto-pipeline detect", res, show_keys=["profile"])

    res = s.post(f"{api_url}/datasets/{dataset_id}/auto-pipeline/recipe",
                 json={"target": COL_TARGET})
    _check("Auto-pipeline recipe", res, show_keys=["profile", "recipe"])

    res = s.post(f"{api_url}/datasets/{dataset_id}/recommend-tests",
                 json={"col1": COL_NUM1, "col2": COL_NUM2})
    r = _check("Recommande tests", res, show_keys=["recommendations"])

    res = s.post(f"{api_url}/datasets/{dataset_id}/recommend-models",
                 json={"target_column": COL_TARGET})
    r = _check("Recommande modèles", res, show_keys=["recommendations"])
    if r:
        recs = r.get("recommendations", [])
        if recs:
            print(f"      → top: {[x.get('key') or x.get('model') for x in recs[:3]]}")

    res = s.post(f"{api_url}/datasets/{dataset_id}/check-assumptions",
                 json={"test_type": "means_comparison", "value_col": COL_NUM1,
                       "group_col": COL_CAT1})
    _check("Vérif hypothèses", res, show_keys=["all_passed", "checks"])

    # ══════════════════════════════════════════════════════════════════════════
    _section("5. ANALYSE DESCRIPTIVE & CORRÉLATIONS")
    # ══════════════════════════════════════════════════════════════════════════
    res = s.post(f"{api_url}/datasets/{dataset_id}/analysis", json={})
    r = _check("Analyse complète (desc+corr+VIF)", res,
               show_keys=["descriptive_stats", "correlations", "vif"])

    res = s.get(f"{api_url}/datasets/{dataset_id}/analysis/descriptive")
    r = _check("Stats descriptives (GET)", res)
    if r and isinstance(r, dict):
        cols = list(r.keys())[:4]
        print(f"      → colonnes analysées (aperçu): {cols}")

    res = s.get(f"{api_url}/datasets/{dataset_id}/analysis/correlations?method=pearson")
    _check("Corrélations Pearson", res)

    res = s.get(f"{api_url}/datasets/{dataset_id}/analysis/correlations?method=spearman")
    _check("Corrélations Spearman", res)

    # ══════════════════════════════════════════════════════════════════════════
    _section("6. TESTS D'HYPOTHÈSES")
    # ══════════════════════════════════════════════════════════════════════════
    tests = [
        ("Compare means (t-test/Welch/ANOVA)", {
            "test_type": "compare_means",
            "group_col": COL_CAT1,
            "value_col": COL_NUM1,
        }),
        ("Corrélation (Pearson/Spearman)", {
            "test_type": "correlation",
            "col1": COL_NUM1,
            "col2": COL_NUM2,
        }),
        ("Indépendance (Chi²)", {
            "test_type": "independence",
            "col1": COL_CAT1,
            "col2": COL_CAT2,
        }),
    ]
    for name, payload in tests:
        res = s.post(f"{api_url}/datasets/{dataset_id}/analysis/test", json=payload)
        r = _check(name, res, show_keys=["test_used", "p_value", "interpretation"])

    res = s.post(f"{api_url}/datasets/{dataset_id}/analysis/stationarity",
                 json={"col": COL_NUM1})
    r = _check("Stationnarité ADF+KPSS", res, show_keys=["adf", "kpss", "is_stationary"])

    # ══════════════════════════════════════════════════════════════════════════
    _section("7. ANALYSES FACTORIELLES (ACP / AFC / ACM)")
    # ══════════════════════════════════════════════════════════════════════════
    res = s.post(f"{api_url}/datasets/{dataset_id}/factor-analysis/pca", json={
        "columns": [COL_NUM1, COL_NUM2, COL_NUM3, COL_NUM4],
        "n_components": 3,
    })
    r = _check("ACP (PCA)", res, show_keys=["explained_variance_ratio", "components", "scores"])
    if r:
        evr = r.get("explained_variance_ratio", [])
        print(f"      → variance expliquée: {[round(v, 3) for v in evr[:3]]}")

    res = s.post(f"{api_url}/datasets/{dataset_id}/factor-analysis/ca", json={
        "row_col": COL_CAT1,
        "col_col": COL_CAT2,
    })
    r = _check("AFC (CA)", res, show_keys=["inertia", "row_coords", "col_coords"])

    res = s.post(f"{api_url}/datasets/{dataset_id}/factor-analysis/mca", json={
        "columns": [COL_CAT1, COL_CAT2],
    })
    r = _check("ACM (MCA)", res, show_keys=["inertia", "coordinates"])

    # ══════════════════════════════════════════════════════════════════════════
    _section("8. MODÉLISATION PRÉDICTIVE")
    # ══════════════════════════════════════════════════════════════════════════
    res = s.post(f"{api_url}/datasets/{dataset_id}/model/train", json={
        "target_column": COL_TARGET,
        "models": ["linear_regression", "random_forest"],
        "test_size": 0.2,
        "split_strategy": "auto",
    })
    r = _check("Entraînement modèles", res,
               show_keys=["task_type", "best_model_key", "ranking"])
    if r:
        ranking = r.get("ranking", [])
        for m in ranking[:3]:
            score_key = "r2" if r.get("task_type") == "regression" else "f1"
            score = m.get("metrics", {}).get(score_key, m.get("metrics", {}))
            print(f"      {m.get('key')}: {score}")

    res = s.get(f"{api_url}/datasets/{dataset_id}/model/results")
    _check("Résultats modèle (GET)", res, show_keys=["best_model_key", "task_type"])

    res = s.get(f"{api_url}/datasets/{dataset_id}/model/feature-ranges")
    r = _check("Feature ranges", res, show_keys=["features", "task_type"])

    # Prediction — on utilise les moyennes des features
    feat_res = s.get(f"{api_url}/datasets/{dataset_id}/model/feature-ranges").json()
    if feat_res and feat_res.get("ranges"):
        sample_features = {k: v["mean"] for k, v in feat_res["ranges"].items()}
        res = s.post(f"{api_url}/datasets/{dataset_id}/model/predict",
                     json={"features": sample_features})
        r = _check("Prédiction", res, show_keys=["predictions", "model_used"])

    # ══════════════════════════════════════════════════════════════════════════
    _section("9. SÉRIES TEMPORELLES")
    # ══════════════════════════════════════════════════════════════════════════
    res = s.post(f"{api_url}/datasets/{dataset_id}/timeseries", json={
        "date_col": COL_DATE,
        "value_col": COL_NUM1,
        "models": ["arima", "exponential_smoothing"],
        "forecast_steps": 10,
    })
    r = _check("Série temporelle univariée", res,
               show_keys=["models", "forecast", "best_model"])
    if r:
        models_done = list((r.get("models") or {}).keys())
        print(f"      → modèles: {models_done}")

    res = s.post(f"{api_url}/datasets/{dataset_id}/timeseries/multivariate", json={
        "date_col": COL_DATE,
        "value_cols": [COL_NUM1, COL_NUM2],
        "models": ["var"],
        "forecast_steps": 10,
        "granger_max_lag": 4,
        "var_data_mode": "auto",
        "var_trend": "c",
        "granger_data_mode": "auto",
    })
    r = _check("Série temporelle multivariée (VAR)", res,
               show_keys=["models", "granger", "forecast"])

    # ══════════════════════════════════════════════════════════════════════════
    _section("10. GRAPHIQUES / VISUALISATIONS (chart-data)")
    # ══════════════════════════════════════════════════════════════════════════
    charts = [
        ("Chart — Line (revenue/date)", {
            "chart_type": "line",
            "x_col": COL_DATE,
            "y_cols": [COL_NUM1],
            "aggregation": "mean",
        }),
        ("Chart — Bar (satisfaction)", {
            "chart_type": "bar",
            "x_col": COL_CAT2,
            "y_cols": [COL_NUM1],
            "aggregation": "mean",
            "top_n": 10,
        }),
        ("Chart — Pie (is_premium_member)", {
            "chart_type": "pie",
            "x_col": COL_CAT1,
            "y_cols": [COL_NUM1],
            "aggregation": "sum",
        }),
        ("Chart — Scatter (revenue vs time_spent)", {
            "chart_type": "scatter",
            "x_col": COL_NUM1,
            "y_cols": [COL_NUM2],
        }),
        ("Chart — Area (revenue/date)", {
            "chart_type": "area",
            "x_col": COL_DATE,
            "y_cols": [COL_NUM1],
            "aggregation": "sum",
        }),
        ("Chart — Stacked Bar (satisfaction × premium)", {
            "chart_type": "stacked_bar",
            "x_col": COL_CAT2,
            "y_cols": [COL_NUM1],
            "group_col": COL_CAT1,
            "aggregation": "mean",
        }),
    ]
    for name, payload in charts:
        res = s.post(f"{api_url}/datasets/{dataset_id}/chart-data", json=payload)
        r = _check(name, res, show_keys=["chart_type", "labels", "datasets"])
        if r:
            labels = r.get("labels", [])
            ds_list = r.get("datasets", [])
            pts = len(labels)
            series = len(ds_list)
            print(f"      → {pts} points, {series} série(s)")

    # ══════════════════════════════════════════════════════════════════════════
    _section("11. TRANSFORMATIONS")
    # ══════════════════════════════════════════════════════════════════════════
    res = s.get(f"{api_url}/datasets/{dataset_id}/transforms/catalog")
    r = _check("Catalogue transformations", res, show_keys=["transforms"])
    if r:
        t_list = r.get("transforms", [])
        keys = [t.get("key") for t in t_list[:6]]
        print(f"      → {len(t_list)} transforms disponibles: {keys}...")

    res = s.get(f"{api_url}/datasets/{dataset_id}/transforms/recommend")
    r = _check("Recommandations transforms", res, show_keys=["recommendations"])

    res = s.post(f"{api_url}/datasets/{dataset_id}/transforms/preview", json={
        "column": COL_NUM1,
        "transform": "log",
        "params": {},
    })
    r = _check("Preview transform (log)", res,
               show_keys=["transform", "original", "transformed"])
    if r:
        orig = r.get("original", {})
        trans = r.get("transformed", {})
        print(f"      → skewness avant: {orig.get('skewness')}  après: {trans.get('skewness')}")

    res = s.post(f"{api_url}/datasets/{dataset_id}/transforms/apply", json={
        "transforms": [
            {"column": COL_NUM1, "transform": "log", "params": {}},
        ],
        "inplace": False,
    })
    _check("Apply transform (dry-run)", res, show_keys=["logs", "applied", "shape"])

    res = s.post(f"{api_url}/datasets/{dataset_id}/compute-variable", json={
        "new_column": "revenue_per_min",
        "formula": f"{COL_NUM1} / ({COL_NUM2} + 1)",
    })
    _check("Calcul variable dérivée", res, show_keys=["log", "shape"])

    # ══════════════════════════════════════════════════════════════════════════
    _section("12. SCÉNARIOS & SIMULATION")
    # ══════════════════════════════════════════════════════════════════════════
    res = s.post(f"{api_url}/datasets/{dataset_id}/scenarios/presets", json={})
    r = _check("Scénarios prédéfinis (pessimiste/central/optimiste)", res,
               show_keys=["scenarios"])
    if r:
        names = [s_["name"] for s_ in r.get("scenarios", [])]
        print(f"      → scénarios: {names}")

    res = s.post(f"{api_url}/datasets/{dataset_id}/scenarios/create", json={
        "name": "custom_test",
        "modifications": {COL_NUM1: {"shift": 0.1}, COL_NUM2: {"shift": -0.05}},
    })
    _check("Créer scénario custom", res, show_keys=["name", "modifications", "n_rows"])

    res = s.get(f"{api_url}/datasets/{dataset_id}/scenarios")
    r = _check("Lister scénarios", res, show_keys=["scenarios", "count"])

    res = s.post(f"{api_url}/datasets/{dataset_id}/scenarios/run", json={
        "scenario_names": ["pessimiste", "central", "optimiste"],
    })
    r = _check("Exécuter scénarios", res, show_keys=["results", "comparison"])
    if r:
        for sc in r.get("results", []):
            print(f"      {sc.get('name')}: mean_pred={sc.get('mean_prediction')}")

    res = s.post(f"{api_url}/datasets/{dataset_id}/sensitivity", json={
        "variables": [COL_NUM2, COL_NUM3],
        "n_points": 10,
        "range_pct": 0.3,
    })
    r = _check("Analyse de sensibilité", res, show_keys=["analyses", "count"])

    res = s.post(f"{api_url}/datasets/{dataset_id}/tornado", json={"sigma": 1.0})
    r = _check("Tornado chart", res, show_keys=["variables", "bars"])

    res = s.post(f"{api_url}/datasets/{dataset_id}/partial-dependence", json={
        "features": [COL_NUM2, COL_NUM3],
        "n_points": 15,
    })
    _check("Partial Dependence Plots", res, show_keys=["features"])

    res = s.post(f"{api_url}/datasets/{dataset_id}/monte-carlo", json={
        "n_simulations": 500,
        "noise_type": "gaussian",
        "noise_scale": 1.0,
        "seed": 42,
    })
    r = _check("Monte Carlo (500 sims)", res,
               show_keys=["n_simulations", "mean", "std", "percentiles"])

    res = s.post(f"{api_url}/datasets/{dataset_id}/stress-test", json={
        "sigmas": [1.0, 2.0],
    })
    _check("Stress test (±1σ, ±2σ)", res, show_keys=["shocks"])

    # ══════════════════════════════════════════════════════════════════════════
    _section("13. INSIGHTS NARRATIFS")
    # ══════════════════════════════════════════════════════════════════════════
    res = s.get(f"{api_url}/datasets/{dataset_id}/insights")
    r = _check("Insights narratifs", res, show_keys=["count", "summary"])
    if r:
        summary = r.get("summary", {})
        print(f"      → {r.get('count')} insights  "
              f"({summary.get('critical', 0)} critical, "
              f"{summary.get('warning', 0)} warning, "
              f"{summary.get('info', 0)} info)")
        insights = r.get("insights", [])
        for ins in insights[:3]:
            msg = ins.get("message", "")
            sev = ins.get("severity", "")
            print(f"        [{sev}] {msg[:80]}")

    # ══════════════════════════════════════════════════════════════════════════
    _section("14. HISTORIQUE & AUDIT")
    # ══════════════════════════════════════════════════════════════════════════
    res = s.get(f"{api_url}/datasets/{dataset_id}/history")
    r = _check("Historique analyses", res)
    if isinstance(r, list):
        print(f"      → {len(r)} entrée(s)")

    res = s.get(f"{api_url}/datasets/{dataset_id}/audit")
    r = _check("Journal d'audit", res)
    if isinstance(r, list):
        print(f"      → {len(r)} entrée(s)")

    # ══════════════════════════════════════════════════════════════════════════
    # RÉSUMÉ FINAL
    # ══════════════════════════════════════════════════════════════════════════
    elapsed = time.time() - t0_global
    total  = len(_results)
    passed = sum(1 for r in _results if r["ok"])
    failed = total - passed

    print(f"\n{'═'*60}")
    print(f"{BOLD}  RÉSUMÉ  —  {passed}/{total} tests passés  ({elapsed:.1f}s){RESET}")
    print(f"{'═'*60}")

    if failed:
        print(f"\n{RED}{BOLD}  Tests échoués :{RESET}")
        for r in _results:
            if not r["ok"]:
                print(f"  {RED}✗  {r['name']} (HTTP {r['status']}){RESET}")

    print()


# ── Entrypoint ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test tous les endpoints API OpenStats")
    parser.add_argument("--url",  default=DEFAULT_URL,  help="Base URL de l'API")
    parser.add_argument("--file", default=DEFAULT_FILE, help="Chemin vers le CSV de test")
    args = parser.parse_args()

    main(args.url, args.file)
