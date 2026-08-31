"""
Génération des DataFrames tabulaires pour les modèles prédictifs, séries temporelles et factoriels.
"""

from __future__ import annotations

import pandas as pd
from app.core.export_formatters import (
    _dig, _json_text, _coalesce, _labelize, _sanitize_for_json, _select_best_univariate_model
)


def _model_ranking_frame(payload: dict) -> pd.DataFrame:
    modeling = payload.get("modeling") or {}
    rows = []
    for entry in modeling.get("ranking") or []:
        row = {
            "Rang": entry.get("rank"),
            "Modele": _coalesce(entry.get("model_name"), entry.get("name"), entry.get("model"), entry.get("key")),
            "Cle": _coalesce(entry.get("model_key"), entry.get("key")),
            "Type de tache": _coalesce(entry.get("task_type"), modeling.get("task_type")),
            "CV Mean": _dig(entry, "cv_scores", "mean"),
            "CV Std": _dig(entry, "cv_scores", "std"),
            "Parametres": _json_text(entry.get("best_params")),
        }
        for metric_name, metric_value in (entry.get("metrics") or {}).items():
            clean_metric = _sanitize_for_json(metric_value)
            if isinstance(clean_metric, (str, int, float, bool)) and clean_metric is not None:
                row[_labelize(metric_name)] = clean_metric
        rows.append(row)
    return pd.DataFrame(rows)


def _feature_importance_frame(payload: dict) -> pd.DataFrame:
    rows = []
    for entry in payload.get("modeling", {}).get("ranking") or []:
        model_name = _coalesce(entry.get("model_name"), entry.get("name"), entry.get("key"))
        for feature in entry.get("feature_importance") or []:
            rows.append({
                "Modele": model_name,
                "Feature": feature.get("feature"),
                "Importance": feature.get("importance"),
            })
    return pd.DataFrame(rows)


def _regression_ols_summary_frame(payload: dict) -> pd.DataFrame:
    """Extrait le tableau détaillé des coefficients OLS avec t-stat, p-valeurs et IC."""
    modeling = payload.get("modeling") or {}
    ranking = modeling.get("ranking") or []
    ols_entry = next((m for m in ranking if "ols" in str(m.get("model_key", "")).lower() or "linear" in str(m.get("model_key", "")).lower()), None)
    if not ols_entry or not ols_entry.get("model_summary"):
        return pd.DataFrame()

    summ = ols_entry["model_summary"]
    coefs = summ.get("coefficients") or []
    rows = []
    for c in coefs:
        p_val = c.get("p_value", 1)
        stars = "***" if p_val < 0.001 else ("**" if p_val < 0.01 else ("*" if p_val < 0.05 else ""))
        rows.append({
            "Variable": c.get("variable"),
            "Coefficient": c.get("coefficient"),
            "Erreur standard": c.get("std_error"),
            "t-stat": c.get("t_statistic"),
            "p-valeur": c.get("p_value"),
            "Signif.": stars,
            "IC 95% Bas": c.get("ci_lower"),
            "IC 95% Haut": c.get("ci_upper"),
        })
    return pd.DataFrame(rows)


def _shap_frame(payload: dict) -> pd.DataFrame:
    shap = payload.get("modeling", {}).get("shap") or {}
    return pd.DataFrame(shap.get("global_importance") or [])


def _timeseries_summary_frame(payload: dict) -> pd.DataFrame:
    ts = payload.get("timeseries") or {}
    if not ts:
        return pd.DataFrame()
    return pd.DataFrame([{
        "Variable date": ts.get("date_col"),
        "Variable valeur": ts.get("value_col"),
        "Observations": ts.get("n_observations"),
        "Frequence": ts.get("frequency"),
        "Periode saisonniere": ts.get("seasonal_period"),
        "Meilleur modele": ts.get("best_model"),
        "Plage debut": _dig(ts, "date_range", "start"),
        "Plage fin": _dig(ts, "date_range", "end"),
        "Erreur": ts.get("error"),
    }])


def _timeseries_forecast_frame(payload: dict) -> pd.DataFrame:
    ts = payload.get("timeseries") or {}
    best_model = _select_best_univariate_model(ts)
    if not best_model:
        return pd.DataFrame()

    forecast = best_model.get("forecast") or {}
    dates = forecast.get("dates") or []
    values = forecast.get("values") or []
    lower = forecast.get("lower_ci") or [None] * len(dates)
    upper = forecast.get("upper_ci") or [None] * len(dates)
    rows = []
    for idx, date in enumerate(dates):
        rows.append({
            "Modele": best_model.get("model"),
            "Date": date,
            "Prevision": values[idx] if idx < len(values) else None,
            "IC Bas": lower[idx] if idx < len(lower) else None,
            "IC Haut": upper[idx] if idx < len(upper) else None,
        })
    return pd.DataFrame(rows)


def _multivariate_summary_frame(payload: dict) -> pd.DataFrame:
    mts = payload.get("multivariate_timeseries") or {}
    if not mts:
        return pd.DataFrame()
    orders = _dig(mts, "integration_diagnostics", "orders") or {}
    return pd.DataFrame([{
        "Variable date": mts.get("date_col"),
        "Variables": ", ".join(mts.get("value_cols") or []),
        "Observations": mts.get("n_observations"),
        "Nombre de series": mts.get("n_variables"),
        "Frequence": mts.get("frequency"),
        "Toutes stationnaires": mts.get("all_stationary"),
        "Ordres integration": ", ".join(f"{col}=I({order})" for col, order in orders.items()),
        "Johansen/VECM valide": _dig(mts, "johansen_cointegration", "assumption_valid"),
        "Meilleur modele": mts.get("best_model"),
        "Recommandation": mts.get("recommendation"),
        "Diagnostic integration": _dig(mts, "integration_diagnostics", "interpretation"),
        "Debut": _dig(mts, "date_range", "start"),
        "Fin": _dig(mts, "date_range", "end"),
        "Erreur": mts.get("error"),
    }])


