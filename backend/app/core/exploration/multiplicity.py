"""
Contrôle de la multiplicité des tests sur une session d'exploration.

Une boucle qui cherche « jusqu'à trouver quelque chose » teste des dizaines
d'hypothèses : sans correction, une partie des découvertes est du bruit. Le
contrôle est appliqué **globalement à la session**, pas par sonde.
"""

from __future__ import annotations

from app.core.exploration.finding import Finding


def benjamini_hochberg(p_values: list[float], alpha: float = 0.05) -> tuple[list[float], list[bool]]:
    """Procédure de Benjamini-Hochberg : renvoie (q-values, rejets) dans l'ordre d'entrée.

    Contrôle le taux de fausses découvertes (FDR) plutôt que le taux d'erreur
    familial : moins conservateur que Bonferroni, adapté à l'exploration.
    Le calcul est délégué à statsmodels, déjà dépendance du projet.
    """
    if not p_values:
        return [], []

    from statsmodels.stats.multitest import multipletests

    rejected, q_values, _, _ = multipletests(p_values, alpha=alpha, method="fdr_bh")
    return [round(float(q), 6) for q in q_values], [bool(r) for r in rejected]


def apply_fdr(findings: list[Finding], alpha: float = 0.05) -> dict[str, int]:
    """Annote chaque Finding testable avec sa q-value et son statut FDR.

    Les findings sans p-value (mesures descriptives : information mutuelle,
    importance de variable) ne sont pas testés — ils gardent survives_fdr=None
    et sont signalés comme descriptifs à l'affichage.
    """
    testable = [f for f in findings if f.p_value is not None]
    q_values, rejected = benjamini_hochberg([f.p_value for f in testable], alpha=alpha)  # type: ignore[misc]

    for finding, q, keep in zip(testable, q_values, rejected):
        finding.q_value = q
        finding.survives_fdr = keep

    return {
        "tested": len(testable),
        "descriptive": len(findings) - len(testable),
        "surviving": sum(1 for f in testable if f.survives_fdr),
        "alpha": alpha,
    }
