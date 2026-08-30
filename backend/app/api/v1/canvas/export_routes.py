"""
Endpoints d'export de code reproductible et de rapport PDF pour le Canvas.
"""

from __future__ import annotations

import os
import json
import logging
from datetime import datetime
from flask import request, jsonify, send_file

from app.api.v1 import api_v1_bp
from app.api.v1.canvas.graph import _topo_sort
from app.core.code_generation import (
    generate_pipeline_python_script,
    generate_pipeline_r_script,
    generate_pipeline_notebook,
)
from app.services.dataset_service import dataset_manager
from app.core.professional_report import build_report_payload, generate_pdf
from app.config import Config

logger = logging.getLogger(__name__)


@api_v1_bp.route("/canvas/export_code", methods=["POST"])
def export_canvas_code():
    """Génère le script Python, R ou Jupyter Notebook reproductible pour un Canvas."""
    data = request.get_json() or {}
    nodes = data.get("nodes", [])
    edges = data.get("edges", [])
    language = (data.get("language") or "python").lower()
    dataset_name = data.get("dataset_name") or "dataset.csv"

    ordered_node_ids = _topo_sort(nodes, edges)
    node_map = {n["id"]: n for n in nodes}
    steps = []

    for nid in ordered_node_ids:
        node = node_map.get(nid)
        if not node:
            continue
        stype = node.get("type", "")
        ndata = node.get("data", {})
        label = ndata.get("title") or ndata.get("label") or stype
        steps.append({
            "type": stype,
            "operation": stype,
            "params": ndata,
            "label": label,
        })

    if language == "r":
        code_content = generate_pipeline_r_script(steps, dataset_name)
        filename = "script_analyse.R"
    elif language == "notebook":
        nb_json = generate_pipeline_notebook(steps, dataset_name)
        return jsonify({
            "success": True,
            "language": "notebook",
            "filename": "pipeline_analyse.ipynb",
            "notebook_json": nb_json,
        })
    else:
        code_content = generate_pipeline_python_script(steps, dataset_name)
        filename = "script_analyse.py"

    return jsonify({
        "success": True,
        "language": language,
        "filename": filename,
        "code": code_content,
    })


@api_v1_bp.route("/canvas/report", methods=["POST"])
def generate_canvas_report():
    """Génère le rapport PDF complet d'un canvas exécuté."""
    body = request.get_json()
    if not body:
        return jsonify({"success": False, "error": "Body JSON requis"}), 400

    dataset_id = body.get("dataset_id")
    if not dataset_id:
        return jsonify({"success": False, "error": "dataset_id requis"}), 400

    nodes = body.get("nodes", {})
    if not nodes:
        return jsonify({"success": False, "error": "Aucun résultat de nœud (nodes) fourni"}), 400

    ds = dataset_manager.get(dataset_id)
    if not ds:
        return jsonify({"success": False, "error": "Dataset introuvable"}), 404

    profile = ds.get("profile", {})

    bundle = {
        "dataset": ds,
        "data_summary": {"profile": profile},
        "cleaning_log": [],
        "analysis": {},
        "modeling": {},
        "tests": [],
        "factor_analysis": {},
        "timeseries": {},
        "multivariate_timeseries": {},
        "llm_summary": None,
    }

    for nid, node in nodes.items():
        if not isinstance(node, dict) or node.get("status") != "success":
            continue

        res = node.get("result", {})
        ntype = node.get("type", "")

        if ntype == "cleaning":
            if isinstance(res, dict) and "log" in res:
                bundle["cleaning_log"] = res["log"]
        elif ntype == "descriptiveNumeric":
            bundle["analysis"]["descriptive_stats"] = res
        elif ntype == "descriptiveCategorical":
            bundle["analysis"]["categorical_stats"] = res
        elif ntype == "correlation":
            if "correlations" not in bundle["analysis"]:
                bundle["analysis"]["correlations"] = {}
            bundle["analysis"]["correlations"]["pearson"] = res
        elif ntype == "vif":
            bundle["analysis"]["vif"] = res
        elif ntype == "pca":
            bundle["factor_analysis"]["pca"] = res
        elif ntype in ("mca", "ca"):
            bundle["factor_analysis"]["mca"] = res
        elif ntype == "clustering":
            bundle["factor_analysis"]["clustering"] = res
        elif ntype in ("regression", "classification"):
            bundle["modeling"] = res
        elif ntype == "timeseries":
            bundle["timeseries"] = res
        elif ntype == "multivariateTimeseries":
            bundle["multivariate_timeseries"] = res
        elif ntype in ("insights", "llm"):
            if isinstance(res, dict) and "insights" in res:
                try:
                    ins_text = json.dumps(res["insights"], ensure_ascii=False)
                    if bundle["llm_summary"]:
                        bundle["llm_summary"] += f"\n\n{ins_text}"
                    else:
                        bundle["llm_summary"] = ins_text
                except Exception:
                    pass

    reports_dir = Config.REPORTS_DIR
    os.makedirs(reports_dir, exist_ok=True)
    filename = f"rapport_canvas_{dataset_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    output_path = os.path.join(reports_dir, filename)

    try:
        content = build_report_payload(
            dataset_name=ds.get("name") or dataset_id,
            profile=profile,
            recipe={},
            descriptive=bundle.get("analysis", {}).get("descriptive_stats"),
            model_results=bundle.get("modeling", {}),
            insights={"all": []},
        )
        content.title = "Rapport d'Analyse Canvas"
        content.subtitle = "OpenStats Canvas Pipeline"
        pdf_bytes = generate_pdf(content)
        with open(output_path, "wb") as f:
            f.write(pdf_bytes)

        return send_file(
            output_path,
            as_attachment=True,
            download_name=filename,
            mimetype="application/pdf",
        )
    except Exception as e:
        logger.exception("Erreur lors de la génération du rapport Canvas")
        return jsonify({"success": False, "error": str(e)}), 500