def _granger_frame(payload: dict) -> pd.DataFrame:
    details = _dig(payload, "multivariate_timeseries", "granger_causality", "details") or []
    return pd.DataFrame(details)


def _johansen_frame(payload: dict) -> pd.DataFrame:
    johansen = _dig(payload, "multivariate_timeseries", "johansen_cointegration") or {}
    rows = []
    if johansen:
        rows.append({
            "Type de test": "Synthese",
            "Hypothese": "Hypothèse I(1)",
            "Statistique": johansen.get("assumption_message"),
            "Valeur critique 95%": None,
            "Rejet": johansen.get("assumption_valid"),
        })
    for test in johansen.get("trace_tests") or []:
        rows.append({
            "Type de test": "Trace",
            "Hypothese": test.get("hypothesis"),
            "Statistique": test.get("statistic"),
            "Valeur critique 95%": test.get("critical_value_95"),
            "Rejet": test.get("reject"),
        })
    for test in johansen.get("max_eigenvalue_tests") or []:
        rows.append({
            "Type de test": "Max Eigenvalue",
            "Hypothese": test.get("hypothesis"),
            "Statistique": test.get("statistic"),
            "Valeur critique 95%": test.get("critical_value_95"),
            "Rejet": test.get("reject"),
        })
    return pd.DataFrame(rows)


def _multivariate_forecast_frame(payload: dict) -> pd.DataFrame:
    mts = payload.get("multivariate_timeseries") or {}
    best_key = mts.get("best_model")
    models = mts.get("models") or {}
    best_model = models.get(best_key) if best_key else None
    if not best_model:
        for candidate in models.values():
            if candidate and not candidate.get("error"):
                best_model = candidate
                break
    if not best_model:
        return pd.DataFrame()

    forecast = best_model.get("forecast") or {}
    dates = forecast.get("dates") or []
    series = forecast.get("series") or {}
    if not dates or not series:
        return pd.DataFrame()

    rows = []
    for idx, date in enumerate(dates):
        row = {
            "Modele": best_model.get("model"),
            "Date": date,
        }
        for var_name, values in series.items():
            row[var_name] = values[idx] if idx < len(values) else None
        rows.append(row)
    return pd.DataFrame(rows)


def _pca_variance_frame(payload: dict) -> pd.DataFrame:
    pca = _dig(payload, "factor_analysis", "pca") or {}
    labels = pca.get("component_labels") or []
    if not labels:
        return pd.DataFrame()
    rows = []
    eigenvalues = pca.get("eigenvalues") or []
    explained = pca.get("explained_variance_ratio") or []
    cumulative = pca.get("cumulative_variance") or []
    for idx, label in enumerate(labels):
        rows.append({
            "Composante": label,
            "Valeur propre": eigenvalues[idx] if idx < len(eigenvalues) else None,
            "Variance expliquee": explained[idx] if idx < len(explained) else None,
            "Variance cumulee": cumulative[idx] if idx < len(cumulative) else None,
        })
    return pd.DataFrame(rows)


def _pca_loadings_frame(payload: dict) -> pd.DataFrame:
    pca = _dig(payload, "factor_analysis", "pca") or {}
    loadings = pca.get("loadings") or {}
    rows = []
    for variable, coords in loadings.items():
        row = {"Variable": variable}
        row.update(coords)
        contrib = _dig(pca, "contrib_var", variable) or {}
        for component, value in contrib.items():
            row[f"Contribution {component}"] = value
        rows.append(row)
    return pd.DataFrame(rows)


def _ca_coords_frame(payload: dict, axis: str) -> pd.DataFrame:
    ca = _dig(payload, "factor_analysis", "ca") or {}
    source_key = "row_coords" if axis == "row" else "col_coords"
    contrib_key = "row_contrib" if axis == "row" else "col_contrib"
    cos2_key = "row_cos2" if axis == "row" else "col_cos2"
    coords = ca.get(source_key) or {}
    rows = []
    for label, values in coords.items():
        row = {"Libelle": label}
        row.update(values)
        for component, value in (ca.get(contrib_key, {}).get(label) or {}).items():
            row[f"Contribution {component}"] = value
        for component, value in (ca.get(cos2_key, {}).get(label) or {}).items():
            row[f"Cos2 {component}"] = value
        rows.append(row)
    return pd.DataFrame(rows)


def _mca_modalities_frame(payload: dict) -> pd.DataFrame:
    mca = _dig(payload, "factor_analysis", "mca") or {}
    modality_info = mca.get("modality_info") or []
    coords = mca.get("modality_coords") or {}
    contrib = mca.get("modality_contrib") or {}
    cos2 = mca.get("modality_cos2") or {}
    rows = []
    for info in modality_info:
        full_name = info.get("full")
        row = {
            "Variable": info.get("variable"),
            "Modalite": info.get("modality"),
            "Cle": full_name,
        }
        row.update(coords.get(full_name) or {})
        for component, value in (contrib.get(full_name) or {}).items():
            row[f"Contribution {component}"] = value
        for component, value in (cos2.get(full_name) or {}).items():
            row[f"Cos2 {component}"] = value
        rows.append(row)
    return pd.DataFrame(rows)
