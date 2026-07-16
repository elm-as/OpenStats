import numpy as np
import pandas as pd
import pytest

from app.core.analysis import (
    compute_descriptive_stats,
    compute_correlation_matrix,
    compute_vif,
    run_normality_test,
    run_hypothesis_test,
)


@pytest.fixture
def seed():
    np.random.seed(42)


@pytest.fixture
def mixed_df(seed):
    n = 100
    df = pd.DataFrame({
        "num_1": np.random.normal(50, 10, n),
        "num_2": np.random.normal(30, 5, n),
        "cat_1": np.random.choice(["A", "B", "C"], n),
        "cat_2": np.random.choice(["X", "Y"], n),
    })
    df.loc[0, "num_1"] = np.nan
    df.loc[1, "cat_1"] = np.nan
    return df


@pytest.fixture
def collinear_df(seed):
    n = 100
    x1 = np.random.normal(0, 1, n)
    x2 = x1 * 0.8 + np.random.normal(0, 0.1, n)
    x3 = -x1 * 0.6 + np.random.normal(0, 0.2, n)
    x4 = np.random.normal(10, 2, n)
    return pd.DataFrame({"x1": x1, "x2": x2, "x3": x3, "x4": x4})


@pytest.fixture
def two_groups_df(seed):
    n = 50
    group_a = np.random.normal(55, 5, n)
    group_b = np.random.normal(45, 5, n)
    df = pd.DataFrame({
        "group": ["A"] * n + ["B"] * n,
        "score": np.concatenate([group_a, group_b]),
    })
    return df


@pytest.fixture
def corr_test_df(seed):
    n = 80
    x = np.random.normal(0, 1, n)
    y = x * 0.7 + np.random.normal(0, 0.5, n)
    return pd.DataFrame({"x": x, "y": y})


@pytest.fixture
def independence_df(seed):
    n = 120
    df = pd.DataFrame({
        "col1": np.random.choice(["Oui", "Non"], n),
        "col2": np.random.choice(["Haut", "Bas"], n),
    })
    return df


class TestComputeDescriptiveStats:
    def test_mixed_columns(self, mixed_df):
        result = compute_descriptive_stats(mixed_df)

        assert isinstance(result, dict)
        assert set(result.keys()) == {"num_1", "num_2", "cat_1", "cat_2"}

        assert result["num_1"]["type"] == "numeric"
        assert result["num_1"]["dtype"] == "float64"
        assert "mean" in result["num_1"]
        assert "std" in result["num_1"]
        assert "skewness" in result["num_1"]
        assert result["num_1"]["null_count"] == 1
        assert result["num_1"]["null_rate"] == pytest.approx(0.01, abs=1e-6)

        assert result["cat_1"]["type"] == "categorical"
        assert result["cat_1"]["cardinality"] == 3
        assert "top_values" in result["cat_1"]
        assert result["cat_1"]["null_count"] == 1

    def test_all_numeric(self, seed):
        df = pd.DataFrame({
            "a": np.random.normal(0, 1, 30),
            "b": np.random.uniform(10, 20, 30),
        })
        result = compute_descriptive_stats(df)
        assert result["a"]["type"] == "numeric"
        assert result["b"]["type"] == "numeric"
        assert result["a"]["count"] == 30


class TestComputeCorrelationMatrix:
    def test_pearson_default(self, mixed_df):
        result = compute_correlation_matrix(mixed_df)

        assert "matrix" in result
        assert "columns" in result
        assert "significant_pairs" in result
        assert result["method"] == "pearson"
        assert set(result["columns"]) == {"num_1", "num_2"}

        matrix = result["matrix"]
        assert "num_1" in matrix
        assert "num_2" in matrix
        assert abs(matrix["num_1"]["num_2"]) <= 1.0

    def test_spearman(self, mixed_df):
        result = compute_correlation_matrix(mixed_df, method="spearman")

        assert result["method"] == "spearman"
        assert "matrix" in result
        assert "significant_pairs" in result
        assert abs(result["matrix"]["num_1"]["num_2"]) <= 1.0

    def test_no_numeric_cols(self):
        df = pd.DataFrame({"a": ["x", "y"], "b": ["1", "2"]})
        result = compute_correlation_matrix(df)
        assert result["matrix"] == {}
        assert result["columns"] == []

    def test_strong_correlation_detected(self, seed):
        n = 50
        x = np.random.normal(0, 1, n)
        y = x * 0.9 + np.random.normal(0, 0.1, n)
        df = pd.DataFrame({"x": x, "y": y})
        result = compute_correlation_matrix(df)

        assert len(result["significant_pairs"]) >= 1
        pair = result["significant_pairs"][0]
        assert abs(pair["coefficient"]) > 0.5
        assert pair["strength"] in ("modéré", "fort")
        assert "coefficient" in pair
        assert "var1" in pair
        assert "var2" in pair


