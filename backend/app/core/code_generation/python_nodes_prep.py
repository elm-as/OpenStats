"""
Traduction des noeuds de preparation des donnees en blocs de code Python.

Couvre le typage, le nettoyage et les transformations mathématiques et statistiques.
"""

from __future__ import annotations

from typing import Any

from app.core.code_generation.emitter import CodeBlock, py_cols, py_literal

PANDAS = "import pandas as pd"
NUMPY = "import numpy as np"


def columns_helper(params: dict[str, Any], *keys: str) -> list[str]:
    for key in keys:
        value = params.get(key)
        if isinstance(value, list) and value:
            return [str(v) for v in value]
        if isinstance(value, str) and value:
            return [value]
    return []


def target_helper(params: dict[str, Any]) -> str | None:
    for key in ("targetCol", "target_col", "target", "value_col", "valueCol"):
        value = params.get(key)
        if isinstance(value, str) and value:
            return value
    return None


def emit_typing(params: dict[str, Any]) -> CodeBlock:
    return CodeBlock(
        imports=[PANDAS],
        body=[
            "# Inference et conversion des types",
            "df = df.infer_objects()",
            "for col in df.select_dtypes(include=['object', 'string']).columns:",
            "    df[col] = df[col].astype('category')",
            "print(df.dtypes)",
        ],
    )


def emit_cleaning(params: dict[str, Any]) -> CodeBlock:
    """Reproduit `_exec_clean` : seules les actions demandees sont appliquees."""
    actions = params.get("actions", [])
    if isinstance(actions, str):
        actions = [a.strip() for a in actions.split(",") if a.strip()]
    actions = [str(a) for a in actions]

    body = [f"# Nettoyage — actions du pipeline : {', '.join(actions) or 'aucune'}"]

    if "remove_duplicates" in actions:
        body += [
            "_avant = len(df)",
            "df = df.drop_duplicates()",
            "print(f'Doublons retires : {_avant - len(df)}')",
        ]

    for action, key, label in (
        ("drop_high_missing_cols", "high_missing_cols", "colonnes trop lacunaires"),
        ("drop_constant_cols", "constant_cols", "colonnes constantes"),
    ):
        if action in actions:
            cols = columns_helper(params, key)
            body += [
                f"_a_retirer = [c for c in {py_cols(cols)} if c in df.columns]",
                "df = df.drop(columns=_a_retirer)",
                f"print(f'{label} retirees : {{_a_retirer}}')",
            ]

    if "impute_missing" in actions:
        body += [
            "# Imputation : mediane pour les numeriques, mode pour les qualitatives",
            "_impute = 0",
            "for col in df.columns:",
            "    if df[col].isna().any():",
            "        if pd.api.types.is_numeric_dtype(df[col]):",
            "            _valeur = df[col].median()",
            "        else:",
            "            _mode = df[col].mode()",
            "            _valeur = _mode.iloc[0] if not _mode.empty else 'missing'",
            "        _impute += int(df[col].isna().sum())",
            "        df[col] = df[col].fillna(_valeur)",
            "print(f'Valeurs imputees : {_impute}')",
        ]

    if len(body) == 1:
        body.append("print('Aucune action de nettoyage configuree.')")
    body.append("print(f'Apres nettoyage : {df.shape[0]} lignes, {df.shape[1]} colonnes')")
    return CodeBlock(imports=[PANDAS], body=body)


def emit_transform(params: dict[str, Any]) -> CodeBlock:
    """Applique les transformations declarees, en reproduisant le catalogue."""
    transforms = params.get("transforms")
    if not isinstance(transforms, list) or not transforms:
        key = params.get("transform") or params.get("method")
        cols = columns_helper(params, "columns", "column")
        transforms = (
            [{"column": c, "transform": key} for c in cols] if key and cols else []
        )

    if not transforms:
        return CodeBlock(
            imports=[PANDAS],
            body=[
                "# Aucune transformation configuree sur ce noeud.",
                "print('Transformations : rien a appliquer.')",
            ],
        )

    imports = [PANDAS, NUMPY]
    body = ["# Transformations - repliquent exactement app/core/transformations_apply.py"]
    unknown: list[str] = []

    for item in transforms:
        if not isinstance(item, dict):
            continue
        column = item.get("column")
        key = str(item.get("transform") or item.get("key") or "")
        if not column:
            continue
        params_item = item.get("params") or {}
        lines, needed = _transform_lines(str(column), key, params_item)
        if lines is None:
            unknown.append(key)
            continue
        imports.extend(needed)
        body.append(f"# {column} : {key}")
        body.extend(lines)

    if unknown:
        body.append(
            f"# Transformations sans equivalent genere, NON appliquees : {sorted(set(unknown))}"
        )
    body.append("print(df.describe().T)")

    return CodeBlock(
        imports=imports,
        body=body,
        supported=not unknown,
        note=(
            f"transformations non traduites : {sorted(set(unknown))}" if unknown else ""
        ),
    )


