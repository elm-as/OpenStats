"""
Nœuds de sortie et d'extensions (AI, Extension, Insights, Output).
"""

from app.services.dataset_service import dataset_manager
from ._shared import _sanitize

def execute_ai(data, dataset_id):
    prompt = data.get("prompt", "")
    return {
        "status": "success",
        "message": f"Instruction IA enregistrée: '{prompt[:80]}...'",
        "result": {"prompt": prompt},
    }


def execute_extension(data, dataset_id):
    prompt = data.get("prompt", "")
    return {
        "status": "success",
        "message": f"Extension IA: '{prompt[:80]}...'",
        "result": {"prompt": prompt},
    }


def execute_insights(data, dataset_id):
    ds = dataset_manager.get(dataset_id)
    if not ds:
        return {"status": "error", "error": "Dataset introuvable"}

    from app.core.interpretation import (
        narrate_descriptive, narrate_correlations, narrate_vif,
        narrate_modeling, narrate_timeseries,
    )
    from app.core.interpretation.base import sort_insights, insights_to_dict

    all_insights = []
    analysis = ds.get("analysis_results") or {}

    desc = analysis.get("descriptive_stats")
    if isinstance(desc, dict):
        try:
            all_insights.extend(narrate_descriptive(desc))
        except Exception:
            pass

    corr = analysis.get("correlations")
    if isinstance(corr, dict):
        try:
            all_insights.extend(narrate_correlations(corr))
        except Exception:
            pass

    vif = analysis.get("vif")
    if vif:
        try:
            all_insights.extend(narrate_vif(vif))
        except Exception:
            pass

    model_res = ds.get("model_results")
    if isinstance(model_res, dict) and model_res:
        try:
            all_insights.extend(narrate_modeling(model_res))
        except Exception:
            pass

    sorted_ins = sort_insights(all_insights)
    return {
        "status": "success",
        "message": f"{len(sorted_ins)} insight(s) générés",
        "result": _sanitize({"insights": insights_to_dict(sorted_ins), "count": len(sorted_ins)}),
    }


def execute_output(data, dataset_id):
    fmt = data.get("format", "pdf")
    return {
        "status": "success",
        "message": f"Rapport ({fmt.upper()}) prêt. Téléchargez-le depuis la page de rapport.",
        "result": {"format": fmt, "dataset_id": dataset_id},
    }
