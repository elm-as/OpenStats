"""Tests du generateur R.

R n'etant pas installe dans l'environnement de test, la validation est
structurelle : couverture des noeuds, packages declares, echappement, ordre du
graphe et equilibrage des delimiteurs (qui attrape l'essentiel des erreurs de
syntaxe generees par interpolation).
"""

import pytest

from app.core.code_generation.python_nodes import SUPPORTED_NODE_TYPES as PY_NODES
from app.core.code_generation.r_nodes import SUPPORTED_NODE_TYPES as R_NODES
from app.core.code_generation.r_script import generate_r_script

PARAMS = {
    "cleaning": {"actions": ["remove_duplicates", "drop_constant_cols", "impute_missing"],
                 "constant_cols": ["morte"]},
    "transform": {"transforms": [{"column": "x1", "transform": "log1p"},
                                 {"column": "x2", "transform": "standardize"},
                                 {"column": "y", "transform": "winsorize"}]},
    "correlation": {"method": "spearman"},
    "descriptiveNumeric": {"columns": ["x1", "x2"]},
    "regression": {"targetCol": "y", "features": ["x1", "x2"]},
    "classification": {"targetCol": "classe", "features": ["x1"]},
    "explainability": {"targetCol": "y"},
    "survival": {"durationCol": "duree", "eventCol": "evt"},
    "causal": {"treatmentCol": "evt", "outcomeCol": "y", "timeCol": "periode"},
    "hypothesis": {"groupCol": "groupe", "valueCol": "y"},
    "timeseries": {"value_col": "y", "forecast_steps": 6},
    "multivariateTimeseries": {"value_cols": ["y", "x1"], "forecast_steps": 4},
    "testStationarity": {"columns": ["y"]},
    "cointegration": {"columns": ["y", "x1"]},
    "pca": {"columns": ["x1", "x2"], "n_components": 2},
    "cluster": {"n_clusters": 3},
    "chart": {"x_col": "date", "y_cols": ["y"], "chart_type": "line"},
    "sql": {"query": "SELECT * FROM df WHERE y > 0"},
    "output": {"format": "csv"},
}

# Le noeud Python est volontairement non traduit : son code ne peut pas etre
# porte automatiquement en R.
DELIBERATELY_UNSUPPORTED = {"python"}


def _script(node_type, params=None):
    return generate_r_script(
        [{"id": "d", "type": "dataset", "data": {}},
         {"id": "n", "type": node_type, "label": node_type, "data": params or PARAMS.get(node_type, {})}],
        [{"source": "d", "target": "n"}],
        dataset_name="sample.csv",
    )


def _balanced(code: str) -> bool:
    """Delimiteurs equilibres hors chaines et commentaires."""
    depth = {"(": 0, "{": 0, "[": 0}
    closing = {")": "(", "}": "{", "]": "["}
    for line in code.splitlines():
        in_string = False
        quote = ""
        for index, char in enumerate(line):
            if in_string:
                if char == quote and (index == 0 or line[index - 1] != "\\"):
                    in_string = False
                continue
            if char in ('"', "'"):
                in_string, quote = True, char
                continue
            if char == "#":
                break
            if char in depth:
                depth[char] += 1
            elif char in closing:
                depth[closing[char]] -= 1
                if depth[closing[char]] < 0:
                    return False
    return all(value == 0 for value in depth.values())


@pytest.mark.parametrize("node_type", sorted(set(R_NODES) - DELIBERATELY_UNSUPPORTED))
def test_every_node_is_translated(node_type):
    """Aucun noeud ne doit rester sans traduction R."""
    result = _script(node_type)
    assert not result.unsupported, f"{node_type} non traduit"
    assert result.code.strip()


@pytest.mark.parametrize("node_type", sorted(R_NODES))
def test_delimiters_are_balanced(node_type):
    """Un desequilibre de parentheses est la faute classique de l'interpolation."""
    assert _balanced(_script(node_type).code), node_type


def test_r_and_python_cover_the_same_nodes():
    """Les deux langages doivent accepter le meme catalogue de noeuds."""
    assert set(R_NODES) == set(PY_NODES)


