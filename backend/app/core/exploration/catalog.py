"""
Catalogue des sondes d'exploration.

Remplace les listes d'analyses codees en dur (une par type de probleme) par des
regles d'admissibilite evaluees sur le dataset reel. Deux champs font tout le
travail :

  - `admissible` : cette sonde a-t-elle un sens ici ? (forme du dataset, type
    de cible, nombre d'observations)
  - `triggered_by` : cette sonde ne devient interessante qu'une fois certains
    faits etablis par d'autres sondes.

C'est ce second champ qui rend le parcours dependant des resultats : deux
datasets differents n'activent pas les memes sondes, dans le meme ordre.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

from app.core.exploration.context import ExplorationContext
from app.core.exploration.finding import Finding
from app.core.exploration.probes import (association, modeling, robustness, statistical,
                                        temporal, unsupervised)

ProbeFn = Callable[[ExplorationContext], list[Finding]]
Predicate = Callable[[ExplorationContext], bool]


@dataclass(frozen=True)
class ProbeSpec:
    """Declaration d'une sonde : quand elle s'applique, ce qu'elle coute, ce qu'elle apporte."""

    key: str
    label: str
    run: ProbeFn
    admissible: Predicate
    cost: Callable[[ExplorationContext], float]
    yields: frozenset[str] = frozenset()
    triggered_by: frozenset[str] = frozenset()
    base_priority: float = 0.5
    explains: str = ""

    def is_ready(self, ctx: ExplorationContext) -> bool:
        """Admissible sur ce dataset, et debloquee par les faits deja etablis."""
        if not self.admissible(ctx):
            return False
        if self.triggered_by and not (self.triggered_by & ctx.facts):
            return False
        return True


# -- Predicats d'admissibilite -------------------------------------------

def _numeric_target(ctx: ExplorationContext) -> bool:
    return ctx.has_target and ctx.target_kind == "numeric"


def _categorical_target(ctx: ExplorationContext) -> bool:
    return ctx.has_target and ctx.target_kind in ("categorical", "binary")


def _has_numeric_covariates(ctx: ExplorationContext, minimum: int = 1) -> bool:
    return len(ctx.top_covariates(20, kinds=("numeric",))) >= minimum


def _has_categorical_covariates(ctx: ExplorationContext) -> bool:
    return len(ctx.top_covariates(20, kinds=("categorical",))) >= 1


def _is_temporal(ctx: ExplorationContext) -> bool:
    return bool(ctx.temporal_cols) and ctx.n_rows >= 12


def _no_target(ctx: ExplorationContext) -> bool:
    """Exploration libre : aucune variable a expliquer n'a ete designee."""
    return not ctx.has_target


# -- Le catalogue ---------------------------------------------------------

