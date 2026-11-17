"""Helpers de construction des étapes d'un pipeline automatique."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.core.auto_pipeline.detector import DatasetProfile
from app.core.auto_pipeline.feasibility import (
    ANALYSES_TEMPORELLES,
    colonnes_integrees,
    etape_comptage,
    etape_diagnostics_regression,
    etape_panel,
    message_sans_colonne_temporelle,
    message_temporel_sur_panel,
)
from app.core.auto_pipeline.pipeline_schema import PipelineStep


@dataclass
class RecipeBuildContext:
    profile: DatasetProfile
    effective_target: str | None
    problem: str
    selected_analyses: set[str] | None
    df: Any | None = None
    steps: list[PipelineStep] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    duration: int = 0

    def wants(self, key: str) -> bool:
        return self.selected_analyses is None or key in self.selected_analyses

    def add(self, step: PipelineStep | None, sec: int) -> None:
        if step is None:
            return
        self.steps.append(step)
        self.duration += sec


def add_prep_steps(ctx: RecipeBuildContext) -> None:
    profile = ctx.profile
    if ctx.wants("clean"):
        cleaning_actions = [
            action
            for cond, action in [
                (profile.duplicate_ratio > 0.01, "remove_duplicates"),
                (bool(profile.high_missing_cols), "drop_high_missing_cols"),
                (bool(profile.near_constant_cols), "drop_constant_cols"),
                (profile.overall_null_rate > 0.05, "impute_missing"),
            ]
            if cond
        ]
        rationale = (
            f"Détection de {profile.duplicate_rows} doublons, "
            f"{len(profile.high_missing_cols)} colonnes manquantes, "
            f"{len(profile.near_constant_cols)} quasi-constantes."
            if cleaning_actions
            else "Contrôle d'intégrité : 0 doublons, 0 valeurs manquantes critiques."
        )
        ctx.add(
            PipelineStep(
                key="clean",
                operation="clean",
                label="Nettoyage & Contrôle d'intégrité",
                rationale=rationale,
                params={
                    "actions": cleaning_actions,
                    "high_missing_cols": profile.high_missing_cols,
                    "constant_cols": profile.near_constant_cols,
                },
            ),
            2,
        )

    if ctx.wants("descriptive"):
        ctx.add(
            PipelineStep(
                key="descriptive",
                operation="descriptive",
                label="Statistiques descriptives & Distributions",
                rationale="Vue d'ensemble des variables : tendance centrale, dispersion, asymétrie.",
                params={"bootstrap_ci": profile.n_rows < 1000},
            ),
            2,
        )

    if ctx.wants("correlations") and len(profile.numeric_cols) >= 2:
        ctx.add(
            PipelineStep(
                key="correlations",
                operation="correlation",
                label="Matrice de corrélation & Dépendances",
                rationale=f"{len(profile.numeric_cols)} variables numériques analysées pour détecter les associations linéaires et rangs.",
                params={"method": "pearson"},
            ),
            1,
        )


def _add_series_steps(ctx: RecipeBuildContext, date_col: str) -> None:
    profile = ctx.profile
    horizon = min(max(5, int(profile.n_rows * 0.2)), 24)
    if ctx.wants("stationarity"):
        orders = profile.integration_orders or {}
        non_stat = [c for c, v in orders.items() if not v.get("is_stationary", True) or v.get("order", 0) >= 1]
        rationale = (
            f"Tests ADF & KPSS sur les séries temporelles. {len(non_stat)} série(s) non-stationnaire(s) détectée(s)."
            if non_stat
            else "Diagnostic de stationnarité (ADF & KPSS) pour valider l'absence de racine unitaire."
        )
        ctx.add(
            PipelineStep(
                key="timeseries_stationarity",
                operation="timeseries_stationarity",
                label="Tests de Stationnarité (ADF & KPSS)",
                rationale=rationale,
                params={"date_col": date_col, "columns": profile.numeric_cols[:10]},
            ),
            3,
        )

    coint_cols = colonnes_integrees(profile)
    if ctx.wants("cointegration") and len(coint_cols) >= 2:
        ctx.add(
            PipelineStep(
                key="timeseries_cointegration",
                operation="timeseries_cointegration",
                label="Test de Cointégration de Johansen",
                rationale=(
                    f"Relation d'équilibre de long terme entre {len(coint_cols)} "
                    "séries intégrées d'ordre 1. Une série déjà stationnaire n'a pas de "
                    "tendance stochastique à partager : l'inclure fausse le rang."
                ),
                params={"date_col": date_col, "columns": coint_cols},
            ),
            4,
        )

    if ctx.wants("timeseries_forecast") and ctx.effective_target:
        ctx.add(
            PipelineStep(
                key="timeseries",
                operation="timeseries",
                label=f"Prévision Temporelle (ARIMA/SARIMA) sur `{ctx.effective_target}`",
                rationale="Modélisation temporelle avec sélection automatique ARIMA / Holt-Winters et projection à horizon.",
                params={"date_col": date_col, "value_col": ctx.effective_target, "forecast_steps": horizon},
            ),
            8,
        )

    if ctx.wants("timeseries_multivariate") and len(profile.numeric_cols) >= 2:
        target = ctx.effective_target
        value_cols = (
            [target] + [c for c in profile.numeric_cols if c != target][:4]
            if target
            else profile.numeric_cols[:5]
        )
        ctx.add(
            PipelineStep(
                key="timeseries_multivariate",
                operation="timeseries_multivariate",
                label="Modélisation Multivariée (VAR / VECM / ARDL)",
                rationale=f"Capture les dynamiques croisées, interdépendances et causalités de Granger entre {len(value_cols)} variables.",
                params={"date_col": date_col, "value_cols": value_cols, "forecast_steps": horizon},
            ),
            12,
        )


def add_temporal_and_panel_steps(ctx: RecipeBuildContext) -> None:
    profile = ctx.profile
    temporel_demande = [k for k in ANALYSES_TEMPORELLES if ctx.wants(k)] if ctx.selected_analyses else []
    if temporel_demande and not profile.has_temporal:
        ctx.warnings.append(message_sans_colonne_temporelle(profile, temporel_demande))
    elif temporel_demande and not profile.numeric_cols:
        ctx.warnings.append("Analyses temporelles demandées mais aucune variable numérique à suivre dans le temps.")

    if profile.is_panel and profile.numeric_cols:
        if ctx.wants("panel"):
            ctx.add(etape_panel(profile, ctx.effective_target), 4)
        if temporel_demande:
            ctx.warnings.append(message_temporel_sur_panel(profile))
        return

    if profile.has_temporal and profile.numeric_cols:
        date_col = profile.temporal_cols[0] if profile.temporal_cols else "date"
        _add_series_steps(ctx, date_col)


def add_model_and_output_steps(ctx: RecipeBuildContext) -> None:
    profile = ctx.profile
    target = ctx.effective_target
    supervised_problems = ("regression", "binary_classification", "multiclass_classification", "forecast", "timeseries_regression")
    if ctx.wants("vif") and len(profile.numeric_cols) >= 3 and (ctx.problem in supervised_problems or "classification" in str(ctx.problem)):
        ctx.add(
            PipelineStep(
                key="vif",
                operation="vif",
                label="Vérification Multicolinéarité (VIF)",
                rationale="Détecte les redondances et intercorrélations excessives entre variables explicatives.",
                params={},
            ),
            1,
        )

    if ctx.wants("transform"):
        feats = [c for c in profile.numeric_cols if c != target]
        if feats:
            ctx.add(
                PipelineStep(
                    key="transform",
                    operation="transform",
                    label="Normalisation & Préparation des caractéristiques",
                    rationale="Standardisation, log-scaling et mise à l'échelle des variables prédictives.",
                    params={"transforms": [{"column": c, "transform": "standardize"} for c in feats[:5]]},
                    optional=False,
                ),
                2,
            )

    if ctx.wants("pca") and len(profile.numeric_cols) >= 4:
        ctx.add(
            PipelineStep(
                key="pca",
                operation="pca",
                label="ACP — Analyse en Composantes Principales",
                rationale="Synthèse des axes majeurs de variance et réduction de dimensionnalité.",
                params={"columns": profile.numeric_cols},
                optional=True,
            ),
            3,
        )

    if ctx.wants("model") and target:
        is_classif = ctx.problem in ("binary_classification", "multiclass_classification", "classification") or "classification" in str(ctx.problem)
        model_keys = ["logistic_regression", "random_forest", "gradient_boosting"] if is_classif else ["linear_regression", "ridge", "random_forest", "gradient_boosting"]
        label = f"Classification Supervisée sur `{target}`" if is_classif else f"Régression Machine Learning sur `{target}`"
        rationale = (
            f"Entraînement comparatif des modèles de classification sur `{target}`."
            if is_classif
            else f"Modélisation prédictive sur `{target}` avec validation adaptée."
        )
        ctx.add(
            PipelineStep(
                key="model",
                operation="model",
                label=label,
                rationale=rationale,
                params={
                    "target_col": target,
                    "problem_type": "classification" if is_classif else "regression",
                    "task_type": "classification" if is_classif else "regression",
                    "model_keys": model_keys,
                    "cv_folds": 5 if profile.n_rows >= 100 else 3,
                    "cv_strategy": "timeseries" if profile.has_temporal else "kfold",
                    "competitive": True,
                },
            ),
            10,
        )
        if ctx.wants("regression_diagnostics") and not is_classif:
            ctx.add(etape_diagnostics_regression(profile, target), 2)

    if ctx.wants("count_model") and ctx.df is not None:
        ctx.add(etape_comptage(profile, target, ctx.df), 4)
    if ctx.wants("explainability") and target:
        ctx.add(
            PipelineStep(
                key="explainability",
                operation="explainability",
                label="Explicabilité SHAP & Importance des variables",
                rationale="Mesure l'impact direct et la contribution relative de chaque variable explicative.",
                params={"target_col": target},
                optional=True,
            ),
            4,
        )
    if ctx.wants("insights"):
        ctx.add(
            PipelineStep(
                key="insights",
                operation="insights",
                label="Génération d'Insights Narratifs",
                rationale="Synthèse interprétative automatisée et recommandations statistiques actionnables.",
                params={},
            ),
            1,
        )
    if ctx.wants("report"):
        ctx.add(
            PipelineStep(
                key="report",
                operation="report",
                label="Génération de Rapport Exécutif PDF/DOCX",
                rationale="Création d'un rapport structuré avec graphiques, tableaux de résultats et conclusions.",
                params={"format": "pdf"},
                optional=True,
            ),
            3,
        )
