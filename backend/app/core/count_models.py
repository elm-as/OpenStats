"""Modeles de comptage : Poisson et binomiale negative.

Une variable de comptage (nombre de transactions, de reclamations, de visites)
traitee en regression lineaire produit des predictions negatives et des
intervalles de confiance faux : la loi normale suppose une variance constante,
alors qu'un comptage a une variance qui croit avec sa moyenne.

Le choix entre Poisson et binomiale negative ne se devine pas : il se teste.
Poisson impose variance = moyenne ; quand la dispersion observee depasse cette
contrainte, les erreurs standard de Poisson sont trop petites et des
coefficients paraissent significatifs sans l'etre. On mesure donc la
surdispersion, et on bascule si elle est averee.
"""

from __future__ import annotations

import re
from typing import Any

import numpy as np
import pandas as pd

# Au-dela de ce rapport variance/moyenne residuel, Poisson est trop contraint.
SEUIL_SURDISPERSION = 1.5


NOM_COMPTAGE = re.compile(r"(?:^|[_\s])(nb|nombre|count|n|effectif|quantite|qte|freq)(?:$|[_\s])")


def est_comptage(serie: pd.Series, nom: str = "") -> bool:
    """Une serie d'entiers positifs qui se comporte comme un denombrement.

    Le test structurel ne suffit pas : un age est aussi un entier positif. On
    exige donc que la variable descende vers les petites valeurs — ce que fait
    un comptage et pas une mesure de position — ou que son nom l'annonce.
    """
    valeurs = pd.to_numeric(serie, errors="coerce").dropna()
    if valeurs.empty or len(valeurs) < 20:
        return False
    if (valeurs < 0).any() or not np.allclose(valeurs, valeurs.round()):
        return False
    if not 3 <= valeurs.nunique() <= max(50, int(0.2 * len(valeurs))):
        return False

    nom_parlant = bool(NOM_COMPTAGE.search((nom or str(getattr(serie, "name", ""))).lower()))
    atteint_les_petites_valeurs = float(valeurs.min()) <= 3
    return nom_parlant or atteint_les_petites_valeurs


def _tableau_coefficients(ajuste, familles_log: bool = True) -> list[dict[str, Any]]:
    """Coefficients avec leur ratio de taux d'incidence (exp du coefficient)."""
    lignes = []
    for nom in ajuste.params.index:
        coefficient = float(ajuste.params[nom])
        lignes.append({
            "variable": nom,
            "coefficient": round(coefficient, 6),
            # exp(beta) se lit directement : « +1 unite multiplie le compte par ... »
            "incidence_rate_ratio": round(float(np.exp(coefficient)), 4) if familles_log else None,
            "std_error": round(float(ajuste.bse[nom]), 6),
            "p_value": round(float(ajuste.pvalues[nom]), 6),
            "significant": bool(ajuste.pvalues[nom] < 0.05),
        })
    return lignes


def ajuster_modele_comptage(
    df: pd.DataFrame,
    target_col: str,
    covariates: list[str],
    exposure_col: str | None = None,
) -> dict[str, Any]:
    """Ajuste un Poisson, mesure la surdispersion, bascule si necessaire.

    `exposure_col` permet de modeliser un taux plutot qu'un effectif brut
    (nombre d'incidents pour une duree d'exposition donnee).
    """
    import statsmodels.api as sm

    colonnes = [target_col] + [c for c in covariates if c != target_col]
    if exposure_col:
        colonnes.append(exposure_col)
    donnees = df[colonnes].dropna()

    if len(donnees) < 20:
        return {"status": "error", "error": "Au moins 20 observations complètes sont requises"}

    y = pd.to_numeric(donnees[target_col], errors="coerce")
    if (y < 0).any():
        return {"status": "error",
                "error": f"'{target_col}' contient des valeurs négatives : ce n'est pas un comptage"}

    X = pd.get_dummies(donnees[[c for c in covariates if c != target_col]],
                       drop_first=True, dtype=float)
    if X.empty:
        return {"status": "error", "error": "Au moins une covariable est requise"}
    X = sm.add_constant(X, has_constant="add")

    offset = None
    if exposure_col:
        expositions = pd.to_numeric(donnees[exposure_col], errors="coerce")
        if (expositions <= 0).any():
            return {"status": "error", "error": "L'exposition doit être strictement positive"}
        offset = np.log(expositions)

    poisson = sm.GLM(y, X, family=sm.families.Poisson(), offset=offset).fit()

    # Surdispersion : chi2 de Pearson rapporte aux degres de liberte.
    dispersion = float(poisson.pearson_chi2 / poisson.df_resid) if poisson.df_resid else float("nan")
    surdisperse = bool(np.isfinite(dispersion) and dispersion > SEUIL_SURDISPERSION)

    resultat: dict[str, Any] = {
        "status": "success",
        "target_column": target_col,
        "covariates": [c for c in covariates if c != target_col],
        "exposure_column": exposure_col,
        "n_observations": int(len(donnees)),
        "mean_count": round(float(y.mean()), 4),
        "variance_count": round(float(y.var()), 4),
        "dispersion": round(dispersion, 4) if np.isfinite(dispersion) else None,
        "overdispersed": surdisperse,
        "poisson": {
            "coefficients": _tableau_coefficients(poisson),
            "aic": round(float(poisson.aic), 2),
            "log_likelihood": round(float(poisson.llf), 2),
            "pseudo_r2": round(float(1 - poisson.deviance / poisson.null_deviance), 4)
            if poisson.null_deviance else None,
        },
    }

    if surdisperse:
        try:
            alpha = max(1e-6, (dispersion - 1) / max(float(y.mean()), 1e-9))
            binomiale = sm.GLM(y, X,
                               family=sm.families.NegativeBinomial(alpha=alpha),
                               offset=offset).fit()
            resultat["negative_binomial"] = {
                "alpha": round(float(alpha), 6),
                "coefficients": _tableau_coefficients(binomiale),
                "aic": round(float(binomiale.aic), 2),
                "log_likelihood": round(float(binomiale.llf), 2),
            }
        except Exception as e:
            resultat["negative_binomial"] = {"error": str(e)}

    retenu = "negative_binomial" if surdisperse and "error" not in resultat.get(
        "negative_binomial", {"error": 1}) else "poisson"
    resultat["selected_model"] = retenu
    resultat["interpretation"] = (
        f"Dispersion résiduelle = {resultat['dispersion']}. "
        + ("Supérieure à 1 : la variance dépasse la moyenne, les erreurs standard de "
           "Poisson seraient trop optimistes — binomiale négative retenue."
           if surdisperse else
           "Proche de 1 : l'hypothèse de Poisson (variance = moyenne) tient.")
    )
    return resultat
