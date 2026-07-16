"""
Nœuds de tests statistiques (Comparaison, Corrélation, Indépendance, Stationnarité).
"""

from app.services.dataset_service import dataset_manager
from ._shared import _sanitize

def execute_test_compare_means(data, dataset_id):
    group_col = data.get("groupCol", "")
    value_col = data.get("valueCol", "")
    if not group_col or not value_col:
        return {"status": "error", "error": "group_col et value_col requis"}
    config = {"test_type": "compare_means", "group_col": group_col, "value_col": value_col}
    result = dataset_manager.run_test(dataset_id, config)
    return {
        "status": "success",
        "message": f"Test de comparaison de moyennes execute ({result.get('test', '')})",
        "result": _sanitize(result),
    }


def execute_test_correlation(data, dataset_id):
    col1 = data.get("col1", "")
    col2 = data.get("col2", "")
    if not col1 or not col2:
        return {"status": "error", "error": "col1 et col2 requis"}
    config = {"test_type": "correlation", "col1": col1, "col2": col2}
    result = dataset_manager.run_test(dataset_id, config)
    return {
        "status": "success",
        "message": f"Test de correlation execute ({result.get('test', '')})",
        "result": _sanitize(result),
    }


def execute_test_independence(data, dataset_id):
    col1 = data.get("col1", "")
    col2 = data.get("col2", "")
    if not col1 or not col2:
        return {"status": "error", "error": "col1 et col2 requis"}
    config = {"test_type": "independence", "col1": col1, "col2": col2}
    result = dataset_manager.run_test(dataset_id, config)
    return {
        "status": "success",
        "message": f"Test d'independance execute ({result.get('test', '')})",
        "result": _sanitize(result),
    }


def execute_test_stationarity(data, dataset_id):
    cols_str = data.get("cols", "")
    if not cols_str:
        # Fallback on old "col" data just in case
        cols_str = data.get("col", "")
        
    if not cols_str:
        return {"status": "error", "error": "Variables requises"}
        
    df = dataset_manager.get_df(dataset_id)
    cols = [c.strip() for c in cols_str.split(",") if c.strip() in df.columns]
    
    if not cols:
        return {"status": "error", "error": "Aucune colonne valide trouvée dans la requête"}
        
    from app.core.timeseries import test_stationarity
    results = []
    messages = []
    
    for col in cols:
        series = df[col].dropna()
        if len(series) < 8:
            messages.append(f"'{col}': Série trop courte")
            continue
            
        result = test_stationarity(series)
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
