"""
Générateur de Jupyter Notebook (.ipynb) reproductible en JSON.
Conforme à la charte ELMAS.md : fonctions verbe+nom, découpage strict < 350 lignes.
"""

from typing import Any, Dict, List
from .python_generator import generate_node_python_code


def generate_pipeline_notebook(steps: List[Dict[str, Any]], dataset_name: str = "dataset.csv") -> Dict[str, Any]:
    """
    Génère la structure JSON conforme au format Jupyter Notebook v4 (.ipynb).

    :param steps: Liste des étapes de pipeline.
    :param dataset_name: Nom du dataset.
    :return: Dictionnaire JSON représentant le notebook .ipynb.
    """
    cells: List[Dict[str, Any]] = []

    # Markdown Header Cell
    header_md = [
        f"# Pipeline d'Analyse OpenStats byElmas\n",
        f"**Dataset Source** : `{dataset_name}`\\\n",
        f"**Rapport et reproductibilité scientifique**\\\n",
        f"Généré automatiquement par OpenStats byElmas."
    ]
    cells.append({
        "cell_type": "markdown",
        "metadata": {},
        "source": header_md
    })

    # Code Cell 1: Imports & Data Ingestion
    setup_code = [
        "import pandas as pd\n",
        "import numpy as np\n",
        "import matplotlib.pyplot as plt\n",
        "import seaborn as sns\n",
        "\n",
        "# Paramètres d'affichage\n",
        "pd.set_option('display.max_columns', None)\n",
        "plt.style.use('seaborn-v0_8-whitegrid')\n",
        "\n",
        f"df = pd.read_csv('{dataset_name}')\n",
        "df.head()"
    ]
    cells.append({
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": setup_code
    })

    # Steps Cells
    for idx, step in enumerate(steps, 1):
        stype = step.get("operation") or step.get("type") or "unknown"
        sdata = step.get("params") or step.get("data") or {}
        label = step.get("label") or stype

        # Markdown Section
        cells.append({
            "cell_type": "markdown",
            "metadata": {},
            "source": [f"## Étape {idx} : {label}\n", f"_{step.get('rationale', '')}_"]
        })

        # Python Code Cell
        py_code = generate_node_python_code(stype, sdata, dataset_name)
        code_lines = [line + "\n" for line in py_code.split("\n")]

        cells.append({
            "cell_type": "code",
            "execution_count": None,
            "metadata": {},
            "outputs": [],
            "source": code_lines
        })

    return {
        "cells": cells,
        "metadata": {
            "language_info": {
                "name": "python",
                "version": "3.11"
            }
        },
        "nbformat": 4,
        "nbformat_minor": 2
    }
