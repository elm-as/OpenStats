from __future__ import annotations

from typing import Any

from app.core.interpretation.base import (
    Confidence,
    Insight,
    InsightCategory,
    Severity,
    insight,
    sort_insights,
)
from app.core.interpretation.narrators.narrator_formatting import _fmt_num, _fmt_pct, _safe


def _extract_best_model(results: dict[str, Any], all_models: Any) -> dict[str, Any]:
    ranking = results.get("ranking") or []
    if isinstance(ranking, list) and ranking and isinstance(ranking[0], dict):
        return ranking[0]
    if isinstance(results.get("best"), dict):
        return results["best"]
    if isinstance(results.get("best_model"), dict):
        return results["best_model"]
    if isinstance(all_models, list) and all_models and isinstance(all_models[0], dict):
        return all_models[0]
    return {}


def _narrate_regression_best(best_name: str, test_metrics: dict[str, Any], target: Any) -> list[Insight]:
    r2 = test_metrics.get("r2")
    if r2 is None:
        return []
    r2 = float(r2)
    rmse = test_metrics.get("rmse")
    mae = test_metrics.get("mae")
    if r2 >= 0.8:
        sev, quality = Severity.SUCCESS, "Excellente qualité prédictive"
    elif r2 >= 0.6:
        sev, quality = Severity.SUCCESS, "Bonne qualité prédictive"
    elif r2 >= 0.3:
        sev, quality = Severity.WARNING, "Qualité prédictive modérée"
    else:
        sev, quality = Severity.CRITICAL, "Qualité prédictive faible"

    target_str = f" pour `{target}`" if target else ""
    return [
        insight(
            title=f"{quality} ({best_name})",
            message=f"**{best_name}** explique {_fmt_pct(r2)} de la variance{target_str} (R² = {_fmt_num(r2, 3)}). RMSE = {_fmt_num(rmse, 3) if rmse else 'n/a'}.",
            severity=sev,
            category=InsightCategory.MODEL_QUALITY,
            confidence=Confidence.HIGH,
            suggestion=(
                "Envisager plus de features, du feature engineering ou un autre algorithme."
                if r2 < 0.3
                else None
            ),
            evidence={"r2": r2, "rmse": rmse, "mae": mae, "model": best_name},
        )
    ]


def _narrate_classification_best(best_name: str, test_metrics: dict[str, Any]) -> list[Insight]:
    acc = test_metrics.get("accuracy")
    if acc is None:
        return []
    acc = float(acc)
    f1 = test_metrics.get("f1") or test_metrics.get("f1_score")
    auc = test_metrics.get("roc_auc") or test_metrics.get("auc")
    if acc >= 0.9:
        sev, qual = Severity.SUCCESS, "Excellente classification"
    elif acc >= 0.75:
        sev, qual = Severity.SUCCESS, "Bonne classification"
    elif acc >= 0.6:
        sev, qual = Severity.WARNING, "Classification moyenne"
    else:
        sev, qual = Severity.CRITICAL, "Classification faible"

    evid: dict[str, Any] = {"accuracy": acc, "model": best_name}
    extras: list[str] = []
    if f1 is not None:
        extras.append(f"F1 = {_fmt_num(float(f1), 3)}")
        evid["f1"] = float(f1)
    if auc is not None:
        extras.append(f"AUC = {_fmt_num(float(auc), 3)}")
        evid["auc"] = float(auc)

    return [
        insight(
            title=f"{qual} ({best_name})",
            message=f"**{best_name}** atteint {_fmt_pct(acc)} d'exactitude{(' • ' + ' • '.join(extras)) if extras else ''}.",
            severity=sev,
            category=InsightCategory.MODEL_QUALITY,
            confidence=Confidence.HIGH,
            evidence=evid,
        )
    ]


