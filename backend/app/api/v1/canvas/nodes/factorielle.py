"""
Nœuds factoriels (ACP, AFC, ACM).
"""

from app.services.dataset_service import dataset_manager
from ._shared import _sanitize

def execute_pca(data, dataset_id):
    from app.core.factor_analysis import run_pca
    df = dataset_manager.get_df(dataset_id)
    n_comp_str = data.get("nComponents", "auto")
    n_comp = None if n_comp_str == "auto" else int(n_comp_str)
    result = run_pca(df, n_components=n_comp)
    ds = dataset_manager.get(dataset_id)
    if ds:
        factor = ds.setdefault("factor_results", {})
        factor["pca"] = result
    return {
        "status": "success",
        "message": "ACP calculée",
        "result": _sanitize(result),
    }


def execute_ca(data, dataset_id):
    row_col = data.get("rowCol", "")
    col_col = data.get("colCol", "")
    if not row_col or not col_col:
        return {"status": "error", "error": "Variables en ligne et colonne requises"}
    from app.core.factor_analysis import run_ca
    df = dataset_manager.get_df(dataset_id, respect_exclusions=False)
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
    df = dataset_manager.get_df(dataset_id, respect_exclusions=False)
    result = run_mca(df)
    ds = dataset_manager.get(dataset_id)
    if ds:
        factor = ds.setdefault("factor_results", {})
        factor["mca"] = result
    return {
        "status": "success",
        "message": "ACM calculée",
        "result": _sanitize(result),
    }
