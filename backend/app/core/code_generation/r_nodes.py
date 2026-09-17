"""
Traduction des noeuds du canvas en blocs de code R.

Mêmes regles que le generateur Python : chaque bloc declare ses packages, les
identifiants passent par des litteraux echappes, les parametres du noeud sont
reellement lus, et un noeud sans traduction leve au lieu de produire un no-op.

Les noms de colonnes arrivent via `[[ "nom" ]]` plutot qu'en syntaxe non
standard : c'est la seule forme qui accepte accents, espaces et apostrophes
sans ambiguite.
"""

from __future__ import annotations

from typing import Any

from app.core.code_generation.emitter import CodeBlock, r_cols, r_literal

TIDY = "library(tidyverse)"
STATS = "library(stats)"


def loader(dataset_name: str) -> CodeBlock:
    """Chargement selon l'extension reelle du fichier."""
    extension = dataset_name.rsplit(".", 1)[-1].lower() if "." in dataset_name else "csv"
    name = r_literal(dataset_name)

    if extension in ("xlsx", "xls"):
        call, package = f"readxl::read_excel({name})", "library(readxl)"
    elif extension == "parquet":
        call, package = f"arrow::read_parquet({name})", "library(arrow)"
    elif extension == "json":
        call, package = f"jsonlite::fromJSON({name}) %>% as_tibble()", "library(jsonlite)"
    elif extension == "tsv":
        call, package = f"readr::read_tsv({name})", "library(readr)"
    else:
        call, package = f"readr::read_csv({name})", "library(readr)"

    return CodeBlock(
        imports=[TIDY, package],
        body=[
            "# Chargement du jeu de donnees",
            f"df <- {call}",
            'cat(sprintf("Dataset : %d lignes, %d colonnes\\n", nrow(df), ncol(df)))',
        ],
    )


def _columns(params: dict[str, Any], *keys: str) -> list[str]:
    for key in keys:
        value = params.get(key)
        if isinstance(value, list) and value:
            return [str(v) for v in value]
        if isinstance(value, str) and value:
            return [value]
    return []


def _target(params: dict[str, Any]) -> str | None:
    for key in ("targetCol", "target_col", "target", "value_col", "valueCol"):
        value = params.get(key)
        if isinstance(value, str) and value:
            return value
    return None


def _numeric_subset(params: dict[str, Any]) -> str:
    cols = _columns(params, "columns")
    if cols:
        return f"df[, {r_cols(cols)}, drop = FALSE]"
    return "df %>% select(where(is.numeric))"


def emit(node_type: str, params: dict[str, Any], dataset_name: str) -> CodeBlock:
    """Bloc de code R pour un noeud. `supported=False` si non traduisible."""
    handler = _HANDLERS.get(node_type)
    if handler is None:
        return CodeBlock(
            body=[
                f"# NON TRADUIT : le noeud '{node_type}' n'a pas d'equivalent R.",
                f"stop({r_literal(f'Noeud non traduit : {node_type}')})",
            ],
            supported=False,
            note=f"aucune traduction R pour '{node_type}'",
        )
    return handler(params)


# ── Preparation ──────────────────────────────────────────────────────────

def _typing(params: dict[str, Any]) -> CodeBlock:
    return CodeBlock(imports=[TIDY], body=[
        "# Typage des colonnes",
        "df <- df %>% mutate(across(where(is.character), as.factor))",
        "glimpse(df)",
    ])


