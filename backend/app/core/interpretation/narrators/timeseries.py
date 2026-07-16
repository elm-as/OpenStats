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


def narrate_timeseries(results: dict[str, Any]) -> list[Insight]:
    """Interprète une analyse TS univariée."""
    insights: list[Insight] = []
    if not results:
        return insights

    var_name = results.get("value_col") or "série"

    # Stationnarité
    stat = results.get("stationarity") or {}
    adf = stat.get("adf") or {}
    kpss = stat.get("kpss") or {}
    adf_p = adf.get("p_value")
    kpss_p = kpss.get("p_value")

    if adf_p is not None and kpss_p is not None:
        try:
            adf_p, kpss_p = float(adf_p), float(kpss_p)
            adf_stationary = adf_p < 0.05
            kpss_stationary = kpss_p >= 0.05
            if adf_stationary and kpss_stationary:
                insights.append(insight(
                    title=f"`{var_name}` : série stationnaire",
                    message=f"ADF (p = {_fmt_num(adf_p, 4)}) et KPSS (p = {_fmt_num(kpss_p, 4)}) confirment la stationnarité.",
                    severity=Severity.SUCCESS,
                    category=InsightCategory.STATIONARITY,
                    confidence=Confidence.HIGH,
                    variables=[var_name],
                    evidence={"adf_p": adf_p, "kpss_p": kpss_p},
                ))
            elif not adf_stationary and not kpss_stationary:
                insights.append(insight(
                    title=f"`{var_name}` : série non stationnaire",
                    message=f"ADF (p = {_fmt_num(adf_p, 4)}) et KPSS (p = {_fmt_num(kpss_p, 4)}) indiquent une non-stationnarité.",
                    severity=Severity.WARNING,
                    category=InsightCategory.STATIONARITY,
                    confidence=Confidence.HIGH,
                    suggestion="Appliquer une différenciation (1er ordre) ou un détrend.",
                    variables=[var_name],
                    evidence={"adf_p": adf_p, "kpss_p": kpss_p},
                ))
            else:
                insights.append(insight(
                    title=f"`{var_name}` : stationnarité ambiguë",
                    message=f"ADF et KPSS ne sont pas concordants (ADF p = {_fmt_num(adf_p, 4)}, KPSS p = {_fmt_num(kpss_p, 4)}).",
                    severity=Severity.METHODOLOGICAL,
                    category=InsightCategory.STATIONARITY,
                    confidence=Confidence.MEDIUM,
                    suggestion="La série est peut-être trend-stationary. Tester la détrendisation.",
                    variables=[var_name],
                ))
        except (TypeError, ValueError):
            pass

    # Saisonnalité
    decomp = results.get("decomposition") or {}
    period = decomp.get("period") or results.get("seasonal_period")
    if period and period > 1:
        period_label = {7: "hebdomadaire", 12: "mensuelle", 4: "trimestrielle", 24: "horaire", 365: "annuelle"}.get(
            int(period), f"de période {int(period)}"
        )
        seasonal_strength = decomp.get("seasonal_strength")
        if seasonal_strength is not None and float(seasonal_strength) >= 0.4:
            insights.append(insight(
                title=f"Saisonnalité {period_label} forte",
                message=f"La composante saisonnière capte {_fmt_pct(float(seasonal_strength))} de la variance résiduelle.",
                severity=Severity.INFO,
                category=InsightCategory.SEASONALITY,
                confidence=Confidence.HIGH,
                suggestion="Utiliser SARIMA ou Holt-Winters avec saisonnalité.",
                variables=[var_name],
                evidence={"period": int(period), "strength": float(seasonal_strength)},
            ))
        else:
            insights.append(insight(
                title=f"Période saisonnière {period_label} détectée",
                message=f"Période suggérée : {int(period)}.",
                severity=Severity.INFO,
                category=InsightCategory.SEASONALITY,
                confidence=Confidence.MEDIUM,
                variables=[var_name],
                evidence={"period": int(period)},
            ))

    # Meilleur modèle de prévision
    best_model = results.get("best_model") or {}
    if best_model:
        name = best_model.get("name") or best_model.get("type") or "modèle"
        aic = best_model.get("aic")
        rmse = best_model.get("rmse") or _safe(best_model, "metrics", "rmse")
        mape = best_model.get("mape") or _safe(best_model, "metrics", "mape")

        msg = f"Le meilleur modèle est **{name}**"
        details = []
        if aic is not None:
            details.append(f"AIC = {_fmt_num(float(aic), 1)}")
        if rmse is not None:
            details.append(f"RMSE = {_fmt_num(float(rmse), 3)}")
        if mape is not None:
            details.append(f"MAPE = {_fmt_num(float(mape), 1)}%")
        if details:
            msg += " (" + " • ".join(details) + ")"
        msg += "."

        insights.append(insight(
            title=f"Modèle de prévision retenu : {name}",
            message=msg,
            severity=Severity.SUCCESS,
            category=InsightCategory.MODEL_QUALITY,
            confidence=Confidence.HIGH,
            variables=[var_name],
            evidence={"model": name, "aic": aic, "rmse": rmse, "mape": mape},
        ))

    # Résidus
    resid = results.get("residual_diagnostics") or {}
    if isinstance(resid, dict):
        lb = resid.get("ljung_box") or {}
        jb = resid.get("jarque_bera") or {}
        lb_p = lb.get("p_value")
        jb_p = jb.get("p_value")
        if lb_p is not None and float(lb_p) < 0.05:
            insights.append(insight(
                title="Résidus auto-corrélés",
                message=f"Le test de Ljung-Box rejette l'indépendance (p = {_fmt_num(float(lb_p), 4)}).",
                severity=Severity.WARNING,
                category=InsightCategory.MODEL_QUALITY,
                confidence=Confidence.HIGH,
                suggestion="Augmenter l'ordre AR/MA ou ajouter une composante saisonnière.",
                variables=[var_name],
                evidence={"ljung_box_p": float(lb_p)},
            ))
        if jb_p is not None and float(jb_p) < 0.05:
            insights.append(insight(
                title="Résidus non normaux",
                message=f"Le test de Jarque-Bera rejette la normalité (p = {_fmt_num(float(jb_p), 4)}).",
                severity=Severity.INFO,
                category=InsightCategory.NORMALITY,
                confidence=Confidence.HIGH,
                suggestion="Les intervalles de confiance des prévisions doivent être interprétés avec prudence.",
                variables=[var_name],
                evidence={"jarque_bera_p": float(jb_p)},
            ))
    # ── Tutoriel Automatique ──
    insights.append(insight(
        title="💡 Comment interpréter une série temporelle ?",
        message="La **stationnarité** (Test ADF) indique si la série est stable dans le temps. Si elle ne l'est pas, les modèles comme ARIMA appliqueront des différences (le paramètre 'd') pour la stabiliser avant de prédire. La **décomposition** sépare la tendance (hausse/baisse globale) de la saisonnalité (motifs répétés).",
        severity=Severity.METHODOLOGICAL,
        category=InsightCategory.RECOMMENDATION,
        confidence=Confidence.HIGH,
        tags=["tutorial"],
    ))

    return sort_insights(insights)



