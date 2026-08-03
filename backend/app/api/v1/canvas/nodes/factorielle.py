"""
Nœuds factoriels (ACP, AFC, ACM).
"""

from app.services.dataset_service import dataset_manager
from ._shared import _sanitize

def execute_pca(data, dataset_id):
    from app.core.factor_analysis import run_pca
    df = dataset_manager.get_df(dataset_id)
    if df is None or df.empty:
        return {"status": "error", "error": "DataFrame vide ou introuvable pour l'ACP"}
    numeric_df = df.select_dtypes(include=["number"]).dropna(axis=1, how="all")
    if numeric_df.shape[1] < 2:
        return {"status": "error", "error": f"Au moins 2 variables numériques requises pour l'ACP (trouvé: {numeric_df.shape[1]})"}
    n_comp_str = data.get("nComponents", "auto")
    n_comp = None if n_comp_str == "auto" else int(n_comp_str)
    result = run_pca(df, n_components=n_comp)
    ds = dataset_manager.get(dataset_id)
    if ds:
        factor = ds.setdefault("factor_results", {})
        factor["pca"] = result
    return {
        "status": "success",
        "message": f"ACP calculée ({numeric_df.shape[1]} variables)",
        "result": _sanitize(result),
    }


def execute_ca(data, dataset_id):
    row_col = data.get("rowCol", "")
    col_col = data.get("colCol", "")
    if not row_col or not col_col:
        return {"status": "error", "error": "Variables en ligne et colonne requises pour l'AFC"}
    from app.core.factor_analysis import run_ca
    df = dataset_manager.get_df(dataset_id)
    if df is None or df.empty:
        return {"status": "error", "error": "DataFrame vide ou introuvable pour l'AFC"}
    missing_cols = [c for c in [row_col, col_col] if c not in df.columns]
    if missing_cols:
        return {"status": "error", "error": f"Colonnes introuvables dans le dataset: {', '.join(missing_cols)}"}
    result = run_ca(df, row_col, col_col)
    ds = dataset_manager.get(dataset_id)
    if ds:
        factor = ds.setdefault("factor_results", {})
        factor["ca"] = result
    return {
        "status": "success",
        "message": "AFC calculée",
        "result": _sanitize(result),
    }


def execute_mca(data, dataset_id):
    from app.core.factor_analysis import run_mca
    df = dataset_manager.get_df(dataset_id)
    if df is None or df.empty:
        return {"status": "error", "error": "DataFrame vide ou introuvable pour l'ACM"}
    cat_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()
    if len(cat_cols) < 2:
        return {"status": "error", "error": f"Au moins 2 variables catégorielles requises pour l'ACM (trouvé: {len(cat_cols)})"}
    result = run_mca(df)
    ds = dataset_manager.get(dataset_id)
    if ds:
        factor = ds.setdefault("factor_results", {})
        factor["mca"] = result
    return {
        "status": "success",
        "message": f"ACM calculée ({len(cat_cols)} variables catégorielles)",
        "result": _sanitize(result),
    }
