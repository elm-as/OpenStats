import numpy as np
import pandas as pd
import pytest
from app.core.modeling import (
    prepare_data,
    train_competitive,
    REGRESSION_MODELS,
    CLASSIFICATION_MODELS,
)


@pytest.fixture
def regression_df():
    np.random.seed(42)
    n = 200
    X = np.random.randn(n, 5)
    coef = np.array([1.5, -2.0, 0.5, 3.0, -1.0])
    y = X @ coef + np.random.randn(n) * 0.5
    cols = [f"feat_{i}" for i in range(5)]
    df = pd.DataFrame(X, columns=cols)
    df["target"] = y
    return df


@pytest.fixture
def classification_df():
    np.random.seed(42)
    n = 200
    X = np.random.randn(n, 4)
    logits = X @ np.array([1.0, -1.5, 0.5, 2.0]) + np.random.randn(n) * 0.3
    y = (1 / (1 + np.exp(-logits)) > 0.5).astype(int)
    cols = [f"feat_{i}" for i in range(4)]
    df = pd.DataFrame(X, columns=cols)
    df["target"] = y
    return df


class TestPrepareDataRegression:
    def test_shapes(self, regression_df):
        result = prepare_data(regression_df, target_col="target", test_size=0.2)

        assert result["task_type"] == "regression"
        assert result["X_train"].shape[0] == 160
        assert result["X_test"].shape[0] == 40
        assert result["X_train"].shape[1] == 5
        assert result["X_test"].shape[1] == 5
        assert len(result["y_train"]) == 160
        assert len(result["y_test"]) == 40

    def test_feature_names(self, regression_df):
        result = prepare_data(regression_df, target_col="target", test_size=0.2)

        assert result["feature_names"] == ["feat_0", "feat_1", "feat_2", "feat_3", "feat_4"]

    def test_split_info_random(self, regression_df):
        result = prepare_data(regression_df, target_col="target", test_size=0.2)

        assert result["split_info"]["strategy"] == "random"
        assert result["split_info"]["temporal_column"] is None

    def test_custom_test_size(self, regression_df):
        result = prepare_data(regression_df, target_col="target", test_size=0.3)

        assert result["X_train"].shape[0] == 140
        assert result["X_test"].shape[0] == 60

    def test_no_non_numeric_features_included(self, regression_df):
        regression_df["text_col"] = ["abc"] * len(regression_df)
        result = prepare_data(regression_df, target_col="target", test_size=0.2)

        assert "text_col" not in result["feature_names"]
        assert result["X_train"].shape[1] == 5


class TestPrepareDataClassification:
    def test_shapes(self, classification_df):
        result = prepare_data(classification_df, target_col="target", test_size=0.2)

        assert result["task_type"] == "classification"
        assert result["X_train"].shape[0] == 160
        assert result["X_test"].shape[0] == 40
        assert result["X_train"].shape[1] == 4
        assert result["X_test"].shape[1] == 4
        assert len(result["y_train"]) == 160
        assert len(result["y_test"]) == 40

    def test_stratify_preserves_class_proportion(self, classification_df):
        result = prepare_data(classification_df, target_col="target", test_size=0.2, split_strategy="random")

        original_prop = classification_df["target"].mean()
        train_prop = result["y_train"].mean()
        test_prop = result["y_test"].mean()

        assert abs(train_prop - original_prop) < 0.1
        assert abs(test_prop - original_prop) < 0.1

    def test_split_strategy_random(self, classification_df):
        result = prepare_data(classification_df, target_col="target", test_size=0.2)

        assert result["split_info"]["strategy"] == "random"

    def test_invalid_split_strategy(self, classification_df):
        with pytest.raises(ValueError, match="split_strategy invalide"):
            prepare_data(classification_df, target_col="target", test_size=0.2, split_strategy="invalid")

    def test_feature_names(self, classification_df):
        result = prepare_data(classification_df, target_col="target", test_size=0.2)

        assert result["feature_names"] == ["feat_0", "feat_1", "feat_2", "feat_3"]


