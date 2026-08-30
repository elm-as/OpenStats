"""
Génération des DataFrames tabulaires pour les statistiques, tests et audit.
"""

from __future__ import annotations

import pandas as pd
from app.core.export_formatters import (
    _human_size, _dig, _json_text, _coalesce, _flatten_records
)


def _summary_frame(payload: dict) -> pd.DataFrame:
    metadata = payload.get("metadata", {})
    dataset = payload.get("dataset", {})
    data_summary = payload.get("data_summary", {})
    rows = [
        {"Champ": "Titre", "Valeur": metadata.get("title")},
        {"Champ": "Organisation", "Valeur": metadata.get("organization")},
        {"Champ": "Dataset ID", "Valeur": dataset.get("id")},
        {"Champ": "Nom du dataset", "Valeur": dataset.get("name")},
        {"Champ": "Fichier source", "Valeur": dataset.get("original_filename")},
        {"Champ": "Taille du fichier", "Valeur": _human_size(dataset.get("file_size"))},
        {"Champ": "Cree le", "Valeur": dataset.get("created_at")},
        {"Champ": "Mis a jour le", "Valeur": dataset.get("updated_at")},
        {"Champ": "Lignes (courant)", "Valeur": _dig(dataset, "shape", "rows")},
        {"Champ": "Colonnes (courant)", "Valeur": _dig(dataset, "shape", "columns")},
        {"Champ": "Lignes (brut)", "Valeur": _dig(dataset, "raw_shape", "rows")},
        {"Champ": "Colonnes (brut)", "Valeur": _dig(dataset, "raw_shape", "columns")},
        {"Champ": "Colonnes actives", "Valeur": _dig(dataset, "active_shape", "columns")},
        {"Champ": "Colonnes exclues", "Valeur": ", ".join(dataset.get("excluded_columns") or []) or "Aucune"},
        {"Champ": "Version courante", "Valeur": dataset.get("current_version")},
        {"Champ": "Nombre de versions", "Valeur": dataset.get("versions_count")},
        {"Champ": "Memoire estimee (MB)", "Valeur": data_summary.get("memory_usage_mb")},
        {"Champ": "Export genere le", "Valeur": metadata.get("generated_at")},
    ]
    return pd.DataFrame(rows)


def _preview_frame(payload: dict) -> pd.DataFrame:
    return pd.DataFrame.from_records(payload.get("data_summary", {}).get("preview") or [])


def _dictionary_frame(payload: dict) -> pd.DataFrame:
    rows = []
    for entry in payload.get("data_summary", {}).get("dictionary", []):
        stats = entry.get("stats", {}) or {}
        rows.append({
            "Colonne": entry.get("nom_brut"),
            "Libelle": entry.get("nom_lisible"),
            "Type": entry.get("type_statistique"),
            "Type Regex": entry.get("type_regex"),
            "Unite": entry.get("unite_mesure"),
            "Domaine": entry.get("domaine_unite"),
            "Format Date": entry.get("date_format"),
            "Taux Nullite": entry.get("taux_nullite"),
            "Cardinalite": entry.get("cardinalite"),
            "Moyenne": stats.get("mean"),
            "Mediane": stats.get("median"),
            "Ecart-type": stats.get("std"),
            "Min": stats.get("min"),
            "Max": stats.get("max"),
            "Top Valeurs": _json_text(stats.get("top_values")),
        })
    return pd.DataFrame(rows)


