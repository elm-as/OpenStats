"""
Gestion du surtypage statistique des colonnes de DatasetManager.
"""

from __future__ import annotations

import copy
import pandas as pd
from sqlalchemy.orm.attributes import flag_modified
from app.extensions import db
from app.models.dataset import Dataset
from app.services.storage_service import storage


class DatasetTypingMixin:
    """Fournit les méthodes de mise à jour et de surtypage statistique des colonnes."""

    def _apply_type_overrides_to_profile(self, profile: dict, overrides: dict) -> None:
        """Applique les surcharges de type sur un profil."""
        if not profile or not overrides:
            return
        for col_name, new_type in overrides.items():
            for category in ["numeric_cols", "categorical_cols", "binary_cols", "temporal_cols", "discrete_cols"]:
                if col_name in profile.get(category, []):
                    profile[category].remove(col_name)

            cat_map = {
                "continu": "numeric_cols", "numeric": "numeric_cols", "continuous": "numeric_cols",
                "catégoriel_nominal": "categorical_cols", "categorical": "categorical_cols",
                "catégoriel_ordinal": "categorical_cols", "ordinal": "categorical_cols",
                "binaire": "binary_cols", "binary": "binary_cols",
                "temporel": "temporal_cols", "temporal": "temporal_cols",
                "discret": "discrete_cols", "discrete": "discrete_cols",
                "identifiant": "id_cols", "id": "id_cols",
            }
            target_cat = cat_map.get(new_type)
            if target_cat:
                profile.setdefault(target_cat, []).append(col_name)

            for col_info in profile.get("columns", []):
                if col_info.get("name") == col_name:
                    col_info["inferred_type"] = new_type
                    col_info["user_override"] = True

    def update_column_type(self, dataset_id: str, column: str, new_type: str) -> dict:
        """Met à jour le type statistique d'une colonne dans le profil avec traçabilité."""
        from app.core.statistical_types import CANONICAL_TYPES, canonical_statistical_type, safe_convert_series

        ds = db.session.get(Dataset, dataset_id)
        if ds is None:
            raise ValueError(f"Dataset {dataset_id} introuvable")

        canonical_type = canonical_statistical_type(new_type)
        if canonical_type not in CANONICAL_TYPES:
            raise ValueError(
                f"Type invalide : {new_type}. Types valides : {', '.join(sorted(CANONICAL_TYPES))}"
            )

        profile = copy.deepcopy(ds.profile or {})
        dictionary = profile.get("dictionary", [])
        entry = next((e for e in dictionary if e.get("nom_brut") == column), None)
        if entry is None:
            entry = {"nom_brut": column, "type_statistique": "continu"}
            dictionary.append(entry)
            profile["dictionary"] = dictionary

        old_type = entry.get("type_statistique", "")
        entry["type_statistique"] = canonical_type

        overrides = dict(ds.type_overrides or {})
        overrides[column] = canonical_type
        ds.type_overrides = overrides
        ds.profile = profile
        flag_modified(ds, "profile")
        flag_modified(ds, "type_overrides")

        report_dict = None
        if old_type != canonical_type:
            df = self.get_df(dataset_id, cleaned=True, respect_exclusions=False)
            if df is not None and column in df.columns:
                converted_col, report = safe_convert_series(df[column], canonical_type, col_name=column)
                report_dict = report.to_dict()
                df[column] = converted_col

                version = max((v.version_number for v in ds.versions), default=2)
                storage.save_dataframe(df, dataset_id, version)
                if hasattr(self, "_session_cache") and dataset_id in self._session_cache:
                    self._invalidate_session_cache(dataset_id)

        audit_data = {"column": column, "old_type": old_type, "new_type": canonical_type}
        if report_dict:
            audit_data["conversion_report"] = report_dict

        self._audit(dataset_id, "type_change", audit_data)
        db.session.commit()

        result = {
            "column": column,
            "old_type": old_type,
            "new_type": canonical_type,
            "profile": ds.profile,
        }
        if report_dict:
            result["conversion_report"] = report_dict
        return result

    def set_excluded_columns(self, dataset_id: str, columns: list[str]) -> dict:
        """Définit la liste des colonnes exclues."""
        ds = db.session.get(Dataset, dataset_id)
        if ds is None:
            raise ValueError(f"Dataset {dataset_id} introuvable")

        df = self.get_df(dataset_id, respect_exclusions=False)
        valid_cols = set(df.columns) if df is not None else set()
        clean_exclusions = [c for c in columns if c in valid_cols]

        ds.excluded_columns = clean_exclusions
        self._audit(dataset_id, "exclude_columns", {"excluded": clean_exclusions})
        db.session.commit()
        if hasattr(self, "_invalidate_session_cache"):
            self._invalidate_session_cache(dataset_id)

        return {
            "dataset_id": dataset_id,
            "excluded_columns": clean_exclusions,
            "active_columns": len(valid_cols) - len(clean_exclusions),
        }

    def get_excluded_columns(self, dataset_id: str) -> list[str]:
        """Retourne la liste des colonnes exclues."""
        ds = db.session.get(Dataset, dataset_id)
        return (ds.excluded_columns or []) if ds else []

