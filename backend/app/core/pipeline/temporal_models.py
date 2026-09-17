"""
Comparaison de modeles de series temporelles.

L'evaluation se fait par **origine glissante** : on entraine sur le debut de la
serie, on predit l'horizon suivant, on avance. C'est la seule facon honnete de
juger une prevision — une validation croisee melangeant les periodes
entrainerait le modele sur le futur.

Deux references naives encadrent les resultats : la persistance (derniere valeur
observee) et la derive lineaire. Un modele qui ne les bat pas n'apporte rien.
"""

from __future__ import annotations

import warnings
from typing import Any

import numpy as np
import pandas as pd

from app.core.statistical_attempt import DEGENERATE_DATA_ERRORS, attempt, describe

MIN_TRAIN = 12
DEFAULT_HORIZON = 4
MAX_FOLDS = 4


def _mae(actual: np.ndarray, predicted: np.ndarray) -> float:
    return float(np.mean(np.abs(actual - predicted)))


def _detect_period(series: pd.Series) -> int:
    """Periode saisonniere deduite de la frequence de l'index."""
    index = series.index
    if not isinstance(index, pd.DatetimeIndex) or len(index) < 8:
        return 1
    freq = pd.infer_freq(index) or ""
    head = freq.split("-")[0].upper()
    return {"M": 12, "ME": 12, "MS": 12, "Q": 4, "QE": 4, "QS": 4,
            "W": 52, "D": 7, "H": 24}.get(head, 1)


# ── Previsionnistes ──────────────────────────────────────────────────────

def _forecast_naive(train: pd.Series, horizon: int, period: int) -> np.ndarray:
    return np.full(horizon, float(train.iloc[-1]))


def _forecast_drift(train: pd.Series, horizon: int, period: int) -> np.ndarray:
    if len(train) < 2:
        return _forecast_naive(train, horizon, period)
    slope = (float(train.iloc[-1]) - float(train.iloc[0])) / (len(train) - 1)
    return float(train.iloc[-1]) + slope * np.arange(1, horizon + 1)


def _forecast_holt_winters(train: pd.Series, horizon: int, period: int) -> np.ndarray:
    from statsmodels.tsa.holtwinters import ExponentialSmoothing

    seasonal = "add" if period > 1 and len(train) >= 2 * period else None
    model = ExponentialSmoothing(train, trend="add", seasonal=seasonal,
                                 seasonal_periods=period if seasonal else None,
                                 initialization_method="estimated").fit()
    return np.asarray(model.forecast(horizon), dtype=float)


def _integration_order(series: pd.Series, max_diff: int = 2) -> int:
    """Ordre de differenciation choisi par test de racine unitaire, pas par AIC.

    Comparer des AIC entre modeles de `d` differents n'a pas de sens : ils ne
    portent pas sur les memes donnees.
    """
    from statsmodels.tsa.stattools import adfuller

    work = series.dropna()
    for order in range(max_diff + 1):
        if work.nunique() < 3 or len(work) < 8:
            return order
        # Un ADF qui echoue ne permet pas de conclure a la non-stationnarite :
        # on s'arrete a l'ordre atteint plutot que de differencier a l'aveugle.
        test = attempt(adfuller, work, autolag="AIC")
        if not test or float(test.value[1]) < 0.05:
            return order
        work = work.diff().dropna()
    return max_diff


