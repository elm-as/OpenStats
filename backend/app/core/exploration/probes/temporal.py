"""
Sondes temporelles : stationnarite, tendance, ruptures et causalite de Granger.

La stationnarite est evaluee une fois et deposee comme fait ; les sondes de
causalite ne se declenchent qu'ensuite, sur des series rendues stationnaires.
C'est ce chainage qui evite de tester Granger sur des series I(1) (regression
fallacieuse).
"""

from __future__ import annotations

import warnings

import numpy as np
import pandas as pd

from app.core.statistical_attempt import DEGENERATE_DATA_ERRORS, attempt, describe
from app.core.exploration.context import ExplorationContext
from app.core.exploration.finding import Finding

MIN_OBS_STATIONARITY = 12
MIN_OBS_GRANGER = 25
MAX_GRANGER_LAG = 4


def _ordered_series(ctx: ExplorationContext, col: str) -> pd.Series:
    """Serie numerique triee selon l'axe temporel du dataset."""
    if not ctx.temporal_cols:
        return pd.to_numeric(ctx.df[col], errors="coerce").dropna()

    time_col = ctx.temporal_cols[0]
    frame = ctx.df[[time_col, col]].copy()
    frame[col] = pd.to_numeric(frame[col], errors="coerce")
    frame = frame.dropna().sort_values(time_col)
    return frame[col].reset_index(drop=True)


def probe_stationarity(ctx: ExplorationContext) -> list[Finding]:
    """ADF + KPSS sur la cible et ses principales covariables.

    Contrairement au detecteur historique, un test qui echoue produit un statut
    'indetermine' explicite au lieu d'une p-value fabriquee.
    """
    findings: list[Finding] = []
    columns = ([ctx.target] if ctx.has_target and ctx.target in ctx.numeric_cols else [])
    columns += [c for c in ctx.top_covariates(5, kinds=("numeric",)) if c != ctx.target]

    for col in columns:
        series = _ordered_series(ctx, col)
        if len(series) < MIN_OBS_STATIONARITY:
            continue

        verdict = evaluate_stationarity(series)
        if verdict["status"] == "indetermine":
            ctx.notes.append(f"Stationnarite de {col} indeterminee : {verdict.get('reason', '')}")
            continue
        if verdict["stationary"]:
            continue

        findings.append(Finding(
            kind="non_stationnarite",
            variables=(col,),
            effect_size=0.6 if verdict["order"] == 1 else 0.8,
            effect_metric="ordre d'integration",
            headline=f"{col} n'est pas stationnaire : integree d'ordre {verdict['order']}",
            detail=(f"ADF p = {verdict['adf_p']:.3g} (H0 : racine unitaire), "
                    f"KPSS p = {verdict['kpss_p']:.3g} (H0 : stationnarite). "
                    f"Il faut differencier {verdict['order']} fois avant toute regression : "
                    "sur des series brutes, une correlation eleve est probablement fallacieuse."),
            p_value=verdict["adf_p"],
            n=len(series),
            establishes=("non_stationnarite", "differenciation_requise"),
            payload=verdict,
            probe="stationarity",
        ))

    return findings


def evaluate_stationarity(series: pd.Series, max_diff: int = 2) -> dict:
    """Ordre d'integration par ADF + KPSS, avec statut explicite en cas d'echec.

    KPSS est appele avec regression='ct' au niveau afin de ne pas confondre une
    serie trend-stationnaire avec une racine unitaire (source classique de
    sur-differenciation).
    """
    from statsmodels.tsa.stattools import adfuller, kpss

    work = series.dropna().astype(float)
    if len(work) < MIN_OBS_STATIONARITY:
        return {"status": "indetermine", "reason": "serie trop courte",
                "stationary": False, "order": None, "adf_p": None, "kpss_p": None}

    level_adf = level_kpss = None
    level_kpss_bounded = False

    for order in range(max_diff + 1):
        if work.nunique() < 3:
            return {"status": "indetermine", "reason": "serie degeneree apres differenciation",
                    "stationary": False, "order": None, "adf_p": level_adf, "kpss_p": level_kpss}
        try:
            adf_p = float(adfuller(work, autolag="AIC")[1])
            # 'ct' au niveau (trend-stationnarite possible), 'c' apres differenciation.
            kpss_p, p_is_bound = _kpss_pvalue(work, "ct" if order == 0 else "c")
        except DEGENERATE_DATA_ERRORS as exc:
            return {"status": "indetermine", "reason": describe(exc, limit=120),
                    "stationary": False, "order": None, "adf_p": level_adf, "kpss_p": level_kpss}

        if order == 0:
            level_adf, level_kpss = round(adf_p, 4), round(kpss_p, 4)
            level_kpss_bounded = p_is_bound

        rejects_unit_root = adf_p < 0.05
        keeps_stationarity = kpss_p > 0.05

        if rejects_unit_root and keeps_stationarity:
            return {"status": "conclusif", "stationary": True, "order": order,
                    "adf_p": level_adf, "kpss_p": level_kpss,
                    "kpss_p_bounded": level_kpss_bounded}
        if rejects_unit_root != keeps_stationarity and order == 0:
            # Les deux tests se contredisent : information utile, pas un verdict.
            return {"status": "contradictoire", "stationary": False, "order": 1,
                    "adf_p": level_adf, "kpss_p": level_kpss,
                    "kpss_p_bounded": level_kpss_bounded,
                    "reason": "ADF et KPSS ne concordent pas au niveau"}

        if order < max_diff:
            work = work.diff().dropna()

    return {"status": "conclusif", "stationary": False, "order": max_diff,
            "adf_p": level_adf, "kpss_p": level_kpss,
            "kpss_p_bounded": level_kpss_bounded}


