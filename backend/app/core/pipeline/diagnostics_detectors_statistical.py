"""
Detecteurs d'anomalies statistiques et violations d'hypotheses (extremes, asymetrie, colinearite, racine unitaire, heteroscedasticite).
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from app.core import measurements
from app.core.pipeline.diagnostics_models import THRESHOLDS, Issue, Remedy
from app.core.statistical_attempt import attempt


def detect_outliers(df: pd.DataFrame, numeric: list[str]) -> list[Issue]:
    """Detecte les observations extremes au sens de l'IQR."""
    issues: list[Issue] = []
    for col in numeric:
        bounds = measurements.outliers(df[col])
        if bounds is None or bounds.ratio < THRESHOLDS["outlier_ratio"]:
            continue
        ratio, low, high = bounds.ratio, bounds.lower, bounds.upper

        issues.append(Issue(
            code="outliers",
            columns=(col,),
            severity=min(1.0, ratio * 5),
            metric=ratio,
            metric_label="part de points hors bornes IQR",
            title=f"{col} : {ratio:.1%} de valeurs extremes",
            detail=(f"Points hors de [{low:.4g} ; {high:.4g}] (regle 1,5 x IQR). "
                    "Ils dominent une moyenne et tirent les moindres carres."),
            remedies=[
                Remedy(action="winsorize", columns=(col,),
                       label=f"Winsoriser {col} (1er-99e percentile)",
                       rationale="Borne les extremes sans supprimer d'observation."),
                Remedy(action="robust_scale", columns=(col,),
                       label=f"Mise a l'echelle robuste de {col}",
                       rationale="Centre sur la mediane, echelle sur l'IQR : insensible aux extremes.",
                       aggressive=True),
            ],
        ))

    return issues


def detect_skewness(df: pd.DataFrame, numeric: list[str]) -> list[Issue]:
    """Detecte les asymetries marquees des distributions continues."""
    issues: list[Issue] = []
    for col in numeric:
        series = pd.to_numeric(df[col], errors="coerce").dropna()
        if len(series) < 12:
            continue
        skew = measurements.skewness(series)
        if skew is None or abs(skew) < THRESHOLDS["skew"]:
            continue

        remedies: list[Remedy] = []
        if (series > 0).all():
            remedies.append(Remedy(action="log", columns=(col,),
                                   label=f"Log de {col}",
                                   rationale="Comprime la queue droite ; valable car la variable est strictement positive.",
                                   aggressive=True))
            remedies.append(Remedy(action="boxcox", columns=(col,),
                                   label=f"Box-Cox sur {col}",
                                   rationale="Choisit automatiquement la puissance qui normalise le mieux.",
                                   aggressive=True))
        elif (series >= 0).all():
            remedies.append(Remedy(action="log1p", columns=(col,),
                                   label=f"log(1+x) sur {col}",
                                   rationale="Variante du log tolerant les zeros.",
                                   aggressive=True))
        else:
            remedies.append(Remedy(action="yeo_johnson", columns=(col,),
                                   label=f"Yeo-Johnson sur {col}",
                                   rationale="Normalise une variable qui prend des valeurs negatives.",
                                   aggressive=True))

        issues.append(Issue(
            code="skewed",
            columns=(col,),
            severity=min(1.0, abs(skew) / 4),
            metric=skew,
            metric_label="coefficient d'asymetrie",
            title=f"{col} : distribution asymetrique (skew = {skew:+.2f})",
            detail=("La moyenne n'est pas representative et les tests parametriques "
                    "perdent leur garantie."),
            remedies=remedies,
        ))

    return issues


def detect_multicollinearity(df: pd.DataFrame, numeric: list[str],
                             target: str | None = None) -> list[Issue]:
    """Detecte les fortes correlations bicaracteristiques entre predicteurs."""
    if len(numeric) < 2:
        return []

    predictors = [c for c in numeric if c != target]
    if len(predictors) < 2:
        return []

    cols = list(predictors)
    if target and target in df.columns:
        cols.append(target)
    frame = df[cols].replace([np.inf, -np.inf], np.nan).dropna()
    if len(frame) < 10 or frame.shape[1] < 2:
        return []

    issues: list[Issue] = []

    for pair in measurements.strong_correlations(
            frame, predictors, threshold=THRESHOLDS["correlation"]):
        a, b, strength = pair.a, pair.b, abs(pair.r)
        drop = _least_useful(frame, a, b, target)
        kept = b if drop == a else a
        issues.append(Issue(
            code="collinearity",
            columns=(a, b),
            severity=min(1.0, (strength - 0.85) * 5),
            metric=strength,
            metric_label="|r| de Pearson",
            title=f"{a} et {b} sont redondantes (|r| = {strength:.2f})",
            detail=("Deux predicteurs quasi interchangeables rendent les coefficients "
                    "d'une regression instables : leur signe peut s'inverser d'un "
                    "echantillon a l'autre."),
            remedies=[Remedy(
                action="drop_columns", columns=(drop,),
                label=f"Retirer {drop}",
                rationale=f"Conserve {kept}, qui porte la meme information.",
            )],
            blocks_modeling=True,
        ))

    return issues


