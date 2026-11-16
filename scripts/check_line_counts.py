"""Lanceur scripts/ pour check_line_counts.py déléguant au script canonique."""

from __future__ import annotations

import runpy
import sys
from pathlib import Path


def main() -> None:
    """Exécute le script canonique dans backend/scripts/check_line_counts.py."""
    target = Path(__file__).resolve().parent.parent / "backend" / "scripts" / "check_line_counts.py"
    if not target.exists():
        print(f"[ERREUR] Script introuvable : {target}", file=sys.stderr)
        sys.exit(1)

    runpy.run_path(str(target), run_name="__main__")


if __name__ == "__main__":
    main()
