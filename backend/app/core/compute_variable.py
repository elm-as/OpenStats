"""
Module de calcul de variables personnalisées via des expressions mathématiques.
Utilise pandas.eval() après validation stricte d'AST pour empêcher toute injection.
"""

from __future__ import annotations

import ast
from typing import Any
import numpy as np
import pandas as pd

ALLOWED_MATH_FUNCTIONS = frozenset({
    "log", "log10", "exp", "sqrt", "sin", "cos", "tan",
    "arcsin", "arccos", "arctan", "abs",
})


def validate_formula_ast(formula: str) -> None:
    """
    Vérifie qu'une formule mathématique ne contient que des opérations arithmétiques
    et des fonctions autorisées, interdisant tout accès à des attributs ou objets système.
    """
    if not formula or not formula.strip():
        raise ValueError("La formule est vide.")

    try:
        tree = ast.parse(formula.strip(), mode="eval")
    except SyntaxError as exc:
        raise ValueError(f"Erreur de syntaxe dans la formule : {exc}") from exc

    for node in ast.walk(tree):
        if isinstance(node, (ast.Expression, ast.BinOp, ast.UnaryOp, ast.Constant, ast.Name, ast.Load)):
            continue
        if isinstance(node, (ast.Add, ast.Sub, ast.Mult, ast.Div, ast.FloorDiv, ast.Mod, ast.Pow, ast.USub, ast.UAdd)):
            continue
        if isinstance(node, ast.Call):
            if isinstance(node.func, ast.Name) and node.func.id in ALLOWED_MATH_FUNCTIONS:
                continue
            func_name = getattr(node.func, "id", "inconnu")
            raise ValueError(f"Fonction mathématique non autorisée dans la formule : '{func_name}'.")

        raise ValueError(f"Opération syntaxique interdite dans la formule : '{type(node).__name__}'.")


def compute_new_variable(df: pd.DataFrame, new_col_name: str, formula: str) -> tuple[pd.DataFrame, dict[str, Any]]:
    """
    Évalue une formule mathématique sur un DataFrame et ajoute le résultat
    comme nouvelle colonne.
    """
    df_out = df.copy()

    try:
        validate_formula_ast(formula)
        result_series = df_out.eval(formula)

        if isinstance(result_series, pd.DataFrame):
            raise ValueError("L'expression a retourné un DataFrame au lieu d'une Series 1D.")

        df_out[new_col_name] = result_series

        log = {
            "column": new_col_name,
            "transform": "compute",
            "formula": formula,
            "success": True,
            "meta": {"formula": formula},
        }
        return df_out, log

    except Exception as exc:
        log = {
            "column": new_col_name,
            "transform": "compute",
            "formula": formula,
            "success": False,
            "error": str(exc),
        }
        return df_out, log
