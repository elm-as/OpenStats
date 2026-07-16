from __future__ import annotations

from app.core.interpretation.base import (
    Insight,
    Severity,
    Confidence,
    InsightCategory,
    insight,
    sort_insights,
)


def narrate_diagnostics(advisories: list[dict]) -> list[Insight]:
    """Convertit les advisories existants en Insights."""
    insights: list[Insight] = []
    if not advisories:
        return insights

    sev_map = {
        "critical": Severity.CRITICAL,
        "warning": Severity.WARNING,
        "info": Severity.INFO,
        "methodological": Severity.METHODOLOGICAL,
    }
    cat_map = {
        "missing": InsightCategory.MISSING,
        "outliers": InsightCategory.OUTLIERS,
        "distribution": InsightCategory.DISTRIBUTION,
        "correlation": InsightCategory.CORRELATION,
        "multicollinearity": InsightCategory.MULTICOLLINEARITY,
        "quality": InsightCategory.DATA_QUALITY,
        "stationarity": InsightCategory.STATIONARITY,
    }

    for adv in advisories:
        if not isinstance(adv, dict):
            continue
        severity = sev_map.get(adv.get("severity", "info"), Severity.INFO)
        category = cat_map.get(adv.get("category", ""), InsightCategory.DATA_QUALITY)
        insights.append(insight(
            title=adv.get("title", "Diagnostic"),
            message=adv.get("message", ""),
            severity=severity,
            category=category,
            confidence=Confidence.HIGH,
            suggestion=adv.get("suggestion"),
            tags=[adv.get("category", "")],
        ))

    return sort_insights(insights)