def _cleaning(params: dict[str, Any]) -> CodeBlock:
    """Reproduit `_exec_clean` : seules les actions demandees sont appliquees."""
    actions = params.get("actions", [])
    if isinstance(actions, str):
        actions = [a.strip() for a in actions.split(",") if a.strip()]
    actions = [str(a) for a in actions]

    body = [f"# Nettoyage - actions du pipeline : {', '.join(actions) or 'aucune'}"]

    if "remove_duplicates" in actions:
        body += [
            "n_avant <- nrow(df)",
            "df <- distinct(df)",
            'cat(sprintf("Doublons retires : %d\\n", n_avant - nrow(df)))',
        ]

    for action, key in (("drop_high_missing_cols", "high_missing_cols"),
                        ("drop_constant_cols", "constant_cols")):
        if action in actions:
            cols = _columns(params, key)
            body += [
                f"a_retirer <- intersect({r_cols(cols)}, names(df))",
                "df <- df[, setdiff(names(df), a_retirer), drop = FALSE]",
                'cat(sprintf("Colonnes retirees : %s\\n", paste(a_retirer, collapse = ", ")))',
            ]

    if "impute_missing" in actions:
        body += [
            "# Imputation : mediane pour les numeriques, mode pour les qualitatives",
            "for (col in names(df)) {",
            "  if (anyNA(df[[col]])) {",
            "    if (is.numeric(df[[col]])) {",
            "      valeur <- median(df[[col]], na.rm = TRUE)",
            "    } else {",
            "      tab <- sort(table(df[[col]]), decreasing = TRUE)",
            '      valeur <- if (length(tab) > 0) names(tab)[1] else "missing"',
            "    }",
            "    df[[col]][is.na(df[[col]])] <- valeur",
            "  }",
            "}",
        ]

    if len(body) == 1:
        body.append('cat("Aucune action de nettoyage configuree.\\n")')
    body.append('cat(sprintf("Apres nettoyage : %d lignes, %d colonnes\\n", nrow(df), ncol(df)))')
    return CodeBlock(imports=[TIDY], body=body)


def _transform(params: dict[str, Any]) -> CodeBlock:
    """Transformations, alignees sur le comportement du moteur (decalages inclus)."""
    transforms = params.get("transforms")
    if not isinstance(transforms, list) or not transforms:
        key = params.get("transform") or params.get("method")
        cols = _columns(params, "columns", "column")
        transforms = [{"column": c, "transform": key} for c in cols] if key and cols else []

    if not transforms:
        return CodeBlock(imports=[TIDY], body=[
            "# Aucune transformation configuree sur ce noeud.",
            'cat("Transformations : rien a appliquer.\\n")',
        ])

    imports = [TIDY]
    body = ["# Transformations - memes regles que le moteur de l'application"]
    unknown: list[str] = []

    for item in transforms:
        if not isinstance(item, dict):
            continue
        column = item.get("column")
        key = str(item.get("transform") or item.get("key") or "")
        if not column:
            continue
        lines, needed = _transform_lines(str(column), key, item.get("params") or {})
        if lines is None:
            unknown.append(key)
            continue
        imports.extend(needed)
        body.append(f"# {column} : {key}")
        body.extend(lines)

    if unknown:
        body.append(f"# Transformations sans equivalent genere, NON appliquees : "
                    f"{', '.join(sorted(set(unknown)))}")
    body.append("print(summary(df))")

    return CodeBlock(imports=imports, body=body, supported=not unknown,
                     note=(f"transformations non traduites : {sorted(set(unknown))}"
                           if unknown else ""))