def _best_arima_order(train: pd.Series, period: int = 1,
                      seasonal: bool = False) -> tuple[tuple[int, int, int], tuple]:
    """Ordre ARIMA par AIC, a `d` fixe et grille bornee par la taille d'echantillon."""
    from statsmodels.tsa.arima.model import ARIMA

    d = _integration_order(train)
    effective = len(train) - d
    cap = max(1, min(3, effective // 12))

    best_order, best_aic = (1, d, 1), float("inf")
    seasonal_order = (1, 0, 1, period) if seasonal and period > 1 else (0, 0, 0, 0)

    for p in range(cap + 1):
        for q in range(cap + 1):
            if p == 0 and q == 0:
                continue
            # Un ordre non estimable est un candidat ecarte, pas une erreur.
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                fitted = attempt(
                    lambda: ARIMA(train, order=(p, d, q),
                                  seasonal_order=seasonal_order).fit(
                                      method_kwargs={"maxiter": 60, "disp": 0}))
            if fitted and np.isfinite(fitted.value.aic) and fitted.value.aic < best_aic:
                best_aic, best_order = fitted.value.aic, (p, d, q)

    return best_order, seasonal_order


def _forecast_arima(train: pd.Series, horizon: int, period: int) -> np.ndarray:
    from statsmodels.tsa.arima.model import ARIMA

    order, seasonal_order = _best_arima_order(train)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        fit = ARIMA(train, order=order, seasonal_order=seasonal_order).fit(
            method_kwargs={"maxiter": 60, "disp": 0})
    return np.asarray(fit.forecast(horizon), dtype=float)


def _forecast_sarima(train: pd.Series, horizon: int, period: int) -> np.ndarray:
    from statsmodels.tsa.arima.model import ARIMA

    if period <= 1 or len(train) < 2 * period:
        raise ValueError("saisonnalité indéterminable sur cette série")
    order, seasonal_order = _best_arima_order(train, period=period, seasonal=True)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        fit = ARIMA(train, order=order, seasonal_order=seasonal_order).fit(
            method_kwargs={"maxiter": 60, "disp": 0})
    return np.asarray(fit.forecast(horizon), dtype=float)


def _forecast_prophet(train: pd.Series, horizon: int, period: int) -> np.ndarray:
    import logging

    from prophet import Prophet

    logging.getLogger("prophet").setLevel(logging.CRITICAL)
    logging.getLogger("cmdstanpy").setLevel(logging.CRITICAL)

    if not isinstance(train.index, pd.DatetimeIndex):
        raise ValueError("Prophet requiert un index de dates")

    frame = pd.DataFrame({"ds": train.index, "y": train.to_numpy(dtype=float)})
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        model = Prophet(weekly_seasonality=False, daily_seasonality=False).fit(frame)
        future = model.make_future_dataframe(periods=horizon,
                                             freq=pd.infer_freq(train.index) or "D")
        forecast = model.predict(future)
    return forecast["yhat"].to_numpy(dtype=float)[-horizon:]


FORECASTERS = {
    "naive": _forecast_naive,
    "drift": _forecast_drift,
    "holt_winters": _forecast_holt_winters,
    "arima": _forecast_arima,
    "sarima": _forecast_sarima,
    "prophet": _forecast_prophet,
}

LABELS = {
    "naive": "Persistance (référence)",
    "drift": "Dérive linéaire (référence)",
    "holt_winters": "Lissage exponentiel (Holt-Winters)",
    "arima": "ARIMA",
    "sarima": "SARIMA (saisonnier)",
    "prophet": "Prophet",
}

FAMILIES = {"naive": "reference", "drift": "reference"}


def compare_temporal(series: pd.Series, horizon: int | None = None,
                     budget_sec: float = 90.0,
                     keys: list[str] | None = None) -> dict[str, Any]:
    """Compare les previsionnistes par origine glissante et les classe par MAE."""
    import time

    clean = series.dropna().astype(float)
    if len(clean) < MIN_TRAIN + 2:
        return {"error": f"Série trop courte ({len(clean)} points) pour une validation honnête.",
                "results": [], "folds": 0}

    period = _detect_period(clean)
    horizon = horizon or max(1, min(DEFAULT_HORIZON, len(clean) // 8))
    n_folds = max(1, min(MAX_FOLDS, (len(clean) - MIN_TRAIN) // horizon))

    origins = [len(clean) - (n_folds - i) * horizon for i in range(n_folds)]
    origins = [o for o in origins if o >= MIN_TRAIN]
    if not origins:
        return {"error": "Pas assez d'observations pour une origine glissante.",
                "results": [], "folds": 0}

    candidates = list(keys or FORECASTERS.keys())
    started = time.time()
    results: list[dict[str, Any]] = []

    for key in candidates:
        forecaster = FORECASTERS.get(key)
        if forecaster is None:
            continue
        if time.time() - started > budget_sec:
            results.append({"key": key, "label": LABELS.get(key, key),
                            "family": FAMILIES.get(key, "temporel"),
                            "status": "skipped", "reason": "budget de temps atteint"})
            continue

        errors: list[float] = []
        failure: str | None = None
        for origin in origins:
            train, actual = clean.iloc[:origin], clean.iloc[origin:origin + horizon]
            if len(actual) == 0:
                continue
            try:
                predicted = forecaster(train, len(actual), period)
                if predicted is None or len(predicted) != len(actual) or not np.all(np.isfinite(predicted)):
                    raise ValueError("prévision invalide")
                errors.append(_mae(actual.to_numpy(dtype=float), np.asarray(predicted, dtype=float)))
            except DEGENERATE_DATA_ERRORS as exc:
                failure = describe(exc, limit=110)
                break

        if failure or not errors:
            results.append({"key": key, "label": LABELS.get(key, key),
                            "family": FAMILIES.get(key, "temporel"),
                            "status": "error", "reason": failure or "aucune fenêtre évaluable"})
            continue

        results.append({
            "key": key, "label": LABELS.get(key, key),
            "family": FAMILIES.get(key, "temporel"),
            "status": "ok",
            "mae": round(float(np.mean(errors)), 6),
            "mae_std": round(float(np.std(errors)), 6),
            "fold_errors": [round(e, 6) for e in errors],
        })

    scored = [r for r in results if r["status"] == "ok"]
    scored.sort(key=lambda r: r["mae"])

    reference = next((r["mae"] for r in scored if r["key"] == "naive"), None)
    for entry in scored:
        if reference and reference > 0:
            # Skill score : part de l'erreur de la persistance qui est evitee.
            entry["skill_vs_naive"] = round(1 - entry["mae"] / reference, 4)

    best = next((r for r in scored if r["family"] != "reference"), None)
    beats_reference = bool(best and reference and best["mae"] < reference)

    return {
        "metric": "erreur absolue moyenne (MAE)",
        "validation": f"origine glissante — {len(origins)} fenêtre(s), horizon {horizon}",
        "seasonal_period": period,
        "horizon": horizon,
        "folds": len(origins),
        "results": scored + [r for r in results if r["status"] != "ok"],
        "best": best,
        "baseline": reference,
        "beats_baseline": beats_reference,
        "n_points": len(clean),
        "elapsed_sec": round(time.time() - started, 2),
    }