def _least_useful(frame: pd.DataFrame, a: str, b: str, target: str | None) -> str:
    """Des deux colonnes redondantes, celle dont la perte coute le moins cher."""
    if target and target in frame.columns and target not in (a, b):
        target_series = frame[target]
        if not pd.api.types.is_numeric_dtype(target_series):
            target_series = pd.Series(pd.Categorical(target_series).codes, index=frame.index, dtype=float)
            target_series = target_series.replace(-1, np.nan)

        link_a = attempt(lambda: abs(float(frame[a].corr(target_series))))
        link_b = attempt(lambda: abs(float(frame[b].corr(target_series))))
        val_a = link_a.value if link_a and np.isfinite(link_a.value) else None
        val_b = link_b.value if link_b and np.isfinite(link_b.value) else None
        if val_a is not None and val_b is not None and abs(val_a - val_b) > 1e-9:
            return b if val_a >= val_b else a

    corr = frame.select_dtypes(include=[np.number]).corr().abs()
    mean_a = corr[a].mean() if a in corr else 0.0
    mean_b = corr[b].mean() if b in corr else 0.0
    return b if mean_a >= mean_b else a


def detect_non_stationarity(df: pd.DataFrame, numeric: list[str]) -> list[Issue]:
    """Evalue la presence de racine unitaire sur les series chronologiques."""
    from app.core.exploration.probes.temporal import evaluate_stationarity

    issues: list[Issue] = []
    for col in numeric[:12]:
        series = pd.to_numeric(df[col], errors="coerce").dropna()
        if len(series) < 12:
            continue

        verdict = evaluate_stationarity(series)
        if verdict.get("status") == "indetermine":
            continue

        order = int(verdict.get("order") or 0)
        if order == 0:
            continue
        issues.append(Issue(
            code="non_stationary",
            columns=(col,),
            severity=0.55 if order == 1 else 0.75,
            metric=order,
            metric_label="ordre d'integration",
            title=f"{col} n'est pas stationnaire (I({order}))",
            detail=(f"ADF p = {verdict.get('adf_p')}, KPSS p = {verdict.get('kpss_p')}. "
                    "Une regression sur series brutes produirait une relation fallacieuse."),
            remedies=[
                Remedy(action="diff" if order == 1 else "diff2", columns=(col,),
                       label=f"Differencier {col}" + (" (ordre 2)" if order > 1 else ""),
                       rationale="Rend la serie stationnaire ; fait perdre les premieres observations.",
                       aggressive=True),
                Remedy(action="detrend", columns=(col,),
                       label=f"Retirer la tendance de {col}",
                       rationale="Alternative si la serie est trend-stationnaire plutot qu'a racine unitaire.",
                       aggressive=True),
            ],
            blocks_modeling=True,
        ))

    return issues


def detect_heteroskedasticity(df: pd.DataFrame, numeric: list[str], target: str,
                              notes: list[str]) -> list[Issue]:
    """Test de Breusch-Pagan pour heteroscedasticite des residus."""
    from statsmodels.stats.diagnostic import het_breuschpagan
    import statsmodels.api as sm

    predictors = [c for c in numeric if c != target][:10]
    if not predictors or target not in df.columns:
        return []

    if not pd.api.types.is_numeric_dtype(df[target]):
        return []

    frame = df[predictors + [target]].apply(pd.to_numeric, errors="coerce")
    frame = frame.replace([np.inf, -np.inf], np.nan).dropna()
    if len(frame) < 30:
        return []

    exog = sm.add_constant(frame[predictors])
    fitted = attempt(lambda: sm.OLS(frame[target], exog).fit())
    if not fitted:
        notes.append(f"Test d'hétéroscédasticité impossible : {fitted.reason}")
        return []

    test = attempt(het_breuschpagan, fitted.value.resid, exog)
    if not test:
        notes.append(f"Test de Breusch-Pagan impossible : {test.reason}")
        return []

    p_value = test.value[1]
    if not np.isfinite(p_value) or p_value >= THRESHOLDS["heteroskedastic_p"]:
        return []

    positive = (frame[target] > 0).all()
    remedies = [Remedy(
        action="robust_se", columns=(target,),
        label="Utiliser des erreurs standard robustes (HC1)",
        rationale="Corrige les tests sans modifier les donnees.",
    )]
    if positive:
        remedies.insert(0, Remedy(
            action="log", columns=(target,),
            label=f"Modeliser log({target})",
            rationale="Stabilise la variance quand l'erreur croit avec le niveau.",
            aggressive=True,
        ))

    return [Issue(
        code="heteroskedastic",
        columns=(target,),
        severity=0.5,
        metric=float(p_value),
        metric_label="p-value de Breusch-Pagan",
        title=f"Variance des erreurs non constante sur {target} (p = {p_value:.3g})",
        detail=("L'amplitude des erreurs depend du niveau predit : les intervalles de confiance "
                "et les tests d'une regression classique sont fausses."),
        remedies=remedies,
        blocks_modeling=True,
    )]
