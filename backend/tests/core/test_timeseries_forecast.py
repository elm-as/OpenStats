import numpy as np
import pandas as pd
import pytest

from app.core.timeseries import (
    _parse_datetime_series,
    _prepare_series,
    _build_forecast_dates,
)


@pytest.fixture
def forecast_index():
    return pd.date_range("2020-01-01", periods=50, freq="D")


class TestParseDatetimeSeries:
    def test_iso_format_dates(self):
        raw = pd.Series(["2020-01-01", "2020-01-02", "2020-01-03", "2020-01-04", "2020-01-05"])
        result = _parse_datetime_series(raw)
        assert isinstance(result, pd.Series)
        assert result.dtype == "datetime64[ns]"
        assert result.notna().all()
        assert result.iloc[0] == pd.Timestamp("2020-01-01")
        assert result.iloc[-1] == pd.Timestamp("2020-01-05")

    def test_french_dates(self):
        raw = pd.Series(["1 janvier 2020", "15 mars 2020", "30 juin 2020"])
        result = _parse_datetime_series(raw)
        assert isinstance(result, pd.Series)
        assert result.dtype == "datetime64[ns]"
        assert result.notna().all()

    def test_slash_format_dayfirst(self):
        raw = pd.Series(["01/01/2020", "15/03/2020", "31/12/2020"])
        result = _parse_datetime_series(raw)
        assert result.notna().all()
        assert result.iloc[0] == pd.Timestamp("2020-01-01")

    def test_years_only(self):
        raw = pd.Series(["2020", "2021", "2022", "2023"])
        result = _parse_datetime_series(raw)
        assert result.iloc[0] == pd.Timestamp("2020-01-01")

    def test_year_match_pattern(self):
        raw = pd.Series(["2020", "2021", "2022"])
        result = _parse_datetime_series(raw)
        assert result.dtype == "datetime64[ns]"
        assert result.iloc[0] == pd.Timestamp("2020-01-01")

    def test_numeric_years(self):
        raw = pd.Series([2020, 2021, 2022])
        result = _parse_datetime_series(raw)
        assert result.dtype == "datetime64[ns]"
        assert result.iloc[0] == pd.Timestamp("2020-01-01")

    def test_mixed_formats(self):
        raw = pd.Series(["2020-01-01", "02/02/2021", "mars 2022"])
        result = _parse_datetime_series(raw)
        assert result.notna().any()

    def test_with_nan_values(self):
        raw = pd.Series(["2020-01-01", np.nan, "2020-01-03"])
        result = _parse_datetime_series(raw)
        assert pd.isna(result.iloc[1])
        assert not pd.isna(result.iloc[0])
        assert not pd.isna(result.iloc[2])

    def test_empty_series(self):
        raw = pd.Series([], dtype="object")
        result = _parse_datetime_series(raw)
        assert isinstance(result, pd.Series)
        assert result.dtype == "datetime64[ns]"
        assert len(result) == 0

    def test_all_nan(self):
        raw = pd.Series([np.nan, np.nan, np.nan])
        result = _parse_datetime_series(raw)
        assert result.isna().all()

    def test_month_year_format(self):
        raw = pd.Series(["01/2020", "06/2020", "12/2020"])
        result = _parse_datetime_series(raw)
        assert result.notna().any()

    def test_returns_series_with_same_index(self):
        raw = pd.Series(["2020-01-01", "2020-01-02", "2020-01-03"], index=[10, 20, 30])
        result = _parse_datetime_series(raw)
        assert list(result.index) == [10, 20, 30]


