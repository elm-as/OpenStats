from __future__ import annotations

from typing import Any

from app.core.interpretation.base import (
    Insight,
    Severity,
    Confidence,
    InsightCategory,
    insight,
    sort_insights,
)
from app.core.interpretation.narrators._helpers import _fmt_pct, _fmt_num, _safe


def narrate_modeling(results: dict[str, Any]) -> list[Insight]:
    """Interprète les résultats d'une modélisation (compétitive ou unique)."""
    insights: list[Insight] = []
    if not results:
        return insights

    task = results.get("task_type") or results.get("task")
    best = results.get("best_model") or results.get("best") or {}
    all_models = results.get("models") or results.get("comparison") or []
    target = results.get("target") or results.get("target_col")

    if not best and isinstance(all_models, list) and all_models:
        # Prendre le meilleur du leaderboard
        if task == "regression":
            all_models_sorted = sorted(all_models, key=lambda m: -_safe(m, "test_metrics", "r2", default=-999))
        else:
            all_models_sorted = sorted(all_models, key=lambda m: -_safe(m, "test_metrics", "accuracy", default=0))
        best = all_models_sorted[0] if all_models_sorted else {}

    best_name = best.get("name") or best.get("model_key") or "Meilleur modèle"
    test_metrics = best.get("test_metrics") or best.get("metrics") or {}

    # ── Régression ──
    if task == "regression":
        r2 = test_metrics.get("r2")
        rmse = test_metrics.get("rmse")
        mae = test_metrics.get("mae")

        if r2 is not None:
            r2 = float(r2)
            if r2 >= 0.8:
                sev, msg_quality = Severity.SUCCESS, "Excellente qualité prédictive"
            elif r2 >= 0.6:
                sev, msg_quality = Severity.SUCCESS, "Bonne qualité prédictive"
            elif r2 >= 0.3:
                sev, msg_quality = Severity.WARNING, "Qualité prédictive modérée"
            else:
                sev, msg_quality = Severity.CRITICAL, "Qualité prédictive faible"

            target_str = f" pour `{target}`" if target else ""
            insights.append(insight(
                title=f"{msg_quality} ({best_name})",
                message=f"**{best_name}** explique {_fmt_pct(r2)} de la variance{target_str} (R² = {_fmt_num(r2, 3)}). RMSE = {_fmt_num(rmse, 3) if rmse else 'n/a'}.",
                severity=sev,
                category=InsightCategory.MODEL_QUALITY,
                confidence=Confidence.HIGH,
                suggestion=(
                    "Envisager plus de features, du feature engineering ou un autre algorithme."
                    if r2 < 0.3 else None
                ),
                evidence={"r2": r2, "rmse": rmse, "mae": mae, "model": best_name},
            ))

    # ── Classification ──
    elif task == "classification":
        acc = test_metrics.get("accuracy")
        f1 = test_metrics.get("f1") or test_metrics.get("f1_score")
        auc = test_metrics.get("roc_auc") or test_metrics.get("auc")

        if acc is not None:
            acc = float(acc)
            if acc >= 0.9:
                sev, qual = Severity.SUCCESS, "Excellente classification"
            elif acc >= 0.75:
                sev, qual = Severity.SUCCESS, "Bonne classification"
            elif acc >= 0.6:
                sev, qual = Severity.WARNING, "Classification moyenne"
            else:
                sev, qual = Severity.CRITICAL, "Classification faible"

            evid: dict[str, Any] = {"accuracy": acc, "model": best_name}
            extras = []
            if f1 is not None:
                extras.append(f"F1 = {_fmt_num(float(f1), 3)}")
                evid["f1"] = float(f1)
            if auc is not None:
                extras.append(f"AUC = {_fmt_num(float(auc), 3)}")
                evid["auc"] = float(auc)

            insights.append(insight(
                title=f"{qual} ({best_name})",
                message=f"**{best_name}** atteint {_fmt_pct(acc)} d'exactitude{(' • ' + ' • '.join(extras)) if extras else ''}.",
                severity=sev,
                category=InsightCategory.MODEL_QUALITY,
                confidence=Confidence.HIGH,
                evidence=evid,
            ))

    # ── Comparaison modèles ──
    if isinstance(all_models, list) and len(all_models) >= 2:
        key_metric = "r2" if task == "regression" else "accuracy"
        scored = []
        for m in all_models:
            v = _safe(m, "test_metrics", key_metric)
            if v is not None:
                try:
                    scored.append((m.get("name") or m.get("model_key") or "?", float(v)))
                except (TypeError, ValueError):
                    continue
        if len(scored) >= 2:
            scored.sort(key=lambda x: -x[1])
            top, second = scored[0], scored[1]
            delta = top[1] - second[1]
            if delta > 0.001:
                rel = (delta / second[1]) * 100 if second[1] > 0 else None
                rel_str = f" (+{_fmt_num(rel, 1)}%)" if rel else ""
                insights.append(insight(
                    title=f"{top[0]} domine la compétition",
                    message=f"**{top[0]}** surperforme **{second[0]}** sur {key_metric} ({_fmt_num(top[1], 3)} vs {_fmt_num(second[1], 3)}){rel_str}.",
                    severity=Severity.INFO,
                    category=InsightCategory.MODEL_COMPARISON,
                    confidence=Confidence.HIGH,
                    evidence={"winner": top[0], "runner_up": second[0], "delta": delta, "metric": key_metric},
                ))

    # ── Feature importance ──
    feat_imp = best.get("feature_importance") or results.get("feature_importance")
    if isinstance(feat_imp, list) and feat_imp:
        sorted_feats = sorted(feat_imp, key=lambda x: -abs(float(x.get("importance", 0))))
        top3 = sorted_feats[:3]
        if top3:
            names = ", ".join(f"`{f.get('feature') or f.get('name')}`" for f in top3)
            top_imp = float(top3[0].get("importance", 0))
            insights.append(insight(
                title="Variables clés identifiées",
                message=f"Les 3 variables les plus influentes sont : {names}. **`{top3[0].get('feature') or top3[0].get('name')}`** domine ({_fmt_pct(top_imp) if top_imp <= 1 else _fmt_num(top_imp, 2)}).",
                severity=Severity.INFO,
                category=InsightCategory.FEATURE_IMPORTANCE,
                confidence=Confidence.HIGH,
                variables=[f.get("feature") or f.get("name") for f in top3 if f.get("feature") or f.get("name")],
                evidence={"top3": top3},
            ))

    # ── Diagnostics modèle ──
    diag = results.get("diagnostics") or best.get("diagnostics") or {}
    if isinstance(diag, dict):
        flag = diag.get("quality_flag")
        if flag == "critical":
            insights.append(insight(
                title="Alerte qualité modèle",
                message=diag.get("message", "Le modèle présente des signes d'inadéquation."),
                severity=Severity.CRITICAL,
                category=InsightCategory.MODEL_QUALITY,
                confidence=Confidence.HIGH,
                suggestion="Vérifier les résidus, l'équilibre des classes ou la fuite de données.",
                evidence=diag,
            ))

    # ── Warnings statistiques ──
    warnings = best.get("warnings") or results.get("warnings") or []
    if isinstance(warnings, list):
        for w in warnings:
            insights.append(insight(
                title="Validation des hypothèses (Statistiques)",
                message=str(w),
                severity=Severity.WARNING,
                category=InsightCategory.DATA_QUALITY,
                confidence=Confidence.HIGH,
                suggestion="L'application de modèles plus complexes (ex: Random Forest) peut contourner ce problème si les variables ne sont pas modifiables.",
                tags=["tutorial"],
            ))

    # ── Tutoriel Automatique ──
    if task == "regression":
        insights.append(insight(
            title="💡 Comment interpréter ces résultats ?",
            message="Le **R²** indique le pourcentage de variance expliquée : plus il est proche de 100%, meilleur est le modèle. Le **RMSE** représente l'erreur moyenne de prédiction dans les mêmes unités que la cible. *Objectif : maximiser le R², minimiser le RMSE.*",
            severity=Severity.METHODOLOGICAL,
            category=InsightCategory.RECOMMENDATION,
            confidence=Confidence.HIGH,
            tags=["tutorial"],
        ))
    elif task == "classification":
        insights.append(insight(
            title="💡 Comment interpréter ces résultats ?",
            message="L'**Exactitude (Accuracy)** mesure le pourcentage de bonnes prédictions. Le **F1-score** est plus fiable si vos classes sont déséquilibrées (ex: 90% de 'Non', 10% de 'Oui'). L'**AUC** évalue la capacité globale du modèle à séparer les classes.",
            severity=Severity.METHODOLOGICAL,
            category=InsightCategory.RECOMMENDATION,
            confidence=Confidence.HIGH,
            tags=["tutorial"],
        ))

    return sort_insights(insights)