class TestTrainCompetitiveRegression:
    def test_returns_expected_keys(self, regression_df):
        data = prepare_data(regression_df, target_col="target", test_size=0.2)
        result = train_competitive(data, model_keys=["linear_regression", "ridge"])

        assert result["task_type"] == "regression"
        assert "ranking" in result
        assert "failed" in result
        assert "best_model" in result
        assert "best_model_key" in result
        assert "feature_names" in result
        assert "diagnostics" in result

    def test_ranking_non_empty(self, regression_df):
        data = prepare_data(regression_df, target_col="target", test_size=0.2)
        result = train_competitive(data, model_keys=["linear_regression", "ridge"])

        assert len(result["ranking"]) >= 1
        assert len(result["failed"]) == 0

    def test_best_model_is_set(self, regression_df):
        data = prepare_data(regression_df, target_col="target", test_size=0.2)
        result = train_competitive(data, model_keys=["linear_regression", "ridge"])

        assert result["best_model"] is not None
        assert result["best_model_key"] is not None

    def test_ranking_sorted_by_r2(self, regression_df):
        data = prepare_data(regression_df, target_col="target", test_size=0.2)
        result = train_competitive(data, model_keys=["linear_regression", "ridge"])

        ranking = result["ranking"]
        r2_values = [r["metrics"]["r2"] for r in ranking]
        assert r2_values == sorted(r2_values, reverse=True)

    def test_each_entry_has_metrics(self, regression_df):
        data = prepare_data(regression_df, target_col="target", test_size=0.2)
        result = train_competitive(data, model_keys=["linear_regression", "ridge"])

        for entry in result["ranking"]:
            assert "rmse" in entry["metrics"]
            assert "mae" in entry["metrics"]
            assert "r2" in entry["metrics"]
            assert "mape" in entry["metrics"]
            assert "model_key" in entry
            assert "model_name" in entry
            assert "rank" in entry
            assert "cv_scores" in entry
            assert "best_params" in entry

    def test_cv_scores_structure(self, regression_df):
        data = prepare_data(regression_df, target_col="target", test_size=0.2)
        result = train_competitive(data, model_keys=["linear_regression", "ridge"])

        for entry in result["ranking"]:
            cv = entry["cv_scores"]
            assert "mean" in cv
            assert "std" in cv
            assert "scores" in cv
            assert isinstance(cv["scores"], list)

    def test_feature_importance_present(self, regression_df):
        data = prepare_data(regression_df, target_col="target", test_size=0.2)
        result = train_competitive(data, model_keys=["linear_regression"])

        entry = result["ranking"][0]
        importance = entry["feature_importance"]
        assert isinstance(importance, list)
        if importance:
            assert "feature" in importance[0]
            assert "importance" in importance[0]

    def test_diagnostics_present(self, regression_df):
        data = prepare_data(regression_df, target_col="target", test_size=0.2)
        result = train_competitive(data, model_keys=["linear_regression", "ridge"])

        diag = result["diagnostics"]
        assert "best_r2" in diag
        assert "quality_flag" in diag


class TestTrainCompetitiveClassification:
    def test_returns_expected_keys(self, classification_df):
        data = prepare_data(classification_df, target_col="target", test_size=0.2)
        result = train_competitive(data, model_keys=["logistic_regression", "decision_tree"])

        assert result["task_type"] == "classification"
        assert "ranking" in result
        assert "failed" in result
        assert "best_model" in result
        assert "best_model_key" in result

    def test_ranking_non_empty(self, classification_df):
        data = prepare_data(classification_df, target_col="target", test_size=0.2)
        result = train_competitive(data, model_keys=["logistic_regression", "decision_tree"])

        assert len(result["ranking"]) >= 1
        assert len(result["failed"]) == 0

    def test_best_model_is_set(self, classification_df):
        data = prepare_data(classification_df, target_col="target", test_size=0.2)
        result = train_competitive(data, model_keys=["logistic_regression", "decision_tree"])

        assert result["best_model"] is not None
        assert result["best_model_key"] is not None

    def test_ranking_sorted_by_f1_weighted(self, classification_df):
        data = prepare_data(classification_df, target_col="target", test_size=0.2)
        result = train_competitive(data, model_keys=["logistic_regression", "decision_tree"])

        ranking = result["ranking"]
        f1_values = [r["metrics"]["f1_weighted"] for r in ranking]
        assert f1_values == sorted(f1_values, reverse=True)

    def test_each_entry_has_metrics(self, classification_df):
        data = prepare_data(classification_df, target_col="target", test_size=0.2)
        result = train_competitive(data, model_keys=["logistic_regression", "decision_tree"])

        for entry in result["ranking"]:
            assert "accuracy" in entry["metrics"]
            assert "precision_weighted" in entry["metrics"]
            assert "recall_weighted" in entry["metrics"]
            assert "f1_weighted" in entry["metrics"]
            assert "model_key" in entry
            assert "model_name" in entry
            assert "rank" in entry
            assert "cv_scores" in entry
            assert "best_params" in entry

    def test_confusion_matrix_in_classification(self, classification_df):
        data = prepare_data(classification_df, target_col="target", test_size=0.2)
        result = train_competitive(data, model_keys=["logistic_regression"])

        entry = result["ranking"][0]
        assert "confusion_matrix" in entry["metrics"]
        assert isinstance(entry["metrics"]["confusion_matrix"], list)


class TestModelRegistries:
    def test_regression_models_has_expected_keys(self):
        expected = {
            "linear_regression", "ridge", "lasso", "elasticnet",
            "polynomial_regression", "decision_tree", "random_forest",
            "gradient_boosting", "knn", "svr",
        }
        for key in expected:
            assert key in REGRESSION_MODELS, f"{key} missing from REGRESSION_MODELS"

    def test_classification_models_has_expected_keys(self):
        expected = {
            "logistic_regression", "decision_tree", "random_forest",
            "gradient_boosting", "knn", "svm", "lda", "qda", "adaboost",
        }
        for key in expected:
            assert key in CLASSIFICATION_MODELS, f"{key} missing from CLASSIFICATION_MODELS"

    def test_regression_model_entries_have_required_fields(self):
        for key, info in REGRESSION_MODELS.items():
            assert "class" in info or key == "polynomial_regression"
            assert "name" in info
            assert "params" in info

    def test_classification_model_entries_have_required_fields(self):
        for key, info in CLASSIFICATION_MODELS.items():
            assert "class" in info
            assert "name" in info
            assert "params" in info