class TestPrepareSeries:
    def test_basic_preparation(self):
        df = pd.DataFrame({
            "date": ["2020-01-01", "2020-01-02", "2020-01-03", "2020-01-04", "2020-01-05"],
            "value": [10.0, 20.0, 30.0, 40.0, 50.0],
        })
        result = _prepare_series(df, "date", "value")
        assert isinstance(result, pd.Series)
        assert result.dtype in (np.float64, float)
        assert isinstance(result.index, pd.DatetimeIndex)
        assert len(result) >= 5

    def test_with_nan_in_values(self):
        df = pd.DataFrame({
            "date": ["2020-01-01", "2020-01-02", "2020-01-03", "2020-01-04", "2020-01-05"],
            "value": [10.0, np.nan, 30.0, np.nan, 50.0],
        })
        result = _prepare_series(df, "date", "value")
        assert isinstance(result, pd.Series)
        assert not result.isna().any()

    def test_with_nan_in_dates(self):
        df = pd.DataFrame({
            "date": ["2020-01-01", np.nan, "2020-01-03", "2020-01-04", "2020-01-05"],
            "value": [10.0, 20.0, 30.0, 40.0, 50.0],
        })
        result = _prepare_series(df, "date", "value")
        assert isinstance(result, pd.Series)
        assert len(result) >= 3

    def test_sorted_by_date(self):
        df = pd.DataFrame({
            "date": ["2020-01-05", "2020-01-01", "2020-01-03", "2020-01-04", "2020-01-02"],
            "value": [50.0, 10.0, 30.0, 40.0, 20.0],
        })
        result = _prepare_series(df, "date", "value")
        assert result.index.is_monotonic_increasing

    def test_duplicate_dates_removed(self):
        df = pd.DataFrame({
            "date": ["2020-01-01", "2020-01-01", "2020-01-02", "2020-01-03"],
            "value": [10.0, 99.0, 30.0, 40.0],
        })
        result = _prepare_series(df, "date", "value")
        assert result.loc["2020-01-01"] == 99.0
        assert len(result[result.index == pd.Timestamp("2020-01-01")]) == 1

    def test_returns_index_with_freq(self):
        df = pd.DataFrame({
            "date": ["2020-01-01", "2020-01-02", "2020-01-03", "2020-01-04", "2020-01-05"],
            "value": [10.0, 20.0, 30.0, 40.0, 50.0],
        })
        result = _prepare_series(df, "date", "value")
        assert result.index.freq is not None


class TestBuildForecastDates:
    def test_daily_forecast(self, forecast_index):
        steps = 10
        result = _build_forecast_dates(forecast_index, steps)

        assert isinstance(result, pd.DatetimeIndex)
        assert len(result) == steps
        assert result[0] > forecast_index[-1]
        assert result.is_monotonic_increasing

    def test_steps_zero(self, forecast_index):
        result = _build_forecast_dates(forecast_index, 0)
        assert len(result) == 0
        assert isinstance(result, pd.DatetimeIndex)

    def test_with_custom_forecast_dates(self, forecast_index):
        custom_dates = ["2020-03-01", "2020-03-02", "2020-03-03"]
        result = _build_forecast_dates(forecast_index, 3, forecast_dates=custom_dates)

        assert isinstance(result, pd.DatetimeIndex)
        assert len(result) == 3
        assert result[0] == pd.Timestamp("2020-03-01")

    def test_custom_dates_count_mismatch_raises(self, forecast_index):
        custom_dates = ["2020-03-01", "2020-03-02"]
        with pytest.raises(ValueError, match="Nombre de forecast_dates invalide"):
            _build_forecast_dates(forecast_index, 5, forecast_dates=custom_dates)

    def test_custom_dates_invalid_raises(self, forecast_index):
        custom_dates = ["invalid", "also_invalid"]
        with pytest.raises(ValueError, match="Certaines forecast_dates sont invalides"):
            _build_forecast_dates(forecast_index, 2, forecast_dates=custom_dates)

    def test_monthly_forecast(self):
        index = pd.date_range("2020-01-01", periods=12, freq="MS")
        result = _build_forecast_dates(index, 6)
        assert len(result) == 6
        assert result.freq is not None

    def test_weekly_forecast(self):
        index = pd.date_range("2020-01-05", periods=10, freq="W")
        result = _build_forecast_dates(index, 4)
        assert len(result) == 4

    def test_forecast_starts_after_last_date(self, forecast_index):
        result = _build_forecast_dates(forecast_index, 5)
        assert result[0] > forecast_index[-1]

    def test_no_overlap_with_history(self, forecast_index):
        result = _build_forecast_dates(forecast_index, 5)
        overlap = result.intersection(forecast_index)
        assert len(overlap) == 0
