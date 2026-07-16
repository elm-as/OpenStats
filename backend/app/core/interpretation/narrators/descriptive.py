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


def narrate_descriptive(results: dict[str, Any]) -> list[Insight]:
    """Interprète les statistiques descriptives par variable."""
    insights: list[Insight] = []

    for col, stats in (results or {}).items():
        if not isinstance(stats, dict):
            continue
        if stats.get("type") != "numeric":
            # Catégorielle : cardinalité
            n_unique = stats.get("unique_count") or stats.get("cardinality")
            count = stats.get("count")
            if n_unique and count and n_unique > 0.8 * count:
                insights.append(insight(
                    title=f"`{col}` quasi-identifiant",
                    message=f"La variable `{col}` possède {n_unique} modalités pour {count} observations (cardinalité ~{_fmt_pct(n_unique/count)}). Elle se comporte comme un identifiant.",
                    severity=Severity.WARNING,
                    category=InsightCategory.DATA_QUALITY,
                    confidence=Confidence.HIGH,
                    suggestion="Exclure de la modélisation ou agréger en catégories.",
                    variables=[col],
                    evidence={"unique": int(n_unique), "n": int(count)},
                ))
            continue

        skew = stats.get("skewness")
        kurt = stats.get("kurtosis")
        cv = stats.get("cv")
        null_rate = stats.get("null_rate")
        n = stats.get("count")

        # Asymétrie
        if skew is not None and n and n >= 30:
            if abs(skew) >= 2:
                direction = "positive" if skew > 0 else "négative"
                insights.append(insight(
                    title=f"`{col}` fortement asymétrique",
                    message=f"Distribution très asymétrique {direction} (skewness = {_fmt_num(skew, 2)}). Les statistiques basées sur la moyenne sont peu fiables.",
                    severity=Severity.WARNING,
                    category=InsightCategory.DISTRIBUTION,
                    confidence=Confidence.HIGH,
                    suggestion=(
                        "Appliquer une transformation log/Yeo-Johnson"
                        if skew > 0 else "Tester une transformation x² ou Yeo-Johnson"
                    ),
                    variables=[col],
                    evidence={"skewness": float(skew)},
                ))
            elif abs(skew) >= 1:
                insights.append(insight(
                    title=f"`{col}` modérément asymétrique",
                    message=f"Asymétrie modérée (skewness = {_fmt_num(skew, 2)}). À surveiller selon les hypothèses des tests utilisés.",
                    severity=Severity.INFO,
                    category=InsightCategory.DISTRIBUTION,
                    confidence=Confidence.MEDIUM,
                    variables=[col],
                    evidence={"skewness": float(skew)},
                ))

        # Kurtosis
        if kurt is not None and n and n >= 30 and abs(kurt) >= 3:
            shape = "leptokurtique (queues lourdes, outliers possibles)" if kurt > 0 else "platikurtique (distribution aplatie)"
            insights.append(insight(
                title=f"`{col}` : kurtosis élevée",
                message=f"Distribution {shape} (kurtosis = {_fmt_num(kurt, 2)}).",
                severity=Severity.INFO,
                category=InsightCategory.DISTRIBUTION,
                confidence=Confidence.MEDIUM,
                suggestion="Envisager winsorisation ou tests non-paramétriques." if kurt > 0 else None,
                variables=[col],
                evidence={"kurtosis": float(kurt)},
            ))

        # CV : variabilité relative
        if cv is not None and abs(cv) > 100:
            insights.append(insight(
                title=f"`{col}` très volatile",
                message=f"Coefficient de variation = {_fmt_num(cv, 1)}%. La variabilité dépasse la moyenne, suggérant une distribution très étalée ou des outliers.",
                severity=Severity.INFO,
                category=InsightCategory.DISTRIBUTION,
                confidence=Confidence.MEDIUM,
                variables=[col],
                evidence={"cv": float(cv)},
            ))

        # Valeurs manquantes
        if null_rate is not None and null_rate >= 0.5:
            insights.append(insight(
                title=f"`{col}` quasi-vide ({_fmt_pct(null_rate)})",
                message=f"Plus de la moitié des valeurs sont manquantes ({_fmt_pct(null_rate)}).",
                severity=Severity.CRITICAL,
                category=InsightCategory.MISSING,
                confidence=Confidence.HIGH,
                suggestion="Exclure la variable ou utiliser une imputation avancée (MICE).",
                variables=[col],
                evidence={"null_rate": float(null_rate)},
            ))
        elif null_rate is not None and null_rate >= 0.2:
            insights.append(insight(
                title=f"`{col}` : {_fmt_pct(null_rate)} de manquants",
                message=f"Taux de valeurs manquantes significatif ({_fmt_pct(null_rate)}).",
                severity=Severity.WARNING,
                category=InsightCategory.MISSING,
                confidence=Confidence.HIGH,
                suggestion="Imputer (médiane, KNN, MICE) ou documenter la cause.",
                variables=[col],
                evidence={"null_rate": float(null_rate)},
            ))

    return sort_insights(insights)