def _descriptive_frames(payload: dict) -> tuple[pd.DataFrame, pd.DataFrame]:
    numeric_rows = []
    categorical_rows = []
    descriptive_stats = payload.get("analysis", {}).get("descriptive_stats") or {}
    for column_name, stats in descriptive_stats.items():
        if not isinstance(stats, dict):
            continue
        if stats.get("type") == "numeric":
            row = {
                "Variable": column_name,
                "Type": stats.get("dtype"),
                "Effectif": stats.get("count"),
                "Moyenne": stats.get("mean"),
                "Mediane": stats.get("median"),
                "Mode": stats.get("mode"),
                "Ecart-type": stats.get("std"),
                "Variance": stats.get("variance"),
                "Min": stats.get("min"),
                "Q1": stats.get("q1"),
                "Q3": stats.get("q3"),
                "Max": stats.get("max"),
                "IQR": stats.get("iqr"),
                "CV (%)": stats.get("cv"),
                "Skewness": stats.get("skewness"),
                "Kurtosis": stats.get("kurtosis"),
                "Nulls": stats.get("null_count"),
                "Taux Nullite": stats.get("null_rate"),
            }
            ci = stats.get("confidence_intervals") or {}
            ci_values = ci.get("bootstrap_ci") or {}
            if ci_values:
                row.update({
                    "IC Moyenne Bas": _dig(ci_values, "mean", "ci_lower"),
                    "IC Moyenne Haut": _dig(ci_values, "mean", "ci_upper"),
                    "IC Mediane Bas": _dig(ci_values, "median", "ci_lower"),
                    "IC Mediane Haut": _dig(ci_values, "median", "ci_upper"),
                    "IC Ecart-type Bas": _dig(ci_values, "std", "ci_lower"),
                    "IC Ecart-type Haut": _dig(ci_values, "std", "ci_upper"),
                    "N Bootstrap": ci.get("n_bootstrap"),
                })
            numeric_rows.append(row)
        else:
            categorical_rows.append({
                "Variable": column_name,
                "Type": stats.get("dtype"),
                "Effectif": stats.get("count"),
                "Cardinalite": stats.get("cardinality"),
                "Mode": stats.get("mode"),
                "Frequence du mode": stats.get("mode_frequency"),
                "Top Valeurs": _json_text(stats.get("top_values")),
                "Nulls": stats.get("null_count"),
                "Taux Nullite": stats.get("null_rate"),
            })
    return pd.DataFrame(numeric_rows), pd.DataFrame(categorical_rows)


def _correlation_matrix_frame(payload: dict, method: str) -> pd.DataFrame:
    corr = payload.get("analysis", {}).get("correlations", {}).get(method) or {}
    matrix = corr.get("matrix")
    columns = corr.get("columns") or []
    if not matrix or not columns:
        return pd.DataFrame()
    frame = pd.DataFrame(matrix)
    return frame.reindex(index=columns, columns=columns).reset_index(names="Variable")


def _significant_correlations_frame(payload: dict) -> pd.DataFrame:
    rows = []
    correlations = payload.get("analysis", {}).get("correlations", {})
    for method, corr in correlations.items():
        for pair in corr.get("significant_pairs", []):
            rows.append({
                "Methode": method,
                "Variable 1": pair.get("var1"),
                "Variable 2": pair.get("var2"),
                "Coefficient": pair.get("coefficient"),
                "Force": pair.get("strength"),
            })
    return pd.DataFrame(rows)


def _vif_frame(payload: dict) -> pd.DataFrame:
    return pd.DataFrame(payload.get("analysis", {}).get("vif") or [])


def _tests_frame(payload: dict) -> pd.DataFrame:
    rows = []
    for test in payload.get("tests") or []:
        rows.append({
            "Test": _coalesce(test.get("test_name"), test.get("test"), test.get("test_type")),
            "Type": test.get("test_type"),
            "Statistique": test.get("statistic"),
            "P-value": test.get("p_value"),
            "Significatif": test.get("significant"),
            "Taille d effet": _json_text(test.get("effect_size")),
            "Interpretation": test.get("interpretation"),
            "Erreur": test.get("error"),
        })
    return pd.DataFrame(rows)


def _log_frame(records: list[dict] | None) -> pd.DataFrame:
    return _flatten_records(records or [])


def _versions_frame(payload: dict) -> pd.DataFrame:
    return _flatten_records(payload.get("versions") or [])


def _history_frame(payload: dict) -> pd.DataFrame:
    return _flatten_records(payload.get("history") or [])


def _audit_frame(payload: dict) -> pd.DataFrame:
    return _flatten_records(payload.get("audit_trail") or [])