def _transform_lines(column: str, key: str,
                     params: dict[str, Any]) -> tuple[list[str] | None, list[str]]:
    """Lignes R reproduisant une transformation du catalogue."""
    c = r_literal(column)
    s = f"df[[{c}]]"

    simple = {
        "square": f"{s} ^ 2",
        "reciprocal": f"ifelse({s} == 0, NA, 1 / {s})",
        "standardize": f"if (sd({s}, na.rm = TRUE) != 0) "
                       f"({s} - mean({s}, na.rm = TRUE)) / sd({s}, na.rm = TRUE) "
                       f"else {s} - mean({s}, na.rm = TRUE)",
        "minmax": f"if (diff(range({s}, na.rm = TRUE)) != 0) "
                  f"({s} - min({s}, na.rm = TRUE)) / diff(range({s}, na.rm = TRUE)) else {s} * 0",
        "robust_scale": f"({s} - median({s}, na.rm = TRUE)) / "
                        f"ifelse(IQR({s}, na.rm = TRUE) != 0, IQR({s}, na.rm = TRUE), 1)",
        "rank": f"rank({s}, na.last = 'keep', ties.method = 'average')",
    }
    if key in simple:
        return [f"df[[{c}]] <- {simple[key]}"], []

    if key == "diff":
        order = int(params.get("order", 1) or 1)
        return [f"df[[{c}]] <- c(rep(NA, {order}), diff({s}, lag = {order}))"], []
    if key == "diff2":
        return [f"df[[{c}]] <- c(rep(NA, 2), diff({s}, differences = 2))"], []
    if key == "seasonal_diff":
        period = int(params.get("period", 12) or 12)
        return [f"df[[{c}]] <- c(rep(NA, {period}), diff({s}, lag = {period}))"], []
    if key == "lag":
        lag = int(params.get("lag", 1) or 1)
        return [f"df[[{c}]] <- dplyr::lag({s}, n = {lag})"], []
    if key == "pct_change":
        periods = int(params.get("periods", 1) or 1)
        return [f"df[[{c}]] <- ({s} / dplyr::lag({s}, n = {periods})) - 1"], []
    if key == "rolling_mean":
        window = int(params.get("window", 3) or 3)
        return ([f"df[[{c}]] <- zoo::rollapply({s}, width = {window}, FUN = mean, "
                 f"fill = NA, align = 'right', partial = TRUE)"], ["library(zoo)"])
    if key == "rolling_std":
        window = int(params.get("window", 3) or 3)
        return ([f"df[[{c}]] <- zoo::rollapply({s}, width = {window}, FUN = sd, "
                 f"fill = NA, align = 'right', partial = TRUE)"], ["library(zoo)"])
    if key == "winsorize":
        lower = float(params.get("lower", 0.01) or 0.01)
        upper = float(params.get("upper", 0.99) or 0.99)
        return ([f"bornes <- quantile({s}, probs = c({lower}, {upper}), na.rm = TRUE)",
                 f"df[[{c}]] <- pmin(pmax({s}, bornes[1]), bornes[2])"], [])

    # Decalage conditionnel, identique au moteur Python.
    if key in ("log", "log1p", "sqrt"):
        condition = (f"any({s} <= 0, na.rm = TRUE)" if key == "log"
                     else f"any({s} < 0, na.rm = TRUE)")
        offset = ("abs(min({s}, na.rm = TRUE))" if key == "sqrt"
                  else "abs(min({s}, na.rm = TRUE)) + 1").replace("{s}", s)
        function = {"log": "log10", "log1p": "log1p", "sqrt": "sqrt"}[key]
        return ([
            f"decalage <- if ({condition}) {offset} else 0",
            f"df[[{c}]] <- {function}({s} + decalage)",
        ], [])

    if key == "boxcox":
        return ([
            f"vals <- {s}[!is.na({s})]",
            "decalage <- if (any(vals <= 0)) abs(min(vals)) + 1 else 0",
            "bc <- MASS::boxcox(lm((vals + decalage) ~ 1), plotit = FALSE)",
            "lambda <- bc$x[which.max(bc$y)]",
            f"df[[{c}]] <- if (abs(lambda) < 1e-8) log({s} + decalage) "
            f"else (({s} + decalage) ^ lambda - 1) / lambda",
            'cat(sprintf("  lambda Box-Cox = %.6f\\n", lambda))',
        ], ["library(MASS)"])

    if key == "yeo_johnson":
        return ([
            f"tr <- caret::preProcess(data.frame(v = {s}), method = 'YeoJohnson')",
            f"df[[{c}]] <- predict(tr, data.frame(v = {s}))$v",
        ], ["library(caret)"])

    if key == "detrend":
        return ([
            f"idx <- seq_along({s})",
            f"ajuste <- lm({s} ~ idx)",
            f"df[[{c}]] <- {s} - predict(ajuste, newdata = data.frame(idx = idx))",
        ], [])

    return None, []


# ── Description ──────────────────────────────────────────────────────────

def _descriptive_numeric(params: dict[str, Any]) -> CodeBlock:
    return CodeBlock(imports=[TIDY, "library(psych)"], body=[
        "# Statistiques descriptives (variables numeriques)",
        f"num <- {_numeric_subset(params)}",
        "print(psych::describe(num))",
    ])


def _descriptive_categorical(params: dict[str, Any]) -> CodeBlock:
    cols = _columns(params, "columns")
    subset = (f"df[, {r_cols(cols)}, drop = FALSE]" if cols
              else "df %>% select(where(~ !is.numeric(.)))")
    return CodeBlock(imports=[TIDY], body=[
        "# Statistiques descriptives (variables qualitatives)",
        f"cat_df <- {subset}",
        "for (col in names(cat_df)) {",
        '  cat(sprintf("--- %s ---\\n", col))',
        "  print(head(sort(table(cat_df[[col]], useNA = 'ifany'), decreasing = TRUE), 20))",
        "}",
    ])


