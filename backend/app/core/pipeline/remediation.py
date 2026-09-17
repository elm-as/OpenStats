"""
Application des remedes et boucle correction / re-diagnostic (etapes 7 et 8).

La boucle est la piece delicate : sans garde-fous elle tourne indefiniment ou
degrade les donnees. Quatre conditions d'arret la bornent :

  1. plus aucun probleme non resolu ;
  2. plafond d'iterations atteint ;
  3. la gravite cumulee ne diminue plus (correction sterile) ;
  4. un remede deja tente sur une colonne n'est jamais rejoue.

Le jeu de donnees d'origine est conserve : chaque iteration est reversible et
l'utilisateur voit l'avant/apres.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import numpy as np
import pandas as pd

from app.core.pipeline.diagnostics import Issue, Remedy, diagnose, severity_total, summarize
from app.core.statistical_attempt import DEGENERATE_DATA_ERRORS, describe

MAX_ITERATIONS = 5
MIN_IMPROVEMENT = 0.02          # gain de gravite minimal pour juger une iteration utile
STRUCTURAL_ACTIONS = {"drop_columns", "drop_duplicates", "impute", "robust_se"}

# Transformations qui redefinissent l'echelle ou la forme d'une variable.
# Une seule s'applique par colonne sur toute la session : enchainer un log
# puis un Box-Cox sur la meme serie n'a pas de sens statistique.
SHAPE_ACTIONS = {"log", "log1p", "sqrt", "reciprocal", "square", "boxcox",
                 "yeo_johnson", "standardize", "minmax", "robust_scale",
                 "winsorize", "rank", "diff", "diff2", "seasonal_diff", "detrend"}


@dataclass
class AppliedRemedy:
    remedy: Remedy
    ok: bool
    message: str
    before: dict[str, Any] = field(default_factory=dict)
    after: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            **self.remedy.to_dict(),
            "ok": self.ok,
            "message": self.message,
            "before": self.before,
            "after": self.after,
        }


@dataclass
class Iteration:
    index: int
    issues_before: list[Issue]
    applied: list[AppliedRemedy]
    issues_after: list[Issue]
    severity_before: float
    severity_after: float
    resolved_keys: list[str]
    stop_reason: str | None = None
    kept: bool = True               # False si l'iteration a ete annulee faute de gain

    def to_dict(self) -> dict[str, Any]:
        return {
            "index": self.index,
            "severity_before": round(self.severity_before, 4),
            "severity_after": round(self.severity_after, 4),
            "gain": round(self.severity_before - self.severity_after, 4),
            "issues_before": [i.to_dict() for i in self.issues_before],
            "issues_after": [i.to_dict() for i in self.issues_after],
            "applied": [a.to_dict() for a in self.applied],
            "resolved": self.resolved_keys,
            "stop_reason": self.stop_reason,
            "kept": self.kept,
        }


def _column_stats(series: pd.Series) -> dict[str, Any]:
    """Signature chiffree d'une colonne, pour montrer l'effet d'un remede."""
    numeric = pd.to_numeric(series, errors="coerce").dropna()
    if numeric.empty:
        return {"n": int(series.notna().sum()), "missing": float(series.isna().mean())}

    from scipy import stats as sps
    q1, q3 = numeric.quantile(0.25), numeric.quantile(0.75)
    iqr = q3 - q1
    outliers = float(((numeric < q1 - 1.5 * iqr) | (numeric > q3 + 1.5 * iqr)).mean()) if iqr > 0 else 0.0
    # Les moments d'ordre 3 demandent au moins 3 points et de la variance.
    skew = float(sps.skew(numeric)) if len(numeric) >= 3 and numeric.nunique() > 1 else 0.0

    return {
        "n": int(len(numeric)),
        "missing": round(float(series.isna().mean()), 4),
        "mean": round(float(numeric.mean()), 6),
        "std": round(float(numeric.std()), 6),
        "skew": round(skew, 4),
        "outlier_ratio": round(outliers, 4),
    }