def narrate_multivariate_timeseries(results: dict[str, Any]) -> list[Insight]:
    """Interprète une analyse TS multivariée (VAR/VECM/Granger/Johansen)."""
    insights: list[Insight] = []
    if not results:
        return insights

    # Granger
    granger = results.get("granger_causality") or {}
    if isinstance(granger, dict):
        sig = granger.get("significant_pairs") or granger.get("granger_significant") or []
        if sig:
            shown = sig[:5] if isinstance(sig, list) else []
            insights.append(insight(
                title=f"Causalité de Granger détectée ({len(sig)} relation{'s' if len(sig) > 1 else ''})",
                message=f"Relations causales significatives identifiées : {', '.join(str(s) for s in shown)}{'…' if len(sig) > 5 else ''}.",
                severity=Severity.INFO,
                category=InsightCategory.HYPOTHESIS,
                confidence=Confidence.HIGH,
                evidence={"n_significant": len(sig)},
            ))
        else:
            insights.append(insight(
                title="Aucune causalité de Granger significative",
                message="Aucune variable n'est statistiquement utile pour prédire les autres.",
                severity=Severity.INFO,
                category=InsightCategory.HYPOTHESIS,
                confidence=Confidence.MEDIUM,
            ))

    # Cointégration Johansen
    johansen = results.get("johansen_cointegration") or {}
    if isinstance(johansen, dict):
        rank = johansen.get("rank") or johansen.get("cointegration_rank")
        if rank is not None and int(rank) > 0:
            insights.append(insight(
                title=f"Cointégration détectée (rang {int(rank)})",
                message=f"Les séries partagent {int(rank)} relation(s) d'équilibre de long terme.",
                severity=Severity.INFO,
                category=InsightCategory.STATIONARITY,
                confidence=Confidence.HIGH,
                suggestion="Privilégier un modèle VECM plutôt qu'un VAR différencié.",
                evidence={"rank": int(rank)},
            ))

    # Stationnarité globale
    if results.get("all_stationary") is True:
        insights.append(insight(
            title="Toutes les séries sont stationnaires",
            message="Un modèle VAR en niveaux est approprié.",
            severity=Severity.SUCCESS,
            category=InsightCategory.STATIONARITY,
            confidence=Confidence.HIGH,
        ))
    elif results.get("all_stationary") is False:
        insights.append(insight(
            title="Au moins une série est non stationnaire",
            message="Différenciation ou VECM nécessaire selon la cointégration.",
            severity=Severity.WARNING,
            category=InsightCategory.STATIONARITY,
            confidence=Confidence.HIGH,
        ))

    # Modèles
    models = results.get("models") or {}
    if isinstance(models, dict) and models:
        # Trouver le meilleur par AIC
        scored = []
        for name, m in models.items():
            if isinstance(m, dict):
                aic = m.get("aic")
                if aic is not None:
                    try:
                        scored.append((name, float(aic)))
                    except (TypeError, ValueError):
                        continue
        if scored:
            scored.sort(key=lambda x: x[1])
            best = scored[0]
            insights.append(insight(
                title=f"Modèle multivarié retenu : {best[0]}",
                message=f"AIC = {_fmt_num(best[1], 1)} (meilleur parmi {len(scored)} modèles).",
                severity=Severity.SUCCESS,
                category=InsightCategory.MODEL_QUALITY,
                confidence=Confidence.HIGH,
                evidence={"model": best[0], "aic": best[1]},
            ))

    return sort_insights(insights)
