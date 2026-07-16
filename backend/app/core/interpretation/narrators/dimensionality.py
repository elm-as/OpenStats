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
from app.core.interpretation.narrators._helpers import _fmt_pct, _fmt_num


def narrate_pca(results: dict[str, Any]) -> list[Insight]:
    """Interprète une ACP."""
    insights: list[Insight] = []
    if not results:
        return insights

    explained = results.get("explained_variance_ratio") or results.get("variance_explained") or []
    if isinstance(explained, list) and explained:
        try:
            ev = [float(x) for x in explained]
        except (TypeError, ValueError):
            ev = []

        if ev:
            cumul = []
            s = 0.0
            for v in ev:
                s += v
                cumul.append(s)

            # Composantes nécessaires pour 80% de variance
            k80 = next((i + 1 for i, c in enumerate(cumul) if c >= 0.8), len(cumul))
            k90 = next((i + 1 for i, c in enumerate(cumul) if c >= 0.9), len(cumul))

            # PC1 et PC2
            pc1 = ev[0]
            pc2 = ev[1] if len(ev) > 1 else 0
            pc12 = pc1 + pc2

            insights.append(insight(
                title=f"PC1+PC2 expliquent {_fmt_pct(pc12)} de la variance",
                message=f"La première composante porte {_fmt_pct(pc1)}, la seconde {_fmt_pct(pc2)}. Plan factoriel principal pertinent.",
                severity=Severity.SUCCESS if pc12 >= 0.5 else Severity.INFO,
                category=InsightCategory.DIMENSIONALITY,
                confidence=Confidence.HIGH,
                evidence={"pc1": pc1, "pc2": pc2, "pc12": pc12},
            ))

            insights.append(insight(
                title=f"{k80} composantes capturent 80% de la variance",
                message=f"Réduction effective : de {len(ev)} variables à {k80} composantes principales (90% : {k90}).",
                severity=Severity.INFO,
                category=InsightCategory.DIMENSIONALITY,
                confidence=Confidence.HIGH,
                suggestion=f"Conserver {k80} composantes pour la modélisation downstream." if k80 < len(ev) else None,
                evidence={"k80": k80, "k90": k90, "total": len(ev)},
            ))

    # Variables les mieux représentées sur PC1
    coords = results.get("variable_coords") or results.get("loadings") or {}
    if isinstance(coords, dict) and coords:
        try:
            scored = []
            for var, vec in coords.items():
                if isinstance(vec, (list, tuple)) and len(vec) >= 1:
                    scored.append((var, abs(float(vec[0]))))
                elif isinstance(vec, dict):
                    pc1_val = vec.get("PC1") or vec.get("Dim1") or vec.get("0")
                    if pc1_val is not None:
                        scored.append((var, abs(float(pc1_val))))
            scored.sort(key=lambda x: -x[1])
            top3 = scored[:3]
            if top3 and top3[0][1] > 0.5:
                vars_str = ", ".join(f"`{v}`" for v, _ in top3)
                insights.append(insight(
                    title="Variables structurantes de PC1",
                    message=f"Les variables les plus corrélées à la première composante sont : {vars_str}.",
                    severity=Severity.INFO,
                    category=InsightCategory.FEATURE_IMPORTANCE,
                    confidence=Confidence.HIGH,
                    variables=[v for v, _ in top3],
                ))
        except (TypeError, ValueError):
            pass

    return sort_insights(insights)


def narrate_ca(results: dict[str, Any]) -> list[Insight]:
    """Interprète une AFC."""
    insights: list[Insight] = []
    if not results:
        return insights

    chi2 = results.get("chi2") or results.get("chi_square")
    pvalue = results.get("p_value") or results.get("pvalue")
    inertia = results.get("total_inertia")

    if pvalue is not None:
        try:
            p = float(pvalue)
            if p < 0.05:
                insights.append(insight(
                    title="Association significative entre les variables",
                    message=f"Le test du Chi² confirme une association (p = {_fmt_num(p, 4)}). L'AFC est interprétable.",
                    severity=Severity.SUCCESS,
                    category=InsightCategory.CORRELATION,
                    confidence=Confidence.HIGH,
                    evidence={"chi2": chi2, "p_value": p, "inertia": inertia},
                ))
            else:
                insights.append(insight(
                    title="Variables peu liées",
                    message=f"Le Chi² n'est pas significatif (p = {_fmt_num(p, 4)}). L'AFC peut être peu informative.",
                    severity=Severity.WARNING,
                    category=InsightCategory.CORRELATION,
                    confidence=Confidence.HIGH,
                ))
        except (TypeError, ValueError):
            pass

    explained = results.get("explained_variance_ratio") or []
    if isinstance(explained, list) and len(explained) >= 2:
        try:
            pc12 = float(explained[0]) + float(explained[1])
            insights.append(insight(
                title=f"Plan factoriel : {_fmt_pct(pc12)} de l'inertie",
                message=f"Axe 1 : {_fmt_pct(float(explained[0]))} • Axe 2 : {_fmt_pct(float(explained[1]))}.",
                severity=Severity.INFO,
                category=InsightCategory.DIMENSIONALITY,
                confidence=Confidence.HIGH,
            ))
        except (TypeError, ValueError):
            pass

    return insights


def narrate_mca(results: dict[str, Any]) -> list[Insight]:
    """Interprète une ACM (similaire à AFC mais sur η²)."""
    insights: list[Insight] = []
    if not results:
        return insights

    explained = results.get("explained_variance_ratio") or results.get("inertia_ratio") or []
    if isinstance(explained, list) and explained:
        try:
            ev = [float(x) for x in explained]
            pc12 = sum(ev[:2])
            insights.append(insight(
                title=f"Plan factoriel ACM : {_fmt_pct(pc12)}",
                message=f"Premier plan factoriel : {' + '.join(_fmt_pct(v) for v in ev[:2])}.",
                severity=Severity.INFO if pc12 >= 0.3 else Severity.WARNING,
                category=InsightCategory.DIMENSIONALITY,
                confidence=Confidence.HIGH,
            ))
        except (TypeError, ValueError):
            pass

    # η² : variables structurantes
    eta2 = results.get("eta2") or {}
    if isinstance(eta2, dict) and eta2:
        try:
            scored = []
            for var, vec in eta2.items():
                if isinstance(vec, (list, tuple)) and vec:
                    scored.append((var, float(vec[0])))
                elif isinstance(vec, dict):
                    v = vec.get("Dim1") or vec.get("0") or vec.get("PC1")
                    if v is not None:
                        scored.append((var, float(v)))
            scored.sort(key=lambda x: -x[1])
            top3 = scored[:3]
            if top3 and top3[0][1] > 0.1:
                vars_str = ", ".join(f"`{v}` (η²={_fmt_num(s, 2)})" for v, s in top3)
                insights.append(insight(
                    title="Variables structurant l'axe 1",
                    message=f"Les variables les plus liées à l'axe 1 : {vars_str}.",
                    severity=Severity.INFO,
                    category=InsightCategory.FEATURE_IMPORTANCE,
                    confidence=Confidence.HIGH,
                    variables=[v for v, _ in top3],
                ))
        except (TypeError, ValueError):
            pass

    return insights
