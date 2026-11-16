"""Pure synthetic dataset generators for opaque-box E2E testing."""

from __future__ import annotations

import io
import numpy as np
import pandas as pd


def make_regression_dataset(n_samples: int = 200, seed: int = 42, as_format: str = "csv") -> bytes:
    """Generates continuous and categorical features with a known linear target.

    Features:
        - x1: standard normal
        - x2: standard normal
        - x_collinear: 2.2 * x1 + 0.1 * noise (creates VIF > 10)
        - category: nominal labels ('Alpha', 'Beta', 'Gamma')
        - target: 3.5 * x1 - 2.0 * x2 + noise
    """
    rng = np.random.default_rng(seed)
    x1 = rng.normal(loc=0.0, scale=1.0, size=n_samples)
    x2 = rng.normal(loc=2.0, scale=1.5, size=n_samples)
    x_collinear = 2.2 * x1 + rng.normal(0.0, 0.08, size=n_samples)
    categories = rng.choice(["Alpha", "Beta", "Gamma"], size=n_samples)

    cat_effect = np.where(categories == "Alpha", 1.5, np.where(categories == "Beta", -1.0, 0.0))
    target = 3.5 * x1 - 2.0 * x2 + cat_effect + rng.normal(0.0, 0.5, size=n_samples)

    df = pd.DataFrame({
        "x1": x1,
        "x2": x2,
        "x_collinear": x_collinear,
        "category": categories,
        "target": target,
    })

    # Introduce minor missingness to exercise imputation pipelines
    if n_samples > 10:
        df.loc[2:4, "x1"] = np.nan
        df.loc[5:7, "category"] = np.nan

    if as_format.lower() == "parquet":
        buf = io.BytesIO()
        df.to_parquet(buf, index=False, engine="pyarrow")
        return buf.getvalue()

    return df.to_csv(index=False).encode("utf-8")


def make_classification_dataset(n_samples: int = 200, seed: int = 42, n_classes: int = 2) -> bytes:
    """Generates balanced synthetic features for binary or multiclass classification."""
    rng = np.random.default_rng(seed)
    age = rng.integers(20, 75, size=n_samples)
    income = rng.normal(55000.0, 15000.0, size=n_samples)
    credit_score = rng.normal(650.0, 50.0, size=n_samples)

    logits = (age - 45) * 0.05 + (income - 55000) * 0.00008 - (credit_score - 650) * 0.04
    probs = 1.0 / (1.0 + np.exp(-logits))

    if n_classes == 2:
        target = (probs > 0.5).astype(int)
    else:
        # Multiclass 0, 1, 2
        p1 = probs * 0.6
        p2 = (1.0 - probs) * 0.4
        p3 = 1.0 - (p1 + p2)
        classes = np.array([0, 1, 2])
        target = [rng.choice(classes, p=[p1[i], p2[i], p3[i]]) for i in range(n_samples)]

    df = pd.DataFrame({
        "age": age,
        "income": income,
        "credit_score": credit_score,
        "target": target,
    })
    return df.to_csv(index=False).encode("utf-8")


def make_timeseries_dataset(n_periods: int = 100, freq: str = "D", seed: int = 42) -> bytes:
    """Generates sequential date-indexed multivariate time series."""
    rng = np.random.default_rng(seed)
    dates = pd.date_range("2023-01-01", periods=n_periods, freq=freq)

    t = np.arange(n_periods)
    trend = 0.4 * t
    seasonality = 5.0 * np.sin(2.0 * np.pi * t / 7.0)

    sales = 100.0 + trend + seasonality + rng.normal(0.0, 2.0, size=n_periods)
    price = 25.0 - 0.05 * t + rng.normal(0.0, 0.5, size=n_periods)
    interest_rate = 3.5 + 0.01 * t + rng.normal(0.0, 0.1, size=n_periods)

    df = pd.DataFrame({
        "date": dates.strftime("%Y-%m-%d"),
        "sales": np.round(sales, 2),
        "price": np.round(price, 2),
        "interest_rate": np.round(interest_rate, 2),
    })
    return df.to_csv(index=False).encode("utf-8")


def make_contingency_dataset(n_samples: int = 200, seed: int = 42) -> bytes:
    """Generates nominal categorical dimensions for Chi-square and Correspondence Analysis."""
    rng = np.random.default_rng(seed)
    departments = rng.choice(["Sales", "Engineering", "Marketing", "Support"], size=n_samples)
    education = rng.choice(["BSc", "MSc", "PhD"], size=n_samples)
    satisfaction = rng.choice(["Low", "Medium", "High"], size=n_samples)

    df = pd.DataFrame({
        "department": departments,
        "education": education,
        "satisfaction": satisfaction,
    })
    return df.to_csv(index=False).encode("utf-8")


def make_boundary_dataset(kind: str = "empty", seed: int = 42) -> bytes:
    """Generates pathological datasets to test boundary guards and validations."""
    rng = np.random.default_rng(seed)

    if kind == "empty":
        return b""

    if kind == "headers_only":
        return b"col_a,col_b,col_c\n"

    if kind == "single_row":
        return b"col_a,col_b,col_c\n10,20.5,active\n"

    if kind == "constant_col":
        df = pd.DataFrame({
            "normal_col": rng.normal(size=50),
            "constant_col": [42.0] * 50,
            "target": rng.normal(size=50),
        })
        return df.to_csv(index=False).encode("utf-8")

    if kind == "single_class":
        df = pd.DataFrame({
            "feature_1": rng.normal(size=50),
            "feature_2": rng.normal(size=50),
            "target": [1] * 50,  # All 1s
        })
        return df.to_csv(index=False).encode("utf-8")

    raise ValueError(f"Unknown boundary kind: '{kind}'")
