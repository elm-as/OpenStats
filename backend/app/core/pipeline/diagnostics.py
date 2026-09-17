"""
Diagnostics : detection typee des problemes d'un jeu de donnees.

Chaque probleme detecte connait ses remedes possibles. C'est ce couplage qui
permet a la boucle correction/re-diagnostic de fonctionner sans regles ad hoc :
l'etape 7 se contente de choisir parmi les remedes que l'etape 6 a proposes.

Les remedes s'appuient sur le catalogue de transformations existant
(`app.core.transformations_catalog`), pas sur une implementation parallele.
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any

import numpy as np
import pandas as pd
from scipy import stats

from app.core import measurements
from app.core.statistical_attempt import attempt

# Seuils de declenchement. Regroupes ici pour rester ajustables d'un seul endroit.
THRESHOLDS = {
    "missing_ratio": 0.05,
    "missing_severe": 0.40,
    "outlier_ratio": 0.02,
    "skew": 1.0,
    "correlation": 0.90,
    "vif": 10.0,
    "adf_p": 0.05,
    "heteroskedastic_p": 0.05,
    "duplicate_ratio": 0.01,
    "cardinality_ratio": 0.95,
}


@dataclass
class Remedy:
    """Une correction applicable, exprimee dans le vocabulaire du catalogue existant."""

    action: str                       # cle de transformation, ou action structurelle
    columns: tuple[str, ...]
    label: str
    rationale: str
    params: dict[str, Any] = field(default_factory=dict)
    aggressive: bool = False          # modifie la semantique des variables

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["columns"] = list(self.columns)
        return data


@dataclass
class Issue:
    """Un probleme detecte, avec sa gravite et ses remedes candidats."""

    code: str
    columns: tuple[str, ...]
    severity: float                   # 0..1
    metric: float
    metric_label: str
    title: str
    detail: str
    remedies: list[Remedy] = field(default_factory=list)
    blocks_modeling: bool = False

    @property
    def key(self) -> str:
        """Identite stable d'un probleme, pour suivre sa resolution d'une iteration a l'autre."""
        return f"{self.code}::{','.join(sorted(self.columns))}"

    def to_dict(self) -> dict[str, Any]:
        return {
            "key": self.key,
            "code": self.code,
            "columns": list(self.columns),
            "severity": round(self.severity, 4),
            "metric": round(float(self.metric), 6) if self.metric is not None else None,
            "metric_label": self.metric_label,
            "title": self.title,
            "detail": self.detail,
            "blocks_modeling": self.blocks_modeling,
            "remedies": [r.to_dict() for r in self.remedies],
        }


# ── Detecteurs ───────────────────────────────────────────────────────────

def diagnose(df: pd.DataFrame, target: str | None = None,
             is_timeseries: bool = False,
             kinds: dict[str, str] | None = None,
             notes: list[str] | None = None) -> list[Issue]:
    """Passe complete de diagnostic. Renvoie les problemes tries par gravite.

    `kinds` porte le typage declare : une colonne declaree categorielle n'est
    pas diagnostiquee comme une grandeur numerique, meme si elle contient des
    nombres.
    """
    if kinds:
        numeric = [c for c in df.columns if kinds.get(c) == "numeric"]
    else:
        numeric = [c for c in df.columns
                   if pd.api.types.is_numeric_dtype(df[c]) and df[c].nunique(dropna=True) > 2]

    notes = notes if notes is not None else []

    issues: list[Issue] = []
    issues += _duplicates(df)
    issues += _constant_columns(df)
    issues += _high_cardinality(df)
    issues += _missing_values(df)
    issues += _outliers(df, numeric)
    issues += _skewness(df, numeric)
    issues += _multicollinearity(df, numeric, target)
    if is_timeseries:
        issues += _non_stationarity(df, numeric)
    if target and target in df.columns:
        issues += _heteroskedasticity(df, numeric, target, notes)

    return sorted(issues, key=lambda i: -i.severity)


def _duplicates(df: pd.DataFrame) -> list[Issue]:
    if df.empty:
        return []
    count, ratio = measurements.duplicate_rows(df)
    if ratio < THRESHOLDS["duplicate_ratio"]:
        return []

    return [Issue(
        code="duplicates",
        columns=("<lignes>",),
        severity=min(1.0, ratio * 6),
        metric=ratio,
        metric_label="part de lignes dupliquees",
        title=f"{count} lignes dupliquees ({ratio:.1%})",
        detail=("Des observations repetees gonflent artificiellement la taille d'echantillon : "
                "les p-values deviennent trop petites et les intervalles trop etroits."),
        remedies=[Remedy(
            action="drop_duplicates", columns=("<lignes>",),
            label="Supprimer les lignes dupliquees",
            rationale=f"Retire {count} doublons exacts.",
        )],
    )]


def _constant_columns(df: pd.DataFrame) -> list[Issue]:
    dead = measurements.constant_columns(df)
    if not dead:
        return []

    return [Issue(
        code="constant",
        columns=tuple(dead),
        severity=0.35,
        metric=len(dead),
        metric_label="colonnes sans variance",
        title=f"{len(dead)} colonne(s) sans aucune variation",
        detail=(f"{', '.join(dead[:5])} ne varie(nt) pas : ces colonnes ne peuvent rien expliquer "
                "et font echouer certains calculs (division par une variance nulle)."),
        remedies=[Remedy(
            action="drop_columns", columns=tuple(dead),
            label="Retirer les colonnes constantes",
            rationale="Aucune information exploitable.",
        )],
    )]


