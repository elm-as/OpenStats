import numpy as np
import pandas as pd
import pytest

from app.core.timeseries import (
    test_stationarity as check_stationarity,
    decompose_series,
    _detect_seasonal_period,
)


@pytest.fixture
def seed():
    np.random.seed(42)


@pytest.fixture
def stationary_series(seed):
    dates = pd.date_range("2020-01-01", periods=200, freq="D")
    values = np.random.normal(0, 1, 200)
    return pd.Series(values, index=dates)


@pytest.fixture
def nonstationary_series(seed):
    dates = pd.date_range("2020-01-01", periods=200, freq="D")
    values = np.random.normal(0, 1, 200).cumsum()
    return pd.Series(values, index=dates)


@pytest.fixture
def weekly_seasonal_series(seed):
    dates = pd.date_range("2020-01-01", periods=100, freq="D")
    trend = np.linspace(0, 10, 100)
    seasonal = 3 * np.sin(2 * np.pi * np.arange(100) / 7)
    noise = np.random.normal(0, 0.5, 100)
    values = trend + seasonal + noise
    return pd.Series(values, index=dates)


@pytest.fixture
def daily_series(seed):
    dates = pd.date_range("2020-01-01", periods=30, freq="D")
    values = np.random.normal(50, 5, 30)
    return pd.Series(values, index=dates)


class TestStationarity:
    def test_on_stationary_data(self, stationary_series):
        result = check_stationarity(stationary_series)

        assert "adf" in result
        assert "kpss" in result
        assert "conclusion" in result
        assert "is_stationary" in result

        adf = result["adf"]
        assert "statistic" in adf
        assert "p_value" in adf
        assert "lags_used" in adf
        assert "n_obs" in adf
        assert "critical_values" in adf
        assert "is_stationary" in adf
        assert "interpretation" in adf
        assert adf["is_stationary"] is True

        kpss = result["kpss"]
        assert "statistic" in kpss
        assert "p_value" in kpss
        assert "lags_used" in kpss
        assert "critical_values" in kpss
        assert "is_stationary" in kpss
        assert "interpretation" in kpss

    def test_on_nonstationary_data(self, nonstationary_series):
        result = check_stationarity(nonstationary_series)

        adf = result["adf"]
        assert adf["is_stationary"] is False
        assert "non-stationnaire" in adf["interpretation"]

    def test_conclusion_field_exists(self, stationary_series):
        result = check_stationarity(stationary_series)
        assert isinstance(result["conclusion"], str)
        assert len(result["conclusion"]) > 0

    def test_is_stationary_is_boolean(self, stationary_series):
        result = check_stationarity(stationary_series)
        assert isinstance(result["is_stationary"], bool)

    def test_critical_values_are_numeric(self, stationary_series):
        result = check_stationarity(stationary_series)
        for k, v in result["adf"]["critical_values"].items():
            assert isinstance(v, (float, int, type(None)))


class TestDecomposeSeries:
    def test_with_explicit_period(self, weekly_seasonal_series):
        result = decompose_series(weekly_seasonal_series, period=7)

        assert "error" not in result
        assert result["period"] == 7
        assert "model" in result
        assert "dates" in result
        assert "observed" in result
        assert "trend" in result
        assert "seasonal" in result
        assert "residual" in result

    def test_output_lengths_match(self, weekly_seasonal_series):
        result = decompose_series(weekly_seasonal_series, period=7)

        n = len(weekly_seasonal_series)
        assert len(result["dates"]) == n
        assert len(result["observed"]) == n
        assert len(result["trend"]) == n
        assert len(result["seasonal"]) == n
        assert len(result["residual"]) == n

    def test_dates_are_isoformat_strings(self, weekly_seasonal_series):
        result = decompose_series(weekly_seasonal_series, period=7)
        for d in result["dates"]:
            assert isinstance(d, str)
            assert "T" in d or "-" in d

    def test_period_too_short_returns_error(self, seed):
        dates = pd.date_range("2020-01-01", periods=5, freq="D")
        series = pd.Series(np.random.normal(0, 1, 5), index=dates)
        result = decompose_series(series, period=7)
        assert "error" in result

    def test_multiplicative_model(self, seed):
        dates = pd.date_range("2020-01-01", periods=50, freq="D")
        trend = np.linspace(10, 20, 50)
        seasonal = 1 + 0.2 * np.sin(2 * np.pi * np.arange(50) / 7)
        noise = np.random.normal(0, 0.1, 50)
        values = trend * seasonal + np.abs(noise)
        series = pd.Series(values, index=dates)
        result = decompose_series(series, model="multiplicative", period=7)
        assert "error" not in result
        assert result["model"] == "multiplicative"

    def test_multiplicative_with_negative_falls_back_to_additive(self, seed):
        dates = pd.date_range("2020-01-01", periods=50, freq="D")
        values = np.random.normal(0, 1, 50)
        series = pd.Series(values, index=dates)
        result = decompose_series(series, model="multiplicative", period=7)
        assert "error" not in result
        assert result["model"] == "additive"


class TestDetectSeasonalPeriod:
    def test_daily_returns_7(self, daily_series):
        period = _detect_seasonal_period(daily_series)
        assert period == 7

    def test_monthly_returns_12(self, seed):
        dates = pd.date_range("2020-01-01", periods=30, freq="MS")
        series = pd.Series(np.random.normal(0, 1, 30), index=dates)
        period = _detect_seasonal_period(series)
        assert period == 12

    def test_weekly_returns_52(self, seed):
        dates = pd.date_range("2020-01-05", periods=30, freq="W")
        series = pd.Series(np.random.normal(0, 1, 30), index=dates)
        period = _detect_seasonal_period(series)
        assert period == 52

    def test_quarterly_returns_4(self, seed):
        dates = pd.date_range("2020-01-01", periods=20, freq="QS")
        series = pd.Series(np.random.normal(0, 1, 20), index=dates)
        period = _detect_seasonal_period(series)
        assert period == 4

    def test_yearly_returns_1(self, seed):
        dates = pd.date_range("2020-01-01", periods=10, freq="YS")
        series = pd.Series(np.random.normal(0, 1, 10), index=dates)
        period = _detect_seasonal_period(series)
        assert period == 1

    def test_no_freq_returns_1(self, seed):
        dates = pd.DatetimeIndex([
            "2020-01-01", "2020-01-03", "2020-01-05",
            "2020-01-08", "2020-01-12", "2020-01-15",
        ])
        series = pd.Series(np.random.normal(0, 1, 6), index=dates)
        period = _detect_seasonal_period(series)
        assert period == 1

    def test_hourly_returns_24(self, seed):
        dates = pd.date_range("2020-01-01", periods=48, freq="h")
        series = pd.Series(np.random.normal(0, 1, 48), index=dates)
        period = _detect_seasonal_period(series)
        assert period == 24

    def test_returns_int(self, daily_series):
        period = _detect_seasonal_period(daily_series)
        assert isinstance(period, int)
        assert period >= 1
