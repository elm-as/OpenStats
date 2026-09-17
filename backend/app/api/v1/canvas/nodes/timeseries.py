"""
Nœuds de séries temporelles (Univariées et Multivariées).
Avec auto-sélection intelligente de la colonne temporelle et des variables numériques.
"""

import pandas as pd
from app.services.dataset_service import dataset_manager
from ._shared import _sanitize, lire_booleen, lire_decimal, lire_entier, lire_texte

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

    model_val = lire_texte(data, "model")
    models = [model_val] if model_val else None
    try:
        result = dataset_manager.run_timeseries(
            dataset_id=dataset_id,
            date_col=date_col,
            value_col=value_col,
            models=models,
            forecast_steps=lire_entier(data, "forecastSteps", 10),
            ar_order=lire_entier(data, "arOrder"),
            diff_order=lire_entier(data, "diffOrder"),
            ma_order=lire_entier(data, "maOrder"),
            seasonal_period=lire_entier(data, "seasonalPeriod"),
            backtest=lire_booleen(data, "backtest", True),
            backtest_horizon=lire_entier(data, "backtestHorizon"),
            backtest_origins=lire_entier(data, "backtestOrigins"),
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

    # Tous ces reglages existent dans l'interface : ils sont transmis au moteur,
    # qui les accepte deja. Un champ laisse vide retombe sur la valeur du moteur.
    niveau_confiance = lire_decimal(data, "confidenceLevel")
    if niveau_confiance is not None and niveau_confiance > 1:
        niveau_confiance = niveau_confiance / 100.0

    try:
        result = dataset_manager.run_multivariate_timeseries(
            dataset_id=dataset_id,
            date_col=date_col,
            value_cols=value_cols,
            forecast_steps=lire_entier(data, "forecastSteps", 10),
            forced_model=lire_texte(data, "forcedModel"),
            granger_max_lag=lire_entier(data, "grangerMaxLag", 4),
            target_col=lire_texte(data, "targetCol"),
            var_data_mode=lire_texte(data, "varDataMode", "auto"),
            max_lag=lire_entier(data, "maxLag", 12),
            ic_criterion=lire_texte(data, "icCriterion", "aic"),
            irf_periods=lire_entier(data, "irfPeriods", 20),
            confidence_level=niveau_confiance if niveau_confiance is not None else 0.95,
            bootstrap_irf=lire_booleen(data, "bootstrapIrf"),
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

    working = df.dropna(subset=[value_col]).copy()
    if date_col and date_col in working.columns:
        try:
            working = working.sort_values(by=date_col)
            dates = working[date_col].astype(str).tolist()
        except Exception:
            dates = [str(i) for i in range(len(working))]
    else:
        dates = [str(i) for i in range(len(working))]

    series = working[value_col]
    if len(series) < 14:
        return {"status": "error", "error": "Série temporelle trop courte (min 14 obs)"}

    period = int(data.get("period", 7))
    from statsmodels.tsa.seasonal import seasonal_decompose
    try:
        decomp = seasonal_decompose(series, period=period, extrapolate_trend="freq")
        trend_vals = [float(x) if pd.notna(x) else None for x in decomp.trend]
        seasonal_vals = [float(x) if pd.notna(x) else None for x in decomp.seasonal]
        resid_vals = [float(x) if pd.notna(x) else None for x in decomp.resid]
        obs_vals = [float(x) if pd.notna(x) else None for x in series]

        res = {
            "column": value_col,
            "period": period,
            "trend_mean": float(decomp.trend.mean()),
            "seasonal_std": float(decomp.seasonal.std()),
            "resid_std": float(decomp.resid.std()),
            "dates": dates,
            "observed": obs_vals,
            "trend": trend_vals,
            "seasonal": seasonal_vals,
            "residuals": resid_vals,
        }
    except Exception as e:
        return {"status": "error", "error": f"Erreur décomposition STL: {str(e)}"}

    return {
        "status": "success",
        "message": f"Décomposition temporelle de '{value_col}' (période={period}) terminée",
        "result": _sanitize(res),
    }


def execute_chow_test(data, dataset_id):
    """Exécute le test de rupture structurelle de Chow."""
    df = dataset_manager.get_df(dataset_id)
    if df is None or df.empty:
        return {"status": "error", "error": "DataFrame vide ou introuvable"}

    target_col = data.get("targetCol", "")
    date_col = data.get("dateCol", "") or _find_date_col(df)
    break_point = data.get("breakPoint", None) or None

    feature_cols_str = data.get("featureCols", "")
    if feature_cols_str:
        feature_cols = [c.strip() for c in feature_cols_str.split(",") if c.strip() in df.columns]
    else:
        ignored = {target_col}
        if date_col:
            ignored.add(date_col)
        feature_cols = [c for c in df.select_dtypes(include=["number"]).columns if c not in ignored][:5]

    if not target_col or target_col not in df.columns:
        # Auto-sélection de la première numérique
        nums = [c for c in df.select_dtypes(include=["number"]).columns if c != date_col]
        if nums:
            target_col = nums[0]
            feature_cols = [c for c in nums[1:] if c != target_col][:5]
        else:
            return {"status": "error", "error": "Variable cible numérique requise pour le test de Chow"}

    if not feature_cols:
        return {"status": "error", "error": "Au moins une variable explicative requise pour le test de Chow"}

    from app.core.timeseries.structural_break import compute_chow_test
    try:
        res = compute_chow_test(
            data=df,
            target_col=target_col,
            feature_cols=feature_cols,
            break_point=break_point,
            date_col=date_col,
        )
    except Exception as e:
        return {"status": "error", "error": f"Erreur test de Chow: {str(e)}"}

    return {
        "status": "success",
        "message": f"Test de Chow ({target_col}) : {res['interpretation']}",
        "result": _sanitize(res),
    }
