import os
from app import create_app
from app.extensions import db
from app.models.dataset import Dataset
from app.services.dataset_service import dataset_manager
from app.api.v1.canvas.nodes.descriptive import execute_descriptive_numeric, execute_descriptive_categorical
from app.api.v1.canvas.nodes.modeling import execute_regression
import pandas as pd
import numpy as np

def run_test():
    os.environ["DATABASE_URL"] = "sqlite:///:memory:?cache=shared"
    os.environ["LOCAL_DEV_MODE"] = "false"
    os.environ["FLASK_ENV"] = "testing"
    os.environ["SECRET_KEY"] = "test-secret-key"
    
    app = create_app()
    with app.app_context():
        db.drop_all()
        db.create_all()
        
        print("1. Generating dataset...")
        np.random.seed(42)
        n_samples = 6000
        
        X_num = np.random.randn(n_samples, 3)
        col3 = X_num[:, 0] * 2.0 + np.random.randn(n_samples) * 0.1
        
        categories = ["A", "B", "C"]
        X_cat = np.random.choice(categories, size=n_samples)
        
        y = 3.5 * X_num[:, 0] - 1.5 * X_num[:, 1] + np.where(X_cat == "A", 2.0, np.where(X_cat == "B", -1.0, 0.0)) + np.random.randn(n_samples)
        
        df = pd.DataFrame({
            "col1_num": X_num[:, 0],
            "col2_num": X_num[:, 1],
            "col3_colinear": col3,
            "col4_cat": X_cat,
            "target": y
        })
        
        df.loc[10:50, "col1_num"] = np.nan
        df.loc[100:150, "col4_cat"] = np.nan
        
        print("2. Saving dataset...")
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
        
        from app.models.dataset import DatasetVersion
        dv = DatasetVersion(
            dataset_id="test-e2e-id",
            version_number=2,
            label="cleaned",
            parquet_path="datasets/test-e2e-id/v2.parquet",
            rows=n_samples,
            columns=5
        )
        db.session.add(dv)
        db.session.commit()
        
        from app.services.storage_service import storage
        storage.save_dataframe(df, "test-e2e-id", version=2)
        
        print("3. Testing Descriptive Nodes (DuckDB)")
        res_num = execute_descriptive_numeric({}, "test-e2e-id")
        print("Num Status:", res_num["status"])
        
        res_cat = execute_descriptive_categorical({}, "test-e2e-id")
        print("Cat Status:", res_cat["status"])
        
        print("4. Testing Modeling (Linear Regression with VIF)")
        res_model = execute_regression({"targetCol": "target", "models": "linear_regression"}, "test-e2e-id")
        print("Model Status:", res_model["status"])
        
        ranking = res_model["result"]["ranking"]
        best_model_info = ranking[0]
        
        print(f"Meilleur modèle: {best_model_info['model_name']} (R2: {best_model_info['metrics']['r2']})")
        
        print("\nFeature Importances:")
        for f in best_model_info.get("feature_importance", []):
            print(f"  - {f['feature']}: {f['importance']}")
            
        print("\nWarnings:")
        for w in best_model_info.get("warnings", []):
            print(f"  > {w}")

if __name__ == "__main__":
    run_test()
