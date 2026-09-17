"""Tests du generateur de code : le script doit s'executer ET donner les memes resultats."""

import io
import os
import subprocess
import sys

import numpy as np
import pandas as pd
import pytest

from app.core.code_generation.emitter import (
    py_cols, py_literal, r_literal, topological_order,
)
from app.core.code_generation.notebook_script import generate_notebook
from app.core.code_generation.python_nodes import SUPPORTED_NODE_TYPES
from app.core.code_generation.python_script import generate_python_script

# Noeuds dont l'execution demande une dependance optionnelle absente du socle.
OPTIONAL_DEPENDENCY = {"survival": "lifelines", "explainability": "shap"}


@pytest.fixture(scope="module")
def sample(tmp_path_factory):
    """Jeu de donnees couvrant tous les cas de figure des noeuds."""
    directory = tmp_path_factory.mktemp("codegen")
    rng = np.random.default_rng(0)
    n = 160
    frame = pd.DataFrame({
        "date": pd.date_range("2015-01-31", periods=n, freq="ME"),
        "duree": rng.gamma(2, 3, n),
        "evt": rng.integers(0, 2, n),
        "groupe": rng.choice(["a", "b", "c"], n),
        "periode": rng.integers(0, 2, n),
        "classe": rng.choice(["x", "y"], n),
        "y": np.cumsum(rng.normal(size=n)) + 50.0,
        "x1": rng.normal(size=n),
        "x2": rng.normal(size=n),
    })
    frame.to_csv(directory / "sample.csv", index=False)
    return directory, frame


PARAMS = {
    "cleaning": {"actions": ["remove_duplicates", "impute_missing"]},
    "transform": {"transforms": [{"column": "x1", "transform": "log1p"},
                                 {"column": "x2", "transform": "standardize"}]},
    "correlation": {"method": "spearman"},
    "descriptiveNumeric": {"columns": ["x1", "x2", "y"]},
    "regression": {"targetCol": "y", "features": ["x1", "x2"]},
    "model": {"targetCol": "y", "features": ["x1", "x2"]},
    "classification": {"targetCol": "classe", "features": ["x1", "x2"]},
    "explainability": {"targetCol": "y"},
    "survival": {"durationCol": "duree", "eventCol": "evt"},
    "causal": {"treatmentCol": "evt", "outcomeCol": "y", "timeCol": "periode"},
    "hypothesis": {"groupCol": "groupe", "valueCol": "y"},
    "timeseries": {"value_col": "y", "date_col": "date", "forecast_steps": 6},
    "multivariateTimeseries": {"value_cols": ["y", "x1", "x2"], "forecast_steps": 5},
    "testStationarity": {"columns": ["y", "x1"]},
    "cointegration": {"columns": ["y", "x1", "x2"]},
    "pca": {"columns": ["x1", "x2", "y"], "n_components": 2},
    "cluster": {"n_clusters": 3},
    "chart": {"x_col": "date", "y_cols": ["y"], "chart_type": "line"},
    "sql": {"query": "SELECT * FROM df WHERE y > 0"},
    "python": {"code": "df['ratio'] = df['x1'] / (df['x2'].abs() + 1)"},
    "output": {"format": "csv"},
}

EXECUTABLE_NODES = sorted(set(SUPPORTED_NODE_TYPES) - {"clean", "descriptive", "correlations",
                                                       "report", "clustering", "stationarity",
                                                       "timeseries_stationarity",
                                                       "timeseries_cointegration",
                                                       "timeseries_forecast",
                                                       "timeseries_multivariate",
                                                       "transform_recommend",
                                                       "stationarization_transform"})


def _run(directory, code: str, name: str):
    path = os.path.join(directory, f"{name}.py")
    with io.open(path, "w", encoding="utf-8") as fh:
        fh.write(code)
    env = dict(os.environ, MPLBACKEND="Agg", PYTHONIOENCODING="utf-8")
    return subprocess.run([sys.executable, path], cwd=directory,
                          capture_output=True, text=True, timeout=300, env=env)


