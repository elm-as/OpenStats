"""
Nœuds de sortie et d'extensions (AI, Extension, Insights, Output).
"""

import os
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
    fmt = data.get("format", "pdf").lower()
    title = data.get("title", "Rapport Canvas")
    org = data.get("organization", "OpenStats")
    
    if not dataset_id:
        return {"status": "skipped", "message": "Aucun dataset connecté pour générer le rapport"}

    try:
        if fmt in ("pdf", "docx", "pptx"):
            if fmt == "pdf":
                file_path = dataset_manager.generate_pdf_report(dataset_id, title=title, organization=org)
                filename = os.path.basename(file_path)
            else:
                from app.core.professional_report import build_report_payload, generate_docx, generate_pptx
                from app.config import Config
                bundle = dataset_manager.get_export_bundle(dataset_id, title=title, organization=org)
                content = build_report_payload(
                    dataset_name=bundle.get("dataset", {}).get("name", dataset_id),
                    profile=bundle.get("data_summary", {}).get("profile"),
                    descriptive=bundle.get("analysis", {}).get("descriptive_stats"),
                    model_results=bundle.get("modeling"),
                )
                blob = generate_docx(content) if fmt == "docx" else generate_pptx(content)
                base_dir = os.path.join(Config.REPORTS_DIR, dataset_id)
                os.makedirs(base_dir, exist_ok=True)
                filename = f"rapport_{dataset_id}.{fmt}"
                file_path = os.path.join(base_dir, filename)
                with open(file_path, "wb") as f:
                    f.write(blob)

            download_url = f"/api/v1/datasets/{dataset_id}/report" if fmt == "pdf" else f"/api/v1/datasets/{dataset_id}/report/professional/{fmt}"
            return {
                "status": "success",
                "message": f"Rapport ({fmt.upper()}) généré avec succès.",
                "dataset_id": dataset_id,
                "result": {
                    "format": fmt,
                    "dataset_id": dataset_id,
                    "file_path": file_path,
                    "filename": filename,
                    "download_url": download_url,
                },
            }
        else:
            download_url = f"/api/v1/datasets/{dataset_id}/export/{fmt}"
            return {
                "status": "success",
                "message": f"Export ({fmt.upper()}) prêt.",
                "dataset_id": dataset_id,
                "result": {
                    "format": fmt,
                    "dataset_id": dataset_id,
                    "download_url": download_url,
                },
            }
    except Exception as e:
        return {
            "status": "error",
            "error": f"Erreur de génération de rapport ({fmt}): {str(e)}",
            "dataset_id": dataset_id,
        }