def _transform_lines(
    column: str, key: str, params: dict[str, Any]
) -> tuple[list[str] | None, list[str]]:
    """Lignes reproduisant une transformation du catalogue, plus ses imports."""
    c = py_literal(column)
    s = f"df[{c}]"

    simple = {
        "square": f"{s} ** 2",
        "reciprocal": f"1.0 / {s}.replace(0, np.nan)",
        "standardize": f"({s} - {s}.mean()) / ({s}.std() if {s}.std() != 0 else 1)",
        "minmax": (
            f"({s} - {s}.min()) / (({s}.max() - {s}.min()) "
            f"if ({s}.max() - {s}.min()) != 0 else 1)"
        ),
        "robust_scale": (
            f"({s} - {s}.median()) / "
            f"(({s}.quantile(0.75) - {s}.quantile(0.25)) "
            f"if ({s}.quantile(0.75) - {s}.quantile(0.25)) != 0 else 1)"
        ),
        "diff2": f"{s}.diff().diff()",
        "rank": f"{s}.rank(method='average', na_option='keep')",
    }
    if key in simple:
        return [f"df[{c}] = {simple[key]}"], []

    # Transformations parametrees
    if key == "diff":
        order = int(params.get("order", 1) or 1)
        return [f"df[{c}] = {s}.diff(periods={order})"], []
    if key == "seasonal_diff":
        period = int(params.get("period", 12) or 12)
        return [f"df[{c}] = {s}.diff(periods={period})"], []
    if key == "lag":
        lag = int(params.get("lag", 1) or 1)
        return [f"df[{c}] = {s}.shift(periods={lag})"], []
    if key == "pct_change":
        periods = int(params.get("periods", 1) or 1)
        return [f"df[{c}] = {s}.pct_change(periods={periods})"], []
    if key == "rolling_mean":
        window = int(params.get("window", 3) or 3)
        min_periods = int(params.get("min_periods", 1) or 1)
        return [
            f"df[{c}] = {s}.rolling(window={window}, min_periods={min_periods}).mean()"
        ], []
    if key == "rolling_std":
        window = int(params.get("window", 3) or 3)
        min_periods = int(params.get("min_periods", 2) or 2)
        return [
            f"df[{c}] = {s}.rolling(window={window}, min_periods={min_periods}).std()"
        ], []
    if key == "winsorize":
        lower = float(params.get("lower", 0.01) or 0.01)
        upper = float(params.get("upper", 0.99) or 0.99)
        return [
            f"df[{c}] = {s}.clip(lower={s}.quantile({lower}), upper={s}.quantile({upper}))"
        ], []

    # Transformations a decalage conditionnel
    if key in ("log", "log1p", "sqrt"):
        condition = f"({s} <= 0).any()" if key == "log" else f"({s} < 0).any()"
        offset = "abs(_min)" if key == "sqrt" else "abs(_min) + 1"
        function = {"log": "np.log10", "log1p": "np.log1p", "sqrt": "np.sqrt"}[key]
        return (
            [
                f"_min = {s}.min()",
                f"_shift = ({offset}) if {condition} else 0",
                f"df[{c}] = {function}({s} + _shift)",
            ],
            [],
        )

    if key == "boxcox":
        return (
            [
                f"_vals = {s}.dropna()",
                "_shift = (abs(_vals.min()) + 1) if (_vals <= 0).any() else 0",
                "_out, _lam = boxcox((_vals + _shift).values)",
                f"df[{c}] = pd.Series(np.nan, index=df.index)",
                f"df.loc[_vals.index, {c}] = _out",
                "print(f'  lambda Box-Cox = {_lam:.6f}')",
            ],
            ["from scipy.stats import boxcox"],
        )

    if key == "yeo_johnson":
        return (
            [
                f"_vals = {s}.dropna()",
                "_out, _lam = yeojohnson(_vals.values)",
                f"df[{c}] = pd.Series(np.nan, index=df.index)",
                f"df.loc[_vals.index, {c}] = _out",
                "print(f'  lambda Yeo-Johnson = {_lam:.6f}')",
            ],
            ["from scipy.stats import yeojohnson"],
        )

    if key == "detrend":
        return (
            [
                f"_vals = {s}.dropna()",
                f"df[{c}] = pd.Series(np.nan, index=df.index)",
                f"df.loc[_vals.index, {c}] = detrend(_vals.values, type='linear')",
            ],
            ["from scipy.signal import detrend"],
        )

    return None, []
