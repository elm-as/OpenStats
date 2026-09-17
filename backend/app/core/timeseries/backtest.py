"""Validation par origine glissante des modeles de prevision.

Jusqu'ici, ARIMA, SARIMA, Holt-Winters et Prophet etaient classes par AIC,
c'est-a-dire sur leur ajustement *dans* l'echantillon. Un AIC plus bas ne dit
rien de la qualite des previsions : un modele peut coller au passe et se
tromper sur l'avenir.

Le principe retenu est celui de l'origine glissante : on coupe la serie a une
date, on ajuste sur ce qui precede, on prevoit l'horizon demande, on compare a
ce qui s'est reellement passe, puis on decale la coupure. Aucune observation
future n'entre dans l'ajustement.

La reference naive (derniere valeur observee, ou valeur de la meme periode
saisonniere) est evaluee dans les memes conditions : sans elle, une erreur de
prevision n'est pas interpretable.
"""

from __future__ import annotations

from typing import Any, Callable

import numpy as np
import pandas as pd

# En deca, il ne reste pas assez d'historique pour ajuster puis tester.
OBSERVATIONS_MINIMALES = 30
ORIGINES_PAR_DEFAUT = 4
# Au-dela, on valide sur la periode recente : c'est elle qui renseigne sur la
# capacite a prevoir demain, et le cout d'ajustement croit avec la longueur.
LONGUEUR_MAXIMALE = 1000


def _erreurs(reel: np.ndarray, prevu: np.ndarray) -> dict[str, float]:
    """Erreurs de prevision usuelles, en ignorant les points non comparables."""
    valide = np.isfinite(reel) & np.isfinite(prevu)
    if not valide.any():
        return {}
    reel, prevu = reel[valide], prevu[valide]
    ecart = reel - prevu

    resultats = {
        "mae": float(np.mean(np.abs(ecart))),
        "rmse": float(np.sqrt(np.mean(ecart ** 2))),
    }
    non_nuls = reel != 0
    if non_nuls.any():
        resultats["mape"] = float(np.mean(np.abs(ecart[non_nuls] / reel[non_nuls])) * 100)
    return resultats


def _prevision_naive(historique: pd.Series, horizon: int, periode: int) -> np.ndarray:
    """Reference : derniere valeur, ou meme periode de la saison precedente."""
    if periode > 1 and len(historique) >= periode:
        motif = historique.iloc[-periode:].to_numpy()
        return np.array([motif[i % periode] for i in range(horizon)])
    return np.repeat(float(historique.iloc[-1]), horizon)


def _decoupage(n: int, horizon: int, n_origines: int) -> list[int]:
    """Positions de coupure, de la plus ancienne a la plus recente."""
    minimum_ajustement = max(OBSERVATIONS_MINIMALES, int(n * 0.5))
    derniere = n - horizon
    if derniere <= minimum_ajustement:
        return []

    pas = max(1, (derniere - minimum_ajustement) // max(1, n_origines))
    origines = list(range(minimum_ajustement, derniere + 1, pas))[:n_origines]
    return origines or [derniere]


def valider_par_origine_glissante(
    series: pd.Series,
    ajusteurs: dict[str, Callable[[pd.Series, int], np.ndarray | None]],
    horizon: int = 6,
    n_origines: int = ORIGINES_PAR_DEFAUT,
    periode: int = 1,
) -> dict[str, Any]:
    """Compare des modeles sur des previsions hors echantillon.

    `ajusteurs` associe un nom de modele a une fonction (historique, horizon)
    qui rend les valeurs prevues, ou None si l'ajustement echoue.
    """
    serie = series.dropna()
    if len(serie) > LONGUEUR_MAXIMALE:
        serie = serie.iloc[-LONGUEUR_MAXIMALE:]
    n = len(serie)
    horizon = max(1, min(horizon, max(1, n // 5)))
    origines = _decoupage(n, horizon, n_origines)

    if not origines:
        return {
            "status": "insuffisant",
            "raison": (f"Série trop courte pour une validation hors échantillon "
                       f"({n} observations, minimum {OBSERVATIONS_MINIMALES + horizon})."),
            "horizon": horizon,
            "n_origines": 0,
        }

    cumul: dict[str, dict[str, list[float]]] = {}
    noms = list(ajusteurs) + ["reference_naive"]
    for nom in noms:
        cumul[nom] = {"reel": [], "prevu": []}

    for coupure in origines:
        historique = serie.iloc[:coupure]
        reel = serie.iloc[coupure:coupure + horizon].to_numpy(dtype=float)
        if len(reel) < horizon:
            continue

        for nom, ajusteur in ajusteurs.items():
            try:
                prevu = ajusteur(historique, horizon)
            except Exception:
                prevu = None
            if prevu is None or len(prevu) != horizon:
                continue
            cumul[nom]["reel"].extend(reel.tolist())
            cumul[nom]["prevu"].extend(np.asarray(prevu, dtype=float).tolist())

        naive = _prevision_naive(historique, horizon, periode)
        cumul["reference_naive"]["reel"].extend(reel.tolist())
        cumul["reference_naive"]["prevu"].extend(naive.tolist())

    resultats = {}
    for nom, valeurs in cumul.items():
        if not valeurs["reel"]:
            continue
        resultats[nom] = _erreurs(np.array(valeurs["reel"]), np.array(valeurs["prevu"]))
        resultats[nom]["n_previsions"] = len(valeurs["reel"])

    reference = resultats.get("reference_naive", {})
    rmse_reference = reference.get("rmse")
    for nom, mesures in resultats.items():
        if nom == "reference_naive" or not rmse_reference:
            continue
        # Gain > 0 : le modele fait mieux que la reference naive.
        mesures["gain_vs_naive"] = round(1 - mesures["rmse"] / rmse_reference, 4)

    classables = [(nom, m["rmse"]) for nom, m in resultats.items()
                  if nom != "reference_naive" and m.get("rmse") is not None]
    classables.sort(key=lambda x: x[1])

    meilleur = classables[0][0] if classables else None
    bat_la_reference = bool(
        meilleur and rmse_reference and resultats[meilleur]["rmse"] < rmse_reference
    )

    return {
        "status": "ok",
        "horizon": horizon,
        "n_origines": len(origines),
        "periode_saisonniere": periode,
        "metriques": {nom: {k: (round(v, 4) if isinstance(v, float) else v)
                            for k, v in m.items()} for nom, m in resultats.items()},
        "classement": [nom for nom, _ in classables],
        "meilleur_modele": meilleur,
        "bat_la_reference_naive": bat_la_reference,
        "interpretation": (
            f"« {meilleur} » obtient la plus faible erreur hors échantillon sur "
            f"{len(origines)} origines à horizon {horizon}."
            + ("" if bat_la_reference
               else " Aucun modèle ne fait mieux que la référence naïve : "
                    "la prévision n'apporte rien sur cette série.")
        ) if meilleur else "Aucun modèle n'a pu être validé.",
    }
