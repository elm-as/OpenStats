"""
Nœuds descriptifs — Statistiques et Corrélations.
"""

from app.services.dataset_service import dataset_manager
from ._shared import _sanitize

def execute_descriptive_numeric(data, dataset_id):
    from app.core.analysis import compute_descriptive_stats
    from app.core.duckdb_analysis import compute_descriptive_stats_duckdb
    
    ds = dataset_manager.get(dataset_id)
    ds_model = dataset_manager.get_dataset_model(dataset_id)
    
    num_cols = []
    profile = ds.get("profile") if ds else None
    excluded = dataset_manager.get_excluded_columns(dataset_id) if dataset_id else []
    if profile and isinstance(profile, dict) and profile.get("dictionary"):
        for entry in profile["dictionary"]:
            col_name = entry.get("nom_brut")
            if col_name in excluded:
                continue
            t = entry.get("type_statistique", "")
            if t in ("continu", "discret", "numerique"):
                num_cols.append(col_name)
                
    parquet_path = dataset_manager.get_parquet_path(dataset_id)
    # Si dataset > 5000 lignes et que Parquet est disponible, utiliser DuckDB pour soulager la RAM
    if parquet_path and ds_model and ds_model.rows > 5000:
        if not num_cols:
            # Fallback sur Pandas juste pour trouver les colonnes
            df = dataset_manager.get_df(dataset_id)
            num_cols = df.select_dtypes(include=["number"]).columns.tolist()
            
        columns_info = [{"name": c, "type": "numeric"} for c in num_cols]
        result = compute_descriptive_stats_duckdb(parquet_path, columns_info)
    else:
        df = dataset_manager.get_df(dataset_id)
        if not num_cols:
            num_cols = df.select_dtypes(include=["number"]).columns.tolist()
        df_num = df[num_cols] if num_cols else df
        result = compute_descriptive_stats(df_num)
        
    if ds:
        existing = dataset_manager._load_latest_analysis_result(dataset_id, "descriptive") or {}
        existing["descriptive_stats"] = result
        dataset_manager.store_ad_hoc_analysis(dataset_id, "descriptive", {}, existing, cache_key="analysis_results")
    return {
        "status": "success",
        "message": f"Statistiques descriptives numériques calculées ({len(num_cols)} colonnes)",
        "result": _sanitize(result),
    }


def execute_descriptive_categorical(data, dataset_id):
    from app.core.analysis import compute_descriptive_stats
    from app.core.duckdb_analysis import compute_descriptive_stats_duckdb
    
    ds = dataset_manager.get(dataset_id)
    ds_model = dataset_manager.get_dataset_model(dataset_id)
    
    cat_cols = []
    profile = ds.get("profile") if ds else None
    excluded = dataset_manager.get_excluded_columns(dataset_id) if dataset_id else []
    if profile and isinstance(profile, dict) and profile.get("dictionary"):
        for entry in profile["dictionary"]:
            col_name = entry.get("nom_brut")
            if col_name in excluded:
                continue
            t = entry.get("type_statistique", "")
            if t in ("catégoriel_nominal", "binaire"):
                cat_cols.append(col_name)
                
    parquet_path = dataset_manager.get_parquet_path(dataset_id)
    
    if parquet_path and ds_model and ds_model.rows > 5000:
        if not cat_cols:
            df = dataset_manager.get_df(dataset_id)
            cat_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()
            
        columns_info = [{"name": c, "type": "categorical"} for c in cat_cols]
        result = compute_descriptive_stats_duckdb(parquet_path, columns_info)
    else:
        df = dataset_manager.get_df(dataset_id)
        if not cat_cols:
            cat_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()
        df_cat = df[cat_cols] if cat_cols else df
        result = compute_descriptive_stats(df_cat)
        
    return {
        "status": "success",
        "message": f"Statistiques descriptives catégorielles calculées ({len(cat_cols)} colonnes)",
        "result": _sanitize(result),
    }


def execute_correlation(data, dataset_id):
    method = data.get("method", "pearson")
    from app.core.analysis import compute_correlation_matrix
    df = dataset_manager.get_df(dataset_id)
    if df is None or df.empty:
        return {"status": "error", "error": "DataFrame vide ou introuvable pour la corrélation"}
    numeric_df = df.select_dtypes(include=["number"])
    if numeric_df.shape[1] < 2:
        return {"status": "error", "error": f"Au moins 2 variables numériques requises pour la corrélation (trouvé: {numeric_df.shape[1]})"}
    result = compute_correlation_matrix(df, method=method)
    ds = dataset_manager.get(dataset_id)
    if ds:
        existing = dataset_manager._load_latest_analysis_result(dataset_id, "descriptive") or {}
        existing["correlations"] = result
        dataset_manager.store_ad_hoc_analysis(dataset_id, "descriptive", {"method": method}, existing, cache_key="analysis_results")
    return {
        "status": "success",
        "message": f"Matrice de corrélation ({method}) calculée ({numeric_df.shape[1]} variables)",
        "result": _sanitize(result),
    }


def execute_vif(data, dataset_id):
    try:
        results = dataset_manager.analyze(dataset_id)
    except Exception as e:
        return {"status": "error", "error": f"Erreur lors du calcul VIF: {str(e)}"}
    vif_data = results.get("vif", {})
    if not vif_data:
        return {"status": "error", "error": "Impossible de calculer le VIF. Vérifiez qu'il y a au moins 2 variables numériques sans valeurs manquantes."}
    ds = dataset_manager.get(dataset_id)
    if ds:
        existing = dataset_manager._load_latest_analysis_result(dataset_id, "descriptive") or {}
        existing["vif"] = vif_data
        dataset_manager.store_ad_hoc_analysis(dataset_id, "descriptive", {}, existing, cache_key="analysis_results")
    return {
        "status": "success",
        "message": "VIF (multicolinéarité) calculé",
        "result": _sanitize(vif_data),
    }
