"""
Routes API pour la génération de rapports PDF et exports multi-format.
"""

import os
from datetime import datetime

from flask import request, jsonify, send_file
from app.api.v1 import api_v1_bp
from app.services.dataset_service import dataset_manager
from app.schemas import ReportSchema, validate_payload


def _build_export_filename(dataset_id: str, ext: str) -> str:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return f"export_{dataset_id}_{timestamp}.{ext}"


@api_v1_bp.route("/datasets/<dataset_id>/report", methods=["POST"])
def generate_report(dataset_id):
    """
    Génère le rapport PDF exécutif.
    Body JSON (optionnel) :
    {
        "title": "Mon Analyse",
        "organization": "Mon Entreprise"
    }
    """
    data, err = validate_payload(ReportSchema, request.get_json(silent=True))
    if err:
        return jsonify(err), 400

    try:
        output_path = dataset_manager.generate_pdf_report(
            dataset_id=dataset_id,
            title=data["title"],
            organization=data["organization"],
        )

        return send_file(
            output_path,
            as_attachment=True,
            download_name=output_path.split("/")[-1].split("\\")[-1],
            mimetype="application/pdf",
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_v1_bp.route("/datasets/<dataset_id>/export/<fmt>", methods=["POST"])
def export_dataset(dataset_id, fmt):
    """
    Exporte les résultats dans le format demandé.
    Formats supportés : excel, json, html
    Body JSON optionnel : {"title": "Mon Analyse"}
    """
    if fmt not in ("excel", "json", "html"):
        return jsonify({"error": f"Format '{fmt}' non supporté. Utilisez excel, json ou html."}), 400

    data, err = validate_payload(ReportSchema, request.get_json(silent=True))
    if err:
        return jsonify(err), 400

    from app.config import Config
    base_dir = os.path.join(Config.REPORTS_DIR, dataset_id)
    os.makedirs(base_dir, exist_ok=True)

    try:
        bundle = dataset_manager.get_export_bundle(
            dataset_id=dataset_id,
            title=data["title"],
            organization=data["organization"],
        )

        if fmt == "excel":
            from app.core.export import export_excel
            filename = _build_export_filename(dataset_id, "xlsx")
            output_path = os.path.join(base_dir, filename)
            export_excel(output_path, bundle)
            return send_file(
                output_path, as_attachment=True,
                download_name=filename,
                mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )

        elif fmt == "json":
            from app.core.export import export_json
            filename = _build_export_filename(dataset_id, "json")
            output_path = os.path.join(base_dir, filename)
            export_json(output_path, bundle)
            return send_file(
                output_path, as_attachment=True,
                download_name=filename,
                mimetype="application/json",
            )

        elif fmt == "html":
            from app.core.export import export_html
            filename = _build_export_filename(dataset_id, "html")
            output_path = os.path.join(base_dir, filename)
            export_html(output_path, bundle)
            return send_file(
                output_path, as_attachment=True,
                download_name=filename,
                mimetype="text/html",
            )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Rapports professionnels (PDF/DOCX/PPTX) ──────────────────────────────


@api_v1_bp.route("/datasets/<dataset_id>/report/professional/<fmt>", methods=["POST", "GET"])
def professional_report(dataset_id, fmt):
    """
    Génère un rapport professionnel (style cabinet de conseil) au format demandé.
    Formats : pdf | docx | pptx
    """
    fmt = (fmt or "").lower()
    if fmt not in ("pdf", "docx", "pptx"):
        return jsonify({"error": f"Format '{fmt}' non supporté. Utilisez pdf, docx ou pptx."}), 400

    ds = dataset_manager.get(dataset_id)
    if ds is None:
        return jsonify({"error": "Dataset introuvable"}), 404

    from app.core.professional_report import (
        build_report_payload, generate_pdf, generate_docx, generate_pptx,
    )
    from app.core.interpretation import (
        narrate_descriptive, narrate_correlations, narrate_vif, narrate_modeling,
        narrate_timeseries, narrate_multivariate_timeseries, narrate_pca,
        narrate_diagnostics,
    )
    from app.core.interpretation.base import sort_insights, insights_to_dict
    from app.core.auto_pipeline import detect_dataset_profile, build_recipe
    from app.core.recommendations import diagnose_dataset

    df = dataset_manager.get_df(dataset_id)
    if df is None or df.empty:
        return jsonify({"error": "Dataset vide ou introuvable"}), 404

    # Load analysis results and model results from DB/cache using get_export_bundle
    try:
        bundle = dataset_manager.get_export_bundle(dataset_id)
    except Exception as e:
        return jsonify({"error": f"Erreur lors de la récupération des données: {str(e)}"}), 500

    analysis = bundle.get("analysis") or {}
    model_results = bundle.get("modeling") or {}
    ts_results = bundle.get("timeseries") or {}
    mv_ts_results = bundle.get("multivariate_timeseries") or {}
    factor = bundle.get("factor_analysis") or {}

    try:
        profile = detect_dataset_profile(df)
    except Exception as e:
        return jsonify({"error": f"Erreur lors de l'analyse du profil: {str(e)}"}), 500

    try:
        recipe = build_recipe(profile)
    except Exception as e:
        return jsonify({"error": f"Erreur lors de la construction de la recette: {str(e)}"}), 500

    all_ins = []
    try:
        advisories = diagnose_dataset(df, ds.get("profile"))
        all_ins.extend(narrate_diagnostics(advisories))
    except Exception:
        pass
    if isinstance(analysis.get("descriptive_stats"), dict):
        try: all_ins.extend(narrate_descriptive(analysis["descriptive_stats"]))
        except Exception: pass
    if isinstance(analysis.get("correlations"), dict):
        try: all_ins.extend(narrate_correlations(analysis["correlations"]))
        except Exception: pass
    if analysis.get("vif"):
        try: all_ins.extend(narrate_vif(analysis["vif"]))
        except Exception: pass
    if isinstance(model_results, dict) and model_results:
        try: all_ins.extend(narrate_modeling(model_results))
        except Exception: pass
    if isinstance(ts_results, dict) and ts_results:
        try: all_ins.extend(narrate_timeseries(ts_results))
        except Exception: pass
    if isinstance(mv_ts_results, dict) and mv_ts_results:
        try: all_ins.extend(narrate_multivariate_timeseries(mv_ts_results))
        except Exception: pass
    if isinstance(factor, dict) and factor.get("pca"):
        try: all_ins.extend(narrate_pca(factor["pca"]))
        except Exception: pass

    insights_dict = insights_to_dict(sort_insights(all_ins))

    dataset_name = ds.get("name") or ds.get("filename") or dataset_id
    content = build_report_payload(
        dataset_name=dataset_name,
        profile=profile.to_dict(),
        recipe=recipe.to_dict(),
        descriptive=analysis.get("descriptive_stats"),
        model_results=model_results,
        insights=insights_dict,
    )

    try:
        if fmt == "pdf":
            blob = generate_pdf(content)
            mime = "application/pdf"
            ext = "pdf"
        elif fmt == "docx":
            blob = generate_docx(content)
            mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            ext = "docx"
        else:
            blob = generate_pptx(content)
            mime = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
            ext = "pptx"
    except Exception as e:
        return jsonify({"error": f"Erreur génération {fmt}: {str(e)}"}), 500

    from app.config import Config
    base_dir = os.path.join(Config.REPORTS_DIR, dataset_id)
    os.makedirs(base_dir, exist_ok=True)
    filename = f"rapport_professionnel_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{ext}"
    output_path = os.path.join(base_dir, filename)
    with open(output_path, "wb") as f:
        f.write(blob)

    return send_file(
        output_path, as_attachment=True,
        download_name=filename, mimetype=mime,
    )
