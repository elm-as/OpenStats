"""Tier 1: Time series econometrics, competitive model training, and simulation."""

from __future__ import annotations

from tests.e2e.conftest import upload_test_dataset
from tests.e2e.dataset_factories import (
    make_regression_dataset,
    make_timeseries_dataset,
)


def test_stationarity_adf_and_kpss(e2e_client, e2e_headers):
    """ADF and KPSS unit root stationarity testing."""
    ts_bytes = make_timeseries_dataset(n_periods=60, seed=301)
    ds = upload_test_dataset(e2e_client, e2e_headers, {"bytes": ts_bytes, "name": "Stationarity TS"})
    dataset_id = ds["dataset_id"]

    stationarity_payload = {"col": "sales"}
    res = e2e_client.post(
        f"/api/v1/datasets/{dataset_id}/analysis/stationarity",
        json=stationarity_payload,
        headers=e2e_headers,
    )
    assert res.status_code == 200
    stat_data = res.get_json()
    assert "adf" in stat_data or "is_stationary" in stat_data


def test_univariate_timeseries_forecasting(e2e_client, e2e_headers):
    """Univariate forecasting with ARIMA order estimation."""
    ts_bytes = make_timeseries_dataset(n_periods=70, seed=302)
    ds = upload_test_dataset(e2e_client, e2e_headers, {"bytes": ts_bytes, "name": "Uni Forecast TS"})
    dataset_id = ds["dataset_id"]

    ts_payload = {
        "date_col": "date",
        "value_col": "sales",
        "models": ["arima"],
        "forecast_steps": 5,
    }
    res = e2e_client.post(
        f"/api/v1/datasets/{dataset_id}/timeseries",
        json=ts_payload,
        headers=e2e_headers,
    )
    assert res.status_code == 200
    forecast_data = res.get_json()
    assert "models" in forecast_data or "best_model" in forecast_data or "arima" in forecast_data


def test_multivariate_timeseries_var(e2e_client, e2e_headers):
    """Multivariate VAR and Granger causality testing."""
    ts_bytes = make_timeseries_dataset(n_periods=60, seed=303)
    ds = upload_test_dataset(e2e_client, e2e_headers, {"bytes": ts_bytes, "name": "Multi VAR TS"})
    dataset_id = ds["dataset_id"]

    multi_payload = {
        "date_col": "date",
        "value_cols": ["sales", "price", "interest_rate"],
        "models": ["var"],
        "forecast_steps": 4,
        "granger_max_lag": 2,
    }
    res = e2e_client.post(
        f"/api/v1/datasets/{dataset_id}/timeseries/multivariate",
        json=multi_payload,
        headers=e2e_headers,
    )
    assert res.status_code == 200
    multi_data = res.get_json()
    assert "models" in multi_data or "var" in multi_data or "granger_causality" in multi_data


def test_autopipeline_competitive_training(e2e_client, e2e_headers):
    """Competitive multi-algorithm model training and leaderboard retrieval."""
    csv_bytes = make_regression_dataset(n_samples=100, seed=304)
    ds = upload_test_dataset(e2e_client, e2e_headers, {"bytes": csv_bytes, "name": "Train Model Reg"})
    dataset_id = ds["dataset_id"]

    train_payload = {
        "target_column": "target",
        "models": ["linear_regression", "ridge"],
        "test_size": 0.2,
    }
    res_train = e2e_client.post(
        f"/api/v1/datasets/{dataset_id}/model/train",
        json=train_payload,
        headers=e2e_headers,
    )
    assert res_train.status_code == 200
    train_res = res_train.get_json()
    assert "ranking" in train_res
    assert len(train_res["ranking"]) > 0
    assert "best_model_key" in train_res

    res_results = e2e_client.get(f"/api/v1/datasets/{dataset_id}/model/results", headers=e2e_headers)
    assert res_results.status_code == 200
    res_data = res_results.get_json()
    assert res_data.get("best_model_key") == train_res["best_model_key"]


def test_model_predict_endpoint(e2e_client, e2e_headers):
    """Real-time predictions on single and batch inputs."""
    csv_bytes = make_regression_dataset(n_samples=100, seed=305)
    ds = upload_test_dataset(e2e_client, e2e_headers, {"bytes": csv_bytes, "name": "Predict Reg"})
    dataset_id = ds["dataset_id"]

    train_payload = {
        "target_column": "target",
        "models": ["linear_regression"],
        "test_size": 0.2,
    }
    res_train = e2e_client.post(
        f"/api/v1/datasets/{dataset_id}/model/train",
        json=train_payload,
        headers=e2e_headers,
    )
    assert res_train.status_code == 200

    single_predict_payload = {
        "features": {
            "x1": 0.5,
            "x2": 1.5,
            "x_collinear": 1.1,
            "category": "Alpha",
        }
    }
    res_pred = e2e_client.post(
        f"/api/v1/datasets/{dataset_id}/model/predict",
        json=single_predict_payload,
        headers=e2e_headers,
    )
    assert res_pred.status_code == 200
    pred_data = res_pred.get_json()
    assert "predictions" in pred_data
    assert len(pred_data["predictions"]) == 1


def test_scenarios_and_simulations(e2e_client, e2e_headers):
    """What-if scenario creation, Monte Carlo simulation, and stress testing."""
    csv_bytes = make_regression_dataset(n_samples=100, seed=306)
    ds = upload_test_dataset(e2e_client, e2e_headers, {"bytes": csv_bytes, "name": "Simulate Reg"})
    dataset_id = ds["dataset_id"]

    train_payload = {
        "target_column": "target",
        "models": ["linear_regression"],
        "test_size": 0.2,
    }
    e2e_client.post(
        f"/api/v1/datasets/{dataset_id}/model/train",
        json=train_payload,
        headers=e2e_headers,
    )

    scen_payload = {
        "name": "shock_scenario",
        "modifications": {"x1": {"shift": -1.5}},
    }
    res_create = e2e_client.post(
        f"/api/v1/datasets/{dataset_id}/scenarios/create",
        json=scen_payload,
        headers=e2e_headers,
    )
    assert res_create.status_code == 200

    res_run = e2e_client.post(
        f"/api/v1/datasets/{dataset_id}/scenarios/run",
        json={"scenario_names": ["shock_scenario"]},
        headers=e2e_headers,
    )
    assert res_run.status_code == 200
    run_data = res_run.get_json()
    assert "results" in run_data

    mc_payload = {
        "n_simulations": 100,
        "noise_type": "gaussian",
        "noise_scale": 0.5,
    }
    res_mc = e2e_client.post(
        f"/api/v1/datasets/{dataset_id}/monte-carlo",
        json=mc_payload,
        headers=e2e_headers,
    )
    assert res_mc.status_code == 200
    mc_data = res_mc.get_json()
    assert "distribution" in mc_data and "histogram" in mc_data

    res_stress = e2e_client.post(
        f"/api/v1/datasets/{dataset_id}/stress-test",
        json={"sigmas": [1.0, 2.0]},
        headers=e2e_headers,
    )
    assert res_stress.status_code == 200