def _correlation(params: dict[str, Any]) -> CodeBlock:
    method = str(params.get("method", "pearson"))
    return CodeBlock(imports=[TIDY, "library(corrplot)"], body=[
        f"# Matrice de correlation ({method})",
        f"num <- {_numeric_subset(params)}",
        f"mat <- cor(num, use = 'pairwise.complete.obs', method = {r_literal(method)})",
        "print(round(mat, 3))",
        "corrplot::corrplot(mat, method = 'color', addCoef.col = 'black', "
        "tl.col = 'black', number.cex = 0.7)",
    ])


def _vif(params: dict[str, Any]) -> CodeBlock:
    return CodeBlock(imports=[TIDY, "library(car)"], body=[
        "# Facteurs d'inflation de la variance",
        "num <- df %>% select(where(is.numeric)) %>% tidyr::drop_na()",
        "if (ncol(num) >= 3) {",
        "  cible <- names(num)[1]",
        "  formule <- as.formula(paste0('`', cible, '` ~ .'))",
        "  print(car::vif(lm(formule, data = num)))",
        "} else {",
        '  cat("VIF : au moins 3 variables numeriques requises.\\n")',
        "}",
    ])


# ── Analyses ─────────────────────────────────────────────────────────────

def _pca(params: dict[str, Any]) -> CodeBlock:
    n_components = int(params.get("n_components", 2) or 2)
    return CodeBlock(imports=[TIDY, "library(FactoMineR)", "library(factoextra)"], body=[
        "# Analyse en composantes principales",
        f"num <- {_numeric_subset(params)} %>% tidyr::drop_na()",
        f"acp <- FactoMineR::PCA(num, ncp = {n_components}, graph = FALSE)",
        "print(acp$eig)",
        "print(factoextra::fviz_pca_biplot(acp, repel = TRUE))",
    ])


def _manifold(params: dict[str, Any]) -> CodeBlock:
    return CodeBlock(imports=[TIDY, "library(Rtsne)"], body=[
        "# Projection non lineaire (t-SNE)",
        "num <- df %>% select(where(is.numeric)) %>% tidyr::drop_na() %>% distinct()",
        "perplexite <- max(5, min(30, floor((nrow(num) - 1) / 3)))",
        "emb <- Rtsne::Rtsne(as.matrix(scale(num)), dims = 2, perplexity = perplexite)",
        "plot(emb$Y, xlab = 'Dim 1', ylab = 'Dim 2', main = 'Projection t-SNE')",
    ])


def _cluster(params: dict[str, Any]) -> CodeBlock:
    k = int(params.get("n_clusters", params.get("k", 3)) or 3)
    return CodeBlock(imports=[TIDY, "library(cluster)"], body=[
        f"# Classification non supervisee (K-Means, k={k})",
        "num <- df %>% select(where(is.numeric)) %>% tidyr::drop_na()",
        "mat <- scale(num)",
        "set.seed(0)",
        f"km <- kmeans(mat, centers = {k}, nstart = 10)",
        "print(table(km$cluster))",
        "sil <- cluster::silhouette(km$cluster, dist(mat))",
        'cat(sprintf("Silhouette moyenne : %.4f\\n", mean(sil[, 3])))',
    ])


def _regression(params: dict[str, Any]) -> CodeBlock:
    target = _target(params)
    if not target:
        return CodeBlock(body=["# Regression : aucune variable cible configuree."],
                         note="cible manquante")
    features = _columns(params, "features", "columns")
    robust = bool(params.get("robust_se"))
    imports = [TIDY]
    body = [
        f"# Regression sur {target}",
        (f"variables <- {r_cols(features + [target])}" if features
         else f"variables <- union(names(df %>% select(where(is.numeric))), {r_cols([target])})"),
        "reg_df <- df[, intersect(variables, names(df)), drop = FALSE] %>% tidyr::drop_na()",
        f"formule <- as.formula(paste0('`', {r_literal(target)}, '` ~ .'))",
        "modele <- lm(formule, data = reg_df)",
        "print(summary(modele))",
    ]
    if robust:
        imports += ["library(sandwich)", "library(lmtest)"]
        body += [
            "# Erreurs standard robustes (heteroscedasticite detectee par le diagnostic)",
            "print(lmtest::coeftest(modele, vcov. = sandwich::vcovHC(modele, type = 'HC1')))",
        ]
    return CodeBlock(imports=imports, body=body)


