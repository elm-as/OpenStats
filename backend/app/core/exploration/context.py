"""
Contexte d'exploration : l'état que le moteur fait circuler entre les sondes.

`facts` est le mécanisme central : chaque sonde y dépose ce qu'elle a établi,
et l'admissibilité des sondes suivantes en dépend. C'est ce qui fait qu'un
dataset ne suit pas le même chemin qu'un autre.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import pandas as pd


@dataclass
class ExplorationContext:
    """État partagé d'une session d'exploration."""

    df: pd.DataFrame
    target: str | None = None
    target_kind: str | None = None          # numeric | categorical | binary
    numeric_cols: list[str] = field(default_factory=list)
    categorical_cols: list[str] = field(default_factory=list)
    temporal_cols: list[str] = field(default_factory=list)
    ranked_covariates: list[tuple[str, float]] = field(default_factory=list)
    facts: set[str] = field(default_factory=set)
    notes: list[str] = field(default_factory=list)

    @property
    def n_rows(self) -> int:
        return len(self.df)

    @property
    def has_target(self) -> bool:
        return bool(self.target) and self.target in self.df.columns

    @property
    def covariate_names(self) -> list[str]:
        return [c for c, _ in self.ranked_covariates]

    def top_covariates(self, k: int, kinds: tuple[str, ...] = ()) -> list[str]:
        """Les k covariables les plus informatives, filtrées par type si demandé."""
        names = self.covariate_names
        if kinds:
            allowed = set()
            if "numeric" in kinds:
                allowed |= set(self.numeric_cols)
            if "categorical" in kinds:
                allowed |= set(self.categorical_cols)
            if "temporal" in kinds:
                allowed |= set(self.temporal_cols)
            names = [c for c in names if c in allowed]
        return names[:k]

    def numeric_series(self, col: str) -> pd.Series:
        return pd.to_numeric(self.df[col], errors="coerce").dropna()


def classify_target(series: pd.Series) -> str:
    """numeric | binary | categorical — la nature de la cible pilote les sondes admissibles."""
    valid = series.dropna()
    n_unique = valid.nunique()
    if n_unique <= 1:
        return "constant"
    if n_unique == 2:
        return "binary"
    if pd.api.types.is_numeric_dtype(valid) and n_unique > 12:
        return "numeric"
    if pd.api.types.is_numeric_dtype(valid):
        return "categorical"
    return "categorical"


def build_context(df: pd.DataFrame, target: str | None,
                  profile_types: dict[str, str] | None = None) -> ExplorationContext:
    """Prépare le contexte : typage des colonnes puis classement des covariables."""
    from app.core.exploration.covariates import rank_covariates

    profile_types = profile_types or {}
    numeric_cols, categorical_cols, temporal_cols = [], [], []

    for col in df.columns:
        declared = profile_types.get(col)
        if declared == "temporal" or pd.api.types.is_datetime64_any_dtype(df[col]):
            temporal_cols.append(col)
        elif declared == "id":
            continue
        elif pd.api.types.is_numeric_dtype(df[col]) and df[col].nunique() > 2:
            numeric_cols.append(col)
        else:
            categorical_cols.append(col)

    ctx = ExplorationContext(
        df=df,
        target=target if target in df.columns else None,
        numeric_cols=numeric_cols,
        categorical_cols=categorical_cols,
        temporal_cols=temporal_cols,
    )

    if ctx.has_target:
        ctx.target_kind = classify_target(df[ctx.target])
        candidates = [c for c in (numeric_cols + categorical_cols) if c != ctx.target]
        ctx.ranked_covariates = rank_covariates(df, ctx.target, candidates)

    ctx.facts.update(_initial_facts(ctx))
    return ctx


def _initial_facts(ctx: ExplorationContext) -> set[str]:
    """Faits établis d'entrée de jeu par la seule forme du dataset."""
    facts: set[str] = set()
    if ctx.has_target:
        facts.add("cible_definie")
        facts.add(f"cible_{ctx.target_kind}")
    if ctx.temporal_cols:
        facts.add("axe_temporel")
    if ctx.n_rows < 60:
        facts.add("petit_echantillon")
    if len(ctx.numeric_cols) >= 3:
        facts.add("multi_numerique")
    if ctx.categorical_cols:
        facts.add("categorielles_presentes")
    return facts
