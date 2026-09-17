"""
Sondes de modelisation : pouvoir predictif, importance des variables,
multicolinearite et diagnostic des residus.

Le modele n'est pas ici une finalite mais un instrument de mesure : il sert a
etablir des faits (heteroscedasticite, non-linearite residuelle, colinearite)
que les sondes suivantes exploitent.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from app.core.statistical_attempt import attempt
from app.core.exploration.context import ExplorationContext
from app.core.exploration.finding import Finding, effect_adverb

MIN_ROWS_MODEL = 30
MAX_FEATURES = 12


def _design_matrix(ctx: ExplorationContext, features: list[str]) -> pd.DataFrame | None:
    """Matrice de features encodee, alignee avec la cible."""
    frame = ctx.df[features + [ctx.target]].copy()
    for col in features:
        if not pd.api.types.is_numeric_dtype(frame[col]):
            frame[col] = pd.Categorical(frame[col]).codes
        frame[col] = pd.to_numeric(frame[col], errors="coerce")
    frame = frame.replace([np.inf, -np.inf], np.nan).dropna()
    return frame if len(frame) >= MIN_ROWS_MODEL else None


def probe_predictive_power(ctx: ExplorationContext) -> list[Finding]:
    """Un modele non lineaire explique-t-il la cible mieux que sa moyenne ?

    Le score est valide par validation croisee : sans cela, un R2 en
    reapprentissage est systematiquement optimiste et ne prouve rien.
    """
    from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
    from sklearn.model_selection import cross_val_score

    features = ctx.top_covariates(MAX_FEATURES)
    if not features:
        return []

    frame = _design_matrix(ctx, features)
    if frame is None:
        return []

    X = frame[features]
    y = frame[ctx.target]
    is_regression = ctx.target_kind == "numeric"
    n_splits = 5 if len(frame) >= 100 else 3

    if is_regression:
        model = RandomForestRegressor(n_estimators=120, random_state=0, n_jobs=1)
        scoring = "r2"
        metric, baseline_label = "R2 valide par validation croisee", "la moyenne"
    else:
        y = pd.Categorical(y).codes
        if pd.Series(y).value_counts().min() < n_splits:
            return []
        model = RandomForestClassifier(n_estimators=120, random_state=0, n_jobs=1)
        scoring = "balanced_accuracy"
        metric, baseline_label = "exactitude equilibree (validation croisee)", "le hasard"

    evaluation = attempt(cross_val_score, model, X, y, cv=n_splits, scoring=scoring)
    if not evaluation:
        ctx.notes.append(f"Pouvoir predictif non evaluable : {evaluation.reason}")
        return []
    scores = evaluation.value

    fitting = attempt(model.fit, X, y)
    if not fitting:
        ctx.notes.append(f"Entrainement impossible : {fitting.reason}")
        return []

    score = float(np.mean(scores))
    spread = float(np.std(scores))
    floor = 0.0 if is_regression else 1.0 / max(2, len(np.unique(y)))
    if score <= floor + 0.02:
        return [Finding(
            kind="pouvoir_predictif_nul",
            variables=(ctx.target,),
            effect_size=0.35,
            effect_metric=metric,
            headline=f"Aucune variable disponible ne predit {ctx.target} ({metric} = {score:.2f})",
            detail=(f"Un modele non lineaire entraine sur les {len(features)} meilleures covariables "
                    f"ne fait pas mieux que {baseline_label}. Le signal recherche n'est pas dans ces "
                    "colonnes : il manque une variable, ou la cible est essentiellement du bruit."),
            p_value=None,
            n=len(frame),
            establishes=("pouvoir_predictif_nul",),
            payload={"score": round(score, 4), "folds": n_splits},
            probe="predictive_power",
        )]

    findings = [Finding(
        kind="pouvoir_predictif",
        variables=(ctx.target,),
        effect_size=min(1.0, max(0.0, score)),
        effect_metric=metric,
        headline=f"{ctx.target} est predictible {effect_adverb(score)} ({metric} = {score:.2f})",
        detail=(f"Foret aleatoire sur {len(features)} covariables, {n_splits} plis, "
                f"dispersion entre plis +/-{spread:.3f}. Score hors echantillon : "
                "il n'est donc pas gonfle par le reapprentissage."),
        p_value=None,
        n=len(frame),
        establishes=("modele_utile",),
        payload={"score": round(score, 4), "std": round(spread, 4),
                 "folds": n_splits, "features": features},
        probe="predictive_power",
    )]

    findings += _importance_findings(ctx, model, features, len(frame))
    if is_regression:
        findings += _residual_findings(ctx, model, X, y, len(frame))
    return findings


def _importance_findings(ctx: ExplorationContext, model, features: list[str], n: int) -> list[Finding]:
    """Variables dominantes selon l'importance du modele."""
    importances = dict(zip(features, model.feature_importances_))
    ranked = sorted(importances.items(), key=lambda kv: -kv[1])
    if not ranked or ranked[0][1] < 0.2:
        return []

    top_name, top_value = ranked[0]
    listing = ", ".join(f"{k} ({v:.0%})" for k, v in ranked[:4])
    return [Finding(
        kind="variable_dominante",
        variables=(top_name, ctx.target),
        effect_size=float(top_value),
        effect_metric="importance dans la foret aleatoire",
        headline=f"{top_name} porte a elle seule {top_value:.0%} du pouvoir predictif sur {ctx.target}",
        detail=(f"Classement des contributions : {listing}. "
                "Attention : l'importance se partage entre variables correlees, "
                "une variable peut donc etre sous-evaluee si une jumelle est presente."),
        p_value=None,
        n=n,
        establishes=("variable_dominante",),
        payload={"importances": {k: round(float(v), 4) for k, v in ranked}},
        probe="predictive_power",
    )]


