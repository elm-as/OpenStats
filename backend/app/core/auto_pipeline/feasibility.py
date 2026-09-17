"""Ce que le profil permet de poser, et pourquoi il l'interdit parfois.

Une etape retiree sans explication est indiscernable d'une etape oubliee :
ce module produit le message qui manque.
"""

from __future__ import annotations

import re

from app.core.auto_pipeline.detector import DatasetProfile
from app.core.auto_pipeline.pipeline_schema import PipelineStep

ANALYSES_TEMPORELLES = (
    "stationarity", "cointegration", "timeseries_forecast", "timeseries_multivariate",
)


def message_sans_colonne_temporelle(profile: DatasetProfile, demandees: list[str]) -> str:
    """Explique l'absence d'etape temporelle, et nomme la colonne a forcer.

    Une colonne dont le nom evoque une date mais dont le format n'a pas ete
    reconnu est le cas le plus frequent : on la designe explicitement plutot
    que de laisser l'utilisateur chercher.
    """
    suspectes = [
        c for c in profile.column_types
        if re.search(r"(date|temps|time|periode|période|annee|année|mois|jour|semaine|trimestre)",
                      str(c).lower())
        and profile.column_types[c] != "temporal"
    ]
    base = (f"{len(demandees)} analyse(s) temporelle(s) demandée(s), "
            "mais aucune colonne n'a été reconnue comme date.")
    if suspectes:
        return (base + " La colonne « " + suspectes[0] + " » y ressemble : "
                "forcez son type sur « Date » dans le typage, puis relancez.")
    return (base + " Ajoutez une colonne de date, ou forcez le type d'une colonne "
            "existante sur « Date » dans le typage.")


def etape_panel(profile: DatasetProfile, cible: str | None) -> PipelineStep | None:
    """Etape d'econometrie de panel, si le profil fournit de quoi l'estimer."""
    forme = profile.panel_structure
    numeriques = profile.numeric_cols
    cible_panel = cible if cible in numeriques else (numeriques[-1] if numeriques else None)
    covariables = [c for c in numeriques if c != cible_panel][:6]
    if not cible_panel or not covariables:
        return None

    return PipelineStep(
        key="panel",
        operation="panel",
        label=f"Économétrie de panel sur `{cible_panel}` (effets fixes / aléatoires)",
        rationale=(
            f"{forme.get('n_entities')} entités suivies sur {forme.get('n_periods')} "
            "périodes : les effets propres aux entités doivent être traités avant toute "
            "interprétation. Le test de Hausman arbitre entre effets fixes et aléatoires."
        ),
        params={
            "entity_col": forme.get("entity_column"),
            "time_col": forme.get("time_column"),
            "target_col": cible_panel,
            "covariates": covariables,
        },
    )


def message_temporel_sur_panel(profile: DatasetProfile) -> str:
    """Pourquoi un ARIMA n'a pas de sens sur un panel non filtre."""
    forme = profile.panel_structure
    return (
        "Analyses temporelles univariées demandées sur un panel "
        f"({forme.get('n_entities')} entités × {forme.get('n_periods')} périodes) : "
        "elles empileraient les entités sur les mêmes dates. Filtrez sur une entité, "
        "ou utilisez l'étape d'économétrie de panel."
    )


def colonnes_integrees(profile: DatasetProfile, maximum: int = 5) -> list[str]:
    """Series candidates a la cointegration : celles integrees d'ordre >= 1.

    Johansen cherche des tendances stochastiques communes. Une serie
    stationnaire n'en a pas : la mettre dans le systeme gonfle le rang detecte
    et fait conclure a une cointegration qui n'existe pas. A defaut de
    diagnostic disponible, on retombe sur les premieres numeriques.
    """
    ordres = profile.integration_orders or {}
    integrees = [
        col for col in profile.numeric_cols
        if (ordres.get(col) or {}).get("order", 0) >= 1
        or not (ordres.get(col) or {}).get("is_stationary", True)
    ]
    return (integrees or profile.numeric_cols)[:maximum]


def etape_comptage(profile: DatasetProfile, cible: str | None, df) -> PipelineStep | None:
    """Etape de modele de comptage, si la cible est un denombrement.

    Une cible entiere positive passee en regression lineaire produit des
    predictions negatives : on propose alors la loi qui correspond.
    """
    from app.core.count_models import est_comptage

    if not cible or cible not in getattr(df, "columns", []):
        return None
    if not est_comptage(df[cible], str(cible)):
        return None

    covariables = [c for c in profile.numeric_cols if c != cible][:5]
    if not covariables:
        return None

    return PipelineStep(
        key="count_model",
        operation="count_model",
        label=f"Modèle de comptage sur `{cible}` (Poisson / binomiale négative)",
        rationale=(
            f"`{cible}` est un dénombrement : une régression linéaire y prédirait des "
            "valeurs négatives et sous-estimerait les erreurs standard. La surdispersion "
            "est testée pour choisir entre Poisson et binomiale négative."
        ),
        params={"target_col": cible, "covariates": covariables},
    )


def etape_diagnostics_regression(profile: DatasetProfile, cible: str | None) -> PipelineStep | None:
    """Verification des hypotheses apres une regression."""
    if not cible:
        return None
    covariables = [c for c in profile.numeric_cols if c != cible][:6]
    if not covariables:
        return None

    return PipelineStep(
        key="regression_diagnostics",
        operation="regression_diagnostics",
        label="Diagnostics du modèle (hypothèses de la régression)",
        rationale=(
            "Un R² élevé ne garantit pas des p-values fiables : homoscédasticité, "
            "indépendance des résidus et forme fonctionnelle sont testées, et chaque "
            "hypothèse en défaut est accompagnée de sa conséquence."
        ),
        params={"target_col": cible, "feature_cols": covariables},
        optional=True,
    )
