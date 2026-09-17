"""Verifie que le corpus remplit les conditions exigees par chaque moteur.

Le controle n'est pas declaratif : il appelle les moteurs de l'application
(diagnostics de la boucle de correction, stationnarite, Johansen, Granger,
Chow, panel FE/RE/Hausman, modelisation) sur les fichiers reellement ecrits.

    python -m scripts.demo_dataset.validation [dossier]
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

DOSSIER_DEFAUT = Path(__file__).resolve().parents[3] / "data" / "demo"
SEUIL_COLINEARITE = 0.90
SEUIL_VIF = 10.0


def _titre(texte: str) -> None:
    print(f"\n{'=' * 72}\n{texte}\n{'=' * 72}")


def _ligne(libelle: str, valeur: object, ok: bool | None = None) -> None:
    marque = "" if ok is None else ("[OK]   " if ok else "[ECHEC]")
    print(f"{marque:8}{libelle:<52}{valeur}")


def _paires_correlees(df: pd.DataFrame, colonnes: list[str]) -> pd.Series:
    corr = df[colonnes].corr().abs()
    haut = corr.where(np.triu(np.ones(corr.shape), k=1).astype(bool))
    return haut.stack().sort_values(ascending=False)


def _vif_max(df: pd.DataFrame, colonnes: list[str]) -> tuple[str, float]:
    from app.core.analysis import compute_vif

    resultats = compute_vif(df[colonnes].dropna())
    if not resultats:
        return ("-", float("nan"))
    pire = max(resultats, key=lambda r: r["vif"])
    return (pire["variable"], pire["vif"])


def controler_structure(df: pd.DataFrame, nom: str) -> None:
    _titre(f"{nom} — structure et seuils de la boucle de correction")
    _ligne("lignes x colonnes", f"{len(df)} x {df.shape[1]}")
    taux_manquant = df.isna().mean()
    _ligne("taux de manquants max (seuil 5 %)",
           f"{taux_manquant.max():.1%} ({taux_manquant.idxmax()})",
           taux_manquant.max() < 0.05)
    doublons = df.duplicated().mean()
    _ligne("doublons (seuil 1 %)", f"{doublons:.2%}", doublons < 0.01)

    numeriques = df.select_dtypes("number").columns.tolist()
    if len(numeriques) >= 2:
        paires = _paires_correlees(df, numeriques)
        _ligne("|r| max entre numeriques (seuil 0.90)",
               f"{paires.iloc[0]:.3f}  {paires.index[0]}",
               paires.iloc[0] < SEUIL_COLINEARITE)
        print("         3 paires les plus liees : "
              + " | ".join(f"{a}~{b}={v:.2f}" for (a, b), v in paires.head(3).items()))
        variable, vif = _vif_max(df, numeriques)
        _ligne("VIF max (seuil 10)", f"{vif:.2f} ({variable})", vif < SEUIL_VIF)


def controler_clients(df: pd.DataFrame) -> None:
    from scipy import stats

    from app.core.pipeline.diagnostics import diagnose

    _titre("clients — conditions des analyses transversales")

    issues = diagnose(df, target="valeur_client")
    bloquants = [i for i in issues if getattr(i, "blocks_modeling", False)]
    _ligne("diagnostics bloquant la modelisation", len(bloquants), not bloquants)
    for issue in issues[:6]:
        print(f"         - {issue.code:16} {issue.title}")

    _ligne("asymetrie de revenu_annuel (log utile si > 1)",
           f"{stats.skew(df['revenu_annuel']):.2f}")
    # Sur l'echantillon complet, comme le fait le noeud de l'application : un
    # sous-echantillon masquerait un rejet.
    p_shapiro = stats.shapiro(df["score_credit"].values)[1]
    _ligne("Shapiro sur score_credit, 2400 obs (p > 0.05)",
           f"{p_shapiro:.3f}", p_shapiro > 0.05)

    groupes = [g["revenu_annuel"].values for _, g in df.groupby("segment")]
    f_stat, p_anova = stats.f_oneway(*groupes)
    _ligne("ANOVA segment -> revenu_annuel", f"F={f_stat:.1f}, p={p_anova:.2e}", p_anova < 0.05)
    _ligne("Levene (homoscedasticite ANOVA)",
           f"p={stats.levene(*groupes)[1]:.4f}")

    table = pd.crosstab(df["segment"], df["canal_prefere"])
    chi2, p_chi2, _, attendus = stats.chi2_contingency(table)
    _ligne("chi2 segment x canal_prefere", f"chi2={chi2:.0f}, p={p_chi2:.2e}", p_chi2 < 0.05)
    _ligne("effectif theorique minimal (>= 5)", f"{attendus.min():.1f}", attendus.min() >= 5)

    modalites = {c: df[c].nunique() for c in df.select_dtypes("object").columns}
    _ligne("modalites par variable qualitative (ACM)", modalites,
           all(2 <= v <= 10 for v in modalites.values()))

    taux_churn = df["churn"].mean()
    _ligne("taux d'evenement churn (survie + classification)",
           f"{taux_churn:.1%}", 0.15 < taux_churn < 0.6)
    _ligne("censure a droite (survie)", f"{1 - taux_churn:.1%}", taux_churn < 1)

    cellules = df.groupby(["groupe_pilote", "periode_post"]).size()
    _ligne("cellules DiD (4 non vides)", cellules.to_dict(), len(cellules) == 4)


def controler_modeles(df: pd.DataFrame) -> None:
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.linear_model import LinearRegression
    from sklearn.metrics import roc_auc_score
    from sklearn.model_selection import cross_val_score, train_test_split

    _titre("clients — pouvoir predictif reellement present")
    encode = pd.get_dummies(df.drop(columns=["valeur_client", "churn"]),
                            drop_first=True).fillna(df.median(numeric_only=True))
    encode = encode.fillna(0)

    r2 = cross_val_score(LinearRegression(), encode, df["valeur_client"], cv=5, scoring="r2")
    _ligne("R2 valide croise — cible valeur_client", f"{r2.mean():.3f}", 0.3 < r2.mean() < 0.95)

    x_tr, x_te, y_tr, y_te = train_test_split(
        encode.drop(columns=[c for c in encode.columns if c.startswith("duree_")]),
        df["churn"], test_size=0.25, random_state=0, stratify=df["churn"])
    modele = RandomForestClassifier(n_estimators=250, min_samples_leaf=5, random_state=0)
    modele.fit(x_tr, y_tr)
    auc = roc_auc_score(y_te, modele.predict_proba(x_te)[:, 1])
    _ligne("AUC hors echantillon — cible churn (sans duree)",
           f"{auc:.3f}", 0.6 < auc < 0.95)


def controler_causalite(df: pd.DataFrame) -> None:
    import statsmodels.api as sm
    from statsmodels.sandbox.regression.gmm import IV2SLS

    from scripts.demo_dataset.clients import ATT_DID, BETA_CONSEIL

    _titre("clients — identification causale (DiD, 2SLS, survie)")

    sous = df[["depense_mensuelle", "groupe_pilote", "periode_post"]].dropna().copy()
    sous["interaction"] = sous["groupe_pilote"] * sous["periode_post"]
    did = sm.OLS(sous["depense_mensuelle"],
                 sm.add_constant(sous[["groupe_pilote", "periode_post", "interaction"]])).fit()
    att = did.params["interaction"]
    _ligne(f"ATT estime par DiD (vrai = {ATT_DID})",
           f"{att:.1f} (p={did.pvalues['interaction']:.4f})",
           abs(att - ATT_DID) < 25 and did.pvalues["interaction"] < 0.05)

    propre = df[["valeur_client", "heures_conseil_annuel", "distance_agence_km"]].dropna()
    premiere = sm.OLS(propre["heures_conseil_annuel"],
                      sm.add_constant(propre["distance_agence_km"])).fit()
    _ligne("force de l'instrument (F 1re etape, > 10)",
           f"{premiere.fvalue:.1f}", premiere.fvalue > 10)
    mco = sm.OLS(propre["valeur_client"],
                 sm.add_constant(propre["heures_conseil_annuel"])).fit()
    iv = IV2SLS(propre["valeur_client"],
                sm.add_constant(propre["heures_conseil_annuel"]),
                sm.add_constant(propre["distance_agence_km"])).fit()
    _ligne(f"effet du conseil (vrai = {BETA_CONSEIL})",
           f"MCO biaise={mco.params.iloc[1]:.1f} | 2SLS={iv.params[1]:.1f}",
           abs(iv.params[1] - BETA_CONSEIL) < abs(mco.params.iloc[1] - BETA_CONSEIL))

    from app.core.survival_analysis import fit_cox_model
    covariables = ["indice_satisfaction", "nb_produits_detenus", "distance_agence_km"]
    cox = fit_cox_model(df, "duree_relation_observee", "churn", covariables)
    p_values = cox.get("p_values", {})
    significatifs = [c for c in covariables if p_values.get(c, 1) < 0.05]
    _ligne("Cox - covariables significatives", f"{len(significatifs)}/3 {cox.get('hazard_ratios')}",
           len(significatifs) >= 2)


def controler_series(df: pd.DataFrame) -> None:
    from app.core.exploration.probes.temporal import evaluate_stationarity
    from app.core.timeseries.stationarity import test_stationarity
    from app.core.timeseries.structural_break import compute_chow_test
    from app.core.timeseries.tests_multivariate import (test_granger_causality,
                                                        test_johansen_cointegration)

    _titre("series — conditions des moteurs temporels")

    cadre = df.set_index(pd.to_datetime(df["date"])).drop(columns=["date"])
    _ligne("frequence journaliere reguliere, sans trou",
           f"{cadre.index.min().date()} -> {cadre.index.max().date()}",
           bool(pd.infer_freq(cadre.index) == "D"))

    ordres = {c: evaluate_stationarity(cadre[c]).get("order") for c in cadre.columns}
    accords = {c: test_stationarity(cadre[c])["is_stationary"] for c in cadre.columns}
    _ligne("series stationnaires en niveau (ADF et KPSS d'accord)",
           [c for c, ok in accords.items() if ok], any(accords.values()))
    _ligne("ordre d'integration par serie (sonde)", ordres,
           0 in ordres.values() and 1 in ordres.values())

    trio = ["indice_prix_matiere", "indice_prix_concurrent", "cout_logistique"]
    johansen = test_johansen_cointegration(cadre[trio])
    _ligne("rang de cointegration (Johansen, attendu 1)",
           johansen.get("cointegration_rank"), johansen.get("cointegration_rank") == 1)

    granger = test_granger_causality(cadre[["ventes_quotidiennes", "trafic_web"]], max_lag=4)
    matrice = granger.get("matrix", {})
    aller = matrice.get("trafic_web", {}).get("ventes_quotidiennes")
    retour = matrice.get("ventes_quotidiennes", {}).get("trafic_web")
    _ligne("Granger trafic -> ventes (p < 0.05)", aller, aller is not None and aller < 0.05)
    _ligne("Granger ventes -> trafic (doit rester > 0.05)", retour,
           retour is not None and retour > 0.05)

    chow = compute_chow_test(df, "ventes_quotidiennes",
                             ["trafic_web", "temperature_moyenne"],
                             break_point="2023-03-01", date_col="date")
    p_chow = chow.get("p_value")
    _ligne("Chow au 2023-03-01", f"F={chow.get('f_statistic')}, p={p_chow}",
           p_chow is not None and p_chow < 0.05)

    from statsmodels.stats.diagnostic import het_arch
    rendements = np.diff(np.log(df["cours_actif"].values))
    p_arch = het_arch(rendements, nlags=10)[1]
    _ligne("effet ARCH sur cours_actif (p < 0.05 attendu)", f"{p_arch:.2e}", p_arch < 0.05)

    saison = cadre["ventes_quotidiennes"].groupby(cadre.index.dayofweek).mean()
    amplitude = (saison.max() - saison.min()) / saison.mean()
    _ligne("amplitude hebdomadaire des ventes (periode 7)", f"{amplitude:.1%}", amplitude > 0.1)


def controler_panel(df: pd.DataFrame) -> None:
    from app.core.panel_models import fit_panel_models

    _titre("panel — conditions de l'econometrie de panel")
    _ligne("entites x periodes", f"{df['agence_id'].nunique()} x {df['periode'].nunique()}")
    _ligne("panel cylindre", bool(df.groupby("agence_id").size().nunique() == 1),
           df.groupby("agence_id").size().nunique() == 1)

    resultat = fit_panel_models(
        df, entity_col="agence_id", time_col="periode", target_col="chiffre_affaires",
        covariates=["budget_marketing", "effectif", "indice_concurrence",
                    "taux_penetration_marche"])
    hausman = resultat.get("hausman_test", {})
    p_hausman = hausman.get("p_value")
    _ligne("Hausman (p < 0.05 => effets fixes)",
           f"chi2={hausman.get('statistic')}, p={p_hausman}",
           p_hausman is not None and p_hausman < 0.05)
    _ligne("effets fixes recommandes", hausman.get("prefer_fixed_effects"),
           bool(hausman.get("prefer_fixed_effects")))

    coefficients = {c["variable"]: c["coefficient"]
                    for c in resultat["fixed_effects"]["coefficients"]}
    _ligne("coefficients within estimes", {k: round(v, 2) for k, v in coefficients.items()})

    cellules = df.groupby(["groupe_traite", "apres_lancement"]).size()
    _ligne("cellules DiD du panel", cellules.to_dict(), len(cellules) == 4)

    import statsmodels.api as sm

    from scripts.demo_dataset.panel import ATT_PROGRAMME
    sous = df.copy()
    sous["interaction"] = sous["groupe_traite"] * sous["apres_lancement"]
    did = sm.OLS(sous["chiffre_affaires"],
                 sm.add_constant(sous[["groupe_traite", "apres_lancement", "interaction"]])).fit()
    att = did.params["interaction"]
    _ligne(f"ATT du panel sans covariables (vrai = {ATT_PROGRAMME})",
           f"{att:.1f} (p={did.pvalues['interaction']:.4f})",
           abs(att - ATT_PROGRAMME) < 6 and did.pvalues["interaction"] < 0.05)


def main(argv: list[str]) -> int:
    dossier = Path(argv[1]).resolve() if len(argv) > 1 else DOSSIER_DEFAUT
    clients = pd.read_csv(dossier / "openstats_clients.csv")
    series = pd.read_csv(dossier / "openstats_series.csv")
    panel = pd.read_csv(dossier / "openstats_panel.csv")

    for df, nom in ((clients, "clients"), (series, "series"), (panel, "panel")):
        controler_structure(df, nom)

    controler_clients(clients)
    controler_modeles(clients)
    controler_causalite(clients)
    controler_series(series)
    controler_panel(panel)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