def _classification(params: dict[str, Any]) -> CodeBlock:
    target = _target(params)
    if not target:
        return CodeBlock(body=["# Classification : aucune variable cible configuree."],
                         note="cible manquante")
    features = _columns(params, "features", "columns")
    return CodeBlock(imports=[TIDY, "library(randomForest)"], body=[
        f"# Classification de {target}",
        (f"variables <- {r_cols(features + [target])}" if features
         else f"variables <- names(df)"),
        "cls_df <- df[, intersect(variables, names(df)), drop = FALSE] %>% tidyr::drop_na()",
        f"cls_df[[{r_literal(target)}]] <- as.factor(cls_df[[{r_literal(target)}]])",
        f"formule <- as.formula(paste0('`', {r_literal(target)}, '` ~ .'))",
        "set.seed(0)",
        "modele <- randomForest::randomForest(formule, data = cls_df, ntree = 200)",
        "print(modele)",
        "print(randomForest::importance(modele))",
    ])


def _explainability(params: dict[str, Any]) -> CodeBlock:
    target = _target(params)
    if not target:
        return CodeBlock(body=["# Explicabilite : aucune variable cible configuree."],
                         note="cible manquante")
    return CodeBlock(imports=[TIDY, "library(randomForest)"], body=[
        f"# Importance des variables pour {target}",
        "num <- df %>% select(where(is.numeric)) %>% tidyr::drop_na()",
        f"formule <- as.formula(paste0('`', {r_literal(target)}, '` ~ .'))",
        "set.seed(0)",
        "modele <- randomForest::randomForest(formule, data = num, ntree = 200, importance = TRUE)",
        "print(randomForest::importance(modele))",
        "randomForest::varImpPlot(modele)",
    ], note="SHAP n'a pas d'equivalent direct : importance par permutation utilisee")


# ── Series temporelles ───────────────────────────────────────────────────

def _stationarity(params: dict[str, Any]) -> CodeBlock:
    cols = _columns(params, "columns")
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


def _cointegration(params: dict[str, Any]) -> CodeBlock:
    cols = _columns(params, "columns")
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


def _timeseries(params: dict[str, Any]) -> CodeBlock:
    value = _target(params)
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


def _multivariate_timeseries(params: dict[str, Any]) -> CodeBlock:
    cols = _columns(params, "value_cols", "columns")
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


def _survival(params: dict[str, Any]) -> CodeBlock:
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


def _causal(params: dict[str, Any]) -> CodeBlock:
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
        f"names(did_df) <- c('resultat', 'traitement', 'periode')",
        "modele <- lm(resultat ~ traitement * periode, data = did_df)",
        "print(summary(modele))",
        'cat(sprintf("Effet causal (ATT) : %.6f\\n", coef(modele)[["traitement:periode"]]))',
    ])