@pytest.mark.parametrize("node_type", EXECUTABLE_NODES)
def test_generated_script_runs(node_type, sample):
    """Chaque type de noeud doit produire un script reellement executable."""
    directory, _ = sample
    module = OPTIONAL_DEPENDENCY.get(node_type)
    if module:
        pytest.importorskip(module)

    result = generate_python_script(
        [{"id": "d", "type": "dataset", "data": {}},
         {"id": "n", "type": node_type, "label": node_type, "data": PARAMS.get(node_type, {})}],
        [{"source": "d", "target": "n"}],
        dataset_name="sample.csv",
    )
    assert not result.unsupported, f"{node_type} declare non traduit"

    proc = _run(directory, result.code, f"node_{node_type}")
    assert proc.returncode == 0, f"{node_type} : {proc.stderr[-400:]}"


def test_every_node_compiles():
    """Aucun noeud ne doit produire du code syntaxiquement invalide."""
    for node_type in SUPPORTED_NODE_TYPES:
        result = generate_python_script(
            [{"id": "d", "type": "dataset", "data": {}},
             {"id": "n", "type": node_type, "data": PARAMS.get(node_type, {})}],
            [{"source": "d", "target": "n"}], "sample.csv")
        compile(result.code, f"<{node_type}>", "exec")


def test_unknown_node_is_declared_not_silent():
    """Un noeud inconnu doit etre signale, jamais remplace par un no-op muet."""
    result = generate_python_script(
        [{"id": "d", "type": "dataset", "data": {}},
         {"id": "z", "type": "noeud_inexistant", "data": {}}],
        [{"source": "d", "target": "z"}], "sample.csv")

    assert result.unsupported == ["noeud_inexistant"]
    assert "NotImplementedError" in result.code
    assert result.notes


def test_execution_follows_graph_not_input_order():
    """Le nettoyage doit preceder la regression meme s'il est fourni apres."""
    result = generate_python_script(
        [{"id": "m", "type": "regression", "label": "modele", "data": PARAMS["regression"]},
         {"id": "d", "type": "dataset", "data": {}},
         {"id": "c", "type": "cleaning", "label": "nettoyage", "data": PARAMS["cleaning"]}],
        [{"source": "d", "target": "c"}, {"source": "c", "target": "m"}], "sample.csv")

    steps = [line for line in result.code.splitlines() if line.startswith("# Etape")]
    assert "nettoyage" in steps[0]
    assert "modele" in steps[1]


def test_topological_order_survives_cycles():
    """Un cycle ne doit pas faire disparaitre de noeuds."""
    nodes = [{"id": "a"}, {"id": "b"}, {"id": "c"}]
    edges = [{"source": "a", "target": "b"}, {"source": "b", "target": "a"},
             {"source": "b", "target": "c"}]
    assert len(topological_order(nodes, edges)) == 3


@pytest.mark.parametrize("filename,expected", [
    ("d.csv", "pd.read_csv"),
    ("d.xlsx", "pd.read_excel"),
    ("d.parquet", "pd.read_parquet"),
    ("d.json", "pd.read_json"),
    ("d.tsv", "sep='\\t'"),
])
def test_loader_matches_extension(filename, expected):
    """Le chargement doit correspondre au format reel du fichier."""
    code = generate_python_script([{"id": "d", "type": "dataset", "data": {}}], [], filename).code
    assert expected in code


def test_identifiers_are_escaped():
    """Une colonne contenant une apostrophe ne doit pas casser le script."""
    result = generate_python_script(
        [{"id": "d", "type": "dataset", "data": {}},
         {"id": "c", "type": "causal",
          "data": {"treatmentCol": "l'annee", "outcomeCol": 'chiffre "affaires"', "timeCol": "t"}}],
        [{"source": "d", "target": "c"}], "sample.csv")
    compile(result.code, "<escape>", "exec")


def test_node_imports_are_emitted():
    """Les imports declares par les noeuds doivent figurer en tete du script."""
    result = generate_python_script(
        [{"id": "d", "type": "dataset", "data": {}},
         {"id": "q", "type": "sql", "data": PARAMS["sql"]}],
        [{"source": "d", "target": "q"}], "sample.csv")
    assert "import duckdb" in result.code


