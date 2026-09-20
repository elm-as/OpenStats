"""
Entraînement compétitif multi-algorithmes avec classement et diagnostic.
"""

from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from typing import Any, Callable
from app.core.modeling_registry import REGRESSION_MODELS, CLASSIFICATION_MODELS
from app.core.modeling_trainers import train_single_model


def train_competitive(
    data: dict,
    model_keys: list[str] | None = None,
    cv_folds: int = 5,
    task_type: str | None = None,
    hyperparams: dict | None = None,
    progress_callback: Callable[[str, str], None] | None = None,
    timeout_per_model: float = 45.0,
) -> dict:
    """
    Entraînement compétitif multi-algorithmes avec streaming et timeout de sécurité.
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

    total_models = len(model_keys)
    results = []

    for idx, key in enumerate(model_keys, 1):
        model_name = registry.get(key, {}).get("name", key)
        if progress_callback:
            try:
                progress_callback(f"[{idx}/{total_models}] Entraînement {model_name}...", "info")
            except Exception:
                pass

        t_start = time.time()
        try:
            with ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(
                    train_single_model,
                    key,
                    data,
                    cv_folds,
                    is_competitive=True,
                    hyperparams=hyperparams,
                )
                result = future.result(timeout=timeout_per_model)

            t_elapsed = time.time() - t_start
            if "error" not in result:
                results.append(result)
                if progress_callback:
                    metric_key = "r2" if task_type == "regression" else "f1_weighted"
                    metric_lbl = "R²" if task_type == "regression" else "F1"
                    score = result.get("metrics", {}).get(metric_key, 0.0)
                    try:
                        progress_callback(
                            f"[{idx}/{total_models}] {model_name} terminé en {t_elapsed:.1f}s ({metric_lbl}: {score:.3f})",
                            "info",
                        )
                    except Exception:
                        pass
            else:
                results.append({
                    "model_key": key,
                    "model_name": model_name,
                    "error": result["error"],
                })
                if progress_callback:
                    try:
                        progress_callback(f"[{idx}/{total_models}] {model_name} : {result['error']}", "warning")
                    except Exception:
                        pass
        except TimeoutError:
            t_elapsed = time.time() - t_start
            err_msg = f"Temps limite dépassé (>{timeout_per_model:.0f}s)"
            results.append({
                "model_key": key,
                "model_name": model_name,
                "error": err_msg,
            })
            if progress_callback:
                try:
                    progress_callback(f"[{idx}/{total_models}] {model_name} : {err_msg}, modèle ignoré", "warning")
                except Exception:
                    pass
        except Exception as e:
            results.append({
                "model_key": key,
                "model_name": model_name,
                "error": str(e),
            })
            if progress_callback:
                try:
                    progress_callback(f"[{idx}/{total_models}] {model_name} : échec ({str(e)})", "error")
                except Exception:
                    pass

    valid_results = [r for r in results if "error" not in r]
    if task_type == "regression":
        valid_results.sort(key=lambda r: r["metrics"].get("r2", -999999.0), reverse=True)
    else:
        valid_results.sort(key=lambda r: r["metrics"].get("f1_weighted", -1.0), reverse=True)

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