def _hypothesis(params: dict[str, Any]) -> CodeBlock:
    group = params.get("groupCol") or params.get("group_col")
    value = _target(params) or params.get("valueCol")
    if not (group and value):
        return CodeBlock(body=["# Test d'hypothese : colonnes non configurees."],
                         note="colonnes de test manquantes")
    return CodeBlock(imports=[TIDY], body=[
        "# Comparaison de groupes",
        f"test_df <- df[, {r_cols([str(group), str(value)])}, drop = FALSE] %>% tidyr::drop_na()",
        "names(test_df) <- c('groupe', 'valeur')",
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


def _sql(params: dict[str, Any]) -> CodeBlock:
    query = str(params.get("query") or "SELECT * FROM df")
    return CodeBlock(imports=[TIDY, "library(duckdb)", "library(DBI)"], body=[
        "# Requete SQL via DuckDB",
        "con <- DBI::dbConnect(duckdb::duckdb())",
        "duckdb::duckdb_register(con, 'df', df)",
        f"df <- DBI::dbGetQuery(con, {r_literal(query)})",
        "DBI::dbDisconnect(con, shutdown = TRUE)",
        "print(head(df))",
    ])


def _r_code(params: dict[str, Any]) -> CodeBlock:
    """Un noeud Python n'a pas d'equivalent : on le signale sans le traduire."""
    code = str(params.get("code") or "").strip()
    return CodeBlock(
        body=(["# Noeud Python personnalise : pas de traduction R automatique.",
               "# Code d'origine, a porter manuellement :"]
              + [f"#   {line}" for line in code.splitlines()[:20]]
              + [f"stop({r_literal('Noeud Python a porter manuellement en R')})"]),
        supported=False,
        note="code Python personnalise : portage manuel requis",
    )


def _chart(params: dict[str, Any]) -> CodeBlock:
    x = params.get("x_col") or params.get("xCol")
    ys = _columns(params, "y_cols", "yCols", "y_col")
    kind = str(params.get("chart_type") or params.get("chartType") or "line")
    if not (x and ys):
        return CodeBlock(imports=[TIDY], body=[
            "# Graphique : axes non configures - distributions par defaut",
            "df %>% select(where(is.numeric)) %>% tidyr::pivot_longer(everything()) %>%",
            "  ggplot(aes(value)) + geom_histogram(bins = 30) + facet_wrap(~ name, scales = 'free')",
        ])
    geom = {"line": "geom_line()", "bar": "geom_col()",
            "scatter": "geom_point()", "area": "geom_area()"}.get(kind, "geom_line()")
    return CodeBlock(imports=[TIDY], body=[
        f"# Graphique {kind}",
        f"graphe <- df %>% tidyr::pivot_longer(cols = all_of({r_cols(ys)}), "
        f"names_to = 'serie', values_to = 'valeur') %>%",
        f"  ggplot(aes(x = .data[[{r_literal(str(x))}]], y = valeur, colour = serie)) + {geom} +",
        "  theme_minimal()",
        "print(graphe)",
    ])


def _insights(params: dict[str, Any]) -> CodeBlock:
    return CodeBlock(imports=[TIDY, "library(psych)"], body=[
        "# Synthese : reperes descriptifs et liaisons dominantes",
        "print(psych::describe(df %>% select(where(is.numeric))))",
        "num <- df %>% select(where(is.numeric))",
        "if (ncol(num) >= 2) {",
        "  mat <- abs(cor(num, use = 'pairwise.complete.obs'))",
        "  diag(mat) <- NA",
        "  paires <- which(mat == max(mat, na.rm = TRUE), arr.ind = TRUE)",
        '  cat(sprintf("Liaison la plus forte : %s / %s (r = %.3f)\\n",',
        "      rownames(mat)[paires[1, 1]], colnames(mat)[paires[1, 2]], max(mat, na.rm = TRUE)))",
        "}",
    ])


def _output(params: dict[str, Any]) -> CodeBlock:
    fmt = str(params.get("format", "csv")).lower()
    note = (f"le rendu {fmt.upper()} n'est pas reproductible hors application"
            if fmt in ("pdf", "docx", "pptx") else "")
    return CodeBlock(imports=[TIDY], body=[
        "# Export des resultats",
        "readr::write_csv(df, 'resultat.csv')",
        'cat("Exporte : resultat.csv\\n")',
    ], note=note)


_HANDLERS = {
    "typing": _typing,
    "cleaning": _cleaning, "clean": _cleaning,
    "transform": _transform, "transform_recommend": _transform,
    "stationarization_transform": _transform,
    "descriptiveNumeric": _descriptive_numeric, "descriptive": _descriptive_numeric,
    "descriptiveCategorical": _descriptive_categorical,
    "correlation": _correlation, "correlations": _correlation,
    "vif": _vif,
    "pca": _pca, "manifold": _manifold, "cluster": _cluster, "clustering": _cluster,
    "regression": _regression, "classification": _classification, "model": _regression,
    "explainability": _explainability,
    "testStationarity": _stationarity, "stationarity": _stationarity,
    "timeseries_stationarity": _stationarity,
    "cointegration": _cointegration, "timeseries_cointegration": _cointegration,
    "timeseries": _timeseries, "timeseries_forecast": _timeseries,
    "multivariateTimeseries": _multivariate_timeseries,
    "timeseries_multivariate": _multivariate_timeseries,
    "survival": _survival, "causal": _causal, "hypothesis": _hypothesis,
    "sql": _sql, "python": _r_code, "chart": _chart,
    "insights": _insights, "output": _output, "report": _output,
}

SUPPORTED_NODE_TYPES = sorted(_HANDLERS)