def test_cleaning_matches_engine(sample):
    """Fidelite : le script doit reproduire exactement le nettoyage de l'application."""
    from app.core.auto_pipeline.executor import _exec_clean

    directory, frame = sample
    dirty = pd.concat([frame, frame.iloc[:12]], ignore_index=True)
    dirty.loc[0:5, "x1"] = np.nan
    dirty["morte"] = 1.0
    dirty.to_csv(directory / "dirty.csv", index=False)

    params = {"actions": ["remove_duplicates", "drop_constant_cols", "impute_missing"],
              "constant_cols": ["morte"]}
    expected = _exec_clean(dirty.copy(), params)["df"].reset_index(drop=True)

    result = generate_python_script(
        [{"id": "d", "type": "dataset", "data": {}},
         {"id": "c", "type": "cleaning", "data": params}],
        [{"source": "d", "target": "c"}], "dirty.csv")

    proc = _run(directory, result.code + "\ndf.to_csv('out_clean.csv', index=False)\n", "fid_clean")
    assert proc.returncode == 0, proc.stderr[-400:]

    produced = pd.read_csv(directory / "out_clean.csv")
    assert produced.shape == expected.shape
    assert list(produced.columns) == list(expected.columns)
    numeric = expected.select_dtypes(include="number").columns
    assert np.allclose(produced[numeric].values, expected[numeric].values,
                       rtol=1e-6, atol=1e-8, equal_nan=True)


def test_transform_matches_engine(sample):
    """Fidelite : les transformations doivent donner les memes valeurs que le moteur."""
    from app.core.transformations_apply import apply_transform

    directory, frame = sample
    transforms = [{"column": "x1", "transform": "standardize"},
                  {"column": "x2", "transform": "log1p"},
                  {"column": "y", "transform": "winsorize"}]

    expected = frame.copy()
    for item in transforms:
        series, meta = apply_transform(expected[item["column"]], item["transform"], None)
        assert not meta.get("error")
        expected[item["column"]] = series

    result = generate_python_script(
        [{"id": "d", "type": "dataset", "data": {}},
         {"id": "t", "type": "transform", "data": {"transforms": transforms}}],
        [{"source": "d", "target": "t"}], "sample.csv")

    proc = _run(directory, result.code + "\ndf.to_csv('out_t.csv', index=False)\n", "fid_trans")
    assert proc.returncode == 0, proc.stderr[-400:]

    produced = pd.read_csv(directory / "out_t.csv")
    for item in transforms:
        column = item["column"]
        a = pd.to_numeric(expected[column], errors="coerce").to_numpy(dtype=float)
        b = pd.to_numeric(produced[column], errors="coerce").to_numpy(dtype=float)
        assert np.allclose(a, b, rtol=1e-8, atol=1e-10, equal_nan=True), column


def test_notebook_shares_the_same_blocks():
    """Le notebook n'est pas une seconde implementation : memes noeuds, meme ordre."""
    nodes = [{"id": "m", "type": "regression", "label": "modele", "data": PARAMS["regression"]},
             {"id": "d", "type": "dataset", "data": {}},
             {"id": "c", "type": "cleaning", "label": "nettoyage", "data": PARAMS["cleaning"]}]
    edges = [{"source": "d", "target": "c"}, {"source": "c", "target": "m"}]

    notebook = generate_notebook(nodes, edges, "sample.csv")
    headings = [c["source"][0] for c in notebook["cells"] if c["cell_type"] == "markdown"]

    assert notebook["nbformat"] == 4
    assert "kernelspec" in notebook["metadata"]
    assert any("nettoyage" in h for h in headings)
    assert next(i for i, h in enumerate(headings) if "nettoyage" in h) \
        < next(i for i, h in enumerate(headings) if "modele" in h)


def test_literals_escape_quotes():
    assert py_literal("l'annee") == '"l\'annee"'
    assert py_cols(["a'b"]) == '["a\'b"]'
    assert r_literal('chiffre "x"') == '"chiffre \\"x\\""'
    assert r_literal(None) == "NULL"
    assert r_literal(True) == "TRUE"
