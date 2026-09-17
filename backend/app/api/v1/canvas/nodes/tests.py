"""
Nœuds de tests statistiques (Comparaison, Corrélation, Indépendance, Stationnarité).
Avec auto-sélection intelligente des colonnes par défaut.
"""

import pandas as pd
from app.services.dataset_service import dataset_manager
from ._shared import _sanitize

def execute_test_compare_means(data, dataset_id):
    cleaned = data.get("_cleaned", True)
    df = dataset_manager.get_df(dataset_id, cleaned=cleaned)
    if df is None or df.empty:
        return {"status": "error", "error": "DataFrame vide ou introuvable"}

    group_col = data.get("groupCol", "")
    value_col = data.get("valueCol", "")

    # Auto-sélection intelligente si non fourni
    if not group_col:
        cat_cols = df.select_dtypes(include=["object", "category", "bool"]).columns.tolist()
        if not cat_cols:
            # Fallback sur les colonnes avec peu de valeurs uniques
            cat_cols = [c for c in df.columns if df[c].dropna().nunique() <= 10]
        if cat_cols:
            group_col = cat_cols[0]

    if not value_col:
        num_cols = [c for c in df.select_dtypes(include=["number"]).columns if c != group_col]
        if num_cols:
            value_col = num_cols[0]

    if not group_col or not value_col or group_col not in df.columns or value_col not in df.columns:
        return {"status": "error", "error": "group_col (catégorielle) et value_col (numérique) requises pour la comparaison de moyennes"}

    config = {"test_type": "compare_means", "group_col": group_col, "value_col": value_col}
    try:
        result = dataset_manager.run_test(dataset_id, config)
    except Exception as e:
        return {"status": "error", "error": f"Erreur test comparaison: {str(e)}"}
    return {
        "status": "success",
        "message": f"Test de comparaison de moyennes exécuté ({group_col} vs {value_col})",
        "result": _sanitize(result),
    }


def execute_test_correlation(data, dataset_id):
    cleaned = data.get("_cleaned", True)
    df = dataset_manager.get_df(dataset_id, cleaned=cleaned)
    if df is None or df.empty:
        return {"status": "error", "error": "DataFrame vide ou introuvable"}

    col1 = data.get("col1", "")
    col2 = data.get("col2", "")

    num_cols = df.select_dtypes(include=["number"]).columns.tolist()
    if not col1 and len(num_cols) >= 1:
        col1 = num_cols[0]
    if not col2 and len(num_cols) >= 2:
        col2 = num_cols[1]
    elif not col2 and len(num_cols) == 1:
        col2 = num_cols[0]

    if not col1 or not col2 or col1 not in df.columns or col2 not in df.columns:
        return {"status": "error", "error": "2 colonnes numériques requises pour le test de corrélation"}

    config = {"test_type": "correlation", "col1": col1, "col2": col2}
    try:
        result = dataset_manager.run_test(dataset_id, config)
    except Exception as e:
        return {"status": "error", "error": f"Erreur test corrélation: {str(e)}"}
    return {
        "status": "success",
        "message": f"Test de corrélation exécuté ({col1} / {col2})",
        "result": _sanitize(result),
    }


def execute_test_independence(data, dataset_id):
    cleaned = data.get("_cleaned", True)
    df = dataset_manager.get_df(dataset_id, cleaned=cleaned)
    if df is None or df.empty:
        return {"status": "error", "error": "DataFrame vide ou introuvable"}

    col1 = data.get("col1", "")
    col2 = data.get("col2", "")

    cat_cols = [c for c in df.columns if not pd.api.types.is_numeric_dtype(df[c]) or df[c].dropna().nunique() <= 10]
    if not col1 and len(cat_cols) >= 1:
        col1 = cat_cols[0]
    if not col2 and len(cat_cols) >= 2:
        col2 = cat_cols[1]

    if not col1 or not col2 or col1 not in df.columns or col2 not in df.columns:
        return {"status": "error", "error": "2 colonnes catégorielles requises pour le test d'indépendance (Chi²)"}

    config = {"test_type": "independence", "col1": col1, "col2": col2}
    try:
        result = dataset_manager.run_test(dataset_id, config)
    except Exception as e:
        return {"status": "error", "error": f"Erreur test indépendance: {str(e)}"}
    return {
        "status": "success",
        "message": f"Test d'indépendance exécuté ({col1} x {col2})",
        "result": _sanitize(result),
    }


