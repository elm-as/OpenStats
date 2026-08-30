"""
Nœuds de séries temporelles (Univariées et Multivariées).
Avec auto-sélection intelligente de la colonne temporelle et des variables numériques.
"""

import pandas as pd
from app.services.dataset_service import dataset_manager
from ._shared import _sanitize

def _find_date_col(df: pd.DataFrame) -> str | None:
    # 1. Datetime dtypes
    for c in df.columns:
        if pd.api.types.is_datetime64_any_dtype(df[c]):
            return c
    # 2. Key words in column names
    for c in df.columns:
        if any(k in c.lower() for k in ["date", "time", "annee", "year", "month", "mois"]):
            return c
    # 3. Parsable sample
    for c in df.columns:
        sample = df[c].dropna().head(20)
        if sample.empty:
            continue
        try:
            parsed = pd.to_datetime(sample.astype(str), errors="coerce")
            if parsed.notna().mean() > 0.7:
                return c
        except Exception:
            pass
    return None


def execute_timeseries(data, dataset_id):
    df = dataset_manager.get_df(dataset_id)
    if df is None or df.empty:
        return {"status": "error", "error": "DataFrame vide ou introuvable"}

    date_col = data.get("dateCol", "") or _find_date_col(df)
    value_col = data.get("valueCol", "")

    if not value_col:
        num_cols = [c for c in df.select_dtypes(include=["number"]).columns if c != date_col]
        if num_cols:
            value_col = num_cols[0]

    if not date_col or not value_col or date_col not in df.columns or value_col not in df.columns:
        return {"status": "error", "error": "Colonnes date et valeur requises pour l'analyse de séries temporelles"}

    forecast_steps = int(data.get("forecastSteps", 10))
    model_val = data.get("model", "auto")
    models = None if model_val == "auto" else [model_val]
    try:
        result = dataset_manager.run_timeseries(
            dataset_id=dataset_id,
            date_col=date_col,
            value_col=value_col,
            models=models,
            forecast_steps=forecast_steps,
        )
    except Exception as e:
        return {"status": "error", "error": f"Erreur série temporelle: {str(e)}"}
    return {
        "status": "success",
        "message": f"Série temporelle analysée ({value_col})",
        "result": _sanitize(result),
    }


def execute_multivariate_timeseries(data, dataset_id):
    df = dataset_manager.get_df(dataset_id)
    if df is None or df.empty:
        return {"status": "error", "error": "DataFrame vide ou introuvable"}

    date_col = data.get("dateCol", "") or _find_date_col(df)
    value_cols_str = data.get("valueCols", "")

    if value_cols_str:
        value_cols = [c.strip() for c in value_cols_str.split(",") if c.strip() in df.columns]
    else:
        value_cols = [c for c in df.select_dtypes(include=["number"]).columns if c != date_col]

    if not date_col or date_col not in df.columns:
        return {"status": "error", "error": "Colonne de date valide requise pour les séries multivariées"}
    if len(value_cols) < 2:
        return {"status": "error", "error": f"Au moins 2 variables numériques requises pour l'analyse multivariée (trouvé: {len(value_cols)})"}

    forced_model_val = data.get("forcedModel", "auto")
    forced_model = None if forced_model_val == "auto" else forced_model_val
    granger_max_lag = int(data.get("grangerMaxLag", 4))
    target_col = data.get("targetCol", "") or None
    try:
        result = dataset_manager.run_multivariate_timeseries(
            dataset_id=dataset_id,
            date_col=date_col,
            value_cols=value_cols,
            forecast_steps=int(data.get("forecastSteps", 10)),
            forced_model=forced_model,
            granger_max_lag=granger_max_lag,
            target_col=target_col,
        )
    except Exception as e:
        return {"status": "error", "error": f"Erreur séries multivariées: {str(e)}"}
    return {
        "status": "success",
        "message": f"Séries temporelles multivariées analysées ({len(value_cols)} variables)",
        "result": _sanitize(result),
    }


