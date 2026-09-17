"""
Sondes statistiques : differences de groupes, forme des distributions,
interactions, segmentation et desequilibre de classes.

Chaque sonde renvoie des Findings et declare les faits qu'elle etablit ;
ce sont ces faits qui debloquent les sondes suivantes.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats

from app.core import measurements
from app.core.statistical_attempt import attempt
from app.core.exploration.context import ExplorationContext
from app.core.exploration.finding import Finding, effect_adverb

MAX_GROUPS = 12
MIN_GROUP_SIZE = 5
INTERACTION_SYMBOL = " x "


# -- Differences entre groupes -------------------------------------------

def probe_group_difference(ctx: ExplorationContext) -> list[Finding]:
    """Cible numerique x covariable categorielle : ANOVA / test t + eta carre."""
    findings: list[Finding] = []
    target = ctx.target

    for col in ctx.top_covariates(6, kinds=("categorical",)):
        pair = ctx.df[[col, target]].dropna()
        groups = [g[target].to_numpy(dtype=float)
                  for _, g in pair.groupby(col, observed=True)
                  if len(g) >= MIN_GROUP_SIZE]
        if len(groups) < 2 or len(groups) > MAX_GROUPS:
            continue

        if len(groups) == 2:
            outcome = attempt(stats.ttest_ind, groups[0], groups[1], equal_var=False)
            test_name = "test t de Welch"
        else:
            outcome = attempt(stats.f_oneway, *groups)
            test_name = "ANOVA a un facteur"
        if not outcome:
            continue
        stat, p = outcome.value

        eta2 = _eta_squared(groups)
        if eta2 < 0.02 or not np.isfinite(p):
            continue

        means = {str(k): round(float(v), 4)
                 for k, v in pair.groupby(col, observed=True)[target].mean().items()}
        spread = max(means.values()) - min(means.values()) if means else 0.0

        findings.append(Finding(
            kind="difference_groupes",
            variables=(col, target),
            effect_size=eta2,
            effect_metric="eta carre",
            headline=f"{target} differe {effect_adverb(eta2)} selon {col} (eta2 = {eta2:.2f})",
            detail=(f"{test_name} sur {len(groups)} groupes. L'ecart entre le groupe le plus haut "
                    f"et le plus bas atteint {spread:.4g}. Environ {eta2:.0%} de la variance de "
                    f"{target} est attribuable a {col}."),
            p_value=float(p),
            n=len(pair),
            establishes=("difference_groupes", "segmenteur_disponible"),
            payload={"eta_squared": round(eta2, 4), "group_means": means, "test": test_name},
            probe="group_difference",
        ))

    return findings


def _eta_squared(groups: list[np.ndarray]) -> float:
    """Part de variance expliquee par l'appartenance aux groupes."""
    all_values = np.concatenate(groups)
    grand_mean = all_values.mean()
    ss_between = sum(len(g) * (g.mean() - grand_mean) ** 2 for g in groups)
    ss_total = ((all_values - grand_mean) ** 2).sum()
    return float(ss_between / ss_total) if ss_total > 0 else 0.0


def probe_categorical_link(ctx: ExplorationContext) -> list[Finding]:
    """Cible categorielle x covariable categorielle : chi2 + V de Cramer."""
    findings: list[Finding] = []
    target = ctx.target

    for col in ctx.top_covariates(6, kinds=("categorical",)):
        table = pd.crosstab(ctx.df[col], ctx.df[target])
        if table.shape[0] < 2 or table.shape[1] < 2 or table.shape[0] > MAX_GROUPS:
            continue
        if (table.values < 5).mean() > 0.2:
            continue  # approximation du chi2 non valide

        outcome = attempt(stats.chi2_contingency, table)
        if not outcome:
            continue
        chi2, p, dof, _ = outcome.value

        n = int(table.values.sum())
        min_dim = min(table.shape) - 1
        cramers_v = float(np.sqrt(chi2 / (n * min_dim))) if min_dim > 0 and n > 0 else 0.0
        if cramers_v < 0.1:
            continue

        findings.append(Finding(
            kind="lien_categoriel",
            variables=(col, target),
            effect_size=cramers_v,
            effect_metric="V de Cramer",
            headline=f"{col} et {target} sont liees {effect_adverb(cramers_v)} (V = {cramers_v:.2f})",
            detail=(f"Test du chi2 d'independance sur un tableau {table.shape[0]}x{table.shape[1]} "
                    f"({dof} degres de liberte, {n} observations). La repartition de {target} "
                    f"n'est pas la meme d'une modalite de {col} a l'autre."),
            p_value=float(p),
            n=n,
            establishes=("lien_categoriel", "segmenteur_disponible"),
            payload={"cramers_v": round(cramers_v, 4), "shape": list(table.shape)},
            probe="categorical_link",
        ))

    return findings


