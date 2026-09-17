"""Traduction des parametres d'une recette vers le contrat des noeuds du canvas.

La recette de l'auto-analyseur nomme ses parametres en snake_case
(`date_col`, `forecast_steps`, `columns`) ; les executeurs de noeuds lisent du
camelCase (`dateCol`, `forecastSteps`, `valueCols`) et attendent des listes
sous forme de chaine « a,b,c ».

Sans cette traduction, le canvas genere depuis une recette s'executait avec des
parametres vides : chaque noeud retombait sur son auto-selection et analysait
une autre colonne que celle choisie par l'analyseur. Le canvas affichait donc
une analyse differente de celle qu'il etait cense reproduire.
"""

from __future__ import annotations

from typing import Any

# Cles communes a tous les noeuds.
EQUIVALENCES_GENERALES = {
    "date_col": "dateCol",
    "value_col": "valueCol",
    "target_col": "targetCol",
    "forecast_steps": "forecastSteps",
    "cv_folds": "cvFolds",
    "n_components": "nComponents",
    "n_simulations": "nSimulations",
    "break_point": "breakPoint",
    "duration_col": "durationCol",
    "event_col": "eventCol",
    "group_col": "groupCol",
    "entity_col": "entityCol",
    "time_col": "timeCol",
    "outcome_col": "outcomeCol",
    "treatment_col": "treatmentCol",
    "instrument_col": "instrumentCol",
}

# La liste de colonnes ne porte pas le meme nom selon le noeud.
CLE_COLONNES = {
    "testStationarity": "cols",
    "cointegration": "valueCols",
    "granger": "valueCols",
    "multivariateTimeseries": "valueCols",
    "pca": "columns",
    "manifold": "columns",
}

# Le noeud de modelisation traduit la strategie de validation croisee.
STRATEGIES_SPLIT = {"timeseries": "time", "kfold": "random", "auto": "auto"}


def _en_chaine(valeur: Any) -> Any:
    """Les noeuds attendent « a,b,c » la ou la recette fournit une liste."""
    if isinstance(valeur, (list, tuple)):
        return ",".join(str(v) for v in valeur)
    return valeur


def traduire_params(node_type: str, params: dict[str, Any]) -> dict[str, Any]:
    """Convertit les parametres d'une etape vers ce que le noeud sait lire."""
    if not params:
        return {}

    traduits: dict[str, Any] = {}

    for cle, valeur in params.items():
        if cle == "columns":
            cible = CLE_COLONNES.get(node_type)
            if cible:
                traduits[cible] = _en_chaine(valeur) if cible != "columns" else valeur
            continue

        if cle == "feature_cols":
            traduits["featureCols"] = _en_chaine(valeur)
            continue

        if cle == "covariates":
            traduits["covariates"] = _en_chaine(valeur)
            continue

        if cle == "model_keys":
            traduits["models"] = _en_chaine(valeur)
            continue

        if cle == "cv_strategy":
            traduits["splitStrategy"] = STRATEGIES_SPLIT.get(str(valeur), "auto")
            continue

        if cle == "transforms":
            # [{column, transform}] -> deux listes paralleles lisibles par le noeud.
            colonnes = [t.get("column") for t in valeur if isinstance(t, dict)]
            actions = [t.get("transform") for t in valeur if isinstance(t, dict)]
            traduits["columns"] = _en_chaine([c for c in colonnes if c])
            traduits["actions"] = _en_chaine([a for a in actions if a])
            traduits["mode"] = "manual"
            continue

        traduits[EQUIVALENCES_GENERALES.get(cle, cle)] = valeur

    # Un noeud temporel univarie cible une serie, pas une « cible de modele ».
    if node_type == "timeseries" and "valueCol" not in traduits and "targetCol" in traduits:
        traduits["valueCol"] = traduits["targetCol"]

    return traduits
