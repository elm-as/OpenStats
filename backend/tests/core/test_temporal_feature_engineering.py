"""
Tests unitaires pour les transformations temporelles :
- Variable retardée (Lag Xt-k)
- Moyenne mobile glissante (Rolling Mean)
- Volatilité mobile glissante (Rolling Std)
- Taux de variation relatif (Pct Change)
"""

import numpy as np
import pandas as pd
import pytest

from app.core.transformations_catalog import TRANSFORM_CATALOG, get_transform_catalog
from app.core.transformations_apply import apply_transform, apply_transforms_to_df


@pytest.fixture
def sample_timeseries():
    np.random.seed(42)
    dates = pd.date_range("2020-01-01", periods=10, freq="D")
    values = np.array([10.0, 12.0, 15.0, 14.0, 16.0, 18.0, 20.0, 25.0, 22.0, 24.0])
    return pd.Series(values, index=dates, name="prix")


class TestTemporalTransformations:
    def test_catalog_contains_temporal_transforms(self):
        keys = [item["key"] for item in get_transform_catalog()]
        assert "lag" in keys
        assert "rolling_mean" in keys
        assert "rolling_std" in keys
        assert "pct_change" in keys
        assert "diff" in keys

    def test_apply_lag(self, sample_timeseries):
        # Lag 1
        lag1, meta1 = apply_transform(sample_timeseries, "lag", {"lag": 1})
        assert meta1["lag"] == 1
        assert pd.isna(lag1.iloc[0])
        assert lag1.iloc[1] == sample_timeseries.iloc[0]
        assert lag1.iloc[5] == sample_timeseries.iloc[4]

        # Lag 2
        lag2, meta2 = apply_transform(sample_timeseries, "lag", {"lag": 2})
        assert meta2["lag"] == 2
        assert pd.isna(lag2.iloc[0])
        assert pd.isna(lag2.iloc[1])
        assert lag2.iloc[2] == sample_timeseries.iloc[0]

    def test_apply_rolling_mean(self, sample_timeseries):
        roll, meta = apply_transform(sample_timeseries, "rolling_mean", {"window": 3, "min_periods": 1})
        assert meta["window"] == 3
        # Premier point = moyenne de lui-même
        assert roll.iloc[0] == sample_timeseries.iloc[0]
        # Troisième point = moyenne des 3 premiers (10 + 12 + 15) / 3 = 12.333
        assert pytest.approx(roll.iloc[2], 0.001) == (10.0 + 12.0 + 15.0) / 3.0

    def test_apply_rolling_std(self, sample_timeseries):
        roll_std, meta = apply_transform(sample_timeseries, "rolling_std", {"window": 3, "min_periods": 2})
        assert meta["window"] == 3
        assert pd.isna(roll_std.iloc[0])  # min_periods=2
        assert roll_std.iloc[1] > 0

    def test_apply_pct_change(self, sample_timeseries):
        pct, meta = apply_transform(sample_timeseries, "pct_change", {"periods": 1})
        assert meta["periods"] == 1
        assert pd.isna(pct.iloc[0])
        # (12 - 10) / 10 = 0.2
        assert pytest.approx(pct.iloc[1], 0.001) == 0.2

    def test_apply_transforms_to_df(self, sample_timeseries):
        df = pd.DataFrame({"prix": sample_timeseries.values})
        transforms = [
            {"column": "prix", "transform": "lag", "params": {"lag": 1}},
            {"column": "prix", "transform": "rolling_mean", "params": {"window": 3}},
        ]
        df_res, logs = apply_transforms_to_df(df, transforms)
        assert "prix_lag" in df_res.columns
        assert "prix_rolling_mean" in df_res.columns
        assert len(logs) == 2
        assert logs[0]["success"] is True
        assert logs[1]["success"] is True
