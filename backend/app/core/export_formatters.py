"""
Fonctions utilitaires de formatage et de sérialisation pour les modules d'export.
"""

from __future__ import annotations

import json
import math
from typing import Any
import pandas as pd


def _safe_sheet_name(base_name: str, used_names: set[str]) -> str:
    clean = base_name[:31]
    suffix = 1
    candidate = clean
    while candidate in used_names:
        suffix_str = f"_{suffix}"
        candidate = f"{clean[:31 - len(suffix_str)]}{suffix_str}"
        suffix += 1
    used_names.add(candidate)
    return candidate


def _coalesce(*values: Any) -> Any:
    for value in values:
        if value not in (None, ""):
            return value
    return None


def _dig(obj: dict | None, *keys: str) -> Any:
    current = obj or {}
    for key in keys:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current


def _labelize(value: str) -> str:
    return value.replace("_", " ").strip().title()


def _stringify_nested(value: Any) -> Any:
    if isinstance(value, (dict, list, tuple)):
        return _json_text(value)
    return _sanitize_for_json(value)


def _json_text(value: Any) -> str:
    if value in (None, "", [], {}):
        return ""
    return json.dumps(_sanitize_for_json(value), ensure_ascii=False)


def _display_datetime(value: Any) -> str:
    if not value:
        return ""
    text = str(value)
    if "T" in text:
        return text.replace("T", " ").replace("+00:00", " UTC")
    return text


def _slugify(text: str) -> str:
    return "-".join(part for part in "".join(ch.lower() if ch.isalnum() else " " for ch in text).split() if part)


def _human_size(num_bytes: Any) -> str:
    value = _sanitize_for_json(num_bytes)
    if value in (None, ""):
        return ""
    size = float(value)
    units = ["B", "KB", "MB", "GB"]
    unit_idx = 0
    while size >= 1024 and unit_idx < len(units) - 1:
        size /= 1024
        unit_idx += 1
    return f"{size:.2f} {units[unit_idx]}"


def _fmt(value: Any) -> str:
    value = _sanitize_for_json(value)
    if value is None:
        return "—"
    if isinstance(value, bool):
        return "Oui" if value else "Non"
    if isinstance(value, int):
        return f"{value:,}".replace(",", " ")
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return "—"
        abs_value = abs(value)
        if abs_value == 0:
            return "0"
        if abs_value >= 1000:
            return f"{value:,.2f}".replace(",", " ")
        if abs_value >= 1:
            return f"{value:.4f}"
        if abs_value >= 0.001:
            return f"{value:.6f}"
        return f"{value:.3e}"
    return str(value)


def _sanitize_for_json(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {str(key): _sanitize_for_json(value) for key, value in obj.items()}
    if isinstance(obj, (list, tuple, set)):
        return [_sanitize_for_json(value) for value in obj]
    if isinstance(obj, pd.Timestamp):
        return obj.isoformat()
    if isinstance(obj, pd.Timedelta):
        return str(obj)
    try:
        if pd.isna(obj):
            return None
    except Exception:
        pass
    if hasattr(obj, "item"):
        try:
            return _sanitize_for_json(obj.item())
        except Exception:
            pass
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    return obj


def _flatten_records(records: list[dict]) -> pd.DataFrame:
    rows = []
    for record in records:
        row = {}
        for key, value in (record or {}).items():
            row[_labelize(key)] = _stringify_nested(value)
        rows.append(row)
    return pd.DataFrame(rows)


def _select_best_univariate_model(timeseries: dict) -> dict | None:
    if not timeseries:
        return None
    models = timeseries.get("models") or {}
    best_key = timeseries.get("best_model")
    if best_key and best_key in models and not models[best_key].get("error"):
        return models[best_key]
    for candidate in models.values():
        if candidate and not candidate.get("error"):
            return candidate
    return None
