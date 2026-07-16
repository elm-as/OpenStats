"""
Nœud SQL : Exécution de requêtes via DuckDB.
"""

from app.services.dataset_service import dataset_manager
import tempfile
import os

def execute_sql(data, dataset_id):
    query = data.get("query", "")
    if not query:
        return {"status": "skipped", "message": "Aucune requête SQL fournie"}

    df = dataset_manager.get_df(dataset_id, respect_exclusions=False)
    if df is None:
        return {"status": "error", "error": "Dataset introuvable"}

    try:
        import duckdb
        # La requête peut utiliser la table 'df' automatiquement trouvée dans l'environnement local par DuckDB
        new_df = duckdb.query(query).df()
        
        fd, temp_path = tempfile.mkstemp(suffix=".parquet")
        os.close(fd)
        
        try:
            new_df.to_parquet(temp_path)
            # Ingestion comme nouveau dataset (car la structure/schéma a changé)
            new_dataset_id = dataset_manager.ingest(temp_path, name="SQL_Result")
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)
        
        return {
            "status": "success",
            "message": f"Requête exécutée avec succès. {len(new_df)} lignes.",
            "dataset_id": new_dataset_id,
            "result": {
                "rows": len(new_df),
                "columns": len(new_df.columns),
                "query": query
            }
        }
    except Exception as e:
        return {"status": "error", "error": f"Erreur SQL : {str(e)}"}