def execute_granger(data, dataset_id):
    df = dataset_manager.get_df(dataset_id)
    if df is None or df.empty:
        return {"status": "error", "error": "DataFrame vide ou introuvable"}

    cols_str = data.get("valueCols", "")
    if cols_str:
        value_cols = [c.strip() for c in cols_str.split(",") if c.strip() in df.columns]
    else:
        date_col = _find_date_col(df)
        value_cols = [c for c in df.select_dtypes(include=["number"]).columns if c != date_col][:5]

    if len(value_cols) < 2:
        return {"status": "error", "error": "Au moins 2 variables numériques requises pour la causalité de Granger"}

    max_lag = int(data.get("maxLag", 4))
    from app.core.timeseries import test_granger_causality
    try:
        res = test_granger_causality(df[value_cols].dropna(), max_lag=max_lag)
    except Exception as e:
        return {"status": "error", "error": f"Erreur calcul Causalité de Granger: {str(e)}"}

    return {
        "status": "success",
        "message": f"Causalité de Granger calculée sur {len(value_cols)} variables (lag max={max_lag})",
        "result": _sanitize(res),
    }


def execute_cointegration(data, dataset_id):
    df = dataset_manager.get_df(dataset_id)
    if df is None or df.empty:
        return {"status": "error", "error": "DataFrame vide ou introuvable"}

    cols_str = data.get("valueCols", "")
    if cols_str:
        value_cols = [c.strip() for c in cols_str.split(",") if c.strip() in df.columns]
    else:
        date_col = _find_date_col(df)
        value_cols = [c for c in df.select_dtypes(include=["number"]).columns if c != date_col][:4]

    if len(value_cols) < 2:
        return {"status": "error", "error": "Au moins 2 variables numériques requises pour la cointégration"}

    from statsmodels.tsa.vector_ar.vecm import coint_johansen
    try:
        res = coint_johansen(df[value_cols].dropna(), det_order=0, k_ar_diff=1)
        r0_stat = float(res.lr1[0])
        r0_crit = float(res.cvt[0, 1])
        is_coint = bool(r0_stat > r0_crit)
    except Exception as e:
        return {"status": "error", "error": f"Erreur calcul Johansen: {str(e)}"}

    return {
        "status": "success",
        "message": f"Test de Johansen ({len(value_cols)} variables) : {'Cointégration détectée' if is_coint else 'Pas de cointégration à 5%'}",
        "result": _sanitize({"r0_stat": r0_stat, "r0_crit_5pct": r0_crit, "is_cointegrated": is_coint, "variables": value_cols}),
    }


def execute_ts_decomposition(data, dataset_id):
    df = dataset_manager.get_df(dataset_id)
    if df is None or df.empty:
        return {"status": "error", "error": "DataFrame vide ou introuvable"}

    date_col = data.get("dateCol", "") or _find_date_col(df)
    value_col = data.get("valueCol", "")
    if not value_col:
        num_cols = [c for c in df.select_dtypes(include=["number"]).columns if c != date_col]
        if num_cols:
            value_col = num_cols[0]

    if not value_col or value_col not in df.columns:
        return {"status": "error", "error": "Variable numérique requise pour la décomposition"}

    series = df[value_col].dropna()
    if len(series) < 14:
        return {"status": "error", "error": "Série temporelle trop courte (min 14 obs)"}

    period = int(data.get("period", 7))
    from statsmodels.tsa.seasonal import seasonal_decompose
    try:
        decomp = seasonal_decompose(series, period=period, extrapolate_trend="freq")
        res = {
            "column": value_col,
            "period": period,
            "trend_mean": float(decomp.trend.mean()),
            "seasonal_std": float(decomp.seasonal.std()),
            "resid_std": float(decomp.resid.std()),
        }
    except Exception as e:
        return {"status": "error", "error": f"Erreur décomposition STL: {str(e)}"}

    return {
        "status": "success",
        "message": f"Décomposition temporelle de '{value_col}' (période={period}) terminée",
        "result": _sanitize(res),
    }
