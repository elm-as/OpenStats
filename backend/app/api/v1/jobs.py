"""
Routes API pour la gestion des jobs asynchrones.
"""

from flask import request, jsonify
from app.api.v1 import api_v1_bp
from app.services.job_service import submit_job, get_job, list_jobs, cancel_job
from app.tasks import is_async_available


@api_v1_bp.route("/jobs", methods=["GET"])
def list_jobs_route():
    """
    Liste les jobs avec filtres optionnels et pagination.
    Query params : dataset_id, status, page, per_page
    """
    dataset_id = request.args.get("dataset_id")
    status = request.args.get("status")
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)

    result = list_jobs(dataset_id=dataset_id, status=status, page=page, per_page=per_page)
    result["async_available"] = is_async_available()
    return jsonify(result)


@api_v1_bp.route("/jobs/submit", methods=["POST"])
def submit_job_route():
    """
    Soumet un nouveau job.
    Body JSON :
    {
        "dataset_id": "abc123",
        "task_type": "analysis" | "modeling" | "timeseries" | "multivariate_ts" | "cleaning" | "report" | "hypothesis_test",
        "parameters": { ... }
    }
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "Corps JSON requis"}), 400

    dataset_id = data.get("dataset_id")
    task_type = data.get("task_type")
    parameters = data.get("parameters", {})

    if not dataset_id:
        return jsonify({"error": "dataset_id requis"}), 400
    if not task_type:
        return jsonify({"error": "task_type requis"}), 400

    try:
        job = submit_job(dataset_id, task_type, parameters)
        return jsonify(job), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_v1_bp.route("/jobs/<job_id>", methods=["GET"])
def get_job_route(job_id):
    """Récupère le statut d'un job."""
    job = get_job(job_id)
    if job is None:
        return jsonify({"error": "Job introuvable"}), 404
    return jsonify(job)


@api_v1_bp.route("/jobs/<job_id>/cancel", methods=["POST"])
def cancel_job_route(job_id):
    """Annule un job en attente ou en cours."""
    job = cancel_job(job_id)
    if job is None:
        return jsonify({"error": "Job introuvable"}), 404
    return jsonify(job)
