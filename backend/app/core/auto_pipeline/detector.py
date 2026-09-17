"""
Détecteur de profil sémantique et inférence de pipeline pour auto-pipeline.
"""

from __future__ import annotations

import pandas as pd
from typing import Any

from app.core.auto_pipeline.profile import DatasetProfile
from app.core.auto_pipeline.heuristics import (
    _classify_column,
    _score_target_candidate,
    _detect_problem_type,
    _integration_order,
    _is_id_like,
    _is_binary,
    _is_temporal,
)


def detect_dataset_profile(
    df: pd.DataFrame,
    user_hint_target: str | None = None,
    type_overrides: dict[str, str] | None = None,
    exclude_columns: list[str] | None = None,
    ds_profile: dict[str, Any] | None = None,
) -> DatasetProfile:
    """Analyse complète d'un DataFrame pour produire son profil sémantique."""
    if exclude_columns:
        cols_to_drop = [c for c in exclude_columns if c in df.columns]
        if cols_to_drop:
            df = df.drop(columns=cols_to_drop)

    profile = DatasetProfile(n_rows=len(df), n_cols=df.shape[1])
    type_overrides = type_overrides or {}

    TYPE_MAP = {
        "continu": "numeric", "numérique": "numeric", "numeric": "numeric", "float": "numeric",
        "discret": "discrete", "integer": "discrete", "int": "discrete",
        "binaire": "binary", "binary": "binary", "bool": "binary",
        "catégoriel_nominal": "categorical", "catégoriel": "categorical", "categoriel": "categorical",
        "catégoriel_ordinal": "categorical", "categorical": "categorical", "texte": "categorical",
        "text": "categorical", "string": "categorical",
        "temporel": "temporal", "temporal": "temporal", "date": "temporal", "datetime": "temporal",
        "identifiant": "id", "id": "id",
    }

    stored_types: dict[str, str] = {}
    if ds_profile and isinstance(ds_profile, dict):
        dictionary = ds_profile.get("dictionary") or []
        for entry in dictionary:
            if isinstance(entry, dict) and "nom_brut" in entry and "type_statistique" in entry:
                stored_types[entry["nom_brut"]] = str(entry["type_statistique"]).lower()

    # 1. Typage des colonnes
    for col in df.columns:
        if col in type_overrides and type_overrides[col] and type_overrides[col] != "auto":
            raw_t = str(type_overrides[col]).lower()
            ct = TYPE_MAP.get(raw_t, _classify_column(df[col], name=col))
        elif col in stored_types and stored_types[col] and stored_types[col] != "auto":
            raw_t = str(stored_types[col]).lower()
            ct = TYPE_MAP.get(raw_t, _classify_column(df[col], name=col))
        else:
            ct = _classify_column(df[col], name=col)

        profile.column_types[col] = ct
        if ct == "numeric":
            profile.numeric_cols.append(col)
        elif ct == "categorical":
            profile.categorical_cols.append(col)
        elif ct == "binary":
            profile.binary_cols.append(col)
        elif ct == "temporal":
            profile.temporal_cols.append(col)
        elif ct == "id":
            profile.id_cols.append(col)
        elif ct == "discrete":
            profile.discrete_cols.append(col)

    profile.has_temporal = len(profile.temporal_cols) > 0

    # 2. Qualité
    profile.duplicate_rows = int(df.duplicated().sum())
    profile.duplicate_ratio = profile.duplicate_rows / max(len(df), 1)
    profile.overall_null_rate = float(df.isna().mean().mean()) if df.shape[1] > 0 else 0.0
    profile.high_missing_cols = [c for c in df.columns if df[c].isna().mean() > 0.5]

    for c in df.columns:
        valid = df[c].dropna()
        if len(valid) > 0 and valid.nunique() == 1:
            profile.near_constant_cols.append(c)
        elif len(valid) > 0:
            top_freq = valid.value_counts(normalize=True).iloc[0]
            if top_freq > 0.98:
                profile.near_constant_cols.append(c)

    # 3. Drapeaux
    if profile.n_rows < 100:
        profile.flags.append("small_sample")
    if profile.n_rows > 100000:
        profile.flags.append("large_sample")
    if profile.n_cols > 50:
        profile.flags.append("wide_dataset")
    if profile.n_cols > profile.n_rows:
        profile.flags.append("high_dim")

    # 4. Structure temporelle / panel
    if profile.has_temporal and (profile.numeric_cols or profile.discrete_cols):
        from app.core.auto_pipeline.panel_structure import decrire_panel, detecter_panel

        candidats = profile.categorical_cols + profile.id_cols + profile.discrete_cols
        couple = detecter_panel(df, profile.temporal_cols, candidats)
        if couple:
            profile.is_panel = True
            profile.is_cross_section = False
            profile.panel_structure = decrire_panel(df, couple[0], couple[1])
        else:
            profile.is_timeseries = True
            profile.is_cross_section = False

    # 5. Détection target
    candidates = []
    if user_hint_target and user_hint_target in df.columns:
        ct = profile.column_types.get(user_hint_target, "numeric")
        profile.suggested_target = user_hint_target
        profile.target_score = 100.0
        profile.problem_type = _detect_problem_type(df[user_hint_target], ct)
    else:
        for col in df.columns:
            ct = profile.column_types[col]
            score = _score_target_candidate(df[col], ct, col)
            candidates.append({"column": col, "type": ct, "score": float(round(score, 1))})

        candidates.sort(key=lambda x: -x["score"])
        profile.candidate_targets = candidates[:15]

        best = candidates[0] if candidates else None
        if best and best["score"] >= 50 and best["type"] not in ("id", "temporal"):
            profile.suggested_target = best["column"]
            profile.target_score = best["score"]
            profile.problem_type = _detect_problem_type(df[best["column"]], best["type"])

    if not profile.suggested_target and profile.is_timeseries and profile.numeric_cols:
        profile.problem_type = "forecast"
        profile.suggested_target = profile.numeric_cols[0]

    # 5b. Stationnarité
    if profile.has_temporal and profile.numeric_cols and profile.n_rows >= 12:
        cols_to_test = profile.numeric_cols[:15]
        orders = {col: _integration_order(df[col].dropna()) for col in cols_to_test}
        profile.integration_orders = orders

        n_stationary = sum(1 for v in orders.values() if v["order"] == 0)
        n_i1 = sum(1 for v in orders.values() if v["order"] == 1)
        n_total = len(orders)

        if n_stationary == n_total:
            profile.stationarity_summary = "all_stationary"
        elif n_i1 == n_total:
            profile.stationarity_summary = "all_nonstationary"
            profile.cointegration_likely = n_i1 >= 2
        elif n_i1 > 0 and n_stationary > 0:
            profile.stationarity_summary = "mixed"
        else:
            profile.stationarity_summary = "all_nonstationary"

        non_stat = [c for c, v in orders.items() if v["order"] > 0]
        if non_stat:
            profile.notes.append(
                f"Séries non-stationnaires détectées : {', '.join(non_stat[:4])} — différenciation recommandée."
            )
        if profile.cointegration_likely:
            profile.notes.append(
                f"{n_i1} séries I(1) détectées — test de cointégration recommandé (Johansen). VECM possible."
            )

    # 6. Notes contextuelles
    if profile.duplicate_ratio > 0.05:
        profile.notes.append(
            f"{profile.duplicate_rows} doublons détectés ({profile.duplicate_ratio:.1%}) — nettoyage recommandé."
        )
    if profile.high_missing_cols:
        profile.notes.append(
            f"{len(profile.high_missing_cols)} colonne(s) avec >50% de valeurs manquantes : "
            + ", ".join(profile.high_missing_cols[:5])
        )
    if profile.near_constant_cols:
        profile.notes.append(
            f"{len(profile.near_constant_cols)} colonne(s) quasi-constante(s) : "
            + ", ".join(profile.near_constant_cols[:5])
        )
    if "high_dim" in profile.flags:
        profile.notes.append("Dataset à haute dimension (p > n) — réduction de dimensions conseillée.")
    if profile.is_timeseries:
        profile.notes.append("Structure de série temporelle détectée — prévision possible.")
    if profile.is_panel:
        forme = profile.panel_structure
        profile.notes.append(
            f"Structure de panel détectée : {forme.get('n_entities')} entités "
            f"({forme.get('entity_column')}) × {forme.get('n_periods')} périodes "
            f"({forme.get('time_column')}), "
            + ("cylindré" if forme.get("is_balanced") else "non cylindré")
            + ". Les modèles temporels univariés ne s'appliquent pas en l'état."
        )

    return profile


__all__ = [
    "DatasetProfile",
    "detect_dataset_profile",
    "_classify_column",
    "_is_id_like",
    "_is_binary",
    "_is_temporal",
    "_score_target_candidate",
    "_detect_problem_type",
    "_integration_order",
]