def _kpss_pvalue(series: pd.Series, regression: str) -> tuple[float, bool]:
    """p-value KPSS, en signalant si elle est bornee par la table de reference.

    statsmodels emet un InterpolationWarning quand la statistique sort de la
    table : la p-value renvoyee est alors une borne, pas une valeur exacte.
    C'est une information a conserver, pas un bruit a masquer.
    """
    from statsmodels.tools.sm_exceptions import InterpolationWarning
    from statsmodels.tsa.stattools import kpss

    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always", InterpolationWarning)
        p_value = float(kpss(series, regression=regression, nlags="auto")[1])
    bounded = any(issubclass(w.category, InterpolationWarning) for w in caught)
    return p_value, bounded


def probe_trend(ctx: ExplorationContext) -> list[Finding]:
    """Tendance monotone de la cible dans le temps (Mann-Kendall via Spearman)."""
    from scipy import stats

    if not ctx.has_target or ctx.target not in ctx.numeric_cols:
        return []

    series = _ordered_series(ctx, ctx.target)
    if len(series) < MIN_OBS_STATIONARITY:
        return []

    time_index = np.arange(len(series))
    outcome = attempt(stats.spearmanr, time_index, series.to_numpy())
    if not outcome:
        ctx.notes.append(f"Test de tendance impossible : {outcome.reason}")
        return []
    rho, p = outcome.value

    if not np.isfinite(p) or p >= 0.05 or abs(rho) < 0.3:
        return []

    direction = "croissante" if rho > 0 else "decroissante"
    first, last = float(series.iloc[0]), float(series.iloc[-1])
    change = (last - first) / abs(first) if first else 0.0

    return [Finding(
        kind="tendance",
        variables=(ctx.target,),
        effect_size=abs(float(rho)),
        effect_metric="rho de Spearman contre le temps",
        headline=f"{ctx.target} suit une tendance {direction} nette (rho = {rho:+.2f})",
        detail=(f"Progression monotone sur {len(series)} periodes, de {first:.4g} a {last:.4g} "
                f"({change:+.1%}). Toute comparaison entre periodes doit tenir compte de cette "
                "derive, sous peine d'attribuer a un facteur ce qui releve du temps."),
        p_value=float(p),
        n=len(series),
        establishes=("tendance",),
        payload={"rho": round(float(rho), 4), "first": first, "last": last,
                 "relative_change": round(change, 4)},
        probe="trend",
    )]


def probe_granger(ctx: ExplorationContext) -> list[Finding]:
    """Causalite de Granger sur series stationnarisees.

    Declenchee apres l'evaluation de la stationnarite : les series sont
    differenciees autant que necessaire avant le test.
    """
    from statsmodels.tsa.stattools import grangercausalitytests

    if not ctx.has_target or ctx.target not in ctx.numeric_cols:
        return []

    findings: list[Finding] = []
    target_series = _make_stationary(_ordered_series(ctx, ctx.target))
    if target_series is None or len(target_series) < MIN_OBS_GRANGER:
        return []

    for col in ctx.top_covariates(4, kinds=("numeric",)):
        if col == ctx.target:
            continue
        driver = _make_stationary(_ordered_series(ctx, col))
        if driver is None:
            continue

        length = min(len(target_series), len(driver))
        if length < MIN_OBS_GRANGER:
            continue

        data = pd.DataFrame({
            "y": target_series.iloc[-length:].to_numpy(),
            "x": driver.iloc[-length:].to_numpy(),
        })
        max_lag = max(1, min(MAX_GRANGER_LAG, length // 8))

        granger = attempt(grangercausalitytests, data[["y", "x"]], maxlag=max_lag)
        if not granger:
            ctx.notes.append(f"Granger indisponible pour {col} : {granger.reason}")
            continue
        raw = granger.value

        # Un test par retard : on corrige la p-value du minimum par le nombre
        # de retards essayes (Bonferroni), sans quoi le choix du lag est du p-hacking.
        per_lag = {lag: float(res[0]["ssr_ftest"][1]) for lag, res in raw.items()}
        best_lag = min(per_lag, key=per_lag.get)
        adjusted_p = min(1.0, per_lag[best_lag] * len(per_lag))
        if adjusted_p >= 0.05:
            continue

        findings.append(Finding(
            kind="causalite_granger",
            variables=(col, ctx.target),
            effect_size=min(1.0, 0.4 + 0.6 * (1 - adjusted_p)),
            effect_metric="test F de Granger (p corrigee)",
            headline=f"{col} precede {ctx.target} de {best_lag} periode(s) (Granger, p = {adjusted_p:.3g})",
            detail=(f"Les valeurs passees de {col} ameliorent la prevision de {ctx.target} au-dela "
                    f"de son propre passe, sur series differenciees. p corrigee de Bonferroni sur "
                    f"{len(per_lag)} retards testes. Precedence temporelle, pas preuve de causalite."),
            p_value=adjusted_p,
            n=length,
            establishes=("causalite_granger", "predicteur_avance"),
            payload={"best_lag": int(best_lag), "p_by_lag": {str(k): round(v, 5) for k, v in per_lag.items()},
                     "lags_tested": len(per_lag)},
            probe="granger",
        ))

    return findings


def _make_stationary(series: pd.Series, max_diff: int = 2) -> pd.Series | None:
    """Differencie la serie jusqu'a stationnarite, ou renvoie None si impossible."""
    verdict = evaluate_stationarity(series, max_diff=max_diff)
    order = verdict.get("order")
    if order is None:
        return None
    work = series.dropna().astype(float)
    for _ in range(int(order)):
        work = work.diff().dropna()
    return work if len(work) >= MIN_OBS_GRANGER else None
