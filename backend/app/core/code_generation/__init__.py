"""
Module de génération de code source reproductible (Python, R, Jupyter Notebook).
Fait autorité selon la charte ELMAS.md (fonctions verbe+nom, docstrings strictes).
"""

from .python_generator import generate_node_python_code, generate_pipeline_python_script
from .r_generator import generate_node_r_code, generate_pipeline_r_script
from .notebook_generator import generate_pipeline_notebook

__all__ = [
    "generate_node_python_code",
    "generate_pipeline_python_script",
    "generate_node_r_code",
    "generate_pipeline_r_script",
    "generate_pipeline_notebook",
]
