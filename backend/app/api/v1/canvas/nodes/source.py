"""
Nœud source — Chargement d'un dataset.
"""

from app.services.dataset_service import dataset_manager


def execute_dataset(data, dataset_id=None):
    """
    Exécute le nœud 'dataset'.
    """
    file_id = data.get("file", "")
    if not file_id:
        return {"status": "error", "error": "Aucun dataset sélectionné"}
    ds = dataset_manager.get(file_id)
    if ds is None:
        return {"status": "error", "error": f"Dataset '{file_id}' introuvable"}
    profile = ds.get("profile", {}) or {}
    
    # Fetch preview of data
    df = dataset_manager.get_df(file_id)
    head_data = []
    if df is not None and not df.empty:
        # Replace NaNs for JSON serialization
        head_data = df.head(5).fillna("").to_dict(orient="records")

    return {
        "status": "success",
        "dataset_id": file_id,
        "message": f"Dataset chargé: {ds.get('name', file_id)}",
        "result": {
            "name": ds.get("name"),
            "rows": profile.get("shape", {}).get("rows") or ds.get("rows"),
            "columns": profile.get("shape", {}).get("columns") or ds.get("columns"),
            "head": head_data,
        },
    }
