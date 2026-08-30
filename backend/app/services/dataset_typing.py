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
                "binaire": "binary_cols", "binary": "binary_cols",
                "temporel": "temporal_cols", "temporal": "temporal_cols",
                "discret": "discrete_cols", "discrete": "discrete_cols",
            }
            target_cat = cat_map.get(new_type)
            if target_cat:
                profile.setdefault(target_cat, []).append(col_name)

            for col_info in profile.get("columns", []):
                if col_info.get("name") == col_name:
                    col_info["inferred_type"] = new_type
                    col_info["user_override"] = True

    def update_column_type(self, dataset_id: str, column: str, new_type: str) -> dict:
        """Met à jour le type statistique d'une colonne dans le profil."""
        VALID_TYPES = {"continu", "discret", "temporel", "catégoriel_nominal", "binaire"}
        ds = db.session.get(Dataset, dataset_id)
        if ds is None:
            raise ValueError(f"Dataset {dataset_id} introuvable")

        # Accepter aussi les équivalents anglais pour la flexibilité
        type_alias = {
            "continuous": "continu", "numeric": "continu",
            "categorical": "catégoriel_nominal", "nominal": "catégoriel_nominal",
            "binary": "binaire", "temporal": "temporel", "datetime": "temporel",
            "discrete": "discret",
        }
        canonical_type = type_alias.get(new_type.lower(), new_type)
        if canonical_type not in VALID_TYPES:
            raise ValueError(f"Type invalide : {new_type}. Types valides : {', '.join(sorted(VALID_TYPES))}")

        profile = copy.deepcopy(ds.profile or {})
        dictionary = profile.get("dictionary", [])
        entry = next((e for e in dictionary if e["nom_brut"] == column), None)
        if entry is None:
            # Si pas de dictionary structuré dans le profil, créer une entrée
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

        if old_type != canonical_type:
            try:
                df = self.get_df(dataset_id, cleaned=True, respect_exclusions=False)
                if df is not None and column in df.columns:
                    if canonical_type == "temporel":
                        df[column] = pd.to_datetime(df[column], errors="coerce")
                    elif canonical_type == "continu":
                        df[column] = pd.to_numeric(df[column], errors="coerce").astype(float)
                    elif canonical_type == "discret":
                        df[column] = pd.to_numeric(df[column], errors="coerce")
                        df[column] = df[column].dropna().astype(int).reindex(df.index)
                    elif canonical_type == "catégoriel_nominal":
                        df[column] = df[column].astype(str).replace("nan", pd.NA)
                    elif canonical_type == "binaire":
                        df[column] = pd.to_numeric(df[column], errors="coerce")
                        df[column] = df[column].dropna().astype(int).reindex(df.index)

                    version = max(v.version_number for v in ds.versions) if ds.versions else 2
                    storage.save_dataframe(df, dataset_id, version)
                    if hasattr(self, "_session_cache") and dataset_id in self._session_cache:
                        self._invalidate_session_cache(dataset_id)
            except Exception:
                pass

        self._audit(dataset_id, "type_change", {"column": column, "old_type": old_type, "new_type": canonical_type})
        db.session.commit()

        return {
            "column": column,
            "old_type": old_type,
            "new_type": canonical_type,
            "profile": ds.profile,
        }

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

