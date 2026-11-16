"""Tier 1: Data cleaning, descriptive statistics, hypothesis tests, and factor analysis."""

from __future__ import annotations

from tests.e2e.conftest import upload_test_dataset
from tests.e2e.dataset_factories import (
    make_regression_dataset,
    make_contingency_dataset,
)


def test_data_cleaning_custom_pipeline(e2e_client, e2e_headers):
    """Custom cleaning pipeline performs deduplication, imputation, and outlier capping."""
    csv_bytes = make_regression_dataset(n_samples=100, seed=201)
    ds = upload_test_dataset(e2e_client, e2e_headers, {"bytes": csv_bytes, "name": "Clean Custom"})
    dataset_id = ds["dataset_id"]

    pipeline_payload = {
        "pipeline": [
            {"step": "deduplication", "config": {}},
            {"step": "missing_values", "config": {"default_strategy": "median"}},
            {"step": "outliers", "config": {"method": "iqr", "treatment": "cap"}},
        ]
    }
    res = e2e_client.post(
        f"/api/v1/datasets/{dataset_id}/clean",
        json=pipeline_payload,
        headers=e2e_headers,
    )
    assert res.status_code == 200
    report = res.get_json()
    assert report is not None


def test_data_cleaning_auto_pipeline(e2e_client, e2e_headers):
    """Automated cleaning endpoint executes sensible default pipeline."""
    csv_bytes = make_regression_dataset(n_samples=100, seed=202)
    ds = upload_test_dataset(e2e_client, e2e_headers, {"bytes": csv_bytes, "name": "Clean Auto"})
    dataset_id = ds["dataset_id"]

    res = e2e_client.post(f"/api/v1/datasets/{dataset_id}/clean/auto", headers=e2e_headers)
    assert res.status_code == 200
    report = res.get_json()
    assert report is not None


def test_capabilities_and_excluded_columns(e2e_client, e2e_headers):
    """Dataset capabilities inspection and feature exclusion toggles."""
    csv_bytes = make_regression_dataset(n_samples=80, seed=203)
    ds = upload_test_dataset(e2e_client, e2e_headers, {"bytes": csv_bytes, "name": "Capabilities DS"})
    dataset_id = ds["dataset_id"]

    res_cap = e2e_client.get(f"/api/v1/datasets/{dataset_id}/capabilities", headers=e2e_headers)
    assert res_cap.status_code == 200
    cap_data = res_cap.get_json()
    assert "columns" in cap_data or "eligible_tests" in cap_data

    exclude_payload = {"excluded_columns": ["x_collinear"]}
    res_put = e2e_client.put(
        f"/api/v1/datasets/{dataset_id}/excluded-columns",
        json=exclude_payload,
        headers=e2e_headers,
    )
    assert res_put.status_code == 200

    res_get = e2e_client.get(f"/api/v1/datasets/{dataset_id}/excluded-columns", headers=e2e_headers)
    assert res_get.status_code == 200
    excluded = res_get.get_json().get("excluded_columns", [])
    assert "x_collinear" in excluded


def test_descriptive_analysis_and_correlations(e2e_client, e2e_headers):
    """Full descriptive analysis, summary metrics, and correlation matrix generation."""
    csv_bytes = make_regression_dataset(n_samples=120, seed=204)
    ds = upload_test_dataset(e2e_client, e2e_headers, {"bytes": csv_bytes, "name": "Stats Analysis"})
    dataset_id = ds["dataset_id"]

    res_full = e2e_client.post(
        f"/api/v1/datasets/{dataset_id}/analysis",
        json={"bootstrap_ci": False},
        headers=e2e_headers,
    )
    assert res_full.status_code == 200
    full_data = res_full.get_json()
    assert "descriptive_stats" in full_data or "correlations" in full_data

    res_desc = e2e_client.get(f"/api/v1/datasets/{dataset_id}/analysis/descriptive", headers=e2e_headers)
    assert res_desc.status_code == 200
    desc_data = res_desc.get_json()
    assert "x1" in desc_data or "target" in desc_data

    res_corr = e2e_client.get(
        f"/api/v1/datasets/{dataset_id}/analysis/correlations?method=pearson",
        headers=e2e_headers,
    )
    assert res_corr.status_code == 200
    corr_data = res_corr.get_json()
    assert corr_data is not None


def test_hypothesis_tests(e2e_client, e2e_headers):
    """Mean comparison (ANOVA/t-test) and categorical independence (Chi-Square) testing."""
    reg_bytes = make_regression_dataset(n_samples=120, seed=205)
    reg_ds = upload_test_dataset(e2e_client, e2e_headers, {"bytes": reg_bytes, "name": "Hypothesis Reg"})
    reg_id = reg_ds["dataset_id"]

    means_test_payload = {
        "test_type": "compare_means",
        "group_col": "category",
        "value_col": "target",
    }
    res_means = e2e_client.post(
        f"/api/v1/datasets/{reg_id}/analysis/test",
        json=means_test_payload,
        headers=e2e_headers,
    )
    assert res_means.status_code == 200
    means_res = res_means.get_json()
    assert "p_value" in means_res or "statistic" in means_res

    cont_bytes = make_contingency_dataset(n_samples=150, seed=206)
    cont_ds = upload_test_dataset(e2e_client, e2e_headers, {"bytes": cont_bytes, "name": "Hypothesis Cont"})
    cont_id = cont_ds["dataset_id"]

    chi2_payload = {
        "test_type": "independence",
        "col1": "department",
        "col2": "education",
    }
    res_chi2 = e2e_client.post(
        f"/api/v1/datasets/{cont_id}/analysis/test",
        json=chi2_payload,
        headers=e2e_headers,
    )
    assert res_chi2.status_code == 200
    chi2_res = res_chi2.get_json()
    assert "p_value" in chi2_res or "statistic" in chi2_res


def test_factor_analysis_pca_ca_mca(e2e_client, e2e_headers):
    """Principal Component Analysis (PCA), Correspondence Analysis (CA), and MCA."""
    reg_bytes = make_regression_dataset(n_samples=100, seed=207)
    reg_ds = upload_test_dataset(e2e_client, e2e_headers, {"bytes": reg_bytes, "name": "Factor Reg"})
    reg_id = reg_ds["dataset_id"]

    pca_payload = {
        "columns": ["x1", "x2", "x_collinear", "target"],
        "n_components": 2,
    }
    res_pca = e2e_client.post(
        f"/api/v1/datasets/{reg_id}/factor-analysis/pca",
        json=pca_payload,
        headers=e2e_headers,
    )
    assert res_pca.status_code == 200
    pca_data = res_pca.get_json()
    assert "eigenvalues" in pca_data or "variance_explained" in pca_data or "loadings" in pca_data

    cont_bytes = make_contingency_dataset(n_samples=120, seed=208)
    cont_ds = upload_test_dataset(e2e_client, e2e_headers, {"bytes": cont_bytes, "name": "Factor Cont"})
    cont_id = cont_ds["dataset_id"]

    ca_payload = {
        "row_col": "department",
        "col_col": "education",
    }
    res_ca = e2e_client.post(
        f"/api/v1/datasets/{cont_id}/factor-analysis/ca",
        json=ca_payload,
        headers=e2e_headers,
    )
    assert res_ca.status_code == 200

    mca_payload = {
        "columns": ["department", "education", "satisfaction"],
        "n_components": 2,
    }
    res_mca = e2e_client.post(
        f"/api/v1/datasets/{cont_id}/factor-analysis/mca",
        json=mca_payload,
        headers=e2e_headers,
    )
    assert res_mca.status_code == 200
