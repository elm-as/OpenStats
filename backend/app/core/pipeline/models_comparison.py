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


MAX_BENCHMARK_ROWS = 25000


def _subsample_for_cv(
    X: pd.DataFrame, y: pd.Series, options: dict[str, Any]
) -> tuple[pd.DataFrame, pd.Series]:
    """Réduit un grand jeu de données de façon reproductible pour accélérer la CV."""
    max_rows = int(options["max_rows"])
    if len(X) <= max_rows:
        return X, y
    rng = np.random.default_rng(0)
    if options.get("stratify") and y.nunique() > 1:
        from sklearn.model_selection import train_test_split
        idx, _ = train_test_split(
            np.arange(len(X)), train_size=max_rows, stratify=y, random_state=0
        )
        idx = np.sort(idx)
    else:
        idx = np.sort(rng.choice(len(X), max_rows, replace=False))
    return X.iloc[idx], y.iloc[idx]


def _build_splits(
    n_rows: int, y_values: np.ndarray, mode: dict[str, Any]
) -> tuple[Any, str] | tuple[None, dict[str, Any]]:
    """Construit le découpage de validation adapté au type de problème."""
    from sklearn.model_selection import KFold, StratifiedKFold, TimeSeriesSplit

    is_regression = mode["problem"] == "regression"
    n_splits = 5 if n_rows >= 100 else 3
    if mode.get("is_timeseries"):
        return TimeSeriesSplit(n_splits=n_splits), "découpage chronologique (TimeSeriesSplit)"
    if is_regression:
        return KFold(n_splits=n_splits, shuffle=True, random_state=0), f"validation croisée {n_splits} plis"

    counts = pd.Series(y_values).value_counts()
    n_splits = min(n_splits, int(counts.min()))
    if n_splits < 2:
        return None, {"error": "Classe trop rare pour une validation croisée fiable.", "results": [], "validation": None}
    return StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=0), f"validation croisée stratifiée {n_splits} plis"


def _evaluate_spec(spec: Any, ctx: dict[str, Any]) -> dict[str, Any]:
    """Évalue un candidat unique, avec plafond de taille propre aux algorithmes O(N²)."""
    from sklearn.model_selection import cross_val_score

    X_spec, y_spec = ctx["X"], ctx["y"]
    splits = ctx["splits"]
    is_regression = ctx["problem"] == "regression"

    if not ctx["is_timeseries"] and spec.max_cv_rows and len(X_spec) > spec.max_cv_rows:
        X_spec, y_spec = _subsample_for_cv(X_spec, y_spec, {"max_rows": spec.max_cv_rows, "stratify": not is_regression})
        splitter, _ = _build_splits(len(X_spec), y_spec.to_numpy(), {"problem": ctx["problem"], "is_timeseries": False})
        if splitter is None:
            return {"key": spec.key, "label": spec.label, "family": spec.family, "status": "skipped", "reason": "classe trop rare"}
        splits = list(splitter.split(X_spec, y_spec.to_numpy() if not is_regression else None))

    build_ctx = {"n_rows": len(X_spec), "n_features": X_spec.shape[1]}
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        evaluation = attempt(
            lambda: cross_val_score(
                spec.build(build_ctx), X_spec, y_spec.to_numpy(), cv=splits, scoring=ctx["scoring"], n_jobs=1
            )
        )
    if not evaluation:
        return {"key": spec.key, "label": spec.label, "family": spec.family, "status": "error", "reason": evaluation.reason}

    mean, std = float(np.mean(evaluation.value)), float(np.std(evaluation.value))
    return {
        "key": spec.key, "label": spec.label, "family": spec.family, "status": "ok",
        "score": round(mean, 4), "std": round(std, 4),
        "gain_vs_baseline": round(mean - ctx["baseline"], 4),
        "fold_scores": [round(float(s), 4) for s in evaluation.value],
        "strengths": spec.strengths, "caveat": spec.caveat,
    }


def compare_models(X: pd.DataFrame, y: pd.Series, problem: str,
                   is_timeseries: bool = False, budget_sec: float = 60.0,
                   keys: list[str] | None = None) -> dict[str, Any]:
    """Evalue les candidats applicables et les classe.

    Le decoupage respecte l'ordre du temps quand le jeu est temporel.
    """
    n_rows, n_features = len(X), X.shape[1]
    is_regression = problem == "regression"

    X_eval, y_eval = (X, y) if is_timeseries else _subsample_for_cv(
        X, y, {"max_rows": MAX_BENCHMARK_ROWS, "stratify": not is_regression}
    )
    y_values = y_eval.to_numpy()
    splitter, validation_or_err = _build_splits(
        len(X_eval), y_values, {"problem": problem, "is_timeseries": is_timeseries}
    )
    if splitter is None:
        return validation_or_err

    validation = validation_or_err
    if len(X_eval) < n_rows:
        validation = f"{validation} (échantillon {len(X_eval):,}/{n_rows:,})".replace(",", " ")

    splits = list(splitter.split(X_eval, y_values if not is_regression else None))
    baseline = _baseline_scores(y_values, "regression" if is_regression else "classification", splits)
    metric = "R²" if is_regression else "exactitude équilibrée"
    scoring = "r2" if is_regression else "balanced_accuracy"
    eval_ctx = {
        "X": X_eval, "y": y_eval, "problem": problem,
        "is_timeseries": is_timeseries, "splits": splits,
        "scoring": scoring, "baseline": baseline,
    }

    selected = [s for s in CATALOG
                if (keys is None or s.key in keys)
                and s.applicable(problem, n_rows, n_features)[0]]

    results: list[dict[str, Any]] = []
    started = time.time()

    for spec in selected:
        if time.time() - started > budget_sec:
            results.append({"key": spec.key, "label": spec.label, "family": spec.family,
                            "status": "skipped", "reason": "budget de temps atteint"})
            continue
        results.append(_evaluate_spec(spec, eval_ctx))

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