def execute_test_stationarity(data, dataset_id):
    cleaned = data.get("_cleaned", True)
    df = dataset_manager.get_df(dataset_id, cleaned=cleaned)
    if df is None or df.empty:
        return {"status": "error", "error": "DataFrame vide ou introuvable"}

    cols_str = data.get("cols", "") or data.get("col", "")
    if cols_str:
        cols = [c.strip() for c in cols_str.split(",") if c.strip() in df.columns]
    else:
        # Auto-sélection de toutes les colonnes numériques
        cols = df.select_dtypes(include=["number"]).columns.tolist()

    if not cols:
        return {"status": "error", "error": "Aucune colonne numérique valide disponible pour la stationnarité"}

    from app.core.timeseries import test_stationarity
    results = []
    messages = []

    for col in cols:
        series = df[col].dropna()
        if len(series) < 8:
            messages.append(f"'{col}': Série trop courte ({len(series)} obs, min 8)")
            continue

        try:
            result = test_stationarity(series)
        except Exception as e:
            messages.append(f"'{col}': Erreur — {str(e)}")
            continue

        result["column"] = col
        result["n_obs"] = int(len(series))
        results.append(result)
        status = 'Stationnaire' if result.get('is_stationary') else 'Non-stationnaire'
        messages.append(f"{col}: {status}")

    if not results:
        return {"status": "error", "error": " | ".join(messages)}

    return {
        "status": "success",
        "message": " | ".join(messages),
        "result": _sanitize({"tests": results}),
    }


def execute_test_normality(data, dataset_id):
    cleaned = data.get("_cleaned", True)
    df = dataset_manager.get_df(dataset_id, cleaned=cleaned)
    if df is None or df.empty:
        return {"status": "error", "error": "DataFrame vide ou introuvable"}

    cols_str = data.get("cols", "") or data.get("col", "")
    if cols_str:
        cols = [c.strip() for c in cols_str.split(",") if c.strip() in df.columns]
    else:
        cols = df.select_dtypes(include=["number"]).columns.tolist()

    if not cols:
        return {"status": "error", "error": "Aucune colonne numérique valide pour le test de normalité"}

    from scipy.stats import shapiro
    results = []
    messages = []

    for col in cols:
        series = df[col].dropna()
        if len(series) < 5:
            continue
        try:
            stat, p_val = shapiro(series.values[:5000])
            is_normal = p_val > 0.05
            results.append({
                "column": col,
                "statistic": round(float(stat), 4),
                "p_value": round(float(p_val), 6),
                "is_normal": is_normal
            })
            messages.append(f"{col}: {'Normale' if is_normal else 'Non-normale'} (p={p_val:.4f})")
        except Exception as e:
            messages.append(f"{col}: Erreur ({e})")

    return {
        "status": "success",
        "message": " | ".join(messages) if messages else "Tests de normalité terminés",
        "result": _sanitize({"tests": results}),
    }


def execute_test_anova(data, dataset_id):
    cleaned = data.get("_cleaned", True)
    df = dataset_manager.get_df(dataset_id, cleaned=cleaned)
    if df is None or df.empty:
        return {"status": "error", "error": "DataFrame vide ou introuvable"}

    group_col = data.get("groupCol", "")
    value_col = data.get("valueCol", "")

    if not group_col:
        cat_cols = [c for c in df.columns if df[c].dropna().nunique() <= 10]
        if cat_cols:
            group_col = cat_cols[0]

    if not value_col:
        num_cols = [c for c in df.select_dtypes(include=["number"]).columns if c != group_col]
        if num_cols:
            value_col = num_cols[0]

    if not group_col or not value_col or group_col not in df.columns or value_col not in df.columns:
        return {"status": "error", "error": "Variables de groupement et numérique requises pour l'ANOVA"}

    groups = [g.dropna().values for _, g in df.groupby(group_col)[value_col]]
    if len(groups) < 2:
        return {"status": "error", "error": "Au moins 2 groupes distincts requis pour l'ANOVA"}

    from scipy.stats import f_oneway, kruskal
    try:
        stat, p_val = f_oneway(*groups)
        stat_k, p_val_k = kruskal(*groups)
    except Exception as e:
        return {"status": "error", "error": f"Erreur calcul ANOVA: {str(e)}"}

    sig = p_val < 0.05

    # Une ANOVA significative dit qu'au moins deux groupes different, jamais
    # lesquels : sans post-hoc, l'utilisateur doit deviner ou comparer a la main
    # sans correction du risque global.
    posthoc = None
    if sig and len(groups) > 2:
        from app.core.posthoc_tests import comparer_groupes
        resultat_posthoc = comparer_groupes(df, group_col, value_col)
        if resultat_posthoc.get("status") == "success":
            posthoc = resultat_posthoc

    complement = ""
    if posthoc:
        complement = (f" — {posthoc['test']} : {posthoc['n_significatives']}/"
                      f"{posthoc['n_comparaisons']} paires distinctes")

    return {
        "status": "success",
        "message": (f"ANOVA ({group_col} x {value_col}) : F={stat:.3f}, p={p_val:.4f} "
                    f"({'Significatif' if sig else 'Non-significatif'}){complement}"),
        "result": _sanitize({
            "anova_f": float(stat),
            "anova_p": float(p_val),
            "kruskal_h": float(stat_k),
            "kruskal_p": float(p_val_k),
            "is_significant": sig,
            "n_groups": len(groups),
            "group_column": group_col,
            "value_column": value_col,
            "posthoc": posthoc,
        }),
    }
