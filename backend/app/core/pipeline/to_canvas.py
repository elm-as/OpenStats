"""
Conversion d'une analyse methodique en graphe de canvas editable.

Ce qui a ete execute (etapes, corrections retenues, modelisation) devient un
pipeline nodal que l'utilisateur peut reprendre, modifier et re-executer — puis
exporter en Python ou en R via le generateur de code.

Le graphe produit est un DAG reel : les aretes portent les dependances de
donnees, pas une disposition visuelle. La mise en page est laissee au frontend.
"""

from __future__ import annotations

from typing import Any

# Correspondance etape -> type de noeud du canvas.
STAGE_NODES: dict[str, dict[str, Any]] = {
    "understand": {"type": "typing", "label": "Typage & profil"},
    "univariate": {"type": "descriptiveNumeric", "label": "Statistiques descriptives"},
    "bivariate": {"type": "correlation", "label": "Corrélations"},
    "modeling": {"type": "regression", "label": "Modélisation"},
    "interpretation": {"type": "insights", "label": "Synthèse & interprétation"},
}

# Remede -> noeud du canvas. Les remedes de meme nature sont regroupes.
REMEDY_NODES: dict[str, dict[str, Any]] = {
    "drop_duplicates": {"type": "cleaning", "label": "Nettoyage"},
    "drop_columns": {"type": "cleaning", "label": "Nettoyage"},
    "impute": {"type": "cleaning", "label": "Nettoyage"},
    "robust_se": {"type": "regression", "label": "Modélisation robuste"},
}

LAYOUT_X_STEP = 280
LAYOUT_Y_STEP = 130


def _node(node_id: str, node_type: str, label: str, data: dict[str, Any],
          column: int, row: int) -> dict[str, Any]:
    return {
        "id": node_id,
        "type": node_type,
        "position": {"x": 60 + column * LAYOUT_X_STEP, "y": 80 + row * LAYOUT_Y_STEP},
        "data": {"title": label, "label": label, **data},
    }


def _cleaning_params(remedies: list[dict[str, Any]]) -> dict[str, Any]:
    """Regroupe les remedes structurels en un seul noeud de nettoyage."""
    actions: list[str] = []
    dropped: list[str] = []

    for remedy in remedies:
        action = remedy.get("action")
        columns = [str(c) for c in (remedy.get("columns") or []) if c != "<lignes>"]
        if action == "drop_duplicates" and "remove_duplicates" not in actions:
            actions.append("remove_duplicates")
        elif action == "drop_columns":
            if "drop_constant_cols" not in actions:
                actions.append("drop_constant_cols")
            dropped.extend(columns)
        elif action == "impute" and "impute_missing" not in actions:
            actions.append("impute_missing")

    return {"actions": actions, "constant_cols": sorted(set(dropped))}


