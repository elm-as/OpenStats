"""
Nœuds factoriels (ACP, AFC, ACM).
Avec auto-sélection des variables si non spécifiées.
"""

from app.services.dataset_service import dataset_manager
from ._shared import _sanitize

def execute_pca(data, dataset_id):
    from app.core.factor_analysis import run_pca
    cleaned = data.get("_cleaned", True)
    df = dataset_manager.get_df(dataset_id, cleaned=cleaned)
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
    cleaned = data.get("_cleaned", True)
    df = dataset_manager.get_df(dataset_id, cleaned=cleaned)
    if df is None or df.empty:
        return {"status": "error", "error": "DataFrame vide ou introuvable pour l'AFC"}

    row_col = data.get("rowCol", "")
    col_col = data.get("colCol", "")

    if not row_col or not col_col:
        cat_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()
        if not cat_cols:
            cat_cols = [c for c in df.columns if df[c].dropna().nunique() <= 10]
        if not row_col and len(cat_cols) >= 1:
            row_col = cat_cols[0]
        if not col_col and len(cat_cols) >= 2:
            col_col = cat_cols[1]

    if not row_col or not col_col or row_col not in df.columns or col_col not in df.columns:
        return {"status": "error", "error": "Variables en ligne et colonne requises pour l'AFC"}

    from app.core.factor_analysis import run_ca
    result = run_ca(df, row_col, col_col)
    ds = dataset_manager.get(dataset_id)
    if ds:
        factor = ds.setdefault("factor_results", {})
        factor["ca"] = result
    return {
        "status": "success",
        "message": f"AFC calculée ({row_col} x {col_col})",
        "result": _sanitize(result),
    }


def execute_mca(data, dataset_id):
    from app.core.factor_analysis import run_mca
    cleaned = data.get("_cleaned", True)
    df = dataset_manager.get_df(dataset_id, cleaned=cleaned)
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
