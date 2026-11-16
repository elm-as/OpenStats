"""
Tests des endpoints de donnees, nettoyage, diagnostics et statistiques classiques.
"""

from __future__ import annotations

import sys
from typing import Any
import requests

from endpoint_test_suite import (
    BOLD,
    COL_CAT1,
    COL_CAT2,
    COL_NUM1,
    COL_NUM2,
    COL_NUM3,
    COL_NUM4,
    COL_TARGET,
    RED,
    RESET,
    _check,
    _dump,
    _section,
)


def run_data_endpoints_tests(s: requests.Session, api_url: str, file_path: str) -> str | None:
    """Execute les tests sur l'upload, la gestion, le nettoyage, les diagnostics et l'analyse descriptive."""
    # 1. UPLOAD
    _section("1. UPLOAD")
    with open(file_path, "rb") as f:
        res = s.post(f"{api_url}/datasets/upload", files={"file": f})

    body = _check("Upload dataset", res, expect=[200, 201], show_keys=["dataset_id", "name"])
    if body is None:
        print(f"\n{RED}Impossible de continuer sans dataset_id.{RESET}")
        return None

    dataset_id = body["dataset_id"]
    print(f"  → dataset_id = {BOLD}{dataset_id}{RESET}")

    # 2. DATASET — Lecture & Gestion
    _section("2. DATASET — Lecture & Gestion")
    _check("Liste datasets", s.get(f"{api_url}/datasets"))
    _check("Détail dataset", s.get(f"{api_url}/datasets/{dataset_id}"))
    _check("Preview (50 lignes)", s.get(f"{api_url}/datasets/{dataset_id}/preview?n=50"),
           show_keys=["columns", "total_rows"])
    _check("Liste versions", s.get(f"{api_url}/datasets/{dataset_id}/versions"))

    # 3. NETTOYAGE
    _section("3. NETTOYAGE")
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

    # 4. DIAGNOSTICS & RECOMMANDATIONS
    _section("4. DIAGNOSTICS & RECOMMANDATIONS")
    res = s.get(f"{api_url}/datasets/{dataset_id}/diagnostics")
    r = _check("Diagnostics", res, show_keys=["count", "advisories"])
    if r:
        print(f"      → {r.get('count', 0)} advisory(ies)")

    res = s.get(f"{api_url}/datasets/{dataset_id}/auto-pipeline/detect")
    _check("Auto-pipeline detect", res, show_keys=["profile"])

    res = s.post(f"{api_url}/datasets/{dataset_id}/auto-pipeline/recipe", json={"target": COL_TARGET})
    _check("Auto-pipeline recipe", res, show_keys=["profile", "recipe"])

    res = s.post(f"{api_url}/datasets/{dataset_id}/recommend-tests",
                 json={"col1": COL_NUM1, "col2": COL_NUM2})
    _check("Recommande tests", res, show_keys=["recommendations"])

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

    # 5. ANALYSE DESCRIPTIVE & CORRÉLATIONS
    _section("5. ANALYSE DESCRIPTIVE & CORRÉLATIONS")
    res = s.post(f"{api_url}/datasets/{dataset_id}/analysis", json={})
    _check("Analyse complète (desc+corr+VIF)", res,
           show_keys=["descriptive_stats", "correlations", "vif"])

    res = s.get(f"{api_url}/datasets/{dataset_id}/analysis/descriptive")
    r = _check("Stats descriptives (GET)", res)
    if r and isinstance(r, dict):
        print(f"      → colonnes analysées (aperçu): {list(r.keys())[:4]}")

    _check("Corrélations Pearson", s.get(f"{api_url}/datasets/{dataset_id}/analysis/correlations?method=pearson"))
    _check("Corrélations Spearman", s.get(f"{api_url}/datasets/{dataset_id}/analysis/correlations?method=spearman"))

    # 6. TESTS D'HYPOTHÈSES
    _section("6. TESTS D'HYPOTHÈSES")
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
        _check(name, res, show_keys=["test_used", "p_value", "interpretation"])

    res = s.post(f"{api_url}/datasets/{dataset_id}/analysis/stationarity", json={"col": COL_NUM1})
    _check("Stationnarité ADF+KPSS", res, show_keys=["adf", "kpss", "is_stationary"])

    # 7. ANALYSES FACTORIELLES (ACP / AFC / ACM)
    _section("7. ANALYSES FACTORIELLES (ACP / AFC / ACM)")
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
    _check("AFC (CA)", res, show_keys=["inertia", "row_coords", "col_coords"])

    res = s.post(f"{api_url}/datasets/{dataset_id}/factor-analysis/mca", json={
        "columns": [COL_CAT1, COL_CAT2],
    })
    _check("ACM (MCA)", res, show_keys=["inertia", "coordinates"])

    # 14. HISTORIQUE & AUDIT
    _section("14. HISTORIQUE & AUDIT")
    res = s.get(f"{api_url}/datasets/{dataset_id}/history")
    r = _check("Historique analyses", res)
    if isinstance(r, list):
        print(f"      → {len(r)} entrée(s)")

    res = s.get(f"{api_url}/datasets/{dataset_id}/audit")
    r = _check("Journal d'audit", res)
    if isinstance(r, list):
        print(f"      → {len(r)} entrée(s)")

    return dataset_id