def _high_cardinality(df: pd.DataFrame) -> list[Issue]:
    """Colonnes textuelles quasi uniques : identifiants deguises en variables."""
    suspects = measurements.identifier_like_columns(
        df, uniqueness=THRESHOLDS["cardinality_ratio"])
    if not suspects:
        return []

    return [Issue(
        code="identifier_like",
        columns=tuple(suspects),
        severity=0.4,
        metric=len(suspects),
        metric_label="colonnes quasi uniques",
        title=f"{len(suspects)} colonne(s) se comportent comme des identifiants",
        detail=(f"{', '.join(suspects[:4])} : presque autant de modalites que de lignes. "
                "Utilisees comme predicteurs, elles provoquent du surapprentissage."),
        remedies=[Remedy(
            action="drop_columns", columns=tuple(suspects),
            label="Exclure les colonnes identifiantes",
            rationale="Sans pouvoir explicatif generalisable.",
        )],
    )]


def _missing_values(df: pd.DataFrame) -> list[Issue]:
    issues: list[Issue] = []
    for col, ratio in measurements.missing_rates(df).items():
        if ratio < THRESHOLDS["missing_ratio"]:
            continue

        numeric = pd.api.types.is_numeric_dtype(df[col])
        remedies: list[Remedy] = []

        if ratio >= THRESHOLDS["missing_severe"]:
            remedies.append(Remedy(
                action="drop_columns", columns=(col,),
                label=f"Retirer {col}",
                rationale=f"{ratio:.0%} de valeurs manquantes : l'imputation inventerait l'essentiel.",
            ))

        remedies.append(Remedy(
            action="impute", columns=(col,),
            label=f"Imputer {col} par la {'mediane' if numeric else 'modalite la plus frequente'}",
            rationale="Conserve toutes les lignes ; sous-estime legerement la variance.",
            params={"strategy": "median" if numeric else "mode"},
        ))

        issues.append(Issue(
            code="missing",
            columns=(col,),
            severity=min(1.0, ratio * 2),
            metric=ratio,
            metric_label="taux de valeurs manquantes",
            title=f"{col} : {ratio:.1%} de valeurs manquantes",
            detail=("Supprimer les lignes incompletes amputerait l'echantillon ; "
                    "imputer sans le dire fausserait les intervalles de confiance."),
            remedies=remedies,
        ))

    return issues


def _outliers(df: pd.DataFrame, numeric: list[str]) -> list[Issue]:
    issues: list[Issue] = []
    for col in numeric:
        bounds = measurements.outliers(df[col])
        if bounds is None or bounds.ratio < THRESHOLDS["outlier_ratio"]:
            continue
        ratio, low, high = bounds.ratio, bounds.lower, bounds.upper
        series = pd.to_numeric(df[col], errors="coerce").dropna()

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


def _skewness(df: pd.DataFrame, numeric: list[str]) -> list[Issue]:
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


def _multicollinearity(df: pd.DataFrame, numeric: list[str],
                       target: str | None = None) -> list[Issue]:
    if len(numeric) < 2:
        return []

    # La cible est exclue des paires testees : elle n'est pas un predicteur
    # redondant, mais elle sert a arbitrer laquelle des deux conserver.
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

        # On retire celle dont la perte coute le moins cher pour predire la
        # cible ; a defaut de cible, la plus redondante avec le reste.
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
        link_a = abs(float(frame[a].corr(frame[target])))
        link_b = abs(float(frame[b].corr(frame[target])))
        if np.isfinite(link_a) and np.isfinite(link_b) and abs(link_a - link_b) > 1e-9:
            return b if link_a >= link_b else a

    corr = frame.corr().abs()
    return b if corr[a].mean() >= corr[b].mean() else a


def _non_stationarity(df: pd.DataFrame, numeric: list[str]) -> list[Issue]:
    from app.core.exploration.probes.temporal import evaluate_stationarity

    issues: list[Issue] = []
    for col in numeric[:12]:
        series = pd.to_numeric(df[col], errors="coerce").dropna()
        if len(series) < 12:
            continue

        verdict = evaluate_stationarity(series)
        if verdict.get("status") == "indetermine":
            continue

        # `stationary` signifie « stationnaire APRES `order` differenciations ».
        # Seul order == 0 correspond a une serie deja stationnaire en niveau ;
        # au-dela, la serie est integree et doit etre signalee.
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


def _heteroskedasticity(df: pd.DataFrame, numeric: list[str], target: str,
                        notes: list[str]) -> list[Issue]:
    from statsmodels.stats.diagnostic import het_breuschpagan
    import statsmodels.api as sm

    predictors = [c for c in numeric if c != target][:10]
    if not predictors or target not in df.columns:
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


# ── Agregation ───────────────────────────────────────────────────────────

def severity_total(issues: list[Issue]) -> float:
    """Gravite cumulee, utilisee comme critere de progression de la boucle."""
    return round(sum(i.severity for i in issues), 6)


def summarize(issues: list[Issue]) -> dict[str, Any]:
    by_code: dict[str, int] = {}
    for issue in issues:
        by_code[issue.code] = by_code.get(issue.code, 0) + 1
    return {
        "count": len(issues),
        "severity_total": severity_total(issues),
        "blocking": sum(1 for i in issues if i.blocks_modeling),
        "by_code": by_code,
    }
