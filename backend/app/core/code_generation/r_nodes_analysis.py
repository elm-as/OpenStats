"""
Traduction des noeuds d'analyse et de modelisation en blocs de code R.

Couvre les statistiques descriptives, correlations, VIF, PCA, t-SNE,
K-Means, regression, classification et explicabilite.
"""

from __future__ import annotations

from typing import Any

from app.core.code_generation.emitter import CodeBlock, r_cols, r_literal
from app.core.code_generation.r_nodes_base import (
    TIDY,
    columns_helper,
    numeric_subset_helper,
    target_helper,
)


def emit_descriptive_numeric(params: dict[str, Any]) -> CodeBlock:
    """Statistiques descriptives pour les variables numeriques."""
    return CodeBlock(imports=[TIDY, "library(psych)"], body=[
        "# Statistiques descriptives (variables numeriques)",
        f"num <- {numeric_subset_helper(params)}",
        "print(psych::describe(num))",
    ])


def emit_descriptive_categorical(params: dict[str, Any]) -> CodeBlock:
    """Statistiques descriptives pour les variables qualitatives."""
    cols = columns_helper(params, "columns")
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


def emit_correlation(params: dict[str, Any]) -> CodeBlock:
    """Matrice de correlation avec corrplot."""
    method = str(params.get("method", "pearson"))
    return CodeBlock(imports=[TIDY, "library(corrplot)"], body=[
        f"# Matrice de correlation ({method})",
        f"num <- {numeric_subset_helper(params)}",
        f"mat <- cor(num, use = 'pairwise.complete.obs', method = {r_literal(method)})",
        "print(round(mat, 3))",
        "corrplot::corrplot(mat, method = 'color', addCoef.col = 'black', "
        "tl.col = 'black', number.cex = 0.7)",
    ])


def emit_vif(params: dict[str, Any]) -> CodeBlock:
    """Facteurs d'inflation de la variance (car::vif)."""
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


def emit_pca(params: dict[str, Any]) -> CodeBlock:
    """Analyse en composantes principales via FactoMineR."""
    n_components = int(params.get("n_components", 2) or 2)
    return CodeBlock(imports=[TIDY, "library(FactoMineR)", "library(factoextra)"], body=[
        "# Analyse en composantes principales",
        f"num <- {numeric_subset_helper(params)} %>% tidyr::drop_na()",
        f"acp <- FactoMineR::PCA(num, ncp = {n_components}, graph = FALSE)",
        "print(acp$eig)",
        "print(factoextra::fviz_pca_biplot(acp, repel = TRUE))",
    ])


def emit_manifold(params: dict[str, Any]) -> CodeBlock:
    """Projection non-lineaire (t-SNE via Rtsne)."""
    return CodeBlock(imports=[TIDY, "library(Rtsne)"], body=[
        "# Projection non lineaire (t-SNE)",
        "num <- df %>% select(where(is.numeric)) %>% tidyr::drop_na() %>% distinct()",
        "perplexite <- max(5, min(30, floor((nrow(num) - 1) / 3)))",
        "emb <- Rtsne::Rtsne(as.matrix(scale(num)), dims = 2, perplexity = perplexite)",
        "plot(emb$Y, xlab = 'Dim 1', ylab = 'Dim 2', main = 'Projection t-SNE')",
    ])


def emit_cluster(params: dict[str, Any]) -> CodeBlock:
    """Clustering K-Means avec silhouette moyenne."""
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


def emit_regression(params: dict[str, Any]) -> CodeBlock:
    """Regression lineaire ordinaire ou avec erreurs robustes."""
    target = target_helper(params)
    if not target:
        return CodeBlock(body=["# Regression : aucune variable cible configuree."],
                         note="cible manquante")
    features = columns_helper(params, "features", "columns")
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


def emit_classification(params: dict[str, Any]) -> CodeBlock:
    """Classification par foret aleatoire (randomForest)."""
    target = target_helper(params)
    if not target:
        return CodeBlock(body=["# Classification : aucune variable cible configuree."],
                         note="cible manquante")
    features = columns_helper(params, "features", "columns")
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


def emit_explainability(params: dict[str, Any]) -> CodeBlock:
    """Importance des variables par foret aleatoire."""
    target = target_helper(params)
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
