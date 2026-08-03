import os
import pytest
import pandas as pd
import numpy as np
from app.services.dataset_service import dataset_manager
from app.models.dataset import Dataset
from app.api.v1.canvas.nodes.descriptive import execute_descriptive_numeric, execute_descriptive_categorical
from app.api.v1.canvas.nodes.modeling import execute_regression

def test_e2e_pipeline_with_duckdb_and_ml(app):
    with app.app_context():
        # 1. Génération d'un dataset complexe
        # Plus de 5000 lignes pour déclencher DuckDB
        np.random.seed(42)
        n_samples = 6000
        
        # Numériques
        X_num = np.random.randn(n_samples, 3)
        
        # Multicolinéarité (VIF > 10) : col3 est fortement corrélée à col1
        col3 = X_num[:, 0] * 2.0 + np.random.randn(n_samples) * 0.1
        
        # Catégorielles
        categories = ["A", "B", "C"]
        X_cat = np.random.choice(categories, size=n_samples)
        
        # Cible (Régression linéaire basée sur col1 et col2 et X_cat)
        # Bruit
        y = 3.5 * X_num[:, 0] - 1.5 * X_num[:, 1] + np.where(X_cat == "A", 2.0, np.where(X_cat == "B", -1.0, 0.0)) + np.random.randn(n_samples)
        
        # Dataframe
        df = pd.DataFrame({
            "col1_num": X_num[:, 0],
            "col2_num": X_num[:, 1],
            "col3_colinear": col3,
            "col4_cat": X_cat,
            "target": y
        })
        
        # Ajouter quelques NaNs pour tester l'imputation (dans le set de test et train)
        df.loc[10:50, "col1_num"] = np.nan
        df.loc[100:150, "col4_cat"] = np.nan
        
        # 2. Sauvegarde dans le storage
        # Création d'un "dataset" factice
        from app.extensions import db
        ds = Dataset(
            id="test-e2e-id",
            name="Test E2E",
            original_filename="test_e2e.csv",
            rows=n_samples,
            columns=5,
            file_size=1000
        )
        db.session.add(ds)
        db.session.commit()
        
        # Enregistrer via le service
        from app.services.storage_service import storage
        storage.save_dataframe(df, "test-e2e-id", version=2) # dataset_manager.get_parquet_path cherche v=2 par defaut
        
        # 3. Test des noeuds Descriptifs (qui va utiliser DuckDB car > 5000 lignes)
        print("\n--- Test Descriptif Numérique (DuckDB) ---")
        res_num = execute_descriptive_numeric({}, "test-e2e-id")
        assert res_num["status"] == "success"
        print("Résultat partiel num:", list(res_num["result"].keys()))
        assert "col1_num" in res_num["result"]
        assert "target" in res_num["result"]
        
        print("\n--- Test Descriptif Catégoriel (DuckDB) ---")
        res_cat = execute_descriptive_categorical({}, "test-e2e-id")
        assert res_cat["status"] == "success"
        print("Résultat partiel cat:", list(res_cat["result"].keys()))
        assert "col4_cat" in res_cat["result"]
        
        # 4. Test de Modélisation (qui va utiliser ColumnTransformer, gérer les NaNs et les Cats)
        print("\n--- Test Modélisation (Régression Linéaire avec VIF) ---")
        res_model = execute_regression({"targetCol": "target", "models": "linear_regression"}, "test-e2e-id")
        assert res_model["status"] == "success"
        
        ranking = res_model["result"]["ranking"]
        assert len(ranking) > 0
        best_model_info = ranking[0]
        
        print(f"Meilleur modèle: {best_model_info['model_name']} (R2: {best_model_info['metrics']['r2']})")
        
        # Vérifier que les variables catégorielles (OneHot) ont bien été extraites dans l'importance
        features_imp = best_model_info.get("feature_importance", [])
        print("Feature Importances:")
        for f in features_imp:
            print(f"  - {f['feature']}: {f['importance']}")
            
        # Vérifier que VIF warning est présent
        warnings = best_model_info.get("warnings", [])
        print("Warnings du modèle:")
        for w in warnings:
            print(f"  > {w}")
            
        assert any("VIF" in w for w in warnings), "Le warning VIF n'a pas été détecté !"
        assert any("col3_colinear" in w for w in warnings), "col3_colinear devrait être signalée pour la multicolinéarité !"
        
        print("\n✅ Test E2E validé avec succès !")
