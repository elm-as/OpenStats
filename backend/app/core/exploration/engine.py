"""
Moteur d'exploration : boucle de recherche best-first sous budget.

Le principe, oppose a celui d'une recette figee :

  1. on construit le contexte et on classe les covariables par pertinence ;
  2. a chaque tour, on choisit la sonde au meilleur rapport interet/cout parmi
     celles qui sont *actuellement* debloquees ;
  3. on execute, on recolte des Findings, on met a jour les faits ;
  4. les nouveaux faits debloquent de nouvelles sondes -> retour en 2.

La boucle est 'anytime' : elle produit un evenement a chaque etape et un
resultat exploitable a tout moment, meme si le budget est epuise.
"""

from __future__ import annotations

import contextlib
import io
import time
import warnings
from dataclasses import dataclass, field
from typing import Any, Iterator

import pandas as pd

from app.core.exploration.catalog import CATALOG, ProbeSpec, admissible_probes, ready_probes
from app.core.exploration.context import ExplorationContext, build_context
from app.core.exploration.finding import Finding, rank_findings
from app.core.exploration.multiplicity import apply_fdr
from app.core.statistical_attempt import DEGENERATE_DATA_ERRORS, describe

DEFAULT_BUDGET_SEC = 45.0


@dataclass
class ProbeRun:
    """Trace d'execution d'une sonde : sert au decompte des tests et a la transparence."""

    key: str
    label: str
    status: str                      # success | empty | error | skipped_budget
    duration_ms: int = 0
    n_findings: int = 0
    triggered_by: list[str] = field(default_factory=list)
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "key": self.key, "label": self.label, "status": self.status,
            "duration_ms": self.duration_ms, "n_findings": self.n_findings,
            "triggered_by": self.triggered_by, "error": self.error,
        }


@dataclass
class ExplorationResult:
    """Resultat complet d'une session d'exploration."""

    target: str | None
    target_kind: str | None
    findings: list[Finding] = field(default_factory=list)
    runs: list[ProbeRun] = field(default_factory=list)
    facts: set[str] = field(default_factory=set)
    covariate_ranking: list[tuple[str, float]] = field(default_factory=list)
    fdr: dict[str, int] = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)
    elapsed_sec: float = 0.0
    budget_exhausted: bool = False

    def to_dict(self) -> dict[str, Any]:
        seen: set[str] = set()
        serialized = []
        for finding in self.findings:
            serialized.append(finding.to_dict(seen))
            seen.update(finding.variables)

        return {
            "target": self.target,
            "target_kind": self.target_kind,
            "findings": serialized,
            "runs": [r.to_dict() for r in self.runs],
            "facts": sorted(self.facts),
            "covariate_ranking": [{"column": c, "mutual_info": s} for c, s in self.covariate_ranking],
            "fdr": self.fdr,
            "notes": self.notes,
            "elapsed_sec": round(self.elapsed_sec, 2),
            "budget_exhausted": self.budget_exhausted,
            "summary": self.summary(),
        }

    def summary(self) -> dict[str, Any]:
        retained = [f for f in self.findings if f.survives_fdr is not False]
        return {
            "probes_run": len([r for r in self.runs if r.status in ("success", "empty")]),
            "probes_available": len(CATALOG),
            "findings_total": len(self.findings),
            "findings_retained": len(retained),
            "hypotheses_tested": self.fdr.get("tested", 0),
            "surviving_fdr": self.fdr.get("surviving", 0),
            "descriptive_findings": self.fdr.get("descriptive", 0),
        }


def _priority(spec: ProbeSpec, ctx: ExplorationContext) -> float:
    """Rapport interet attendu / cout. Une sonde debloquee par un fait est prioritaire.

    Le bonus de declenchement traduit l'idee centrale : une piste ouverte par un
    resultat reel vaut mieux qu'une analyse generique lancee dans le vide.
    """
    trigger_bonus = 0.4 * len(spec.triggered_by & ctx.facts)
    return (spec.base_priority + trigger_bonus) / max(0.1, spec.cost(ctx))