def _residual_findings(ctx: ExplorationContext, model, X, y, n: int) -> list[Finding]:
    """Diagnostic des residus : heteroscedasticite."""
    from statsmodels.stats.diagnostic import het_breuschpagan
    import statsmodels.api as sm

    exog = sm.add_constant(X)
    test = attempt(lambda: het_breuschpagan(y - model.predict(X), exog))
    if not test:
        ctx.notes.append(f"Diagnostic des residus impossible : {test.reason}")
        return []

    p_value = test.value[1]
    if not np.isfinite(p_value) or p_value >= 0.05:
        return []

    return [Finding(
        kind="heteroscedasticite",
        variables=(ctx.target,),
        effect_size=0.5,
        effect_metric="test de Breusch-Pagan",
        headline=f"La dispersion des erreurs sur {ctx.target} n'est pas constante (p = {p_value:.3g})",
        detail=("L'amplitude des erreurs depend du niveau predit : les intervalles de confiance "
                "et les tests d'une regression classique sont fausses. Utiliser des erreurs "
                "standard robustes (HC1), ou modeliser le logarithme de la cible."),
        p_value=float(p_value),
        n=n,
        establishes=("heteroscedasticite", "erreurs_robustes_requises"),
        payload={"breusch_pagan_p": round(float(p_value), 6)},
        probe="predictive_power",
    )]


def probe_multicollinearity(ctx: ExplorationContext) -> list[Finding]:
    """VIF sur les covariables numeriques : quelles variables sont redondantes ?"""
    from statsmodels.stats.outliers_influence import variance_inflation_factor
    import statsmodels.api as sm

    features = ctx.top_covariates(8, kinds=("numeric",))
    if len(features) < 3:
        return []

    frame = ctx.df[features].apply(pd.to_numeric, errors="coerce")
    frame = frame.replace([np.inf, -np.inf], np.nan).dropna()
    if len(frame) < MIN_ROWS_MODEL or frame.shape[1] < 3:
        return []

    design = sm.add_constant(frame)
    computation = attempt(
        lambda: {col: float(variance_inflation_factor(design.values, i))
                 for i, col in enumerate(design.columns) if col != "const"})
    if not computation:
        ctx.notes.append(f"VIF non calculable : {computation.reason}")
        return []
    vifs = computation.value

    severe = {k: v for k, v in vifs.items() if np.isfinite(v) and v >= 10}
    if not severe:
        return []

    worst = max(severe, key=severe.get)
    listing = ", ".join(f"{k} (VIF {v:.1f})" for k, v in sorted(severe.items(), key=lambda kv: -kv[1])[:4])
    return [Finding(
        kind="multicolinearite",
        variables=tuple(severe.keys()),
        effect_size=min(1.0, severe[worst] / 30.0),
        effect_metric="facteur d'inflation de la variance",
        headline=f"{len(severe)} variable(s) redondante(s) : {worst} atteint un VIF de {severe[worst]:.1f}",
        detail=(f"Variables concernees : {listing}. Au-dela de 10, les coefficients d'une "
                "regression deviennent instables et leur signe peut s'inverser d'un echantillon "
                "a l'autre. Retirer les doublons, ou passer par une regression penalisee (ridge)."),
        p_value=None,
        n=len(frame),
        establishes=("multicolinearite",),
        payload={"vif": {k: round(v, 3) for k, v in vifs.items() if np.isfinite(v)}},
        probe="multicollinearity",
    )]
