"""
Entraînement compétitif multi-algorithmes avec classement et diagnostic.
"""

from __future__ import annotations

from typing import Any
from app.core.modeling_registry import REGRESSION_MODELS, CLASSIFICATION_MODELS
from app.core.modeling_trainers import train_single_model


def train_competitive(
    data: dict,
    model_keys: list[str] | None = None,
    cv_folds: int = 5,
    task_type: str | None = None,
) -> dict:
    """
    Entraînement compétitif multi-algorithmes.
    Retourne un classement des modèles avec le meilleur.
    """
    if task_type:
        data["task_type"] = "regression" if "regress" in str(task_type).lower() else "classification"

    task_type = data["task_type"]
    registry = REGRESSION_MODELS if task_type == "regression" else CLASSIFICATION_MODELS

    if model_keys:
        compatible_keys = [k for k in model_keys if k in registry]
        model_keys = compatible_keys if compatible_keys else list(registry.keys())
    else:
        model_keys = list(registry.keys())

    results = []
    for key in model_keys:
        try:
            result = train_single_model(key, data, cv_folds, is_competitive=True)
            if "error" not in result:
                results.append(result)
        except Exception as e:
            results.append({
                "model_key": key,
                "model_name": registry.get(key, {}).get("name", key),
                "error": str(e),
            })

    valid_results = [r for r in results if "error" not in r]
    if task_type == "regression":
        valid_results.sort(key=lambda r: r["metrics"].get("r2", 0), reverse=True)
    else:
        valid_results.sort(key=lambda r: r["metrics"].get("f1_weighted", 0), reverse=True)

    ranking = []
    best_model = None
    best_label_encoder = None
    for i, r in enumerate(valid_results):
        model_obj = r.pop("model", None)
        le_obj = r.pop("label_encoder", None)
        r["rank"] = i + 1
        ranking.append(r)
        if i == 0:
            best_model = model_obj
            best_label_encoder = le_obj

    failed = [r for r in results if "error" in r]

    diagnostics = {}
    if task_type == "regression" and ranking:
        best_r2 = ranking[0]["metrics"].get("r2")
        diagnostics["best_r2"] = best_r2
        diagnostics["quality_flag"] = "critical" if best_r2 is not None and best_r2 < 0 else "ok"
        if best_r2 is not None and best_r2 < 0:
            diagnostics["message"] = (
                "Tous les modèles généralisent mal (R² < 0). Vérifiez la cible, le split temporel, "
                "les valeurs extrêmes et la pertinence des features."
            )

    return {
        "task_type": task_type,
        "ranking": ranking,
        "failed": failed,
        "best_model": best_model,
        "best_model_key": ranking[0]["model_key"] if ranking else None,
        "label_encoder": best_label_encoder,
        "feature_names": data.get("feature_names", []),
        "diagnostics": diagnostics,
    }
