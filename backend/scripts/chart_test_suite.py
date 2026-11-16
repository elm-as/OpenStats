"""
Utilitaires, prédicats et formatage pour les tests de graphiques et visualisations.
"""

from __future__ import annotations

import time
from typing import Any, Callable
import requests

# ── Couleurs terminal ──────────────────────────────────────────────────────────

G = "\033[92m"
R = "\033[91m"
Y = "\033[93m"
C = "\033[96m"
B = "\033[1m"
X = "\033[0m"

# ── Colonnes standard du jeu de donnees de test ────────────────────────────────

COL_DATE = "date_event"
COL_NUM1 = "revenue"
COL_NUM2 = "time_spent_minutes"
COL_NUM3 = "items_purchased"
COL_NUM4 = "discount_applied"
COL_CAT1 = "is_premium_member"
COL_CAT2 = "satisfaction_level"
COL_TARGET = "revenue"

_results: list[dict[str, Any]] = []


def _sec(title: str) -> None:
    print(f"\n{B}{C}{'─'*62}{X}")
    print(f"{B}{C}  {title}{X}")
    print(f"{B}{C}{'─'*62}{X}")


def _check(
    name: str,
    res: requests.Response,
    *,
    validators: list[tuple[str, Callable[[Any], bool]]] | None = None,
    warn_keys: list[str] | None = None,
) -> dict | None:
    """Verifie le statut HTTP + validators optionnels sur le body."""
    ok_http = res.status_code in (200, 201)
    try:
        body = res.json()
    except Exception:
        body = {}

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
    _results.append({
        "name": name,
        "ok": overall,
        "status": res.status_code,
        "val_results": val_results,
    })

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


def _has_data(body: dict, key: str = "data") -> bool:
    """Valide que body[key] est une liste non vide."""
    v = body.get(key)
    return isinstance(v, list) and len(v) > 0


def _has_key(key: str) -> Callable[[dict], bool]:
    return lambda b: key in b and b[key] is not None


def _list_len(key: str, min_len: int = 1) -> Callable[[dict], bool]:
    return lambda b: isinstance(b.get(key), list) and len(b[key]) >= min_len


def _dict_key(key: str) -> Callable[[dict], bool]:
    return lambda b: isinstance(b.get(key), dict) and len(b[key]) > 0


def _num_key(key: str) -> Callable[[dict], bool]:
    return lambda b: isinstance(b.get(key), (int, float)) and b[key] is not None


def print_chart_summary(t0: float) -> bool:
    """Affiche le recapitulatif et retourne True si tous les tests de graphiques ont reussi."""
    elapsed = time.time() - t0
    total = len(_results)
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
        return False

    print()
    return True
