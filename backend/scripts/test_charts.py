"""
Test des graphiques et visualisations de chaque analyse — orchestrateur principal.

Usage :
    python scripts/test_charts.py [--url http://127.0.0.1:5000] [--file path.csv]
"""

from __future__ import annotations

import argparse
from pathlib import Path
import sys
import time
import requests

from chart_test_suite import print_chart_summary
from test_charts_generic import run_generic_charts_tests, upload_and_setup
from test_charts_predictive import run_predictive_charts_tests
from test_charts_statistical import run_statistical_charts_tests

DEFAULT_URL = "http://127.0.0.1:5000/api/v1"
DEFAULT_FILE = str(Path(__file__).resolve().parent.parent / "data" / "test_dataset_complet.csv")


def main(api_url: str, file_path: str) -> None:
    """Orchestre les tests de graphiques generiques, statistiques et predictifs."""
    s = requests.Session()
    t0 = time.time()

    did = upload_and_setup(s, api_url, file_path)
    if not did:
        sys.exit(1)

    run_generic_charts_tests(s, api_url, did)
    run_statistical_charts_tests(s, api_url, did)
    run_predictive_charts_tests(s, api_url, did)

    success = print_chart_summary(t0)
    if not success:
        sys.exit(1)


if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Tests visuels et graphiques OpenStats")
    p.add_argument("--url", default=DEFAULT_URL, help="Base URL de l'API")
    p.add_argument("--file", default=DEFAULT_FILE, help="Chemin vers le CSV de test")
    args = p.parse_args()

    main(args.url, args.file)