def narrate_correlations(results: dict[str, Any]) -> list[Insight]:
    """Interprète les matrices de corrélation (Pearson/Spearman)."""
    insights: list[Insight] = []

    if not results:
        return insights

    for method in ("pearson", "spearman", "kendall"):
        mat = results.get(method) or results.get(f"{method}_matrix")
        if not isinstance(mat, dict):
            continue

        # Convertir en paires sans doublon
        pairs: list[tuple[str, str, float]] = []
        seen = set()
        for row, cols in mat.items():
            if not isinstance(cols, dict):
                continue
            for col, val in cols.items():
                if row == col or val is None:
                    continue
                key = tuple(sorted((row, col)))
                if key in seen:
                    continue
                seen.add(key)
                try:
                    pairs.append((row, col, float(val)))
                except (TypeError, ValueError):
                    continue

        if not pairs:
            continue

        # Top corrélations
        pairs.sort(key=lambda x: -abs(x[2]))

        strong = [p for p in pairs if abs(p[2]) >= 0.7]
        moderate = [p for p in pairs if 0.4 <= abs(p[2]) < 0.7]

        for row, col, r in strong[:5]:
            direction = "positive" if r > 0 else "négative"
            interp = "très forte" if abs(r) >= 0.9 else "forte"
            insights.append(insight(
                title=f"Corrélation {interp} : `{row}` ↔ `{col}`",
                message=f"Corrélation {direction} {interp} ({method} r = {_fmt_num(r, 3)}). Les deux variables évoluent {'dans le même sens' if r > 0 else 'en sens opposé'}.",
                severity=Severity.WARNING if abs(r) >= 0.9 else Severity.INFO,
                category=InsightCategory.CORRELATION,
                confidence=Confidence.HIGH,
                suggestion=(
                    "Risque de multicolinéarité : envisager d'en retirer une avant la régression."
                    if abs(r) >= 0.9 else None
                ),
                variables=[row, col],
                evidence={"r": float(r), "method": method},
                tags=[method],
            ))

        if not strong and moderate:
            row, col, r = moderate[0]
            insights.append(insight(
                title="Aucune corrélation forte détectée",
                message=f"La corrélation la plus élevée est {_fmt_num(r, 2)} ({method}) entre `{row}` et `{col}`. Les variables sont relativement indépendantes.",
                severity=Severity.INFO,
                category=InsightCategory.CORRELATION,
                confidence=Confidence.MEDIUM,
                evidence={"max_r": float(r), "method": method},
            ))

        # On ne traite qu'une méthode (priorité Pearson)
        break

    return sort_insights(insights)


def narrate_vif(vif_results: dict[str, Any] | list[dict]) -> list[Insight]:
    """Interprète les VIF."""
    insights: list[Insight] = []
    if not vif_results:
        return insights

    # Normalisation : accepte dict {col: vif} ou list[{variable, vif}]
    items: list[tuple[str, float]] = []
    if isinstance(vif_results, dict):
        for k, v in vif_results.items():
            try:
                items.append((k, float(v)))
            except (TypeError, ValueError):
                continue
    elif isinstance(vif_results, list):
        for entry in vif_results:
            col = entry.get("variable") or entry.get("name") or entry.get("col")
            val = entry.get("vif") or entry.get("value")
            if col and val is not None:
                try:
                    items.append((col, float(val)))
                except (TypeError, ValueError):
                    continue

    if not items:
        return insights

    items.sort(key=lambda x: -x[1])
    max_var, max_vif = items[0]

    if max_vif >= 10:
        insights.append(insight(
            title="Multicolinéarité sévère",
            message=f"`{max_var}` a un VIF de {_fmt_num(max_vif, 1)} (seuil critique = 10). La régression linéaire est compromise : les coefficients seront instables.",
            severity=Severity.CRITICAL,
            category=InsightCategory.MULTICOLLINEARITY,
            confidence=Confidence.HIGH,
            suggestion="Retirer la variable la plus redondante, appliquer une ACP, ou utiliser Ridge/Lasso.",
            variables=[max_var],
            evidence={"max_vif": float(max_vif), "n_critical": sum(1 for _, v in items if v >= 10)},
        ))
    elif max_vif >= 5:
        insights.append(insight(
            title="Multicolinéarité modérée",
            message=f"VIF max = {_fmt_num(max_vif, 1)} sur `{max_var}` (seuil d'attention = 5).",
            severity=Severity.WARNING,
            category=InsightCategory.MULTICOLLINEARITY,
            confidence=Confidence.HIGH,
            suggestion="Standardiser les variables ou tester une régression régularisée.",
            variables=[max_var],
            evidence={"max_vif": float(max_vif)},
        ))
    else:
        insights.append(insight(
            title="Pas de multicolinéarité problématique",
            message=f"Tous les VIF sont sous 5 (max = {_fmt_num(max_vif, 1)} sur `{max_var}`). Les variables explicatives sont suffisamment indépendantes.",
            severity=Severity.SUCCESS,
            category=InsightCategory.MULTICOLLINEARITY,
            confidence=Confidence.HIGH,
            evidence={"max_vif": float(max_vif)},
        ))

    return insights
