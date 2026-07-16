"""
Recipe builder : génère un pipeline d'analyse adapté au profil du dataset.

Chaque étape (`PipelineStep`) décrit :
 - une opération à réaliser (clean, transform, analyze, model, forecast, factor…)
 - les paramètres
 - le rationale (pourquoi cette étape)
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any

from app.core.auto_pipeline.detector import DatasetProfile


@dataclass
class PipelineStep:
    """Une étape d'un pipeline."""

    key: str  # identifiant unique
    operation: str  # clean | descriptive | correlation | vif | transform | model | timeseries | pca | report
    label: str  # label affichable
    rationale: str  # pourquoi cette étape
    params: dict[str, Any] = field(default_factory=dict)
    optional: bool = False

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class PipelineRecipe:
    """Pipeline complet pour un dataset."""

    title: str
    description: str
    problem_type: str
    target: str | None
    steps: list[PipelineStep] = field(default_factory=list)
    estimated_duration_sec: int = 0
    confidence: str = "high"  # high | medium | low

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["steps"] = [s.to_dict() if hasattr(s, "to_dict") else s for s in self.steps]
        return d


# ── Builder ──────────────────────────────────────────────────────────────


def build_recipe(profile: DatasetProfile) -> PipelineRecipe:
    """Construit un pipeline adapté au profil du dataset."""
    steps: list[PipelineStep] = []
    duration = 0

    target = profile.suggested_target
    problem = profile.problem_type

    # ──  1. Cleaning ──
    cleaning_actions = []
    if profile.duplicate_ratio > 0.01:
        cleaning_actions.append("remove_duplicates")
    if profile.high_missing_cols:
        cleaning_actions.append("drop_high_missing_cols")
    if profile.near_constant_cols:
        cleaning_actions.append("drop_constant_cols")
    if profile.overall_null_rate > 0.05:
        cleaning_actions.append("impute_missing")

    if cleaning_actions:
        steps.append(PipelineStep(
            key="clean",
            operation="clean",
            label="Nettoyage des données",
            rationale=(
                f"Présence de {profile.duplicate_rows} doublons, "
                f"{len(profile.high_missing_cols)} colonnes trop manquantes, "
                f"{len(profile.near_constant_cols)} quasi-constantes."
            ),
            params={
                "actions": cleaning_actions,
                "high_missing_cols": profile.high_missing_cols,
                "constant_cols": profile.near_constant_cols,
            },
        ))
        duration += 2

    # ── 2. Profilage / Descriptives ──
    steps.append(PipelineStep(
        key="descriptive",
        operation="descriptive",
        label="Statistiques descriptives",
        rationale="Vue d'ensemble : distributions, tendances centrales, dispersion.",
        params={"bootstrap_ci": profile.n_rows < 1000},
    ))
    duration += 2

    # ── 3. Corrélations (si ≥2 numériques) ──
    if len(profile.numeric_cols) >= 2:
        steps.append(PipelineStep(
            key="correlations",
            operation="correlation",
            label="Matrice de corrélation",
            rationale=f"{len(profile.numeric_cols)} variables numériques disponibles.",
            params={"method": "pearson"},
        ))
        duration += 1

    # ── 4. VIF (multicolinéarité) ──
    if len(profile.numeric_cols) >= 3 and problem in ("regression", "binary_classification", "multiclass_classification"):
        steps.append(PipelineStep(
            key="vif",
            operation="vif",
            label="Vérification multicolinéarité (VIF)",
            rationale="Indispensable avant une régression : détecte les variables redondantes.",
            params={},
        ))
        duration += 1

    # ── 5. Transformations recommandées ──
    if problem in ("regression", "binary_classification", "multiclass_classification"):
        steps.append(PipelineStep(
            key="transform_recommend",
            operation="transform_recommend",
            label="Recommandations de transformation",
            rationale="Identifie les variables nécessitant log/standardisation/Box-Cox.",
            params={},
            optional=True,
        ))
        duration += 1

    # ── 6. Réduction de dimensions (si haut dim) ──
    if "high_dim" in profile.flags or "wide_dataset" in profile.flags:
        if len(profile.numeric_cols) >= 5:
            steps.append(PipelineStep(
                key="pca",
                operation="pca",
                label="ACP — Réduction de dimensions",
                rationale=(
                    "Dataset à haute dimension : ACP recommandée pour identifier les axes principaux."
                ),
                params={"columns": profile.numeric_cols},
            ))
            duration += 3

    # ── 7. Modélisation ou prévision ──
    if problem == "forecast" and profile.temporal_cols and profile.numeric_cols:
        date_col = profile.temporal_cols[0]
        value_col = target or profile.numeric_cols[0]
        orders = profile.integration_orders  # col -> {order, is_stationary, ...}
        stat_summary = profile.stationarity_summary  # all_stationary | all_nonstationary | mixed | unknown

        if len(profile.numeric_cols) >= 2:
            value_cols = profile.numeric_cols[:5]

            # Choisir le modèle selon stationnarité
            if stat_summary == "all_stationary":
                # Toutes I(0) → VAR en niveaux
                forced_model = "var"
                ts_rationale = (
                    f"Toutes les séries sont stationnaires I(0) → VAR en niveaux recommandé "
                    f"(ADF confirmé pour : {', '.join(value_cols[:3])})."
                )
            elif stat_summary == "all_nonstationary" and profile.cointegration_likely:
                # Toutes I(1) + probable cointégration → VECM
                forced_model = "vecm"
                ts_rationale = (
                    f"{len(value_cols)} séries non-stationnaires I(1) détectées. "
                    f"Cointégration probable → VECM recommandé (test Johansen inclus)."
                )
            elif stat_summary == "all_nonstationary":
                # Toutes I(1) sans cointégration → VAR en différences
                forced_model = "var"
                ts_rationale = (
                    f"Séries I(1) sans cointégration détectée → VAR sur premières différences."
                )
            elif stat_summary == "mixed":
                # I(0) et I(1) mélangés → ARDL
                i0 = [c for c, v in orders.items() if v.get("order", 1) == 0]
                i1 = [c for c, v in orders.items() if v.get("order", 0) >= 1]
                forced_model = "ardl"
                ts_rationale = (
                    f"Stationnarité mixte détectée : {len(i0)} I(0), {len(i1)} I(1) → ARDL recommandé "
                    f"(robuste aux ordres d'intégration mixtes)."
                )
            else:
                # Inconnu → laisser l'auto-sélection
                forced_model = None
                ts_rationale = "Plusieurs variables temporelles : analyse de cointégration et VAR."

            step_params: dict = {
                "date_col": date_col,
                "value_cols": value_cols,
                "forecast_steps": 10,
            }
            if forced_model:
                step_params["forced_model"] = forced_model

            model_label = {
                "vecm": "Prévision multivariée — VECM (cointégration)",
                "ardl": "Prévision multivariée — ARDL (ordres mixtes)",
                "var": "Prévision multivariée — VAR",
            }.get(forced_model or "", "Prévision multivariée (VAR/VECM/ARDL)")

            steps.append(PipelineStep(
                key="timeseries_multivariate",
                operation="timeseries_multivariate",
                label=model_label,
                rationale=ts_rationale,
                params=step_params,
            ))
            duration += 15

        else:
            # Univarié : choisir d selon ADF
            col_order_info = orders.get(value_col, {})
            d = col_order_info.get("order", 0)
            adf_p = col_order_info.get("adf_p")

            if d == 0:
                stat_note = f"Série stationnaire (ADF p={adf_p:.4f}) → ARIMA(d=0)/SARIMA."
            elif d == 1:
                stat_note = f"Série I(1) (ADF p={adf_p:.4f}) → ARIMA(d=1) recommandé."
            else:
                stat_note = f"Série I({d}) → différenciation {d} ordre(s) nécessaire."

            steps.append(PipelineStep(
                key="timeseries",
                operation="timeseries",
                label=f"Prévision ARIMA(d={d}) sur `{value_col}`",
                rationale=f"{stat_note} Modélisation ARIMA/SARIMA/Holt-Winters avec prévisions.",
                params={
                    "date_col": date_col,
                    "value_col": value_col,
                    "forecast_steps": 10,
                },
            ))
            duration += 10

    elif problem in ("regression", "binary_classification", "multiclass_classification") and target:
        # Liste de modèles selon le problème
        if problem == "regression":
            model_keys = ["linear_regression", "ridge", "random_forest", "gradient_boosting"]
        else:
            model_keys = ["logistic_regression", "random_forest", "gradient_boosting"]

        steps.append(PipelineStep(
            key="model",
            operation="model",
            label=f"Modélisation prédictive ({problem.replace('_', ' ')})",
            rationale=(
                f"Cible détectée : `{target}` (confiance {profile.target_score:.0f}/100). "
                f"Mode compétitif avec validation croisée."
            ),
            params={
                "target_col": target,
                "model_keys": model_keys,
                "cv_folds": 5 if profile.n_rows >= 200 else 3,
                "competitive": True,
            },
        ))
        duration += 10

        # SHAP si possible
        steps.append(PipelineStep(
            key="explainability",
            operation="explainability",
            label="Explicabilité SHAP",
            rationale="Interprétation des prédictions par SHAP : feature importance + impacts locaux.",
            params={"target_col": target},
            optional=True,
        ))
        duration += 5

    # ── 8. Insights automatiques ──
    steps.append(PipelineStep(
        key="insights",
        operation="insights",
        label="Génération d'insights narratifs",
        rationale="Transforme les résultats numériques en interprétations actionnables.",
        params={},
    ))
    duration += 1

    # ── 9. Rapport (optionnel) ──
    steps.append(PipelineStep(
        key="report",
        operation="report",
        label="Rapport PDF/DOCX",
        rationale="Génère un rapport complet avec insights, graphiques et recommandations.",
        params={"format": "pdf"},
        optional=True,
    ))
    duration += 3

    # Titre et confiance globale
    if problem == "forecast":
        title = "Prévision de séries temporelles"
        desc = f"Pipeline de prévision sur **{target or profile.numeric_cols[0] if profile.numeric_cols else 'la variable cible'}**."
    elif problem == "regression":
        title = f"Régression sur `{target}`"
        desc = f"Pipeline de régression : nettoyage, exploration, modélisation, explicabilité."
    elif problem in ("binary_classification", "multiclass_classification"):
        title = f"Classification : prédire `{target}`"
        desc = f"Pipeline de classification {'binaire' if problem == 'binary_classification' else 'multi-classe'}."
    else:
        title = "Exploration du dataset"
        desc = "Aucune cible évidente détectée : pipeline exploratoire."

    confidence = "high" if profile.target_score >= 70 or problem == "forecast" else "medium" if profile.target_score >= 40 else "low"

    return PipelineRecipe(
        title=title,
        description=desc,
        problem_type=problem,
        target=target,
        steps=steps,
        estimated_duration_sec=duration,
        confidence=confidence,
    )
