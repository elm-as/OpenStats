"""
Module d'exécution sandboxée sécurisée pour le code Python utilisateur.

Fournit une isolation par sous-processus (multiprocessing spawn) avec validation
statique d'AST, whitelisting de modules et timeout d'exécution.
Conforme à la charte ELMAS.md : fonctions pures, clauses de garde, <= 3 paramètres.
"""

from __future__ import annotations

import ast
import builtins
import multiprocessing as mp
from typing import Any
import pandas as pd

# Modules scientifiques autorisés
ALLOWED_MODULES = frozenset({
    "numpy", "pandas", "scipy", "statsmodels", "sklearn",
    "math", "random", "datetime", "json", "re",
})

# Fonctions built-in proscrites
BLOCKED_BUILTINS = frozenset({
    "open", "exec", "eval", "compile", "__import__",
    "globals", "locals", "input", "breakpoint", "memoryview",
    "type", "classmethod", "staticmethod", "property",
    "getattr", "setattr", "delattr",
})

# Patterns d'attaque connus
DANGEROUS_PATTERNS = frozenset({
    "subprocess", "os.system", "os.popen", "os.exec",
    "shutil", "socket", "http.client", "urllib", "requests",
    "ctypes", "pickle", "shelve", "marshal", "sys.",
    "__subclasses__", "__bases__", "__mro__",
    "__globals__", "__code__", "__reduce__",
})


def validate_python_code_safety(code: str) -> None:
    """
    Analyse statique de sécurité du code Python via AST.
    Lève ValueError si le code contient des patterns ou appels interdits.
    """
    if not code or not code.strip():
        raise ValueError("Le code fourni est vide.")

    code_lower = code.lower()
    for pattern in DANGEROUS_PATTERNS:
        if pattern.lower() in code_lower:
            raise ValueError(f"Opération interdite par la politique de sécurité : '{pattern}'.")

    try:
        tree = ast.parse(code)
    except SyntaxError as exc:
        raise ValueError(f"Erreur de syntaxe Python : {exc}") from exc

    for node in ast.walk(tree):
        # Bloquer l'accès aux attributs magiques/privés (ex: obj.__class__)
        if isinstance(node, ast.Attribute):
            if node.attr.startswith("__") and node.attr.endswith("__"):
                raise ValueError(f"Accès interdit à l'attribut spécial : '{node.attr}'.")

        # Bloquer les appels directs aux builtins dangereux
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
            if node.func.id in BLOCKED_BUILTINS:
                raise ValueError(f"Appel de fonction interdit : '{node.func.id}'.")


def _make_safe_import(allowed: frozenset[str]):
    """Crée une fonction __import__ restreinte à la whitelist."""
    real_import = builtins.__import__

    def safe_import(name: str, *args: Any, **kwargs: Any) -> Any:
        root_package = name.split(".")[0]
        if name in allowed or root_package in allowed:
            return real_import(name, *args, **kwargs)
        raise ImportError(f"Import du module '{name}' non autorisé en environnement sécurisé.")

    return safe_import


def _build_safe_namespace() -> dict[str, Any]:
    """Construit un espace de noms restreint avec builtins et modules scientifiques."""
    import numpy as np
    import pandas as pd
    import scipy.stats as scipy_stats

    safe_builtins = {k: v for k, v in vars(builtins).items() if k not in BLOCKED_BUILTINS}
    safe_builtins["__import__"] = _make_safe_import(ALLOWED_MODULES)

    return {
        "__builtins__": safe_builtins,
        "pd": pd,
        "np": np,
        "stats": scipy_stats,
        "sm": __import__("statsmodels.api", fromlist=["api"]),
        "tsa": __import__("statsmodels.tsa.stattools", fromlist=["adfuller", "kpss"]),
    }


def _worker_run_transform(code: str, df: pd.DataFrame, queue: Any) -> None:
    """Worker enfant pour transformer un DataFrame."""
    try:
        namespace = _build_safe_namespace()
        namespace["df"] = df.copy()

        exec(code, namespace)  # nosec

        result_df = namespace.get("df")
        if result_df is None or not isinstance(result_df, pd.DataFrame):
            queue.put({"status": "error", "message": "Le script doit modifier ou assigner la variable 'df' (DataFrame)."})
            return

        queue.put({"status": "success", "data": result_df})
    except Exception as exc:
        queue.put({"status": "error", "message": str(exc)})


def _worker_run_custom(code: str, df: pd.DataFrame, params: dict[str, Any] | None, queue: Any) -> None:
    """Worker enfant pour exécuter une analyse personnalisée analyze_custom(df, params)."""
    try:
        namespace = _build_safe_namespace()
        exec(code, namespace)  # nosec

        if "analyze_custom" not in namespace or not callable(namespace["analyze_custom"]):
            queue.put({"status": "error", "message": "Le script doit définir une fonction 'analyze_custom(df, params)'."})
            return

        result = namespace["analyze_custom"](df, params or {})
        queue.put({"status": "success", "data": result})
    except Exception as exc:
        queue.put({"status": "error", "message": str(exc)})


def run_sandboxed_transform(code: str, df: pd.DataFrame, timeout_seconds: int = 30) -> pd.DataFrame:
    """
    Exécute un script de transformation de DataFrame dans un processus isolé.
    Retourne le DataFrame résultat ou lève ValueError en cas d'erreur ou timeout.
    """
    validate_python_code_safety(code)

    ctx = mp.get_context("spawn")
    queue = ctx.Queue()
    process = ctx.Process(target=_worker_run_transform, args=(code, df, queue))
    process.start()
    process.join(timeout=timeout_seconds)

    if process.is_alive():
        process.terminate()
        process.join()
        raise ValueError(f"Le script a dépassé le délai limite de {timeout_seconds}s (boucle infinie probable).")

    if queue.empty():
        raise ValueError("Erreur inconnue lors de l'exécution (crash possible par épuisement de mémoire).")

    res = queue.get()
    if res["status"] == "error":
        raise ValueError(res["message"])

    return res["data"]


def run_sandboxed_custom(code: str, df: pd.DataFrame, params: dict[str, Any] | None = None, timeout_seconds: int = 30) -> dict[str, Any]:
    """
    Exécute une fonction d'analyse 'analyze_custom(df, params)' dans un processus isolé.
    Retourne le dictionnaire de résultats ou lève ValueError.
    """
    validate_python_code_safety(code)

    ctx = mp.get_context("spawn")
    queue = ctx.Queue()
    process = ctx.Process(target=_worker_run_custom, args=(code, df, params, queue))
    process.start()
    process.join(timeout=timeout_seconds)

    if process.is_alive():
        process.terminate()
        process.join()
        raise ValueError(f"Le script a dépassé le délai limite de {timeout_seconds}s (boucle infinie probable).")

    if queue.empty():
        raise ValueError("Erreur inconnue lors de l'exécution (crash possible par épuisement de mémoire).")

    res = queue.get()
    if res["status"] == "error":
        raise ValueError(res["message"])

    return res["data"]
