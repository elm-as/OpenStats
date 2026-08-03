"""
Nœuds de tests statistiques (Comparaison, Corrélation, Indépendance, Stationnarité).
"""

from app.services.dataset_service import dataset_manager
from ._shared import _sanitize

def execute_test_compare_means(data, dataset_id):
    group_col = data.get("groupCol", "")
    value_col = data.get("valueCol", "")
    if not group_col or not value_col:
        return {"status": "error", "error": "group_col et value_col requis pour la comparaison de moyennes"}
    df = dataset_manager.get_df(dataset_id)
    if df is None or df.empty:
        return {"status": "error", "error": "DataFrame vide ou introuvable"}
    missing = [c for c in [group_col, value_col] if c not in df.columns]
    if missing:
        return {"status": "error", "error": f"Colonnes introuvables: {', '.join(missing)}"}
    config = {"test_type": "compare_means", "group_col": group_col, "value_col": value_col}
    try:
        result = dataset_manager.run_test(dataset_id, config)
    except Exception as e:
        return {"status": "error", "error": f"Erreur test comparaison: {str(e)}"}
    return {
        "status": "success",
        "message": f"Test de comparaison de moyennes exécuté ({result.get('test', '')})",
        "result": _sanitize(result),
    }


def execute_test_correlation(data, dataset_id):
    col1 = data.get("col1", "")
    col2 = data.get("col2", "")
    if not col1 or not col2:
        return {"status": "error", "error": "col1 et col2 requis pour le test de corrélation"}
    df = dataset_manager.get_df(dataset_id)
    if df is None or df.empty:
        return {"status": "error", "error": "DataFrame vide ou introuvable"}
    missing = [c for c in [col1, col2] if c not in df.columns]
    if missing:
        return {"status": "error", "error": f"Colonnes introuvables: {', '.join(missing)}"}
    config = {"test_type": "correlation", "col1": col1, "col2": col2}
    try:
        result = dataset_manager.run_test(dataset_id, config)
    except Exception as e:
        return {"status": "error", "error": f"Erreur test corrélation: {str(e)}"}
    return {
        "status": "success",
        "message": f"Test de corrélation exécuté ({result.get('test', '')})",
        "result": _sanitize(result),
    }


def execute_test_independence(data, dataset_id):
    col1 = data.get("col1", "")
    col2 = data.get("col2", "")
    if not col1 or not col2:
        return {"status": "error", "error": "col1 et col2 requis pour le test d'indépendance"}
    df = dataset_manager.get_df(dataset_id)
    if df is None or df.empty:
        return {"status": "error", "error": "DataFrame vide ou introuvable"}
    missing = [c for c in [col1, col2] if c not in df.columns]
    if missing:
        return {"status": "error", "error": f"Colonnes introuvables: {', '.join(missing)}"}
    config = {"test_type": "independence", "col1": col1, "col2": col2}
    try:
        result = dataset_manager.run_test(dataset_id, config)
    except Exception as e:
        return {"status": "error", "error": f"Erreur test indépendance: {str(e)}"}
    return {
        "status": "success",
        "message": f"Test d'indépendance exécuté ({result.get('test', '')})",
        "result": _sanitize(result),
    }


def execute_test_stationarity(data, dataset_id):
    cols_str = data.get("cols", "")
    if not cols_str:
        cols_str = data.get("col", "")
        
    if not cols_str:
        return {"status": "error", "error": "Variables requises pour le test de stationnarité"}
        
    df = dataset_manager.get_df(dataset_id)
    if df is None or df.empty:
        return {"status": "error", "error": "DataFrame vide ou introuvable"}

    cols = [c.strip() for c in cols_str.split(",") if c.strip() in df.columns]
    
    if not cols:
        return {"status": "error", "error": f"Aucune colonne valide trouvée. Colonnes demandées: {cols_str}"}
        
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
