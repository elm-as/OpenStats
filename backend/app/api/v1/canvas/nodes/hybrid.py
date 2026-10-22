"""
Nœud Python Hybride : Exécution sécurisée de scripts de transformation de DataFrame.
"""

from __future__ import annotations

import os
import tempfile
import pandas as pd
from app.services.dataset_service import dataset_manager
from app.core.sandbox import run_sandboxed_transform


def execute_python(data: dict, dataset_id: str) -> dict:
    code = data.get("code", "")
    if not code or not code.strip():
        return {"status": "skipped", "message": "Aucun code Python fourni"}

    df = dataset_manager.get_df(dataset_id, respect_exclusions=False)
    if df is None:
        return {"status": "error", "error": "Dataset introuvable"}

    try:
        new_df = run_sandboxed_transform(code, df)
        if not isinstance(new_df, pd.DataFrame):
            return {
                "status": "error",
                "error": "Le code doit modifier ou assigner une variable 'df' contenant un DataFrame Pandas.",
            }

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
            "message": f"Script Python exécuté en environnement sandboxé. {len(new_df)} lignes.",
            "dataset_id": new_dataset_id,
            "result": {
                "rows": len(new_df),
                "columns": len(new_df.columns),
            },
        }
    except Exception as exc:
        return {"status": "error", "error": f"Erreur Python : {exc}"}