def _narrate_model_comparison(all_models: list[Any], task: Any) -> list[Insight]:
    key_metric = "r2" if task == "regression" else "accuracy"
    scored: list[tuple[str, float]] = []
    for m in all_models:
        v = _safe(m, "test_metrics", key_metric)
        if v is None:
            continue
        try:
            scored.append((m.get("name") or m.get("model_key") or "?", float(v)))
        except (TypeError, ValueError):
            continue
    if len(scored) < 2:
        return []
    scored.sort(key=lambda x: -x[1])
    top, second = scored[0], scored[1]
    delta = top[1] - second[1]
    if delta <= 0.001:
        return []
    rel = (delta / second[1]) * 100 if second[1] > 0 else None
    rel_str = f" (+{_fmt_num(rel, 1)}%)" if rel else ""
    return [
        insight(
            title=f"{top[0]} domine la compétition",
            message=f"**{top[0]}** surperforme **{second[0]}** sur {key_metric} ({_fmt_num(top[1], 3)} vs {_fmt_num(second[1], 3)}){rel_str}.",
            severity=Severity.INFO,
            category=InsightCategory.MODEL_COMPARISON,
            confidence=Confidence.HIGH,
            evidence={"winner": top[0], "runner_up": second[0], "delta": delta, "metric": key_metric},
        )
    ]


def _narrate_feature_importance(feat_imp: Any) -> list[Insight]:
    if not isinstance(feat_imp, list) or not feat_imp:
        return []
    sorted_feats = sorted(feat_imp, key=lambda x: -abs(float(x.get("importance", 0))))
    top3 = sorted_feats[:3]
    if not top3:
        return []
    names = ", ".join(f"`{f.get('feature') or f.get('name')}`" for f in top3)
    top_imp = float(top3[0].get("importance", 0))
    return [
        insight(
            title="Variables clés identifiées",
            message=f"Les 3 variables les plus influentes sont : {names}. **`{top3[0].get('feature') or top3[0].get('name')}`** domine ({_fmt_pct(top_imp) if top_imp <= 1 else _fmt_num(top_imp, 2)}).",
            severity=Severity.INFO,
            category=InsightCategory.FEATURE_IMPORTANCE,
            confidence=Confidence.HIGH,
            variables=[f.get("feature") or f.get("name") for f in top3 if f.get("feature") or f.get("name")],
            evidence={"top3": top3},
        )
    ]


def narrate_modeling(results: dict[str, Any]) -> list[Insight]:
    """Interprète les résultats d'une modélisation (compétitive ou unique)."""
    if not results:
        return []

    insights: list[Insight] = []
    task = results.get("task_type") or results.get("task")
    all_models = results.get("ranking") or results.get("models") or results.get("comparison") or []
    target = results.get("target") or results.get("target_col")
    best = _extract_best_model(results, all_models)
    best_name = best.get("name") or best.get("model_name") or best.get("model_key") or "Meilleur modèle"
    test_metrics = best.get("test_metrics") or best.get("metrics") or {}

    if task == "regression":
        insights.extend(_narrate_regression_best(best_name, test_metrics, target))
    elif task == "classification":
        insights.extend(_narrate_classification_best(best_name, test_metrics))

    if isinstance(all_models, list) and len(all_models) >= 2:
        insights.extend(_narrate_model_comparison(all_models, task))

    insights.extend(_narrate_feature_importance(best.get("feature_importance") or results.get("feature_importance")))

    diag = results.get("diagnostics") or best.get("diagnostics") or {}
    if isinstance(diag, dict) and diag.get("quality_flag") == "critical":
        insights.append(
            insight(
                title="Alerte qualité modèle",
                message=diag.get("message", "Le modèle présente des signes d'inadéquation."),
                severity=Severity.CRITICAL,
                category=InsightCategory.MODEL_QUALITY,
                confidence=Confidence.HIGH,
                suggestion="Vérifier les résidus, l'équilibre des classes ou la fuite de données.",
                evidence=diag,
            )
        )

    warnings = best.get("warnings") or results.get("warnings") or []
    if isinstance(warnings, list):
        for w in warnings:
            insights.append(
                insight(
                    title="Validation des hypothèses (Statistiques)",
                    message=str(w),
                    severity=Severity.WARNING,
                    category=InsightCategory.DATA_QUALITY,
                    confidence=Confidence.HIGH,
                )
            )

    return sort_insights(insights)