# -- Forme de la distribution de la cible ---------------------------------

def probe_target_shape(ctx: ExplorationContext) -> list[Finding]:
    """Asymetrie, normalite et valeurs extremes de la cible numerique."""
    findings: list[Finding] = []
    target = ctx.target
    series = ctx.numeric_series(target)
    if len(series) < 12:
        return findings

    skew = measurements.skewness(series) or 0.0
    if abs(skew) >= 0.8:
        findings.append(Finding(
            kind="asymetrie",
            variables=(target,),
            effect_size=min(1.0, abs(skew) / 3.0),
            effect_metric="coefficient d'asymetrie",
            headline=(f"{target} est {'etalee a droite' if skew > 0 else 'etalee a gauche'} "
                      f"(asymetrie = {skew:+.2f})"),
            detail=("La moyenne n'est pas representative : elle est tiree par la queue de "
                    "distribution. Une transformation logarithmique ou de Box-Cox rapprocherait "
                    "la distribution de la normale et stabiliserait une regression."),
            p_value=None,
            n=len(series),
            establishes=("asymetrie", "transformation_utile"),
            payload={"skew": round(skew, 4),
                     "median": round(float(series.median()), 4),
                     "mean": round(float(series.mean()), 4)},
            probe="target_shape",
        ))

    normality = measurements.normality(series)
    if normality and normality["p"] < 0.05:
        findings.append(Finding(
            kind="non_normalite",
            variables=(target,),
            effect_size=min(1.0, abs(skew) / 2.0 + 0.2),
            effect_metric=normality["name"],
            headline=f"{target} ne suit pas une loi normale ({normality['name']}, p = {normality['p']:.3g})",
            detail=("Les tests parametriques classiques (t, ANOVA, intervalles de confiance de la "
                    "moyenne) perdent leur garantie. Alternatives : tests non parametriques, "
                    "ou intervalles par bootstrap."),
            p_value=normality["p"],
            n=len(series),
            establishes=("non_normalite",),
            payload=normality,
            probe="target_shape",
        ))

    bounds = measurements.outliers(series)
    if bounds is not None and bounds.ratio >= 0.01:
        findings.append(Finding(
            kind="valeurs_extremes",
            variables=(target,),
            effect_size=min(1.0, bounds.ratio * 8),
            effect_metric="part de points hors bornes IQR",
            headline=(f"{bounds.count} valeurs extremes dans {target} "
                      f"({bounds.ratio:.1%} des observations)"),
            detail=(f"Points hors de l'intervalle [{bounds.lower:.4g} ; {bounds.upper:.4g}] "
                    "(regle 1,5 x IQR). Ils pesent lourd sur une moyenne et sur les moindres carres : "
                    "verifier s'il s'agit d'erreurs de saisie ou d'un regime reellement different."),
            p_value=None,
            n=len(series),
            establishes=("valeurs_extremes",),
            payload=bounds.to_dict(),
            probe="target_shape",
        ))

    return findings




def probe_class_balance(ctx: ExplorationContext) -> list[Finding]:
    """Desequilibre d'une cible categorielle : conditionne le choix des metriques."""
    imbalance = measurements.class_imbalance(ctx.df[ctx.target])
    if imbalance is None or imbalance["ratio"] >= 0.4:
        return []

    counts = ctx.df[ctx.target].value_counts()
    ratio = imbalance["ratio"]
    majority_share = imbalance["majority_share"]
    return [Finding(
        kind="desequilibre_classes",
        variables=(ctx.target,),
        effect_size=1.0 - ratio,
        effect_metric="ratio minorite/majorite",
        headline=(f"{ctx.target} est desequilibree : '{counts.idxmin()}' ne pese que "
                  f"{ratio:.1%} de '{counts.idxmax()}'"),
        detail=("Un classifieur qui predirait toujours la classe majoritaire atteindrait deja "
                f"{majority_share:.1%} d'exactitude. L'accuracy est trompeuse ici : juger sur "
                "le F1, le rappel de la classe rare ou l'AUC-PR."),
        p_value=None,
        n=int(counts.sum()),
        establishes=("desequilibre_classes",),
        payload={"counts": {str(k): int(v) for k, v in counts.items()}, "ratio": round(ratio, 4)},
        probe="class_balance",
    )]


# -- Sondes de second niveau (declenchees par un fait) --------------------

