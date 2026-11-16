"""
Traduction des noeuds utilitaires, requetes SQL, graphiques et sorties en code R.

Couvre DuckDB SQL, le pont vers code externe, ggplot2, insights et export.
"""

from __future__ import annotations

from typing import Any

from app.core.code_generation.emitter import CodeBlock, r_cols, r_literal
from app.core.code_generation.r_nodes_base import TIDY, columns_helper


def emit_sql(params: dict[str, Any]) -> CodeBlock:
    """Requete SQL via DuckDB dans R."""
    query = str(params.get("query") or "SELECT * FROM df")
    return CodeBlock(imports=[TIDY, "library(duckdb)", "library(DBI)"], body=[
        "# Requete SQL via DuckDB",
        "con <- DBI::dbConnect(duckdb::duckdb())",
        "duckdb::duckdb_register(con, 'df', df)",
        f"df <- DBI::dbGetQuery(con, {r_literal(query)})",
        "DBI::dbDisconnect(con, shutdown = TRUE)",
        "print(head(df))",
    ])


def emit_r_code(params: dict[str, Any]) -> CodeBlock:
    """Noeud Python personnalise : signale qu'aucun equivalent direct R n'existe."""
    code = str(params.get("code") or "").strip()
    return CodeBlock(
        body=(["# Noeud Python personnalise : pas de traduction R automatique.",
               "# Code d'origine, a porter manuellement :"]
              + [f"#   {line}" for line in code.splitlines()[:20]]
              + [f"stop({r_literal('Noeud Python a porter manuellement en R')})"]),
        supported=False,
        note="code Python personnalise : portage manuel requis",
    )


def emit_chart(params: dict[str, Any]) -> CodeBlock:
    """Graphiques standards via ggplot2."""
    x = params.get("x_col") or params.get("xCol")
    ys = columns_helper(params, "y_cols", "yCols", "y_col")
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


def emit_insights(params: dict[str, Any]) -> CodeBlock:
    """Synthese descriptive et corrélations dominantes."""
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


def emit_output(params: dict[str, Any]) -> CodeBlock:
    """Exportation du jeu de donnees."""
    fmt = str(params.get("format", "csv")).lower()
    note = (f"le rendu {fmt.upper()} n'est pas reproductible hors application"
            if fmt in ("pdf", "docx", "pptx") else "")
    return CodeBlock(imports=[TIDY], body=[
        "# Export des resultats",
        "readr::write_csv(df, 'resultat.csv')",
        'cat("Exporte : resultat.csv\\n")',
    ], note=note)
