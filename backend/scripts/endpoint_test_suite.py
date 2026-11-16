"""
Utilitaires et formatage pour la suite de tests des endpoints de l'API.
"""

from __future__ import annotations

import time
from typing import Any
import requests

# ── Couleurs ANSI ─────────────────────────────────────────────────────────────

GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"

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


def _label(ok: bool) -> str:
    return f"{GREEN}[PASS]{RESET}" if ok else f"{RED}[FAIL]{RESET}"


def _section(title: str) -> None:
    print(f"\n{BOLD}{CYAN}{'─'*60}{RESET}")
    print(f"{BOLD}{CYAN}  {title}{RESET}")
    print(f"{BOLD}{CYAN}{'─'*60}{RESET}")


def _check(
    name: str,
    res: requests.Response,
    *,
    show_keys: list[str] | None = None,
    expect: int | list[int] = 200,
) -> dict | None:
    expected_list = [expect] if isinstance(expect, int) else expect
    ok = res.status_code in expected_list
    _results.append({"name": name, "ok": ok, "status": res.status_code})
    try:
        body = res.json()
    except Exception:
        body = {}

    if ok:
        if isinstance(body, dict):
            preview = ", ".join(list(body.keys())[:8])
        elif isinstance(body, list):
            preview = f"[liste de {len(body)} éléments]"
        else:
            preview = str(body)[:120]

        if show_keys:
            for k in show_keys:
                val = body.get(k, "—") if isinstance(body, dict) else "—"
                if isinstance(val, (dict, list)):
                    val = f"({type(val).__name__}, {len(val)} items)"
                print(f"{_label(ok)} {name} ({res.status_code})")
                print(f"    {YELLOW}{k}{RESET}: {val}")
            return body
        print(f"{_label(ok)} {name} ({res.status_code})  →  {preview}")
    else:
        err = body.get("error", res.text[:200]) if isinstance(body, dict) else res.text[:200]
        print(f"{_label(ok)} {name} ({res.status_code})  →  {RED}{err}{RESET}")

    return body if ok else None


def _dump(label: str, data: dict | None, keys: list[str]) -> None:
    """Affiche des sous-cles d'un resultat de maniere lisible."""
    if data is None:
        return
    print(f"    {YELLOW}↳ {label}{RESET}")
    for k in keys:
        val = data.get(k)
        if val is None:
            continue
        if isinstance(val, list):
            ex_str = f"  ex: {str(val[0])[:80]}" if val else ""
            print(f"      {k}: [{len(val)} items]{ex_str}")
        elif isinstance(val, dict):
            sub = list(val.keys())[:5]
            ellipsis_str = "..." if len(val) > 5 else ""
            print(f"      {k}: {{{', '.join(sub)}{ellipsis_str}}}")
        else:
            print(f"      {k}: {str(val)[:100]}")


def print_summary(t0_global: float) -> bool:
    """Affiche le recapitulatif et retourne True si tous les tests ont reussi."""
    elapsed = time.time() - t0_global
    total = len(_results)
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
        return False

    print()
    return True
