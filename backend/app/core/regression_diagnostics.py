"""Diagnostics d'une regression : les hypotheses tiennent-elles ?

Un R2 eleve ne dit rien de la validite des erreurs standard, donc rien de la
fiabilite des p-values. Ces tests existaient deja dans le projet, mais noyes
dans la sortie d'un modele : ce module les rassemble en un verdict lisible,
avec pour chaque probleme la consequence concrete et le remede.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

SEUIL = 0.05


def _verdict(nom: str, p_value: float | None, consequence: str, remede: str) -> dict[str, Any]:
    respectee = bool(p_value is not None and p_value >= SEUIL)
    return {
        "hypothese": nom,
        "p_value": round(float(p_value), 6) if p_value is not None else None,
        "respectee": respectee,
        "consequence": None if respectee else consequence,
        "remede": None if respectee else remede,
    }


def diagnostiquer_regression(
    df: pd.DataFrame,
    target_col: str,
    feature_cols: list[str],
) -> dict[str, Any]:
    """Ajuste une regression MCO et confronte ses hypotheses aux donnees."""
    import statsmodels.api as sm
    from statsmodels.stats.diagnostic import acorr_ljungbox, het_breuschpagan, linear_reset
    from statsmodels.stats.stattools import durbin_watson, jarque_bera

    colonnes = [target_col] + [c for c in feature_cols if c != target_col]
    donnees = df[colonnes].dropna()
    if len(donnees) < 20:
        return {"status": "error", "error": "Au moins 20 observations complètes sont requises"}

    y = pd.to_numeric(donnees[target_col], errors="coerce")
    X = pd.get_dummies(donnees[[c for c in colonnes if c != target_col]],
                       drop_first=True, dtype=float)
    if X.empty:
        return {"status": "error", "error": "Au moins une variable explicative est requise"}
    X = sm.add_constant(X, has_constant="add")

    modele = sm.OLS(y, X).fit()
    residus = modele.resid

    _, p_bp, _, _ = het_breuschpagan(residus, modele.model.exog)
    _, p_jb = jarque_bera(residus)[:2]
    dw = float(durbin_watson(residus))
    p_ljung = float(acorr_ljungbox(residus, lags=[min(10, max(1, len(residus) // 5))],
                                   return_df=True)["lb_pvalue"].iloc[0])
    try:
        p_reset = float(linear_reset(modele, power=2, use_f=True).pvalue)
    except Exception:
        p_reset = None

    hypotheses = [
        _verdict("Homoscédasticité (Breusch-Pagan)", float(p_bp),
                 "Les erreurs standard sont biaisées, donc les p-values ne sont pas fiables.",
                 "Utiliser des erreurs robustes (HC1) ou modéliser log(cible)."),
        _verdict("Normalité des résidus (Jarque-Bera)", float(p_jb),
                 "Les intervalles de confiance sont approximatifs sur petit échantillon.",
                 "Sans conséquence au-delà de ~100 observations ; sinon, transformer la cible."),
        _verdict("Indépendance des résidus (Ljung-Box)", p_ljung,
                 "Les observations voisines se ressemblent : l'information est surestimée "
                 "et les p-values trop favorables.",
                 "Erreurs Newey-West, ou modèle temporel si les données sont ordonnées."),
        _verdict("Forme fonctionnelle (RESET de Ramsey)", p_reset,
                 "La relation n'est pas linéaire : les coefficients estiment une pente "
                 "qui n'existe pas telle quelle.",
                 "Ajouter un terme quadratique, une interaction, ou transformer une variable."),
    ]

    # Durbin-Watson se lit sur une echelle, pas par une p-value : 2 = pas
    # d'autocorrelation, en dessous de 1.5 ou au-dessus de 2.5 = suspect.
    autocorrelation_dw = "aucune" if 1.5 <= dw <= 2.5 else (
        "positive" if dw < 1.5 else "négative")

    violees = [h for h in hypotheses if h["p_value"] is not None and not h["respectee"]]

    return {
        "status": "success",
        "target_column": target_col,
        "n_observations": int(len(donnees)),
        "r_squared": round(float(modele.rsquared), 4),
        "r_squared_adj": round(float(modele.rsquared_adj), 4),
        "durbin_watson": round(dw, 4),
        "autocorrelation": autocorrelation_dw,
        "hypotheses": hypotheses,
        "n_violations": len(violees),
        "interpretation": (
            "Toutes les hypothèses testées sont compatibles avec les données : "
            "les p-values du modèle peuvent être lues telles quelles."
            if not violees else
            f"{len(violees)} hypothèse(s) en défaut ({', '.join(h['hypothese'].split(' (')[0] for h in violees)}) : "
            "les p-values du modèle sont à interpréter avec la correction indiquée."
        ),
    }
