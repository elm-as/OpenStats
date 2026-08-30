"""
Moteur de scénarios (Façade publique) : création, exécution, comparaison, sensibilité, Monte Carlo.
Découpé en sous-modules pour respecter la limite de 350 lignes :
- scenarios_base : création et exécution de scénarios what-if déterministes
- scenarios_simulation : sensibilité, tornado charts, Monte Carlo et stress testing
"""

from __future__ import annotations

from app.core.scenarios_base import (
    create_scenario,
    create_preset_scenarios,
    run_scenario,
    compare_scenarios,
)
from app.core.scenarios_simulation import (
    sensitivity_analysis,
    tornado_chart_data,
    partial_dependence_data,
    monte_carlo_simulation,
    stress_test,
    _build_histogram,
)

__all__ = [
    "create_scenario",
    "create_preset_scenarios",
    "run_scenario",
    "compare_scenarios",
    "sensitivity_analysis",
    "tornado_chart_data",
    "partial_dependence_data",
    "monte_carlo_simulation",
    "stress_test",
    "_build_histogram",
]
