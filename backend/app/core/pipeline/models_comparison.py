"""
Comparaison et evaluation croisee de modeles supervises.
"""

from __future__ import annotations

import time
import warnings
from typing import Any

import numpy as np
import pandas as pd

from app.core.pipeline.models_spec import CATALOG, CATALOG_BY_KEY
from app.core.statistical_attempt import attempt


def _baseline_scores(y: np.ndarray, problem: str, splits) -> float:
    """Score de la reference naive, avec le meme decoupage que les candidats."""
    scores = []
    for train_idx, test_idx in splits:
        y_train, y_test = y[train_idx], y[test_idx]
        if problem == "regression":
            prediction = np.full(len(y_test), y_train.mean())
            ss_res = float(((y_test - prediction) ** 2).sum())
            ss_tot = float(((y_test - y_test.mean()) ** 2).sum())
            scores.append(1 - ss_res / ss_tot if ss_tot > 0 else 0.0)
        else:
            values, counts = np.unique(y_train, return_counts=True)
            prediction = values[counts.argmax()]
            scores.append(float((y_test == prediction).mean()))
    return float(np.mean(scores)) if scores else 0.0


def compare_models(X: pd.DataFrame, y: pd.Series, problem: str,
                   is_timeseries: bool = False, budget_sec: float = 60.0,
                   keys: list[str] | None = None) -> dict[str, Any]:
    """Evalue les candidats applicables et les classe.

    Le decoupage respecte l'ordre du temps quand le jeu est temporel.
    """
    from sklearn.model_selection import KFold, StratifiedKFold, TimeSeriesSplit

    n_rows, n_features = len(X), X.shape[1]
    is_regression = problem == "regression"
    y_values = y.to_numpy()

    n_splits = 5 if n_rows >= 100 else 3
    if is_timeseries:
        splitter = TimeSeriesSplit(n_splits=n_splits)
        validation = "découpage chronologique (TimeSeriesSplit)"
    elif is_regression:
        splitter = KFold(n_splits=n_splits, shuffle=True, random_state=0)
        validation = f"validation croisée {n_splits} plis"
    else:
        counts = pd.Series(y_values).value_counts()
        n_splits = min(n_splits, int(counts.min()))
        if n_splits < 2:
            return {"error": "Classe trop rare pour une validation croisée fiable.",
                    "results": [], "validation": None}
        splitter = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=0)
        validation = f"validation croisée stratifiée {n_splits} plis"

    splits = list(splitter.split(X, y_values if not is_regression else None))
    baseline = _baseline_scores(y_values, "regression" if is_regression else "classification", splits)
    metric = "R²" if is_regression else "exactitude équilibrée"
    scoring = "r2" if is_regression else "balanced_accuracy"

    selected = [s for s in CATALOG
                if (keys is None or s.key in keys)
                and s.applicable(problem, n_rows, n_features)[0]]

    from sklearn.model_selection import cross_val_score

    results: list[dict[str, Any]] = []
    started = time.time()
    context = {"n_rows": n_rows, "n_features": n_features}

    for spec in selected:
        if time.time() - started > budget_sec:
            results.append({"key": spec.key, "label": spec.label, "family": spec.family,
                            "status": "skipped", "reason": "budget de temps atteint"})
            continue
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            evaluation = attempt(
                lambda: cross_val_score(spec.build(context), X, y_values, cv=splits,
                                        scoring=scoring, n_jobs=1))
        if not evaluation:
            results.append({"key": spec.key, "label": spec.label, "family": spec.family,
                            "status": "error", "reason": evaluation.reason})
            continue

        scores = evaluation.value
        mean, std = float(np.mean(scores)), float(np.std(scores))
        results.append({
            "key": spec.key, "label": spec.label, "family": spec.family,
            "status": "ok",
            "score": round(mean, 4), "std": round(std, 4),
            "gain_vs_baseline": round(mean - baseline, 4),
            "fold_scores": [round(float(s), 4) for s in scores],
            "strengths": spec.strengths, "caveat": spec.caveat,
        })

    scored = [r for r in results if r["status"] == "ok"]
    scored.sort(key=lambda r: -r["score"])
    best = scored[0] if scored else None

    return {
        "metric": metric,
        "validation": validation,
        "baseline": round(baseline, 4),
        "baseline_label": ("moyenne de l'échantillon d'entraînement" if is_regression
                           else "classe majoritaire"),
        "results": scored + [r for r in results if r["status"] != "ok"],
        "best": best,
        "n_evaluated": len(scored),
        "n_rows": n_rows,
        "n_features": n_features,
        "elapsed_sec": round(time.time() - started, 2),
    }


def fit_best(X: pd.DataFrame, y: pd.Series, best_key: str,
             n_rows: int, n_features: int):
    """Reentraine le meilleur modele sur l'ensemble des donnees."""
    spec = CATALOG_BY_KEY.get(best_key)
    if spec is None:
        return None
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        estimator = spec.build({"n_rows": n_rows, "n_features": n_features})
        estimator.fit(X, y)
    return estimator