class TestComputeVIF:
    def test_multicolinear_data(self, collinear_df):
        vifs = compute_vif(collinear_df)

        assert isinstance(vifs, list)
        assert len(vifs) == 4

        for entry in vifs:
            assert "variable" in entry
            assert "vif" in entry
            assert "multicollinearity" in entry

        vif_dict = {e["variable"]: e for e in vifs}

        assert vif_dict["x1"]["vif"] > 5
        assert vif_dict["x2"]["vif"] > 5
        assert vif_dict["x1"]["multicollinearity"] in ("severe", "moderate")

        assert vif_dict["x4"]["vif"] < 5
        assert vif_dict["x4"]["multicollinearity"] == "low"

    def test_sorted_descending(self, collinear_df):
        vifs = compute_vif(collinear_df)
        values = [e["vif"] for e in vifs]
        assert values == sorted(values, reverse=True)

    def test_single_column(self):
        df = pd.DataFrame({"x": [1, 2, 3]})
        result = compute_vif(df)
        assert result == []

    def test_empty(self):
        df = pd.DataFrame()
        result = compute_vif(df)
        assert result == []


class TestRunNormalityTest:
    def test_normal_data(self, seed):
        series = pd.Series(np.random.normal(0, 1, 100))
        result = run_normality_test(series)

        assert result["test"] == "Shapiro-Wilk"
        assert "statistic" in result
        assert "p_value" in result
        assert result["is_normal"] in (True, False)
        assert isinstance(result["interpretation"], str)

    def test_uniform_data_rejected(self, seed):
        series = pd.Series(np.random.exponential(scale=2.0, size=200))
        result = run_normality_test(series)

        assert result["test"] == "Shapiro-Wilk"
        assert result["is_normal"] == False
        assert "non-normale" in result["interpretation"].lower()

    def test_with_nan_values(self, seed):
        series = pd.Series([np.nan, 1.0, 2.0, 3.0, 4.0, 5.0] * 20)
        result = run_normality_test(series)
        assert "error" not in result
        assert "statistic" in result

    def test_small_sample(self):
        series = pd.Series([1.0, 2.0, 3.0])
        result = run_normality_test(series)
        assert result["test"] == "Shapiro-Wilk"
        assert "p_value" in result


class TestRunHypothesisTestCompareMeans:
    def test_two_groups_different_means(self, two_groups_df):
        result = run_hypothesis_test(
            two_groups_df,
            test_type="compare_means",
            group_col="group",
            value_col="score",
        )

        assert result["test_type"] == "compare_means"
        assert "test" in result
        assert "statistic" in result
        assert "p_value" in result
        assert "significant" in result
        assert isinstance(result["significant"], (bool, np.bool_))
        assert "effect_size" in result
        assert result["p_value"] < 0.01
        assert result["significant"] == True

    def test_result_structure(self, two_groups_df):
        result = run_hypothesis_test(
            two_groups_df,
            test_type="compare_means",
            group_col="group",
            value_col="score",
        )

        assert isinstance(result["statistic"], float)
        assert isinstance(result["p_value"], float)
        assert 0 <= result["p_value"] <= 1

    def test_effect_size_present(self, two_groups_df):
        result = run_hypothesis_test(
            two_groups_df,
            test_type="compare_means",
            group_col="group",
            value_col="score",
        )

        assert "d_cohen" in result["effect_size"] or "r" in result["effect_size"]
        assert "interpretation" in result["effect_size"]


class TestRunHypothesisTestCorrelation:
    def test_correlated_columns(self, corr_test_df):
        result = run_hypothesis_test(
            corr_test_df,
            test_type="correlation",
            col1="x",
            col2="y",
        )

        assert result["test_type"] == "correlation"
        assert "test" in result
        assert "coefficient" in result
        assert "p_value" in result
        assert "significant" in result
        assert "strength" in result
        assert result["significant"] == True
        assert abs(result["coefficient"]) > 0.5

    def test_strength_field_valid(self, corr_test_df):
        result = run_hypothesis_test(
            corr_test_df,
            test_type="correlation",
            col1="x",
            col2="y",
        )

        assert result["strength"] in ("négligeable", "faible", "modéré", "fort")

    def test_spearman_when_non_normal(self, seed):
        n = 80
        x = np.random.exponential(2, n)
        y = x * 0.5 + np.random.exponential(1, n)
        df = pd.DataFrame({"x": x, "y": y})
        result = run_hypothesis_test(df, test_type="correlation", col1="x", col2="y")

        assert "Spearman" in result["test"] or "Pearson" in result["test"]
        assert "coefficient" in result


class TestRunHypothesisTestIndependence:
    def test_two_categorical(self, independence_df):
        result = run_hypothesis_test(
            independence_df,
            test_type="independence",
            col1="col1",
            col2="col2",
        )

        assert result["test_type"] == "independence"
        assert "test" in result
        assert "statistic" in result
        assert "p_value" in result
        assert "degrees_of_freedom" in result
        assert "significant" in result
        assert "effect_size" in result
        assert "cramers_v" in result["effect_size"]

    def test_effect_size_cramers_v(self, independence_df):
        result = run_hypothesis_test(
            independence_df,
            test_type="independence",
            col1="col1",
            col2="col2",
        )

        assert "cramers_v" in result["effect_size"]
        assert 0 <= result["effect_size"]["cramers_v"] <= 1
        assert "interpretation" in result["effect_size"]

    def test_categorical_detection(self, independence_df):
        result = run_hypothesis_test(
            independence_df,
            test_type="independence",
            col1="col1",
            col2="col2",
        )

        assert result["test"] in ("Chi-carré d'indépendance", "Test exact de Fisher")
