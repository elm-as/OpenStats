"""
Traduction des noeuds utilitaires, SQL, graphiques et exports en Python.
"""

from __future__ import annotations

from typing import Any

from app.core.code_generation.emitter import CodeBlock, py_cols, py_literal
from app.core.code_generation.python_nodes_prep import columns_helper

PANDAS = "import pandas as pd"
NUMPY = "import numpy as np"
PLT = "import matplotlib.pyplot as plt"


def emit_sql(params: dict[str, Any]) -> CodeBlock:
    query = str(params.get("query") or "SELECT * FROM df")
    return CodeBlock(
        imports=["import duckdb"],
        body=[
            "# Requete SQL via DuckDB",
            f"_requete = {py_literal(query)}",
            "df = duckdb.query(_requete).to_df()",
            "print(df.head())",
        ],
    )


def emit_python(params: dict[str, Any]) -> CodeBlock:
    code = str(params.get("code") or "").strip()
    if not code:
        return CodeBlock(body=["# Noeud Python : aucun code fourni."])
    return CodeBlock(
        imports=[PANDAS, NUMPY],
        body=["# Code Python personnalise (repris tel quel du canvas)"]
        + code.splitlines(),
    )


def emit_chart(params: dict[str, Any]) -> CodeBlock:
    x = params.get("x_col") or params.get("xCol")
    ys = columns_helper(params, "y_cols", "yCols", "y_col")
    kind = str(params.get("chart_type") or params.get("chartType") or "line")
    if not (x and ys):
        return CodeBlock(
            imports=[PLT],
            body=[
                "# Graphique : axes non configures.",
                (
                    "df.select_dtypes(include='number').hist(figsize=(11, 8));"
                    " plt.tight_layout(); plt.show()"
                ),
            ],
        )
    mapping = {"line": "line", "bar": "bar", "scatter": "scatter", "area": "area"}
    return CodeBlock(
        imports=[PANDAS, PLT],
        body=[
            f"# Graphique {kind}",
            (
                f"_plot = df.plot(kind={py_literal(mapping.get(kind, 'line'))},"
                f" x={py_literal(str(x))}, y={py_cols(ys)}, figsize=(10, 5))"
            ),
            "plt.tight_layout(); plt.show()",
        ],
    )


def emit_insights(params: dict[str, Any]) -> CodeBlock:
    return CodeBlock(
        imports=[PANDAS],
        body=[
            "# Synthese : reperes descriptifs et correlations dominantes",
            "print(df.describe(include='all').T)",
            "_num = df.select_dtypes(include='number')",
            "if _num.shape[1] >= 2:",
            (
                "    _c ="
                " _num.corr().abs().unstack().sort_values(ascending=False)"
            ),
            "    _c = _c[_c < 0.999].drop_duplicates()",
            "    print('Liaisons les plus fortes :'); print(_c.head(10))",
        ],
    )


def emit_output(params: dict[str, Any]) -> CodeBlock:
    fmt = str(params.get("format", "csv")).lower()
    if fmt in ("pdf", "docx", "pptx"):
        return CodeBlock(
            imports=[PANDAS],
            body=[
                (
                    f"# Export : le rapport {fmt.upper()} est produit par"
                    " l'application."
                ),
                (
                    "# Le script exporte ici les donnees et les statistiques"
                    " equivalentes."
                ),
                "df.to_csv('resultat.csv', index=False)",
                "df.describe().T.to_csv('statistiques.csv')",
                "print('Donnees exportees : resultat.csv, statistiques.csv')",
            ],
            note=f"le rendu {fmt.upper()} n'est pas reproductible hors application",
        )
    return CodeBlock(
        imports=[PANDAS],
        body=[
            "# Export du jeu de donnees",
            "df.to_csv('resultat.csv', index=False)",
            "print('Exporte : resultat.csv')",
        ],
    )
