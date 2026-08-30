"""
Générateur de code R reproductible (tidyverse, stats, survival, forecast, vars, FactoMineR).
Conforme à la charte ELMAS.md : fonctions verbe+nom, découpage strict < 350 lignes.
"""

from typing import Any, Dict, List


def _get_r_loader(file_name: str) -> str:
    ext = file_name.split(".")[-1].lower() if "." in file_name else "csv"
    if ext in ("xlsx", "xls"):
        return f"df <- readxl::read_excel('{file_name}')"
    elif ext == "parquet":
        return f"df <- arrow::read_parquet('{file_name}')"
    elif ext == "json":
        return f"df <- jsonlite::fromJSON('{file_name}')"
    elif ext == "tsv":
        return f"df <- read_tsv('{file_name}')"
    return f"df <- read_csv('{file_name}')"


def generate_node_r_code(
    node_type: str,
    node_data: Dict[str, Any],
    dataset_name: str = "dataset.csv",
    include_imports: bool = False
) -> str:
    """
    Génère le code R propre et exécutable pour un nœud spécifique.

    :param node_type: Type du nœud Canvas ou de l'étape de pipeline.
    :param node_data: Paramètres et configuration du nœud.
    :param dataset_name: Nom du fichier de données source.
    :param include_imports: Inclure les importations de librairies R.
    :return: Chaîne de caractères contenant le script R commenté.
    """
    lines: List[str] = []
    actual_file = node_data.get("file") or node_data.get("fileName") or dataset_name or "dataset.csv"

    if node_type == "dataset":
        if include_imports:
            lines.extend(["library(tidyverse)", ""])
        lines.extend([
            f"# Chargement du dataset '{actual_file}'",
            _get_r_loader(actual_file),
            "glimpse(df)",
            "head(df)"
        ])

    elif node_type == "typing":
        if include_imports:
            lines.extend(["library(tidyverse)", ""])
        lines.extend([
            "# Inférence et conversion des types de colonnes",
            "df <- df %>% mutate(across(where(is.character), as.factor))",
            "str(df)"
        ])

    elif node_type == "cleaning":
        if include_imports:
            lines.extend(["library(tidyverse)", ""])
        actions = node_data.get("actions", "") if isinstance(node_data.get("actions"), str) else ""
        is_iqr = "iqr_clipping" in actions
        is_winsorize = "winsorize_1_99" in actions
        is_none_outliers = "none_outliers" in actions

        lines.extend([
            "# Nettoyage : suppression des doublons et imputation des NAs",
            "df <- df %>% distinct()",
            "num_cols <- df %>% select(where(is.numeric)) %>% names()"
        ])
        if is_iqr:
            lines.extend([
                "# Détection IQR et traitement par Capping (Winsorisation 1% - 99%)",
                "# Note: Aligné sur le comportement du backend pour le traitement 'cap'",
                "df <- df %>% mutate(across(all_of(num_cols), function(x) {",
                "  x[is.na(x)] <- median(x, na.rm = TRUE)",
                "  q_low  <- quantile(x, 0.01, na.rm = TRUE)",
                "  q_high <- quantile(x, 0.99, na.rm = TRUE)",
                "  if (!is.na(q_low) && !is.na(q_high) && q_low < q_high) pmin(pmax(x, q_low), q_high) else x",
                "}))",
                "cat('Lignes après nettoyage :', nrow(df), '| Outliers écrêtés via la méthode IQR [cap 1%-99%]\\n')"
            ])
        elif is_winsorize or not is_none_outliers:
            lines.extend([
                "df <- df %>% mutate(across(all_of(num_cols), function(x) {",
                "  x[is.na(x)] <- median(x, na.rm = TRUE)",
                "  q_low  <- quantile(x, 0.01, na.rm = TRUE)",
                "  q_high <- quantile(x, 0.99, na.rm = TRUE)",
                "  if (!is.na(q_low) && !is.na(q_high) && q_low < q_high) pmin(pmax(x, q_low), q_high) else x",
                "}))",
                "cat('Lignes après nettoyage :', nrow(df), '| Outliers extrêmes écrêtés aux percentiles [1%, 99%]\\n')"
            ])
        else:
            lines.extend([
                "df <- df %>% mutate(across(all_of(num_cols), ~ ifelse(is.na(.), median(., na.rm = TRUE), .)))",
                "cat('Lignes après nettoyage :', nrow(df), '\\n')"
            ])

    elif node_type in ("descriptiveNumeric", "descriptiveCategorical"):
        if include_imports:
            lines.extend(["library(tidyverse)", "library(psych)", ""])
        lines.extend([
            "# Statistiques descriptives",
            "describe_res <- psych::describe(df %>% select(where(is.numeric)))",
            "print(describe_res)"
        ])

    elif node_type == "correlation":
        method = node_data.get("method", "pearson")
        if include_imports:
            lines.extend(["library(tidyverse)", "library(corrplot)", ""])
        lines.extend([
            "# Matrice de corrélation",
            "num_data <- df %>% select(where(is.numeric)) %>% drop_na()",
            f"cor_matrix <- cor(num_data, method = '{method}')",
            "print(cor_matrix)",
            "corrplot::corrplot(cor_matrix, method = 'circle', type = 'upper')"
        ])

    elif node_type == "vif":
        if include_imports:
            lines.extend(["library(tidyverse)", "library(car)", ""])
        lines.extend([
            "# Diagnostic de Multicolinéarité (VIF)",
            "num_data <- df %>% select(where(is.numeric)) %>% drop_na()",
            "if (ncol(num_data) >= 2) {",
            "  vif_model <- lm(as.formula(paste(names(num_data)[1], '~ .')), data = num_data)",
            "  vif_vals <- car::vif(vif_model)",
            "  print(vif_vals)",
            "}"
        ])

    elif node_type == "testNormality":
        col = node_data.get("column", "variable")
        if include_imports:
            lines.extend(["library(stats)", ""])
        lines.extend([
            "# Test de normalité (Shapiro-Wilk)",
            f"val_data <- na.omit(df[['{col}']]) if ('{col}' %in% names(df)) else na.omit(df[[1]])",
            "shapiro_res <- shapiro.test(val_data)",
            "print(shapiro_res)"
        ])

    elif node_type == "testCompareMeans":
        group_col = node_data.get("groupCol", "groupe")
        value_col = node_data.get("valueCol", "valeur")
        if include_imports:
            lines.extend(["library(stats)", ""])
        lines.extend([
            "# Test de comparaison de moyennes (Test t de Welch & Kruskal-Wallis)",
            f"if ('{group_col}' %in% names(df) && '{value_col}' %in% names(df)) {{",
            f"  t_res <- t.test(as.formula('{value_col} ~ {group_col}'), data = df, var.equal = FALSE)",
            "  print(t_res)",
            f"  kw_res <- kruskal.test(as.formula('{value_col} ~ {group_col}'), data = df)",
            "  print(kw_res)",
            "}"
        ])

    elif node_type == "pca":
        if include_imports:
            lines.extend(["library(tidyverse)", ""])
        lines.extend([
            "# Analyse en Composantes Principales (ACP)",
            "num_data <- df %>% select(where(is.numeric)) %>% drop_na()",
            "pca_res <- prcomp(num_data, scale. = TRUE)",
            "summary(pca_res)"
        ])

    elif node_type in ("ca", "mca"):
        if include_imports:
            lines.extend(["library(FactoMineR)", ""])
        lines.extend([
            "# Analyse des Correspondances Multiples (ACM)",
            "cat_data <- df %>% select(where(is.factor))",
            "if (ncol(cat_data) >= 2) {",
            "  mca_res <- FactoMineR::MCA(cat_data, graph = FALSE)",
            "  summary(mca_res)",
            "}"
        ])

    elif node_type == "clustering":
        if include_imports:
            lines.extend(["library(tidyverse)", ""])
        lines.extend([
            "# Clustering K-Means",
            "num_data <- df %>% select(where(is.numeric)) %>% drop_na()",
            "km_res <- kmeans(num_data, centers = 3, nstart = 25)",
            "df$cluster <- km_res$cluster",
            "print(table(df$cluster))"
        ])

    elif node_type == "regression":
        target = node_data.get("targetCol") or node_data.get("target", "target")
        if include_imports:
            lines.extend(["library(stats)", "library(randomForest)", ""])
        lines.extend([
            "# Régression Linéaire OLS & Random Forest en R",
            f"target_var <- if ('{target}' %in% names(df)) '{target}' else names(df %>% select(where(is.numeric)))[1]",
            "model_formula <- as.formula(paste(target_var, '~ .'))",
            "ols_res <- lm(model_formula, data = df)",
            "summary(ols_res)",
            "rf_res <- randomForest::randomForest(model_formula, data = na.omit(df), ntree = 100)",
            "print(rf_res)"
        ])

    elif node_type == "classification":
        target = node_data.get("targetCol") or node_data.get("target", "target")
        if include_imports:
            lines.extend(["library(randomForest)", ""])
        lines.extend([
            "# Classification Random Forest en R",
            f"target_var <- if ('{target}' %in% names(df)) '{target}' else names(df)[ncol(df)]",
            "df[[target_var]] <- as.factor(df[[target_var]])",
            "rf_clf <- randomForest::randomForest(as.formula(paste(target_var, '~ .')), data = na.omit(df), ntree = 100)",
            "print(rf_clf)",
            "print(rf_clf$importance)"
        ])

    elif node_type == "timeseries":
        if include_imports:
            lines.extend(["library(forecast)", ""])
        lines.extend([
            "# Séries Temporelles ARIMA & Décomposition",
            "ts_data <- ts(na.omit(df[[1]]), frequency = 12)",
            "arima_fit <- forecast::auto.arima(ts_data)",
            "print(summary(arima_fit))",
            "fcast <- forecast::forecast(arima_fit, h = 5)",
            "print(fcast)"
        ])

    elif node_type == "multivariateTimeseries":
        if include_imports:
            lines.extend(["library(vars)", ""])
        lines.extend([
            "# Séries Temporelles Multivariées (VAR)",
            "num_data <- df %>% select(where(is.numeric)) %>% drop_na()",
            "if (ncol(num_data) >= 2) {",
            "  var_fit <- vars::VAR(num_data, p = 2, type = 'const')",
            "  print(summary(var_fit))",
            "}"
        ])

    elif node_type == "garch":
        if include_imports:
            lines.extend(["library(rugarch)", ""])
        lines.extend([
            "# Modèle de Volatilité GARCH(1,1)",
            "spec <- rugarch::ugarchspec(variance.model = list(model = 'sGARCH', garchOrder = c(1, 1)))",
            "garch_fit <- rugarch::ugarchfit(spec = spec, data = na.omit(df[[1]]))",
            "print(garch_fit)"
        ])

    elif node_type == "survival":
        dur_col = node_data.get("durationCol", "duration")
        evt_col = node_data.get("eventCol", "event")
        if include_imports:
            lines.extend(["library(survival)", ""])
        lines.extend([
            "# Analyse de Survie (Modèle de Cox)",
            f"if ('{dur_col}' %in% names(df) && '{evt_col}' %in% names(df)) {{",
            f"  surv_obj <- Surv(df${dur_col}, df${evt_col})",
            "  cox_fit <- coxph(surv_obj ~ ., data = df)",
            "  summary(cox_fit)",
            "}"
        ])

    elif node_type == "causal":
        treat_col = node_data.get("treatmentCol", "treatment")
        out_col = node_data.get("outcomeCol", "outcome")
        time_col = node_data.get("timeCol", "period")
        if include_imports:
            lines.extend(["library(stats)", ""])
        lines.extend([
            "# Inférence Causale : Difference-in-Differences (DiD)",
            f"if (all(c('{out_col}', '{treat_col}', '{time_col}') %in% names(df))) {{",
            f"  did_mod <- lm({out_col} ~ {treat_col} * {time_col}, data = df)",
            "  summary(did_mod)",
            "}"
        ])

    elif node_type == "sql":
        if include_imports:
            lines.extend(["library(duckdb)", ""])
        query = node_data.get("query", "SELECT * FROM df")
        lines.extend([
            "# Requête SQL via DuckDB en R",
            "con <- dbConnect(duckdb())",
            "dbWriteTable(con, 'df', df)",
            f"res_df <- dbGetQuery(con, '{query}')",
            "print(head(res_df))",
            "dbDisconnect(con, shutdown = TRUE)"
        ])

    else:
        if include_imports:
            lines.extend(["library(tidyverse)", ""])
        lines.extend([
            f"# Traitement / Analyse R pour le nœud '{node_type}'",
            "glimpse(df)"
        ])

    return "\n".join(lines)


def generate_pipeline_r_script(steps: List[Dict[str, Any]], dataset_name: str = "dataset.csv") -> str:
    from app.core.code_generation.r_pipeline_generator import generate_pipeline_r_script as _gen
    return _gen(steps, dataset_name)