CATALOG: list[ProbeSpec] = [

    # --- Exploration libre : actives uniquement en l'absence de cible ---

    ProbeSpec(
        key="data_quality",
        label="Qualite des donnees",
        run=unsupervised.probe_data_quality,
        admissible=lambda c: c.n_rows >= 10,
        cost=lambda c: 0.2,
        yields=frozenset({"doublons", "lacunes", "colonnes_constantes"}),
        base_priority=0.95,
        explains="Doublons, lacunes et colonnes mortes : ce qui fausserait toute la suite.",
    ),
    ProbeSpec(
        key="pairwise_structure",
        label="Structure des liaisons",
        run=unsupervised.probe_pairwise_structure,
        admissible=lambda c: _no_target(c) and len(c.numeric_cols) >= 2,
        cost=lambda c: 0.3 + 0.05 * len(c.numeric_cols),
        yields=frozenset({"association_lineaire", "multicolinearite"}),
        base_priority=0.9,
        explains="Sans cible designee : quelles variables varient ensemble ?",
    ),
    ProbeSpec(
        key="variance_axes",
        label="Axes de variance (ACP)",
        run=unsupervised.probe_variance_axes,
        admissible=lambda c: _no_target(c) and len(c.numeric_cols) >= 3 and c.n_rows >= 25,
        cost=lambda c: 0.5,
        yields=frozenset({"axes_de_variance", "multicolinearite"}),
        base_priority=0.7,
        explains="Quelques axes suffisent-ils a resumer le jeu de donnees ?",
    ),

    # --- Niveau 1 : ce qu'on peut faire des l'instant ou la cible est connue ---

    ProbeSpec(
        key="target_shape",
        label="Forme de la cible",
        run=statistical.probe_target_shape,
        admissible=lambda c: _numeric_target(c) and c.n_rows >= 12,
        cost=lambda c: 0.3,
        yields=frozenset({"asymetrie", "non_normalite", "valeurs_extremes", "transformation_utile"}),
        base_priority=0.9,
        explains="Verifie si la cible est exploitable telle quelle avant toute modelisation.",
    ),
    ProbeSpec(
        key="class_balance",
        label="Equilibre des classes",
        run=statistical.probe_class_balance,
        admissible=_categorical_target,
        cost=lambda c: 0.1,
        yields=frozenset({"desequilibre_classes"}),
        base_priority=0.9,
        explains="Un desequilibre change les metriques a utiliser pour juger un modele.",
    ),
    ProbeSpec(
        key="association",
        label="Associations avec la cible",
        run=association.probe_target_association,
        admissible=lambda c: _numeric_target(c) and _has_numeric_covariates(c),
        cost=lambda c: 0.4 + 0.02 * len(c.ranked_covariates),
        yields=frozenset({"association_lineaire", "non_linearite", "colinearite_possible"}),
        base_priority=1.0,
        explains="Mesure la liaison de chaque covariable avec la cible, lineaire et non lineaire.",
    ),
    ProbeSpec(
        key="group_difference",
        label="Differences entre groupes",
        run=statistical.probe_group_difference,
        admissible=lambda c: _numeric_target(c) and _has_categorical_covariates(c),
        cost=lambda c: 0.4,
        yields=frozenset({"difference_groupes", "segmenteur_disponible"}),
        base_priority=0.85,
        explains="Compare la cible entre les modalites des variables qualitatives.",
    ),
    ProbeSpec(
        key="categorical_link",
        label="Liens entre qualitatives",
        run=statistical.probe_categorical_link,
        admissible=lambda c: _categorical_target(c) and _has_categorical_covariates(c),
        cost=lambda c: 0.3,
        yields=frozenset({"lien_categoriel", "segmenteur_disponible"}),
        base_priority=0.85,
        explains="Teste l'independance entre la cible qualitative et les autres qualitatives.",
    ),
    ProbeSpec(
        key="stationarity",
        label="Stationnarite des series",
        run=temporal.probe_stationarity,
        admissible=_is_temporal,
        cost=lambda c: 0.6 + 0.1 * len(c.numeric_cols),
        yields=frozenset({"non_stationnarite", "differenciation_requise"}),
        base_priority=0.9,
        explains="Sans stationnarite, toute correlation entre series est suspecte.",
    ),
    ProbeSpec(
        key="trend",
        label="Tendance temporelle",
        run=temporal.probe_trend,
        admissible=lambda c: _is_temporal(c) and _numeric_target(c),
        cost=lambda c: 0.2,
        yields=frozenset({"tendance"}),
        base_priority=0.7,
        explains="Detecte une derive monotone de la cible dans le temps.",
    ),

    # --- Niveau 2 : debloque par ce que le niveau 1 a trouve ---

    ProbeSpec(
        key="redundancy",
        label="Redondance entre predicteurs",
        run=association.probe_redundancy,
        admissible=lambda c: _has_numeric_covariates(c, 2),
        cost=lambda c: 0.3,
        yields=frozenset({"multicolinearite"}),
        triggered_by=frozenset({"association_lineaire", "colinearite_possible"}),
        base_priority=0.6,
        explains="Declenchee des qu'une association forte existe : deux predicteurs peuvent faire doublon.",
    ),
    ProbeSpec(
        key="interaction",
        label="Effets d'interaction",
        run=statistical.probe_interaction,
        admissible=lambda c: _numeric_target(c) and _has_numeric_covariates(c, 2) and c.n_rows >= 30,
        cost=lambda c: 0.8,
        yields=frozenset({"interaction"}),
        triggered_by=frozenset({"non_linearite", "association_lineaire"}),
        base_priority=0.75,
        explains="Declenchee par une non-linearite : deux variables agissent peut-etre ensemble.",
    ),
    ProbeSpec(
        key="segmentation",
        label="Relations conditionnelles",
        run=statistical.probe_segmentation,
        admissible=lambda c: _numeric_target(c) and _has_categorical_covariates(c) and c.n_rows >= 40,
        cost=lambda c: 0.7,
        yields=frozenset({"relation_conditionnelle", "paradoxe_simpson"}),
        triggered_by=frozenset({"segmenteur_disponible", "difference_groupes"}),
        base_priority=0.8,
        explains="Declenchee quand un groupe discriminant existe : la relation change-t-elle selon lui ?",
    ),
    ProbeSpec(
        key="granger",
        label="Causalite de Granger",
        run=temporal.probe_granger,
        admissible=lambda c: _is_temporal(c) and _numeric_target(c) and c.n_rows >= 25,
        cost=lambda c: 1.5,
        yields=frozenset({"causalite_granger", "predicteur_avance"}),
        triggered_by=frozenset({"non_stationnarite", "tendance", "association_lineaire"}),
        base_priority=0.7,
        explains="Declenchee apres l'analyse de stationnarite : quelles series precedent la cible ?",
    ),

    # --- Niveau 3 : synthese, quand il y a matiere ---

    ProbeSpec(
        key="predictive_power",
        label="Pouvoir predictif",
        run=modeling.probe_predictive_power,
        admissible=lambda c: c.has_target and len(c.ranked_covariates) >= 2 and c.n_rows >= 30,
        cost=lambda c: 2.0 + 0.5 * len(c.ranked_covariates),
        yields=frozenset({"modele_utile", "variable_dominante", "heteroscedasticite",
                          "pouvoir_predictif_nul", "erreurs_robustes_requises"}),
        base_priority=0.65,
        explains="Mesure hors echantillon ce que l'ensemble des variables permet de predire.",
    ),
    ProbeSpec(
        key="influential_points",
        label="Observations influentes",
        run=robustness.probe_influential_points,
        admissible=lambda c: _numeric_target(c) and _has_numeric_covariates(c, 1) and c.n_rows >= 30,
        cost=lambda c: 0.4,
        yields=frozenset({"resultat_fragile"}),
        triggered_by=frozenset({"association_lineaire", "modele_utile"}),
        base_priority=0.65,
        explains="Declenchee des qu'une relation est trouvee : repose-t-elle sur quelques lignes ?",
    ),
    ProbeSpec(
        key="structural_break",
        label="Rupture structurelle",
        run=robustness.probe_structural_break,
        admissible=lambda c: _is_temporal(c) and _numeric_target(c) and c.n_rows >= 40,
        cost=lambda c: 0.9,
        yields=frozenset({"regimes_multiples", "resultat_fragile"}),
        triggered_by=frozenset({"tendance", "non_stationnarite", "association_lineaire"}),
        base_priority=0.7,
        explains="Declenchee sur donnees datees : la relation change-t-elle a partir d'une date ?",
    ),
    ProbeSpec(
        key="subgroup_heterogeneity",
        label="Heterogeneite entre sous-groupes",
        run=robustness.probe_subgroup_heterogeneity,
        admissible=lambda c: (_numeric_target(c) and _has_numeric_covariates(c, 1)
                              and _has_categorical_covariates(c) and c.n_rows >= 60),
        cost=lambda c: 0.6,
        yields=frozenset({"relation_conditionnelle", "resultat_fragile"}),
        triggered_by=frozenset({"association_lineaire", "difference_groupes"}),
        base_priority=0.72,
        explains="Declenchee quand une relation et un segmenteur coexistent : tient-elle partout ?",
    ),
    ProbeSpec(
        key="multicollinearity",
        label="Diagnostic de colinearite (VIF)",
        run=modeling.probe_multicollinearity,
        admissible=lambda c: _has_numeric_covariates(c, 3) and c.n_rows >= 30,
        cost=lambda c: 0.6,
        yields=frozenset({"multicolinearite"}),
        triggered_by=frozenset({"modele_utile", "multicolinearite", "association_lineaire"}),
        base_priority=0.55,
        explains="Declenchee quand un modele a du sens : quelles variables s'annulent entre elles ?",
    ),
]


CATALOG_BY_KEY = {spec.key: spec for spec in CATALOG}


def admissible_probes(ctx: ExplorationContext) -> list[ProbeSpec]:
    """Sondes applicables au dataset, faits deja etablis mis a part.

    Sert a repondre a la question 'que peut-on faire sur ce dataset ?' avant
    meme de lancer l'exploration.
    """
    return [spec for spec in CATALOG if spec.admissible(ctx)]


def ready_probes(ctx: ExplorationContext, done: set[str]) -> list[ProbeSpec]:
    """Sondes actuellement executables : admissibles, debloquees, pas deja faites."""
    return [spec for spec in CATALOG if spec.key not in done and spec.is_ready(ctx)]