def build_canvas(result: dict[str, Any], dataset_id: str | None = None,
                 dataset_name: str = "dataset.csv") -> dict[str, Any]:
    """Traduit un resultat de `run_pipeline` en graphe de canvas.

    Seules les corrections effectivement retenues sont converties : une
    iteration annulee par la boucle ne doit pas reapparaitre dans le pipeline.
    """
    stages = {s["key"]: s for s in result.get("stages", [])}
    target = result.get("target")
    problem = result.get("problem_type", "exploration")

    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, Any]] = []
    column = 0

    # `file` porte l'identifiant, pas le nom : c'est la convention du canvas
    # (cf. app/api/v1/canvas/generation.py), sinon le noeud tente de charger
    # un dataset dont le nom n'est pas une cle.
    source = _node("n_dataset", "dataset", dataset_name or "Source",
                   {"dataset_id": dataset_id, "file": dataset_id,
                    "fileName": dataset_name, "importMode": "existing"},
                   column, 0)
    nodes.append(source)
    previous = source["id"]
    column += 1

    # ── Typage declare, s'il a modifie quelque chose ──
    schema = (stages.get("problem", {}).get("data", {}) or {}).get("schema") or {}
    if schema.get("declared"):
        node = _node("n_typing", "typing", "Typage déclaré",
                     {"declared_types": schema["declared"],
                      "coerced": schema.get("coerced", [])}, column, 0)
        nodes.append(node)
        edges.append({"id": f"e_{previous}_{node['id']}", "source": previous, "target": node["id"]})
        previous = node["id"]
        column += 1

    # ── Corrections retenues par la boucle ──
    correction = stages.get("correction", {}).get("data", {}) or {}
    kept_remedies: list[dict[str, Any]] = []
    transforms: list[dict[str, Any]] = []

    for iteration in correction.get("iterations", []):
        if not iteration.get("kept"):
            continue
        for applied in iteration.get("applied", []):
            if not applied.get("ok"):
                continue
            action = applied.get("action")
            if action in REMEDY_NODES:
                kept_remedies.append(applied)
            elif action != "robust_se":
                for col in applied.get("columns", []):
                    transforms.append({"column": col, "transform": action,
                                       "params": applied.get("params") or {}})

    structural = [r for r in kept_remedies if r.get("action") != "robust_se"]
    if structural:
        node = _node("n_cleaning", "cleaning", "Nettoyage",
                     _cleaning_params(structural), column, 0)
        nodes.append(node)
        edges.append({"id": f"e_{previous}_{node['id']}", "source": previous, "target": node["id"]})
        previous = node["id"]
        column += 1

    if transforms:
        node = _node("n_transform", "transform", "Transformations",
                     {"transforms": transforms}, column, 0)
        nodes.append(node)
        edges.append({"id": f"e_{previous}_{node['id']}", "source": previous, "target": node["id"]})
        previous = node["id"]
        column += 1

    # ── Analyses, en parallele apres la preparation ──
    prepared = previous
    row = 0
    analysis_ids: list[str] = []

    for key, spec in (("univariate", STAGE_NODES["univariate"]),
                      ("bivariate", STAGE_NODES["bivariate"])):
        stage = stages.get(key)
        if not stage or stage.get("status") != "success":
            continue
        node = _node(f"n_{key}", spec["type"], spec["label"], {}, column, row)
        nodes.append(node)
        edges.append({"id": f"e_{prepared}_{node['id']}", "source": prepared, "target": node["id"]})
        analysis_ids.append(node["id"])
        row += 1

    diagnostics = stages.get("diagnostics")
    if diagnostics and diagnostics.get("status") == "success":
        node = _node("n_vif", "vif", "Diagnostic de colinéarité", {}, column, row)
        nodes.append(node)
        edges.append({"id": f"e_{prepared}_{node['id']}", "source": prepared, "target": node["id"]})
        analysis_ids.append(node["id"])
        row += 1

    if analysis_ids:
        column += 1

    # ── Modelisation ──
    modeling = stages.get("modeling")
    last = prepared
    if modeling and modeling.get("status") == "success" and target:
        node_type = ("classification" if "classification" in problem
                     else "timeseries" if problem == "forecast" else "regression")
        data: dict[str, Any] = {"targetCol": target, "problem_type": problem}
        if "robust_se" in (correction.get("modeling_flags") or []):
            data["robust_se"] = True
        if node_type == "timeseries":
            temporal = (stages.get("problem", {}).get("data", {}) or {}).get("temporal") or []
            data["value_col"] = target
            if temporal:
                data["date_col"] = temporal[0]

        node = _node("n_model", node_type, STAGE_NODES["modeling"]["label"], data, column, 0)
        nodes.append(node)
        edges.append({"id": f"e_{prepared}_{node['id']}", "source": prepared, "target": node["id"]})
        last = node["id"]
        column += 1

    # ── Synthese ──
    node = _node("n_insights", "insights", STAGE_NODES["interpretation"]["label"], {}, column, 0)
    nodes.append(node)
    edges.append({"id": f"e_{last}_{node['id']}", "source": last, "target": node["id"]})

    return {
        "nodes": nodes,
        "edges": edges,
        "title": f"Analyse méthodique — {target}" if target else "Analyse méthodique",
        "summary": {
            "nodes": len(nodes),
            "transforms": len(transforms),
            "cleaning_actions": _cleaning_params(structural)["actions"] if structural else [],
            "target": target,
            "problem_type": problem,
        },
    }
