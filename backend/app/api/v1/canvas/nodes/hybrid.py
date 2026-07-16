"""
Nœud Python Hybride : Exécution de code Python arbitraire.
"""

from app.services.dataset_service import dataset_manager
import tempfile
import os

def execute_python(data, dataset_id):
    code = data.get("code", "")
    if not code:
        return {"status": "skipped", "message": "Aucun code Python fourni"}

    df = dataset_manager.get_df(dataset_id, respect_exclusions=False)
    if df is None:
        return {"status": "error", "error": "Dataset introuvable"}

    try:
        import pandas as pd
        import numpy as np
        
        # Environnement d'exécution
        local_vars = {
            "df": df.copy(),
            "pd": pd,
            "np": np
        }
        
        # AVERTISSEMENT DE SÉCURITÉ :
        # L'utilisation de exec() permet l'exécution de code arbitraire.
        # Acceptable en mode LOCAL_DEV_MODE, mais à remplacer par Pyodide ou
        # des conteneurs isolés en production SaaS.
        
        # On définit un __builtins__ restreint si nécessaire, ou on laisse le standard
        # pour la flexibilité en local.
        exec(code, {"__builtins__": __builtins__}, local_vars)
        
        new_df = local_vars.get("df")
        if new_df is None or not isinstance(new_df, pd.DataFrame):
            return {"status": "error", "error": "Le code doit modifier ou assigner une variable 'df' contenant un DataFrame Pandas."}
            
        fd, temp_path = tempfile.mkstemp(suffix=".parquet")
        os.close(fd)
        
        try:
            new_df.to_parquet(temp_path)
            new_dataset_id = dataset_manager.ingest(temp_path, name="Python_Result")
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)
        
        return {
            "status": "success",
            "message": f"Script Python exécuté. {len(new_df)} lignes.",
            "dataset_id": new_dataset_id,
            "result": {
                "rows": len(new_df),
                "columns": len(new_df.columns),
            }
        }
    except Exception as e:
        return {"status": "error", "error": f"Erreur Python : {str(e)}"}
