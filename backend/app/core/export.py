"""
Module d'export multi-format : Excel, JSON structure, HTML autonome (Façade publique).
Découpé en sous-modules pour respecter la limite stricte de 350 lignes :
- export_formatters : fonctions utilitaires de formatage et sérialisation
- export_frames_stats : extraction de tableaux statistiques descriptifs et audit
- export_frames_models : extraction de tableaux pour modélisation et séries temporelles
- export_excel : génération du classeur Excel multi-onglets
- export_html : génération de la page HTML autonome
"""

from __future__ import annotations

import json
from app.core.export_formatters import _sanitize_for_json
from app.core.export_excel import export_excel
from app.core.export_html import export_html
from app.core.export_frames_stats import (
    _summary_frame, _preview_frame, _dictionary_frame, _descriptive_frames,
    _correlation_matrix_frame, _significant_correlations_frame, _vif_frame,
    _tests_frame, _log_frame, _versions_frame, _history_frame, _audit_frame,
)
from app.core.export_frames_models import (
    _model_ranking_frame, _feature_importance_frame, _shap_frame,
    _timeseries_summary_frame, _timeseries_forecast_frame,
    _multivariate_summary_frame, _granger_frame, _johansen_frame,
    _multivariate_forecast_frame, _pca_variance_frame, _pca_loadings_frame,
    _ca_coords_frame, _mca_modalities_frame,
)


def export_json(output_path: str, payload: dict) -> str:
    """Exporte tous les resultats dans un JSON structure."""
    clean_payload = _sanitize_for_json(payload)
    with open(output_path, "w", encoding="utf-8") as handle:
        json.dump(clean_payload, handle, ensure_ascii=False, indent=2)
    return output_path


__all__ = [
    "export_excel",
    "export_json",
    "export_html",
    "_summary_frame",
    "_preview_frame",
    "_dictionary_frame",
    "_descriptive_frames",
    "_correlation_matrix_frame",
    "_significant_correlations_frame",
    "_vif_frame",
    "_tests_frame",
    "_model_ranking_frame",
    "_feature_importance_frame",
    "_shap_frame",
    "_timeseries_summary_frame",
    "_timeseries_forecast_frame",
    "_multivariate_summary_frame",
    "_granger_frame",
    "_johansen_frame",
    "_multivariate_forecast_frame",
    "_pca_variance_frame",
    "_pca_loadings_frame",
    "_ca_coords_frame",
    "_mca_modalities_frame",
    "_log_frame",
    "_versions_frame",
    "_history_frame",
    "_audit_frame",
]
