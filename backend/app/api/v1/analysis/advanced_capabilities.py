"""Capacités avancées (Survie, Causalité, Panel, Quantiles, Puissance, TOST) pour l'assistant guidé."""

from __future__ import annotations

from typing import Any


def build_advanced_capabilities(
    numeric_cols: list[str],
    categorical_cols: list[str],
    temporal_cols: list[str],
    binary_cols: list[str],
    all_cols: list[str],
) -> list[dict[str, Any]]:
    """Construit les entrées de capacités pour les méthodes R/économétriques avancées."""
    has_numeric = len(numeric_cols) >= 1
    has_two_numeric = len(numeric_cols) >= 2
    has_binary = len(binary_cols) >= 1
    can_panel = len(categorical_cols) >= 1 and (len(temporal_cols) >= 1 or len(all_cols) >= 3) and has_numeric

    return [
        {
            "key": "survival",
            "label": "Analyse de survie (Kaplan-Meier, Log-Rank & Cox)",
            "description": "Courbes de survie Kaplan-Meier avec IC Greenwood 95 %, test du Log-Rank et modèle de Cox",
            "category": "modeling",
            "icon": "activity",
            "available": has_numeric and has_binary,
            "requires": "1 variable de durée (numérique) + 1 événement binaire (0/1)",
            "config_fields": [
                {"key": "durationCol", "label": "Variable de durée / temps", "type": "select", "options": numeric_cols},
                {"key": "eventCol", "label": "Marqueur d'événement (0/1)", "type": "select", "options": binary_cols or numeric_cols},
                {"key": "groupCol", "label": "Groupe de comparaison (optionnel)", "type": "select", "options": categorical_cols + binary_cols, "optional": True},
            ],
            "reason": None if (has_numeric and has_binary) else "Nécessite 1 variable numérique de durée et 1 variable binaire (0/1)",
        },
        {
            "key": "causal",
            "label": "Inférence causale (PSM + Love Plot / DiD)",
            "description": "Score de propension (ATT + diagramme de balance Love Plot) ou Différences-en-Différences",
            "category": "hypothesis",
            "icon": "git_compare",
            "available": has_numeric and has_binary,
            "requires": "1 traitement binaire (0/1) + 1 résultat numérique",
            "config_fields": [
                {"key": "method", "label": "Méthode d'inférence", "type": "select", "options": ["psm", "did"]},
                {"key": "treatmentCol", "label": "Variable de traitement (0/1)", "type": "select", "options": binary_cols},
                {"key": "outcomeCol", "label": "Variable résultat (Y)", "type": "select", "options": numeric_cols},
            ],
            "reason": None if (has_numeric and has_binary) else "Nécessite 1 variable de traitement binaire et 1 variable résultat numérique",
        },
        {
            "key": "panel",
            "label": "Économétrie de panel (Effets fixes / aléatoires & Hausman)",
            "description": "Estimation Within (FE) et GLS (RE), test de spécification de Hausman et coefficients",
            "category": "modeling",
            "icon": "grid",
            "available": can_panel,
            "requires": "1 identifiant d'entité + 1 période + 1 cible numérique",
            "config_fields": [
                {"key": "entityCol", "label": "Variable d'entité (individus/firmes)", "type": "select", "options": categorical_cols},
                {"key": "timeCol", "label": "Variable de période / temps", "type": "select", "options": temporal_cols or all_cols},
                {"key": "targetCol", "label": "Variable expliquée (Y)", "type": "select", "options": numeric_cols},
            ],
            "reason": None if can_panel else "Nécessite 1 colonne d'entité, 1 colonne temporelle et 1 variable numérique",
        },
        {
            "key": "quantileRegression",
            "label": "Régression quantile (τ = 0.10 à 0.90)",
            "description": "Effet des variables explicatives sur différents quantiles conditionnels de la cible",
            "category": "modeling",
            "icon": "sliders",
            "available": has_two_numeric,
            "requires": "Au moins 2 variables numériques",
            "config_fields": [
                {"key": "targetCol", "label": "Variable cible (Y)", "type": "select", "options": numeric_cols},
            ],
            "reason": None if has_two_numeric else "Nécessite au moins 2 variables numériques",
        },
        {
            "key": "powerAnalysis",
            "label": "Puissance statistique & effet minimal détectable",
            "description": "Calcule la puissance atteinte (1 − β) et l'effectif requis par groupe",
            "category": "hypothesis",
            "icon": "zap",
            "available": has_numeric and has_binary,
            "requires": "1 variable de groupe binaire + 1 variable numérique",
            "config_fields": [
                {"key": "groupCol", "label": "Variable de groupe (binaire)", "type": "select", "options": binary_cols},
                {"key": "valueCol", "label": "Variable mesurée", "type": "select", "options": numeric_cols},
            ],
            "reason": None if (has_numeric and has_binary) else "Nécessite 1 variable de groupe binaire et 1 variable numérique",
        },
        {
            "key": "equivalenceTest",
            "label": "Test d'équivalence (TOST)",
            "description": "Double test unilatéral démontrant qu'un écart entre groupes reste négligeable",
            "category": "hypothesis",
            "icon": "scale",
            "available": has_numeric and has_binary,
            "requires": "1 variable de groupe binaire + 1 variable numérique",
            "config_fields": [
                {"key": "groupCol", "label": "Variable de groupe (binaire)", "type": "select", "options": binary_cols},
                {"key": "valueCol", "label": "Variable mesurée", "type": "select", "options": numeric_cols},
            ],
            "reason": None if (has_numeric and has_binary) else "Nécessite 1 variable de groupe binaire et 1 variable numérique",
        },
    ]
