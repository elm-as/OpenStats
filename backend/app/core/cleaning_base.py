"""
Classe de base pour les étapes du pipeline de nettoyage.
"""

from __future__ import annotations

import pandas as pd


class CleaningStep:
    """Classe de base pour une étape de nettoyage."""

    name: str = "base"

    def apply(self, df: pd.DataFrame, config: dict) -> tuple[pd.DataFrame, dict]:
        """Applique la transformation. Retourne (df_transformé, log_opération)."""
        raise NotImplementedError

    def _log(self, message: str, details: dict | None = None) -> dict:
        return {"step": self.name, "message": message, "details": details or {}}
