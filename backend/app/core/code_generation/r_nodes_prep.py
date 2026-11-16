"""
Traduction des noeuds de preparation des donnees en blocs de code R.

Couvre le typage, le nettoyage et les transformations.
"""

from __future__ import annotations

from typing import Any

from app.core.code_generation.emitter import CodeBlock, r_cols, r_literal
from app.core.code_generation.r_nodes_base import TIDY, columns_helper


def emit_typing(params: dict[str, Any]) -> CodeBlock:
    """Typage automatique des colonnes de caracteres en facteurs."""
    return CodeBlock(imports=[TIDY], body=[
        "# Typage des colonnes",
        "df <- df %>% mutate(across(where(is.character), as.factor))",
        "glimpse(df)",
    ])


def emit_cleaning(params: dict[str, Any]) -> CodeBlock:
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
            cols = columns_helper(params, key)
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


def emit_transform(params: dict[str, Any]) -> CodeBlock:
    """Transformations, alignees sur le comportement du moteur (decalages inclus)."""
    transforms = params.get("transforms")
    if not isinstance(transforms, list) or not transforms:
        key = params.get("transform") or params.get("method")
        cols = columns_helper(params, "columns", "column")
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
