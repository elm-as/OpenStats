"""Regression quantile : l'effet sur la mediane et sur les queues.

Les moindres carres decrivent la moyenne conditionnelle. Or un effet peut etre
nul au centre de la distribution et fort a ses extremites : une action qui ne
change rien au client median peut transformer les gros clients. La moyenne
masque cette heterogeneite, et elle est de surcroit sensible aux valeurs
extremes — la mediane ne l'est pas.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

QUANTILES_PAR_DEFAUT = (0.1, 0.25, 0.5, 0.75, 0.9)


def ajuster_regression_quantile(
    df: pd.DataFrame,
    target_col: str,
    feature_cols: list[str],
    quantiles: tuple[float, ...] | list[float] = QUANTILES_PAR_DEFAUT,
) -> dict[str, Any]:
    """Ajuste une regression pour chaque quantile demande."""
    import statsmodels.api as sm

    quantiles = [q for q in quantiles if 0 < q < 1]
    if not quantiles:
        return {"status": "error", "error": "Aucun quantile valide (attendu entre 0 et 1)"}

    colonnes = [target_col] + [c for c in feature_cols if c != target_col]
    donnees = df[colonnes].dropna()
    if len(donnees) < 30:
        return {"status": "error", "error": "Au moins 30 observations complètes sont requises"}

    y = pd.to_numeric(donnees[target_col], errors="coerce")
    X = pd.get_dummies(donnees[[c for c in colonnes if c != target_col]],
                       drop_first=True, dtype=float)
    if X.empty:
        return {"status": "error", "error": "Au moins une variable explicative est requise"}
    X = sm.add_constant(X, has_constant="add")

    modele = sm.QuantReg(y, X)
    par_quantile = []
    for q in sorted(quantiles):
        try:
            ajuste = modele.fit(q=q)
        except Exception as e:
            par_quantile.append({"quantile": q, "error": str(e)})
            continue
        par_quantile.append({
            "quantile": q,
            "pseudo_r2": round(float(ajuste.prsquared), 4),
            "coefficients": [
                {
                    "variable": nom,
                    "coefficient": round(float(ajuste.params[nom]), 6),
                    "std_error": round(float(ajuste.bse[nom]), 6),
                    "p_value": round(float(ajuste.pvalues[nom]), 6),
                    "significant": bool(ajuste.pvalues[nom] < 0.05),
                }
                for nom in ajuste.params.index
            ],
        })

    mco = sm.OLS(y, X).fit()
    variables = [v for v in mco.params.index if v != "const"]

    # Un effet qui change de signe ou d'ampleur selon le quantile est le
    # signe que la moyenne resume mal la relation.
    heterogeneite = []
    for variable in variables:
        valeurs = [
            (bloc["quantile"], c["coefficient"])
            for bloc in par_quantile if "coefficients" in bloc
            for c in bloc["coefficients"] if c["variable"] == variable
        ]
        if len(valeurs) < 2:
            continue
        coefficients = [v for _, v in valeurs]
        amplitude = max(coefficients) - min(coefficients)
        reference = abs(float(mco.params[variable])) or 1e-9
        heterogeneite.append({
            "variable": variable,
            "coefficient_moyenne_mco": round(float(mco.params[variable]), 6),
            "coefficient_min": round(min(coefficients), 6),
            "coefficient_max": round(max(coefficients), 6),
            "amplitude_relative": round(amplitude / reference, 4),
            "change_de_signe": bool(min(coefficients) < 0 < max(coefficients)),
        })

    heterogeneite.sort(key=lambda h: -h["amplitude_relative"])
    marquantes = [h for h in heterogeneite if h["amplitude_relative"] > 0.5]

    return {
        "status": "success",
        "target_column": target_col,
        "n_observations": int(len(donnees)),
        "quantiles": sorted(quantiles),
        "par_quantile": par_quantile,
        "heterogeneite": heterogeneite,
        "interpretation": (
            f"{len(marquantes)} variable(s) ont un effet nettement différent selon le "
            f"quantile ({', '.join(h['variable'] for h in marquantes[:3])}) : la régression "
            "sur la moyenne en donne une image incomplète."
            if marquantes else
            "Les effets sont stables d'un quantile à l'autre : la régression sur la "
            "moyenne résume correctement la relation."
        ),
    }
