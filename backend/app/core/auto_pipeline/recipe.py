"""Recipe builder : génère un pipeline d'analyse adapté au profil du dataset.

Chaque étape décrit l'opération à réaliser, ses paramètres et son rationale métier.
"""

from __future__ import annotations

from typing import Any
from app.core.auto_pipeline.detector import DatasetProfile
from app.core.auto_pipeline.feasibility import (
    ANALYSES_TEMPORELLES, colonnes_integrees, etape_comptage,
    etape_diagnostics_regression, etape_panel,
    message_sans_colonne_temporelle, message_temporel_sur_panel
)
from app.core.auto_pipeline.pipeline_schema import PipelineStep, PipelineRecipe
from app.core.auto_pipeline.recipe_labels import titre_et_description

# ── Builder ──────────────────────────────────────────────────────────────


def build_recipe(
    profile: DatasetProfile,
    target: str | None = None,
    task_type: str | None = None,
    selected_analyses: list[str] | None = None,
    custom_steps: list[dict[str, Any] | PipelineStep] | None = None,
    df: Any | None = None,
) -> PipelineRecipe:
    """Construit un pipeline personnalisé et adapté au profil du dataset et aux choix de l'utilisateur."""
    if custom_steps:
        parsed_steps = [
            s if isinstance(s, PipelineStep) else PipelineStep(
                key=s.get("key", "step"), operation=s.get("operation", "generic"),
                label=s.get("label", "Étape"), rationale=s.get("rationale", ""),
                params=s.get("params", {}), optional=bool(s.get("optional", False)),
            ) for s in custom_steps
        ]
        return PipelineRecipe(
            title=f"Pipeline Personnalisé ({len(parsed_steps)} étapes)",
            description="Pipeline personnalisé configuré par l'utilisateur.",
            problem_type=task_type or profile.problem_type,
            target=target or profile.suggested_target,
            steps=parsed_steps, estimated_duration_sec=len(parsed_steps) * 3,
            confidence="high",
        )

    steps: list[PipelineStep] = []
    duration = 0
    warnings: list[str] = []

    effective_target = target or profile.suggested_target
    target_type = profile.column_types.get(effective_target, "numeric") if effective_target else None

    # Détermination du type de problème
    if task_type and task_type != "auto":
        if "classif" in str(task_type).lower():
            problem = "binary_classification" if target_type == "binary" else "multiclass_classification"
        else:
            problem = task_type
    elif profile.has_temporal and effective_target and target_type in ("numeric", "discrete", "continu"):
        problem = "forecast"
    elif effective_target and target_type in ("categorical", "binary"):
        problem = "binary_classification" if target_type == "binary" else "multiclass_classification"
    elif effective_target and target_type in ("numeric", "discrete", "continu"):
        problem = "regression"
    else:
        problem = profile.problem_type or "exploration"

    # Filtre sur les analyses sélectionnées si spécifié
    def is_selected(key: str) -> bool:
        if selected_analyses is None:
            return True
        return key in selected_analyses

    # ── 1. Nettoyage & Intégrité ──
    if is_selected("clean"):
        cleaning_actions = [
            action for cond, action in [
                (profile.duplicate_ratio > 0.01, "remove_duplicates"),
                (bool(profile.high_missing_cols), "drop_high_missing_cols"),
                (bool(profile.near_constant_cols), "drop_constant_cols"),
                (profile.overall_null_rate > 0.05, "impute_missing"),
            ] if cond
        ]

        steps.append(PipelineStep(
            key="clean",
            operation="clean",
            label="Nettoyage & Contrôle d'intégrité",
            rationale=(
                f"Détection de {profile.duplicate_rows} doublons, "
                f"{len(profile.high_missing_cols)} colonnes manquantes, "
                f"{len(profile.near_constant_cols)} quasi-constantes."
                if cleaning_actions else
                "Contrôle d'intégrité : 0 doublons, 0 valeurs manquantes critiques."
            ),
            params={
                "actions": cleaning_actions,
                "high_missing_cols": profile.high_missing_cols,
                "constant_cols": profile.near_constant_cols,
            },
        ))
        duration += 2

    # ── 2. Profilage & Descriptives ──
    if is_selected("descriptive"):
        steps.append(PipelineStep(
            key="descriptive",
            operation="descriptive",
            label="Statistiques descriptives & Distributions",
            rationale="Vue d'ensemble des variables : tendance centrale, dispersion, asymétrie.",
            params={"bootstrap_ci": profile.n_rows < 1000},
        ))
        duration += 2

    # ── 3. Corrélations (si ≥2 numériques) ──
    if is_selected("correlations") and len(profile.numeric_cols) >= 2:
        steps.append(PipelineStep(
            key="correlations",
            operation="correlation",
            label="Matrice de corrélation & Dépendances",
            rationale=f"{len(profile.numeric_cols)} variables numériques analysées pour détecter les associations linéaires et rangs.",
            params={"method": "pearson"},
        ))
        duration += 1

    # ── 4. ANALYSES TEMPORELLES & ÉCONOMÉTRIE (Si variable temporelle présente) ──
    temporel_demande = [k for k in ANALYSES_TEMPORELLES if is_selected(k)] if selected_analyses else []
    if temporel_demande and not profile.has_temporal:
        warnings.append(message_sans_colonne_temporelle(profile, temporel_demande))
    elif temporel_demande and not profile.numeric_cols:
        warnings.append(
            "Analyses temporelles demandées mais aucune variable numérique à suivre dans le temps."
        )

    if profile.is_panel and profile.numeric_cols:
        etape = etape_panel(profile, effective_target) if is_selected("panel") else None
        if etape:
            steps.append(etape)
            duration += 4
        if temporel_demande:
            warnings.append(message_temporel_sur_panel(profile))

    elif profile.has_temporal and profile.numeric_cols:
        date_col = profile.temporal_cols[0] if profile.temporal_cols else "date"

        # 4a. Stationnarité (ADF / KPSS)
        if is_selected("stationarity"):
            orders = profile.integration_orders or {}
            non_stat_cols = [c for c, v in orders.items() if not v.get("is_stationary", True) or v.get("order", 0) >= 1]
            stat_rationale = (
                f"Tests ADF & KPSS sur les séries temporelles. {len(non_stat_cols)} série(s) non-stationnaire(s) détectée(s)."
                if non_stat_cols else
                "Diagnostic de stationnarité (ADF & KPSS) pour valider l'absence de racine unitaire."
            )
            steps.append(PipelineStep(
                key="timeseries_stationarity",
                operation="timeseries_stationarity",
                label="Tests de Stationnarité (ADF & KPSS)",
                rationale=stat_rationale,
                params={"date_col": date_col, "columns": profile.numeric_cols[:10]},
            ))
            duration += 3

        # 4b. Cointégration de Johansen & Relations Long-Terme (si ≥2 numériques)
        colonnes_cointegration = colonnes_integrees(profile)
        if (is_selected("cointegration") and len(colonnes_cointegration) >= 2):
            steps.append(PipelineStep(
                key="timeseries_cointegration",
                operation="timeseries_cointegration",
                label="Test de Cointégration de Johansen",
                rationale=(
                    f"Relation d'équilibre de long terme entre {len(colonnes_cointegration)} "
                    "séries intégrées d'ordre 1. Une série déjà stationnaire n'a pas de "
                    "tendance stochastique à partager : l'inclure fausse le rang."
                ),
                params={"date_col": date_col, "columns": colonnes_cointegration},
            ))
            duration += 4

        # 4c. Prévision Univariée / Économétrique (ARIMA, SARIMA, Holt-Winters)
        if is_selected("timeseries_forecast") and effective_target:
            steps.append(PipelineStep(
                key="timeseries",
                operation="timeseries",
                label=f"Prévision Temporelle (ARIMA/SARIMA) sur `{effective_target}`",
                rationale=f"Modélisation temporelle avec sélection automatique ARIMA / Holt-Winters et projection à horizon.",
                params={
                    "date_col": date_col,
                    "value_col": effective_target,
                    "forecast_steps": min(max(5, int(profile.n_rows * 0.2)), 24),
                },
            ))
            duration += 8

        # 4d. Modélisation Multivariée (VAR / VECM / ARDL)
        if is_selected("timeseries_multivariate") and len(profile.numeric_cols) >= 2:
            value_cols = [effective_target] + [c for c in profile.numeric_cols if c != effective_target][:4] if effective_target else profile.numeric_cols[:5]
            steps.append(PipelineStep(
                key="timeseries_multivariate",
                operation="timeseries_multivariate",
                label="Modélisation Multivariée (VAR / VECM / ARDL)",
                rationale=f"Capture les dynamiques croisées, interdépendances et causalités de Granger entre {len(value_cols)} variables.",
                params={
                    "date_col": date_col,
                    "value_cols": value_cols,
                    "forecast_steps": min(max(5, int(profile.n_rows * 0.2)), 24),
                },
            ))
            duration += 12

    # ── 5. Multicolinéarité (VIF) ──
    if is_selected("vif") and len(profile.numeric_cols) >= 3 and (
        problem in ("regression", "binary_classification", "multiclass_classification", "forecast", "timeseries_regression")
        or "classification" in str(problem)
    ):
        steps.append(PipelineStep(
            key="vif",
            operation="vif",
            label="Vérification Multicolinéarité (VIF)",
            rationale="Détecte les redondances et intercorrélations excessives entre variables explicatives.",
            params={},
        ))
        duration += 1

    # ── 6. Transformations & Normalisation ──
    if is_selected("transform"):
        transform_feature_cols = [c for c in profile.numeric_cols if c != effective_target]
        if transform_feature_cols:
            steps.append(PipelineStep(
                key="transform",
                operation="transform",
                label="Normalisation & Préparation des caractéristiques",
                rationale="Standardisation, log-scaling et mise à l'échelle des variables prédictives.",
                params={
                    "transforms": [{"column": c, "transform": "standardize"} for c in transform_feature_cols[:5]]
                },
                optional=False,
            ))
            duration += 2

    # ── 7. Réduction de dimensions (ACP / t-SNE) ──
    if is_selected("pca") and len(profile.numeric_cols) >= 4:
        steps.append(PipelineStep(
            key="pca",
            operation="pca",
            label="ACP — Analyse en Composantes Principales",
            rationale="Synthèse des axes majeurs de variance et réduction de dimensionnalité.",
            params={"columns": profile.numeric_cols},
            optional=True,
        ))
        duration += 3

    # ── 8. Modélisation Machine Learning ──
    if is_selected("model") and effective_target:
        is_classif = (
            problem in ("binary_classification", "multiclass_classification", "classification")
            or "classification" in str(problem)
        )
        if is_classif:
            model_keys = ["logistic_regression", "random_forest", "gradient_boosting"]
            model_label = f"Classification Supervisée sur `{effective_target}`"
            rationale = f"Entraînement comparatif des modèles de classification sur `{effective_target}`."
        else:
            model_keys = ["linear_regression", "ridge", "random_forest", "gradient_boosting"]
            model_label = f"Régression Machine Learning sur `{effective_target}`"
            rationale = (
                f"Modélisation prédictive avec validation temporelle `TimeSeriesSplit` sur `{effective_target}`."
                if profile.has_temporal else
                f"Régression prédictive multi-modèles avec validation croisée sur `{effective_target}`."
            )

        steps.append(PipelineStep(
            key="model",
            operation="model",
            label=model_label,
            rationale=rationale,
            params={
                "target_col": effective_target,
                "problem_type": "classification" if is_classif else "regression",
                "task_type": "classification" if is_classif else "regression",
                "model_keys": model_keys,
                "cv_folds": 5 if profile.n_rows >= 100 else 3,
                "cv_strategy": "timeseries" if profile.has_temporal else "kfold",
                "competitive": True,
            },
        ))
        duration += 10

        if is_selected("regression_diagnostics") and not is_classif:
            etape = etape_diagnostics_regression(profile, effective_target)
            if etape:
                steps.append(etape)
                duration += 2

    # ── 8 bis. Modèle de comptage si la cible est un dénombrement ──
    if is_selected("count_model") and df is not None:
        etape = etape_comptage(profile, effective_target, df)
        if etape:
            steps.append(etape)
            duration += 4

    # ── 9. Explicabilité SHAP ──
    if is_selected("explainability") and effective_target:
        steps.append(PipelineStep(
            key="explainability",
            operation="explainability",
            label="Explicabilité SHAP & Importance des variables",
            rationale="Mesure l'impact direct et la contribution relative de chaque variable explicative.",
            params={"target_col": effective_target},
            optional=True,
        ))
        duration += 4

    # ── 10. Insights Narratifs ──
    if is_selected("insights"):
        steps.append(PipelineStep(
            key="insights",
            operation="insights",
            label="Génération d'Insights Narratifs IA",
            rationale="Synthèse interprétative automatisée et recommandations statistiques actionnables.",
            params={},
        ))
        duration += 1

    # ── 11. Rapport Complet (PDF/DOCX) ──
    if is_selected("report"):
        steps.append(PipelineStep(
            key="report",
            operation="report",
            label="Génération de Rapport Exécutif PDF/DOCX",
            rationale="Création d'un rapport structuré avec graphiques, tableaux de résultats et conclusions.",
            params={"format": "pdf"},
            optional=True,
        ))
        duration += 3

    title, desc = titre_et_description(profile, problem, effective_target)

    return PipelineRecipe(
        title=title,
        description=desc,
        problem_type=problem,
        target=effective_target,
        steps=steps,
        estimated_duration_sec=duration,
        confidence="high",
        warnings=warnings,
    )