def apply_remedy(df: pd.DataFrame, remedy: Remedy,
                 protected: str | None = None) -> tuple[pd.DataFrame, AppliedRemedy]:
    """Applique un remede et renvoie le dataframe modifie plus la trace de l'effet.

    `protected` (la cible) ne peut jamais etre supprimee, meme si un appelant
    le demande : perdre la variable modelisee invaliderait tout le pipeline.
    """
    action = remedy.action
    columns = [c for c in remedy.columns if c in df.columns]
    if action == "drop_columns" and protected:
        columns = [c for c in columns if c != protected]

    before = {c: _column_stats(df[c]) for c in columns}

    try:
        if action == "drop_duplicates":
            n_before = len(df)
            out = df.drop_duplicates().reset_index(drop=True)
            return out, AppliedRemedy(remedy, True,
                                      f"{n_before - len(out)} lignes retirees",
                                      {"rows": n_before}, {"rows": len(out)})

        if action == "drop_columns":
            if not columns:
                return df, AppliedRemedy(remedy, False, "colonnes deja absentes")
            out = df.drop(columns=columns)
            return out, AppliedRemedy(remedy, True,
                                      f"{len(columns)} colonne(s) retiree(s)",
                                      {"columns": df.shape[1]}, {"columns": out.shape[1]})

        if action == "impute":
            if not columns:
                return df, AppliedRemedy(remedy, False, "colonne absente")
            out = df.copy()
            strategy = remedy.params.get("strategy", "median")
            for col in columns:
                if strategy == "median" and pd.api.types.is_numeric_dtype(out[col]):
                    out[col] = out[col].fillna(out[col].median())
                else:
                    mode = out[col].mode()
                    if not mode.empty:
                        out[col] = out[col].fillna(mode.iloc[0])
            after = {c: _column_stats(out[c]) for c in columns}
            return out, AppliedRemedy(remedy, True, "valeurs manquantes imputees", before, after)

        if action == "robust_se":
            # Remede de modelisation : ne touche pas aux donnees, se propage au modele.
            return df, AppliedRemedy(remedy, True,
                                     "erreurs standard robustes activees pour la modelisation")

        # Toute autre action est une transformation du catalogue existant.
        from app.core.transformations_apply import apply_transform

        if not columns:
            return df, AppliedRemedy(remedy, False, "colonne absente")

        out = df.copy()
        for col in columns:
            transformed, meta = apply_transform(out[col], action, remedy.params or None)
            if meta.get("error"):
                return df, AppliedRemedy(remedy, False, str(meta["error"]))
            out[col] = transformed

        out = out.replace([np.inf, -np.inf], np.nan)
        after = {c: _column_stats(out[c]) for c in columns}
        return out, AppliedRemedy(remedy, True, f"transformation '{action}' appliquee", before, after)

    except DEGENERATE_DATA_ERRORS as exc:
        # Le remede est refuse et la raison remonte a l'utilisateur ; le
        # jeu de donnees d'origine est renvoye inchange.
        return df, AppliedRemedy(remedy, False, describe(exc))


def select_remedies(issues: list[Issue], already_tried: set[str],
                    shaped: set[str], allow_aggressive: bool = True,
                    target: str | None = None) -> list[Remedy]:
    """Choisit un remede par probleme non resolu, du plus grave au moins grave.

    Une seule correction par colonne et par iteration : appliquer un log et une
    winsorisation dans le meme tour rendrait l'effet de chacune illisible.
    """
    chosen: list[Remedy] = []
    touched: set[str] = set()

    for issue in sorted(issues, key=lambda i: -i.severity):
        for remedy in issue.remedies:
            if remedy.aggressive and not allow_aggressive:
                continue
            # Garde-fou : aucun remede ne peut supprimer la variable modelisee.
            if remedy.action == "drop_columns" and target and target in remedy.columns:
                continue
            signature = f"{remedy.action}::{','.join(sorted(remedy.columns))}"
            if signature in already_tried:
                continue
            if any(col in touched for col in remedy.columns):
                continue
            # Une colonne ne subit qu'une seule transformation de forme.
            if remedy.action in SHAPE_ACTIONS and any(c in shaped for c in remedy.columns):
                continue

            chosen.append(remedy)
            already_tried.add(signature)
            touched.update(remedy.columns)
            break

    return chosen


