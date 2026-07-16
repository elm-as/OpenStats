from __future__ import annotations

from typing import Any

from app.core.interpretation.base import (
    Insight,
    Severity,
    Confidence,
    InsightCategory,
    insight,
)
from app.core.interpretation.narrators._helpers import _fmt_num


def narrate_hypothesis_test(test_result: dict[str, Any]) -> list[Insight]:
    """Interprète le résultat d'un test (T-test, ANOVA, Chi², corrélation...)."""
    insights: list[Insight] = []
    if not test_result:
        return insights

    test_name = test_result.get("test") or test_result.get("test_name") or "Test"
    pvalue = test_result.get("p_value") or test_result.get("pvalue")
    stat = test_result.get("statistic")
    effect_size = test_result.get("effect_size") or test_result.get("eta_squared") or test_result.get("cohens_d")
    alpha = test_result.get("alpha", 0.05)
    variables = test_result.get("variables") or []

    if pvalue is None:
        return insights

    pvalue = float(pvalue)
    significant = pvalue < alpha

    if significant:
        msg = f"Le test **{test_name}** est significatif (p = {_fmt_num(pvalue, 4)} < {alpha})."
        if effect_size is not None:
            es = float(effect_size)
            magnitude = "faible" if abs(es) < 0.2 else "moyen" if abs(es) < 0.5 else "fort"
            msg += f" Taille d'effet **{magnitude}** ({_fmt_num(es, 3)})."
        insights.append(insight(
            title=f"{test_name} : effet significatif",
            message=msg,
            severity=Severity.SUCCESS,
            category=InsightCategory.HYPOTHESIS,
            confidence=Confidence.HIGH,
            variables=variables,
            evidence={"p_value": pvalue, "statistic": stat, "effect_size": effect_size},
        ))
    else:
        insights.append(insight(
            title=f"{test_name} : pas d'effet significatif",
            message=f"p = {_fmt_num(pvalue, 4)} ≥ {alpha}. L'hypothèse nulle ne peut être rejetée.",
            severity=Severity.INFO,
            category=InsightCategory.HYPOTHESIS,
            confidence=Confidence.HIGH,
            suggestion="Vérifier la puissance statistique (taille d'échantillon).",
            variables=variables,
            evidence={"p_value": pvalue, "statistic": stat},
        ))

    return insights
