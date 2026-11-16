"""
Tests des graphiques generiques de base (/chart-data) sur le jeu de donnees.
"""

from __future__ import annotations

import sys
import requests

from chart_test_suite import (
    B,
    COL_CAT1,
    COL_CAT2,
    COL_DATE,
    COL_NUM1,
    COL_NUM2,
    COL_NUM3,
    R,
    X,
    _check,
    _has_data,
    _has_key,
    _sec,
)


def upload_and_setup(s: requests.Session, api_url: str, file_path: str) -> str | None:
    """Uploade le dataset de test et execute un auto-clean initial."""
    _sec("0. UPLOAD & SETUP")
    with open(file_path, "rb") as f:
        res = s.post(f"{api_url}/datasets/upload", files={"file": f})
    body = _check("Upload dataset", res,
                  validators=[("dataset_id présent", _has_key("dataset_id"))],
                  warn_keys=["dataset_id"])
    if not body:
        print(f"\n{R}Impossible de continuer.{X}")
        return None

    try:
        body = res.json()
    except Exception:
        print("Pas de JSON")
        return None

    did = body.get("dataset_id")
    print(f"  → dataset_id = {B}{did}{X}")

    s.post(f"{api_url}/datasets/{did}/clean/auto")
    return did


def run_generic_charts_tests(s: requests.Session, api_url: str, did: str) -> None:
    """Teste tous les types de graphiques generiques proposes par /chart-data."""
    _sec("1. CHART-DATA — Tous les types de graphiques")

    chart_cases = [
        ("Line : revenue par date", {
            "chart_type": "line",
            "x_col": COL_DATE,
            "y_cols": [COL_NUM1],
            "aggregation": "mean",
            "time_granularity": "auto",
        }, [
            ("chart_type='line'", lambda b: b.get("chart_type") == "line"),
            ("data non vide", lambda b: _has_data(b)),
            ("series défini", lambda b: isinstance(b.get("series"), list) and len(b["series"]) >= 1),
            ("data[0] a clé 'x'", lambda b: "x" in b["data"][0]),
        ]),

        ("Bar : revenue moyen par satisfaction", {
            "chart_type": "bar",
            "x_col": COL_CAT2,
            "y_cols": [COL_NUM1],
            "aggregation": "mean",
            "top_n": 10,
        }, [
            ("chart_type='bar'", lambda b: b.get("chart_type") == "bar"),
            ("data non vide", lambda b: _has_data(b)),
            ("data[0] a x + y", lambda b: "x" in b["data"][0] and COL_NUM1 in b["data"][0]),
        ]),

        ("Bar : count par catégorie", {
            "chart_type": "bar",
            "x_col": COL_CAT2,
            "y_cols": [COL_NUM1],
            "aggregation": "count",
        }, [
            ("data non vide", lambda b: _has_data(b)),
        ]),

        ("Bar : sum par catégorie", {
            "chart_type": "bar",
            "x_col": COL_CAT2,
            "y_cols": [COL_NUM1],
            "aggregation": "sum",
        }, [
            ("data non vide", lambda b: _has_data(b)),
        ]),

        ("Stacked Bar : revenue × premium", {
            "chart_type": "stacked_bar",
            "x_col": COL_CAT2,
            "y_cols": [COL_NUM1],
            "group_col": COL_CAT1,
            "aggregation": "mean",
        }, [
            ("chart_type='stacked_bar'", lambda b: b.get("chart_type") == "stacked_bar"),
            ("data non vide", lambda b: _has_data(b)),
            ("série groupée présente", lambda b: len(b.get("series", [])) >= 1),
        ]),

        ("Pie : répartition is_premium_member", {
            "chart_type": "pie",
            "x_col": COL_CAT1,
            "y_cols": [COL_NUM1],
            "aggregation": "sum",
        }, [
            ("chart_type='pie'", lambda b: b.get("chart_type") == "pie"),
            ("data non vide", lambda b: _has_data(b)),
            ("percent présent", lambda b: "percent" in b["data"][0]),
            ("total présent", lambda b: "total" in b and b["total"] is not None),
        ]),

        ("Pie : count sans y_col", {
            "chart_type": "pie",
            "x_col": COL_CAT2,
            "y_cols": [],
        }, [
            ("data non vide", lambda b: _has_data(b)),
            ("percent présent", lambda b: "percent" in b["data"][0]),
        ]),

        ("Scatter : revenue vs time_spent", {
            "chart_type": "scatter",
            "x_col": COL_NUM1,
            "y_cols": [COL_NUM2],
        }, [
            ("chart_type='scatter'", lambda b: b.get("chart_type") == "scatter"),
            ("data non vide", lambda b: _has_data(b)),
            ("data[0] a x + y", lambda b: "x" in b["data"][0] and "y" in b["data"][0]),
            ("max 500 points", lambda b: len(b["data"]) <= 500),
        ]),

        ("Area : revenue par date (granularity=month)", {
            "chart_type": "area",
            "x_col": COL_DATE,
            "y_cols": [COL_NUM1],
            "aggregation": "sum",
            "time_granularity": "month",
        }, [
            ("chart_type='area'", lambda b: b.get("chart_type") == "area"),
            ("data non vide", lambda b: _has_data(b)),
        ]),

        ("Area : granularity=year", {
            "chart_type": "area",
            "x_col": COL_DATE,
            "y_cols": [COL_NUM1],
            "aggregation": "sum",
            "time_granularity": "year",
        }, [
            ("data non vide", lambda b: _has_data(b)),
        ]),

        ("Line multi-series : revenue + items_purchased", {
            "chart_type": "line",
            "x_col": COL_DATE,
            "y_cols": [COL_NUM1, COL_NUM3],
            "aggregation": "mean",
            "time_granularity": "month",
        }, [
            ("2 séries", lambda b: len(b.get("series", [])) == 2),
            ("data non vide", lambda b: _has_data(b)),
        ]),

        ("Bar top_n=5", {
            "chart_type": "bar",
            "x_col": COL_CAT2,
            "y_cols": [COL_NUM1],
            "aggregation": "mean",
            "top_n": 5,
        }, [
            ("max 5 barres", lambda b: len(b.get("data", [])) <= 5),
        ]),
    ]

    for name, payload, validators in chart_cases:
        res = s.post(f"{api_url}/datasets/{did}/chart-data", json=payload)
        _check(name, res, validators=validators)