def run_correction_loop(
    df: pd.DataFrame,
    target: str | None = None,
    is_timeseries: bool = False,
    max_iterations: int = MAX_ITERATIONS,
    allow_aggressive: bool = True,
    kinds: dict[str, str] | None = None,
) -> tuple[dict[str, Any], pd.DataFrame]:
    """Boucle etapes 7 et 8 : corriger, re-diagnostiquer, recommencer si utile.

    Renvoie (rapport, dataframe corrige).
    """
    original = df
    working = df.copy()
    tried: set[str] = set()
    shaped: set[str] = set()        # colonnes deja transformees en forme
    iterations: list[Iteration] = []
    modeling_flags: set[str] = set()

    issues = diagnose(working, target=target, is_timeseries=is_timeseries, kinds=kinds)
    initial_summary = summarize(issues)
    stop_reason = "aucun probleme detecte" if not issues else None

    for index in range(1, max_iterations + 1):
        if not issues:
            stop_reason = "tous les problemes sont resolus"
            break

        remedies = select_remedies(issues, tried, shaped,
                                   allow_aggressive=allow_aggressive, target=target)
        if not remedies:
            stop_reason = "plus aucun remede disponible qui n'ait deja ete tente"
            break

        severity_before = severity_total(issues)
        candidate = working
        applied: list[AppliedRemedy] = []

        for remedy in remedies:
            candidate, trace = apply_remedy(candidate, remedy, protected=target)
            applied.append(trace)
            if trace.ok and remedy.action == "robust_se":
                modeling_flags.add("robust_se")

        issues_after = diagnose(candidate, target=target, is_timeseries=is_timeseries,
                                kinds=kinds)
        severity_after = severity_total(issues_after)

        keys_before = {i.key for i in issues}
        keys_after = {i.key for i in issues_after}
        resolved = sorted(keys_before - keys_after)

        improved = severity_before - severity_after >= MIN_IMPROVEMENT

        iteration = Iteration(
            index=index,
            issues_before=issues,
            applied=applied,
            issues_after=issues_after,
            severity_before=severity_before,
            severity_after=severity_after,
            resolved_keys=resolved,
            stop_reason=None if improved else "correction sans gain mesurable",
        )
        iterations.append(iteration)

        if not improved:
            # On conserve malgre tout les corrections structurelles, qui sont
            # toujours souhaitables meme si la gravite globale bouge peu.
            structural = all(a.remedy.action in STRUCTURAL_ACTIONS for a in applied if a.ok)
            if structural and resolved:
                working = candidate
                issues = issues_after
            else:
                # Les corrections de cette iteration sont annulees : le rapport
                # doit le dire, sans quoi elles sembleraient tenir.
                iteration.kept = False
            stop_reason = "la correction n'ameliore plus le diagnostic"
            break

        working = candidate
        issues = issues_after
        for trace in applied:
            if trace.ok and trace.remedy.action in SHAPE_ACTIONS:
                shaped.update(trace.remedy.columns)
    else:
        stop_reason = f"plafond de {max_iterations} iterations atteint"

    final_summary = summarize(issues)

    return {
        "iterations": [it.to_dict() for it in iterations],
        "initial": initial_summary,
        "final": final_summary,
        "remaining_issues": [i.to_dict() for i in issues],
        "stop_reason": stop_reason,
        "modeling_flags": sorted(modeling_flags),
        "ready_for_modeling": not any(i.blocks_modeling for i in issues),
        "shape_before": {"rows": len(original), "columns": original.shape[1]},
        "shape_after": {"rows": len(working), "columns": working.shape[1]},
        "columns_removed": sorted(set(original.columns) - set(working.columns)),
    }, working