def probe_interaction(ctx: ExplorationContext) -> list[Finding]:
    """Deux covariables agissent-elles ensemble au-dela de leurs effets propres ?

    Declenchee par la detection d'une non-linearite : c'est la que l'effet
    d'interaction est plausible.
    """
    import statsmodels.api as sm

    findings: list[Finding] = []
    cols = ctx.top_covariates(4, kinds=("numeric",))
    target = ctx.target

    for i, a in enumerate(cols):
        for b in cols[i + 1:]:
            sub = ctx.df[[a, b, target]].apply(pd.to_numeric, errors="coerce")
            sub = sub.replace([np.inf, -np.inf], np.nan).dropna()
            if len(sub) < 30:
                continue

            term = f"{a}{INTERACTION_SYMBOL}{b}"
            design = pd.DataFrame({
                a: sub[a],
                b: sub[b],
                term: (sub[a] - sub[a].mean()) * (sub[b] - sub[b].mean()),
            })
            full = attempt(lambda: sm.OLS(sub[target], sm.add_constant(design)).fit())
            additive = attempt(
                lambda: sm.OLS(sub[target], sm.add_constant(design[[a, b]])).fit())
            if not full or not additive:
                continue
            model, base = full.value, additive.value

            if term not in model.pvalues:
                continue
            p = float(model.pvalues[term])
            delta_r2 = float(model.rsquared - base.rsquared)
            if not np.isfinite(p) or p >= 0.05 or delta_r2 < 0.01:
                continue

            findings.append(Finding(
                kind="interaction",
                variables=(a, b, target),
                effect_size=min(1.0, delta_r2 * 5),
                effect_metric="gain de R2 apporte par le terme d'interaction",
                headline=f"L'effet de {a} sur {target} depend du niveau de {b} (R2 +{delta_r2:.3f})",
                detail=(f"Le terme d'interaction est significatif (p = {p:.3g}) et ajoute "
                        f"{delta_r2:.1%} de variance expliquee au modele additif. "
                        "Interpreter les deux variables separement serait trompeur."),
                p_value=p,
                n=len(sub),
                establishes=("interaction",),
                payload={"delta_r2": round(delta_r2, 4),
                         "coef": round(float(model.params[term]), 6)},
                probe="interaction",
            ))

    return findings


def probe_segmentation(ctx: ExplorationContext) -> list[Finding]:
    """La relation cible/covariable change-t-elle selon un groupe ?

    Declenchee par la presence d'un segmenteur. Detecte les renversements de
    signe, c'est-a-dire un paradoxe de Simpson en puissance.
    """
    findings: list[Finding] = []
    target = ctx.target
    numeric = ctx.top_covariates(3, kinds=("numeric",))
    splitters = ctx.top_covariates(3, kinds=("categorical",))

    for splitter in splitters:
        for col in numeric:
            sub = ctx.df[[splitter, col, target]].dropna()
            if len(sub) < 40:
                continue

            overall_r, _, _ = safe_corr(sub[col], sub[target])
            by_group: dict[str, float] = {}
            for group_value, group in sub.groupby(splitter, observed=True):
                if len(group) < MIN_GROUP_SIZE * 2:
                    continue
                r, _, _ = safe_corr(group[col], group[target])
                by_group[str(group_value)] = round(r, 4)

            if len(by_group) < 2:
                continue

            values = list(by_group.values())
            reversal = max(values) - min(values)
            sign_flip = any(v * overall_r < -0.01 for v in values)
            if reversal < 0.4 and not sign_flip:
                continue

            listing = ", ".join(f"{k} -> {v:+.2f}" for k, v in list(by_group.items())[:5])
            findings.append(Finding(
                kind="relation_conditionnelle",
                variables=(col, target, splitter),
                effect_size=min(1.0, reversal / 2.0),
                effect_metric="amplitude de variation de r entre groupes",
                headline=(f"La relation {col} / {target} change de nature selon {splitter}"
                          + (" et s'inverse dans certains groupes" if sign_flip else "")),
                detail=(f"r global = {overall_r:+.2f}, mais par groupe : {listing}"
                        + (". Un renversement de signe signale un paradoxe de Simpson : "
                           "l'analyse globale conclut l'inverse de l'analyse par groupe."
                           if sign_flip else
                           ". Un modele global masquerait cette heterogeneite.")),
                p_value=None,
                n=len(sub),
                establishes=("relation_conditionnelle",) + (("paradoxe_simpson",) if sign_flip else ()),
                payload={"overall_r": round(overall_r, 4), "by_group": by_group},
                probe="segmentation",
            ))

    return findings


def safe_corr(x: pd.Series, y: pd.Series) -> tuple[float, float, int]:
    """Alias historique de `measurements.correlation`, conserve pour les appelants."""
    return measurements.correlation(x, y)
