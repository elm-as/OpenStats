"""Noeuds d'inference : diagnostics de regression, puissance, quantiles, equivalence.

Ces quatre analyses repondent a des questions que l'application posait sans y
repondre : mes hypotheses tiennent-elles, mon echantillon permettait-il de voir
l'effet, l'effet est-il le meme partout dans la distribution, et puis-je
demontrer qu'il n'y a pas d'effet.
"""

from __future__ import annotations

from app.services.dataset_service import dataset_manager

from ._shared import _sanitize, lire_decimal, lire_entier, lire_texte


def _colonnes(data: dict, cle: str, df, exclues: tuple = ()) -> list[str]:
    """Liste de colonnes saisie « a,b,c », filtree sur ce qui existe."""
    brut = lire_texte(data, cle)
    if not brut:
        return []
    return [c.strip() for c in str(brut).split(",")
            if c.strip() in df.columns and c.strip() not in exclues]


def _cible_et_features(data: dict, df):
    """Cible et variables explicatives, avec repli sur les numeriques utiles."""
    from app.core.analysis_scope import variables_analysables

    analysables = variables_analysables(df, minimum=1)
    target = lire_texte(data, "targetCol")
    if not target or target not in df.columns:
        target = analysables.columns[-1] if len(analysables.columns) else None

    features = _colonnes(data, "featureCols", df, exclues=(target,))
    if not features:
        features = [c for c in analysables.columns if c != target][:6]
    return target, features


def execute_regression_diagnostics(data, dataset_id):
    """Confronte les hypotheses d'une regression aux donnees."""
    from app.core.regression_diagnostics import diagnostiquer_regression

    df = dataset_manager.get_df(dataset_id, cleaned=data.get("_cleaned", True))
    if df is None or df.empty:
        return {"status": "error", "error": "DataFrame vide ou introuvable"}

    target, features = _cible_et_features(data, df)
    if not target or not features:
        return {"status": "error", "error": "Une cible numérique et au moins une variable explicative sont requises"}

    resultat = diagnostiquer_regression(df, target, features)
    if resultat.get("status") != "success":
        return {"status": "error", "error": resultat.get("error", "Échec du diagnostic")}

    return {
        "status": "success",
        "message": (f"Diagnostics sur '{target}' : {resultat['n_violations']} hypothèse(s) "
                    f"en défaut sur {len(resultat['hypotheses'])}"),
        "result": _sanitize(resultat),
    }


def execute_power_analysis(data, dataset_id):
    """Puissance atteinte et effet minimal detectable pour une comparaison."""
    from app.core.statistical_power import analyser_puissance_deux_groupes

    df = dataset_manager.get_df(dataset_id, cleaned=data.get("_cleaned", True))
    if df is None or df.empty:
        return {"status": "error", "error": "DataFrame vide ou introuvable"}

    group_col = lire_texte(data, "groupCol")
    value_col = lire_texte(data, "valueCol")
    if not group_col:
        binaires = [c for c in df.columns if df[c].dropna().nunique() == 2]
        group_col = binaires[0] if binaires else None
    if not value_col:
        from app.core.analysis_scope import variables_analysables
        numeriques = [c for c in variables_analysables(df, minimum=1).columns if c != group_col]
        value_col = numeriques[0] if numeriques else None

    if not group_col or not value_col:
        return {"status": "error",
                "error": "Une variable de groupe binaire et une variable numérique sont requises"}

    resultat = analyser_puissance_deux_groupes(
        df, group_col, value_col,
        puissance_visee=lire_decimal(data, "targetPower", 0.80),
        alpha=lire_decimal(data, "alpha", 0.05),
    )
    if resultat.get("status") != "success":
        return {"status": "error", "error": resultat.get("error", "Échec de l'analyse de puissance")}

    return {
        "status": "success",
        "message": (f"Puissance atteinte {round(resultat['puissance_atteinte'] * 100, 1)} % "
                    f"sur '{value_col}' selon '{group_col}'"),
        "result": _sanitize(resultat),
    }


def execute_quantile_regression(data, dataset_id):
    """Effet des variables selon le quantile de la cible."""
    from app.core.quantile_regression import ajuster_regression_quantile

    df = dataset_manager.get_df(dataset_id, cleaned=data.get("_cleaned", True))
    if df is None or df.empty:
        return {"status": "error", "error": "DataFrame vide ou introuvable"}

    target, features = _cible_et_features(data, df)
    if not target or not features:
        return {"status": "error", "error": "Une cible numérique et au moins une variable explicative sont requises"}

    quantiles_brut = lire_texte(data, "quantiles")
    quantiles = []
    for morceau in str(quantiles_brut or "").split(","):
        try:
            valeur = float(morceau.strip())
        except ValueError:
            continue
        quantiles.append(valeur / 100 if valeur > 1 else valeur)

    resultat = ajuster_regression_quantile(df, target, features,
                                           quantiles=quantiles or (0.1, 0.25, 0.5, 0.75, 0.9))
    if resultat.get("status") != "success":
        return {"status": "error", "error": resultat.get("error", "Échec de la régression quantile")}

    return {
        "status": "success",
        "message": f"Régression quantile sur '{target}' ({len(resultat['quantiles'])} quantiles)",
        "result": _sanitize(resultat),
    }


def execute_equivalence_test(data, dataset_id):
    """TOST : demontrer qu'un ecart tient dans une marge jugee negligeable."""
    from app.core.equivalence_tests import tester_equivalence

    df = dataset_manager.get_df(dataset_id, cleaned=data.get("_cleaned", True))
    if df is None or df.empty:
        return {"status": "error", "error": "DataFrame vide ou introuvable"}

    group_col = lire_texte(data, "groupCol")
    value_col = lire_texte(data, "valueCol")
    if not group_col:
        binaires = [c for c in df.columns if df[c].dropna().nunique() == 2]
        group_col = binaires[0] if binaires else None
    if not value_col:
        from app.core.analysis_scope import variables_analysables
        numeriques = [c for c in variables_analysables(df, minimum=1).columns if c != group_col]
        value_col = numeriques[0] if numeriques else None

    if not group_col or not value_col:
        return {"status": "error",
                "error": "Une variable de groupe binaire et une variable numérique sont requises"}

    resultat = tester_equivalence(df, group_col, value_col,
                                  marge=lire_decimal(data, "margin"),
                                  alpha=lire_decimal(data, "alpha", 0.05))
    if resultat.get("status") != "success":
        return {"status": "error", "error": resultat.get("error", "Échec du test d'équivalence")}

    verdict = "équivalence démontrée" if resultat["equivalent"] else "équivalence non démontrée"
    return {
        "status": "success",
        "message": f"TOST sur '{value_col}' selon '{group_col}' : {verdict}",
        "result": _sanitize(resultat),
    }
