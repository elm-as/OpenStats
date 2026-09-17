"""Ecrit le corpus de demonstration en CSV.

    python -m scripts.demo_dataset [dossier_de_sortie]
"""

from __future__ import annotations

import sys
from pathlib import Path

from . import clients, panel, series

DOSSIER_DEFAUT = Path(__file__).resolve().parents[3] / "data" / "demo"

TABLES = {
    "openstats_clients.csv": clients.build,
    "openstats_series.csv": series.build,
    "openstats_panel.csv": panel.build,
}


def main(argv: list[str]) -> int:
    dossier = Path(argv[1]).resolve() if len(argv) > 1 else DOSSIER_DEFAUT
    dossier.mkdir(parents=True, exist_ok=True)

    for nom, constructeur in TABLES.items():
        df = constructeur()
        chemin = dossier / nom
        df.to_csv(chemin, index=False, encoding="utf-8")
        print(f"{chemin}  ->  {len(df)} lignes x {df.shape[1]} colonnes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