def test_python_node_is_declared_unsupported_not_silently_dropped():
    """Un noeud Python doit etre signale, avec son code en commentaire."""
    result = _script("python", {"code": "df['z'] = df['x1'] * 2"})
    assert result.unsupported == ["python"]
    assert "portage manuel" in " ".join(result.notes)
    assert "stop(" in result.code
    assert "df['z']" in result.code   # le code d'origine reste consultable


def test_unknown_node_stops_the_script():
    result = _script("noeud_inexistant")
    assert result.unsupported == ["noeud_inexistant"]
    assert "stop(" in result.code


@pytest.mark.parametrize("filename,expected", [
    ("d.csv", "read_csv"),
    ("d.xlsx", "read_excel"),
    ("d.parquet", "read_parquet"),
    ("d.json", "fromJSON"),
    ("d.tsv", "read_tsv"),
])
def test_loader_matches_extension(filename, expected):
    code = generate_r_script([{"id": "d", "type": "dataset", "data": {}}], [], filename).code
    assert expected in code


def test_node_packages_are_emitted():
    """Les packages declares par les noeuds doivent figurer en tete."""
    for node_type, package in (("sql", "library(duckdb)"),
                               ("survival", "library(survival)"),
                               ("timeseries", "library(forecast)"),
                               ("multivariateTimeseries", "library(vars)"),
                               ("pca", "library(FactoMineR)"),
                               ("vif", "library(car)"),
                               ("cointegration", "library(urca)"),
                               ("testStationarity", "library(tseries)")):
        code = _script(node_type).code
        assert package in code, f"{package} manquant pour {node_type}"


def test_packages_are_not_duplicated():
    result = generate_r_script(
        [{"id": "d", "type": "dataset", "data": {}},
         {"id": "a", "type": "correlation", "data": PARAMS["correlation"]},
         {"id": "b", "type": "descriptiveNumeric", "data": PARAMS["descriptiveNumeric"]}],
        [{"source": "d", "target": "a"}, {"source": "a", "target": "b"}], "sample.csv")
    assert result.code.count("library(tidyverse)") == 1


def test_identifiers_with_quotes_are_escaped():
    result = _script("causal", {"treatmentCol": "l'annee",
                                "outcomeCol": 'chiffre "affaires"', "timeCol": "t"})
    assert '\\"' in result.code            # guillemet interne echappe
    assert "l'annee" in result.code        # apostrophe conservee telle quelle
    assert _balanced(result.code)


def test_execution_follows_graph_not_input_order():
    result = generate_r_script(
        [{"id": "m", "type": "regression", "label": "modele", "data": PARAMS["regression"]},
         {"id": "d", "type": "dataset", "data": {}},
         {"id": "c", "type": "cleaning", "label": "nettoyage", "data": PARAMS["cleaning"]}],
        [{"source": "d", "target": "c"}, {"source": "c", "target": "m"}], "sample.csv")

    steps = [line for line in result.code.splitlines() if line.startswith("# Etape")]
    assert "nettoyage" in steps[0]
    assert "modele" in steps[1]


def test_cleaning_honours_declared_actions():
    """Seules les actions demandees doivent apparaitre."""
    minimal = _script("cleaning", {"actions": ["remove_duplicates"]}).code
    assert "distinct(df)" in minimal
    assert "median(" not in minimal        # pas d'imputation non demandee

    full = _script("cleaning", PARAMS["cleaning"]).code
    assert "distinct(df)" in full
    assert "median(" in full


def test_transform_reproduces_the_shift_rule():
    """Le decalage des series negatives doit etre present, comme cote Python."""
    code = _script("transform", {"transforms": [{"column": "v", "transform": "log1p"}]}).code
    assert "decalage" in code
    assert "any(df[[\"v\"]] < 0" in code
    assert "log1p(" in code


def test_robust_errors_are_propagated_to_the_model():
    """Le drapeau pose par le diagnostic doit produire des erreurs robustes."""
    code = _script("regression", {"targetCol": "y", "robust_se": True}).code
    assert "vcovHC" in code
    assert "library(sandwich)" in code
