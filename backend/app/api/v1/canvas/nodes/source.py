"""
Nœud source — Chargement d'un dataset.
"""

from app.services.dataset_service import dataset_manager


def execute_dataset(data, dataset_id=None):
    """
    Exécute le nœud 'dataset'.
    """
    file_id = data.get("file") or data.get("dataset_id") or data.get("datasetId") or data.get("selectedDataset") or dataset_id or ""
    
    ds = None
    if file_id:
        ds = dataset_manager.get(file_id)
        if ds is None:
            from app.models.dataset import Dataset
            ds_obj = Dataset.query.filter((Dataset.id == file_id) | (Dataset.name.ilike(f"%{file_id}%"))).first()
            if ds_obj:
                ds = dataset_manager.get(ds_obj.id)
                file_id = ds_obj.id

    if ds is None:
        # Fallback ultime : récupérer le dernier dataset importé
        from app.models.dataset import Dataset
        latest = Dataset.query.order_by(Dataset.created_at.desc()).first()
        if latest:
            ds = dataset_manager.get(latest.id)
            file_id = latest.id

    if ds is None:
        return {"status": "error", "error": "Aucun dataset disponible dans la base de données. Veuillez importer vos données d'abord."}

    profile = ds.get("profile", {}) or {}
    
    # Fetch preview of data
    df = dataset_manager.get_df(file_id)
    head_data = []
    if df is not None and not df.empty:
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
