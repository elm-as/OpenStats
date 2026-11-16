"""
Traduction des noeuds d'econometrie et series temporelles en blocs de code R.

Couvre la stationnarite (ADF/KPSS), cointegration (Johansen),
previsions ARIMA, VAR, analyse de survie (Kaplan-Meier),
difference des differences et tests d'hypotheses.
"""

from __future__ import annotations

from typing import Any

from app.core.code_generation.emitter import CodeBlock, r_cols, r_literal
from app.core.code_generation.r_nodes_base import TIDY, columns_helper, target_helper


def emit_stationarity(params: dict[str, Any]) -> CodeBlock:
    """Tests de stationnarite (ADF et KPSS via tseries)."""
    cols = columns_helper(params, "columns")
    subset = (r_cols(cols) if cols
              else "names(df %>% select(where(is.numeric)))[1:min(10, ncol(df))]")
    return CodeBlock(imports=[TIDY, "library(tseries)"], body=[
        "# Tests de stationnarite (ADF et KPSS)",
        f"colonnes <- {subset}",
        "for (col in colonnes) {",
        "  serie <- na.omit(as.numeric(df[[col]]))",
        "  if (length(serie) < 12) next",
        "  adf <- suppressWarnings(tseries::adf.test(serie)$p.value)",
        "  kpss <- suppressWarnings(tseries::kpss.test(serie, null = 'Trend')$p.value)",
        "  verdict <- if (adf < 0.05 && kpss > 0.05) 'stationnaire' else 'non stationnaire'",
        '  cat(sprintf("%-20s ADF p=%.4f  KPSS p=%.4f  -> %s\\n", col, adf, kpss, verdict))',
        "}",
    ])


def emit_cointegration(params: dict[str, Any]) -> CodeBlock:
    """Test de cointegration de Johansen (urca::ca.jo)."""
    cols = columns_helper(params, "columns")
    subset = (r_cols(cols) if cols
              else "names(df %>% select(where(is.numeric)))[1:min(5, ncol(df))]")
    return CodeBlock(imports=[TIDY, "library(urca)"], body=[
        "# Test de cointegration de Johansen",
        f"colonnes <- {subset}",
        "coint_df <- df[, intersect(colonnes, names(df)), drop = FALSE] %>% tidyr::drop_na()",
        "if (ncol(coint_df) >= 2 && nrow(coint_df) > 20) {",
        "  res <- urca::ca.jo(coint_df, type = 'trace', ecdet = 'none', K = 2)",
        "  print(summary(res))",
        "} else {",
        '  cat("Cointegration : au moins 2 series et 20 observations requises.\\n")',
        "}",
    ])


def emit_timeseries(params: dict[str, Any]) -> CodeBlock:
    """Prevision univariée ARIMA (forecast::auto.arima)."""
    value = target_helper(params)
    steps = int(params.get("forecast_steps", 10) or 10)
    if not value:
        return CodeBlock(body=["# Prevision : aucune variable a prevoir configuree."],
                         note="serie manquante")
    return CodeBlock(imports=[TIDY, "library(forecast)"], body=[
        "# Prevision temporelle (ARIMA)",
        f"serie <- na.omit(as.numeric(df[[{r_literal(value)}]]))",
        "modele <- forecast::auto.arima(serie)",
        "print(summary(modele))",
        f"prevision <- forecast::forecast(modele, h = {steps})",
        "print(prevision)",
        "plot(prevision)",
    ])


def emit_multivariate_timeseries(params: dict[str, Any]) -> CodeBlock:
    """Modele vectoriel autoregressif VAR (vars::VAR)."""
    cols = columns_helper(params, "value_cols", "columns")
    steps = int(params.get("forecast_steps", 10) or 10)
    subset = (r_cols(cols) if cols
              else "names(df %>% select(where(is.numeric)))[1:min(5, ncol(df))]")
    return CodeBlock(imports=[TIDY, "library(vars)"], body=[
        "# Modele vectoriel autoregressif (VAR)",
        f"colonnes <- {subset}",
        "var_df <- df[, intersect(colonnes, names(df)), drop = FALSE] %>% tidyr::drop_na()",
        "var_df <- as.data.frame(lapply(var_df, function(v) c(NA, diff(v))))[-1, , drop = FALSE]",
        "modele <- vars::VAR(var_df, lag.max = 4, ic = 'AIC')",
        "print(summary(modele))",
        f"print(predict(modele, n.ahead = {steps}))",
    ])


def emit_survival(params: dict[str, Any]) -> CodeBlock:
    """Courbe de survie de Kaplan-Meier (survival)."""
    duration = params.get("durationCol") or params.get("duration_col")
    event = params.get("eventCol") or params.get("event_col")
    if not duration or not event:
        return CodeBlock(body=["# Analyse de survie : colonnes duree/evenement non configurees."],
                         note="colonnes duree/evenement manquantes")
    return CodeBlock(imports=[TIDY, "library(survival)"], body=[
        "# Analyse de survie (Kaplan-Meier)",
        f"surv_df <- df[, {r_cols([str(duration), str(event)])}, drop = FALSE] %>% tidyr::drop_na()",
        f"objet <- survival::Surv(surv_df[[{r_literal(str(duration))}]], "
        f"surv_df[[{r_literal(str(event))}]])",
        "ajuste <- survival::survfit(objet ~ 1)",
        "print(ajuste)",
        "plot(ajuste, xlab = 'Duree', ylab = 'Survie', main = 'Courbe de Kaplan-Meier')",
    ])


def emit_causal(params: dict[str, Any]) -> CodeBlock:
    """Inference causale : difference des differences (DiD)."""
    treat = params.get("treatmentCol") or params.get("treatment_col")
    outcome = params.get("outcomeCol") or params.get("outcome_col")
    period = params.get("timeCol") or params.get("time_col")
    if not (treat and outcome and period):
        return CodeBlock(body=["# Inference causale : colonnes non configurees."],
                         note="colonnes DiD manquantes")
    return CodeBlock(imports=[TIDY], body=[
        "# Inference causale : difference des differences",
        f"did_df <- df[, {r_cols([str(outcome), str(treat), str(period)])}, drop = FALSE] "
        "%>% tidyr::drop_na()",
        "names(did_df) <- c('resultat', 'traitement', 'periode')",
        "modele <- lm(resultat ~ traitement * periode, data = did_df)",
        "print(summary(modele))",
        'cat(sprintf("Effet causal (ATT) : %.6f\\n", coef(modele)[["traitement:periode"]]))',
    ])


def emit_hypothesis(params: dict[str, Any]) -> CodeBlock:
    """Comparaison de groupes (test t ou ANOVA)."""
    group = params.get("groupCol") or params.get("group_col")
    value = target_helper(params) or params.get("valueCol")
    if not (group and value):
        return CodeBlock(body=["# Test d'hypothese : colonnes non configurees."],
                         note="colonnes de test manquantes")
    return CodeBlock(imports=[TIDY], body=[
        "# Comparaison de groupes",
        f"test_df <- df[, {r_cols([str(group), str(value)])}, drop = FALSE] %>% tidyr::drop_na()",
        "test_df$groupe <- as.factor(test_df$groupe)",
        "n_groupes <- nlevels(droplevels(test_df$groupe))",
        "if (n_groupes == 2) {",
        "  print(t.test(valeur ~ groupe, data = test_df))",
        "} else if (n_groupes > 2) {",
        "  print(summary(aov(valeur ~ groupe, data = test_df)))",
        "} else {",
        '  cat("Pas assez de groupes exploitables.\\n")',
        "}",
    ])
