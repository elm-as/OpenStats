"""
Execution des noeuds econometriques avances (Donnees de panel, Modeles de comptage).
"""

from __future__ import annotations

from typing import Any

from app.api.v1.canvas.nodes._shared import _sanitize, lire_texte
from app.services.dataset_service import dataset_manager


def execute_panel(data: dict[str, Any], dataset_id: str) -> dict[str, Any]:
    """Econometrie de panel : effets fixes, effets aleatoires et test de Hausman."""
    from app.core.analysis_scope import variables_analysables
    from app.core.panel_models import fit_panel_models
    from app.core.auto_pipeline.panel_structure import detecter_panel
    from app.core.auto_pipeline.heuristics import _is_temporal

    cleaned = data.get("_cleaned", True)
    df = dataset_manager.get_df(dataset_id, cleaned=cleaned)
    if df is None or df.empty:
        return {"status": "error", "error": "DataFrame vide ou introuvable"}

    entity_col = lire_texte(data, "entityCol")
    time_col = lire_texte(data, "timeCol")

    if not entity_col or not time_col:
        temporelles = [c for c in df.columns if _is_temporal(df[c], name=str(c))]
        candidats = [c for c in df.columns
                     if c not in temporelles and df[c].nunique(dropna=True) <= len(df) / 2]
        couple = detecter_panel(df, temporelles, candidats)
        if not couple:
            return {"status": "error",
                    "error": "Aucune structure de panel détectée : indiquez la colonne "
                             "d'entité et la colonne de période."}
        entity_col, time_col = couple

    for nom, colonne in (("entité", entity_col), ("période", time_col)):
        if colonne not in df.columns:
            return {"status": "error", "error": f"Colonne {nom} '{colonne}' introuvable"}

    target = lire_texte(data, "targetCol")
    numeriques = [c for c in variables_analysables(df, minimum=1).columns if c != time_col]
    if not target or target not in df.columns:
        target = numeriques[-1] if numeriques else None
    if not target:
        return {"status": "error", "error": "Variable cible numérique requise"}

    covariables_brut = lire_texte(data, "covariates")
    if covariables_brut:
        covariables = [c.strip() for c in str(covariables_brut).split(",")
                       if c.strip() in df.columns and c.strip() != target]
    else:
        covariables = [c for c in numeriques if c != target][:6]

    if not covariables:
        return {"status": "error", "error": "Au moins une covariable est requise"}

    try:
        result = fit_panel_models(df, entity_col=entity_col, time_col=time_col,
                                  target_col=target, covariates=covariables)
    except Exception as e:
        return {"status": "error", "error": f"Erreur économétrie de panel: {str(e)}"}

    hausman = (result or {}).get("hausman_test", {})
    prefere = "effets fixes" if hausman.get("prefer_fixed_effects") else "effets aléatoires"
    return {
        "status": "success",
        "message": (f"Panel sur '{target}' : {result.get('n_entities')} entités × "
                    f"{result.get('n_observations', 0) // max(1, result.get('n_entities', 1))} "
                    f"périodes — Hausman recommande les {prefere}"),
        "result": _sanitize(result),
    }


def execute_count_model(data: dict[str, Any], dataset_id: str) -> dict[str, Any]:
    """Regression de comptage : Poisson, ou binomiale negative si surdispersion."""
    from app.core.analysis_scope import variables_analysables
    from app.core.count_models import ajuster_modele_comptage, est_comptage

    cleaned = data.get("_cleaned", True)
    df = dataset_manager.get_df(dataset_id, cleaned=cleaned)
    if df is None or df.empty:
        return {"status": "error", "error": "DataFrame vide ou introuvable"}

    target = lire_texte(data, "targetCol")
    if not target:
        candidats = [c for c in df.columns if est_comptage(df[c], str(c))]
        target = candidats[0] if candidats else None
    if not target or target not in df.columns:
        return {"status": "error",
                "error": "Aucune variable de comptage détectée : indiquez la cible."}

    if not est_comptage(df[target], str(target)):
        return {"status": "error",
                "error": (f"'{target}' ne se comporte pas comme un comptage "
                          "(entiers positifs). Utilisez une régression classique.")}

    covariables_brut = lire_texte(data, "covariates")
    if covariables_brut:
        covariables = [c.strip() for c in str(covariables_brut).split(",")
                       if c.strip() in df.columns and c.strip() != target]
    else:
        numeriques = [c for c in variables_analysables(df, minimum=1).columns if c != target]
        categorielles = [c for c in df.select_dtypes(include=["object", "category"]).columns
                         if df[c].nunique() <= 10]
        covariables = (numeriques[:5] + categorielles[:2])

    if not covariables:
        return {"status": "error", "error": "Au moins une covariable est requise"}

    resultat = ajuster_modele_comptage(df, target, covariables,
                                       exposure_col=lire_texte(data, "exposureCol"))
    if resultat.get("status") != "success":
        return {"status": "error", "error": resultat.get("error", "Échec de l'ajustement")}

    retenu = resultat["selected_model"]
    libelle = "binomiale négative" if retenu == "negative_binomial" else "Poisson"
    return {
        "status": "success",
        "message": (f"Modèle de comptage sur '{target}' — {libelle} retenu "
                    f"(dispersion = {resultat.get('dispersion')})"),
        "result": _sanitize(resultat),
    }