def _run_quietly(spec: ProbeSpec, ctx: ExplorationContext) -> list[Finding]:
    """Execute une sonde en confinant le bruit des bibliotheques statistiques.

    statsmodels imprime les tables de Granger sur stdout et emet des
    InterpolationWarning sur KPSS : sans confinement, ce bruit pollue le flux
    SSE et les journaux du serveur.
    """
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        with contextlib.redirect_stdout(io.StringIO()):
            return spec.run(ctx) or []


def explore_stream(df: pd.DataFrame, target: str | None,
                   profile_types: dict[str, str] | None = None,
                   budget_sec: float = DEFAULT_BUDGET_SEC) -> Iterator[dict[str, Any]]:
    """Execute l'exploration en emettant un evenement a chaque etape.

    Evenements emis : `context`, `probe_start`, `probe_done`, `finding`, `complete`.
    """
    started = time.time()
    ctx = build_context(df, target, profile_types)

    available = admissible_probes(ctx)
    yield {
        "type": "context",
        "target": ctx.target,
        "target_kind": ctx.target_kind,
        "n_rows": ctx.n_rows,
        "covariate_ranking": [{"column": c, "mutual_info": s} for c, s in ctx.ranked_covariates],
        "initial_facts": sorted(ctx.facts),
        "admissible_probes": [{"key": s.key, "label": s.label, "explains": s.explains,
                               "gated": bool(s.triggered_by)} for s in available],
        "budget_sec": budget_sec,
    }

    result = ExplorationResult(target=ctx.target, target_kind=ctx.target_kind,
                               covariate_ranking=ctx.ranked_covariates)
    done: set[str] = set()

    while True:
        elapsed = time.time() - started
        if elapsed >= budget_sec:
            result.budget_exhausted = True
            break

        candidates = ready_probes(ctx, done)
        if not candidates:
            break

        spec = max(candidates, key=lambda s: _priority(s, ctx))
        done.add(spec.key)
        unlocked_by = sorted(spec.triggered_by & ctx.facts)

        yield {"type": "probe_start", "key": spec.key, "label": spec.label,
               "explains": spec.explains, "triggered_by": unlocked_by,
               "elapsed_sec": round(elapsed, 2)}

        run = ProbeRun(key=spec.key, label=spec.label, status="success", triggered_by=unlocked_by)
        probe_started = time.time()

        try:
            found = _run_quietly(spec, ctx)
        except DEGENERATE_DATA_ERRORS as exc:
            # Donnees inexploitables pour cette sonde : c'est un resultat.
            # Une erreur de programmation, elle, remonte et fait echouer
            # l'exploration — la masquer produirait un rapport faux.
            found = []
            run.status = "error"
            run.error = describe(exc)
            ctx.notes.append(f"Sonde '{spec.label}' interrompue : {run.error}")

        run.duration_ms = int((time.time() - probe_started) * 1000)
        run.n_findings = len(found)
        if run.status == "success" and not found:
            run.status = "empty"

        for finding in found:
            result.findings.append(finding)
            ctx.facts.update(finding.establishes)
            yield {"type": "finding", "probe": spec.key, "finding": finding.to_dict()}

        result.runs.append(run)
        yield {"type": "probe_done", **run.to_dict(),
               "new_facts": sorted(ctx.facts), "elapsed_sec": round(time.time() - started, 2)}

    # Sondes admissibles jamais declenchees : information utile pour l'utilisateur.
    for spec in CATALOG:
        if spec.key not in done and spec.admissible(ctx):
            result.runs.append(ProbeRun(
                key=spec.key, label=spec.label,
                status="skipped_budget" if result.budget_exhausted else "not_triggered",
                triggered_by=sorted(spec.triggered_by),
            ))

    result.fdr = apply_fdr(result.findings)
    result.findings = rank_findings(result.findings)
    result.facts = ctx.facts
    result.notes = ctx.notes
    result.elapsed_sec = time.time() - started

    yield {"type": "complete", "result": result.to_dict()}


def explore(df: pd.DataFrame, target: str | None,
            profile_types: dict[str, str] | None = None,
            budget_sec: float = DEFAULT_BUDGET_SEC) -> dict[str, Any]:
    """Version bloquante : consomme le flux et renvoie le resultat final."""
    payload: dict[str, Any] = {}
    for event in explore_stream(df, target, profile_types, budget_sec):
        if event["type"] == "complete":
            payload = event["result"]
    return payload
