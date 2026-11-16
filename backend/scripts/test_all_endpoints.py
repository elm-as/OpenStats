"""
Script de test complet des endpoints API — orchestrateur principal.

Usage :
    python scripts/test_all_endpoints.py [--url http://127.0.0.1:5000] [--file path/to/file.csv]

Pré-requis : serveur Flask en cours d'exécution avec LOCAL_DEV_MODE=true.
"""

from __future__ import annotations

import argparse
from pathlib import Path
import sys
import time
import requests

from endpoint_test_suite import print_summary
from test_endpoints_data import run_data_endpoints_tests
from test_endpoints_modeling import run_modeling_endpoints_tests

# ── Configuration par defaut ──────────────────────────────────────────────────

DEFAULT_URL = "http://127.0.0.1:5000/api/v1"
DEFAULT_FILE = str(Path(__file__).resolve().parent.parent / "data" / "test_dataset_complet.csv")


def main(api_url: str, file_path: str) -> None:
    """Orchestre l'execution des tests d'endpoints API sur les donnees et les modeles."""
    s = requests.Session()
    t0_global = time.time()

    dataset_id = run_data_endpoints_tests(s, api_url, file_path)
    if not dataset_id:
        sys.exit(1)

    run_modeling_endpoints_tests(s, api_url, dataset_id)

    success = print_summary(t0_global)
    if not success:
        sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test tous les endpoints API OpenStats")
    parser.add_argument("--url", default=DEFAULT_URL, help="Base URL de l'API")
    parser.add_argument("--file", default=DEFAULT_FILE, help="Chemin vers le CSV de test")
    args = parser.parse_args()

    main(args.url, args.file)
