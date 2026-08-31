"""
Sections spécialisées pour le constructeur de rapport professionnel :
- Section profil du dataset
- Section méthodologie
- Section descriptives
- Section modélisation & régression OLS détaillée
- Section séries temporelles & causalités
"""

from __future__ import annotations

from typing import Any
from app.core.professional_report.builder_models import ReportSection


def _fmt(v: Any, pct: bool = False) -> str:
    """Formatage standardisé des nombres."""
    if v is None:
        return "—"
    try:
        f = float(v)
        if pct:
            return f"{f * 100:.1f}%" if abs(f) <= 1.5 else f"{f:.1f}%"
        if abs(f) >= 1e6 or (abs(f) < 1e-3 and f != 0):
            return f"{f:.2e}"
        if f == int(f):
            return f"{int(f):,}".replace(",", " ")
        return f"{f:.3f}"
    except (TypeError, ValueError):
        return str(v)


def build_profile_section(profile: dict[str, Any] | None) -> ReportSection | None:
    """Construit la section de profilage du dataset."""
    if not profile:
        return None

    n_rows = profile.get("n_rows", 0) or 0
    n_cols = profile.get("n_cols", 0) or 0
    n_num = len(profile.get("numeric_cols") or []) + len(profile.get("discrete_cols") or [])
    n_cat = len(profile.get("categorical_cols") or []) + len(profile.get("binary_cols") or [])
    n_temp = len(profile.get("temporal_cols") or [])
    n_id = len(profile.get("id_cols") or [])

    details = []
    if n_num > 0:
        details.append(f"{n_num} numérique(s)")
    if n_cat > 0:
        details.append(f"{n_cat} catégorielle(s)")
    if n_temp > 0:
        details.append(f"{n_temp} temporelle(s)")
    if n_id > 0:
        details.append(f"{n_id} identifiant(s)")

    sec = ReportSection(
        title="Profil du dataset",
        body=(
            f"Le dataset comporte **{n_rows:,} observations** réparties sur **{n_cols} variables** : "
            f"{', '.join(details)}."
        ).replace(",", " "),
        bullets=profile.get("notes", []) or [],
    )

    if profile.get("suggested_target"):
        sec.bullets.append(
            f"Variable cible suggérée : {profile['suggested_target']} "
            f"(score de confiance : {profile.get('target_score', 0):.0f}/100)"
        )
    if profile.get("problem_type"):
        sec.bullets.append(f"Type de problème détecté : {profile['problem_type']}")

    return sec


def build_methodology_section(recipe: dict[str, Any] | None) -> ReportSection | None:
    """Construit la section méthodologie."""
    if not recipe:
        return None

    steps = recipe.get("steps", [])
    if not steps:
        return None

    return ReportSection(
        title="Méthodologie",
        body=(
            "Le pipeline d'analyse appliqué comporte les étapes suivantes, "
            "sélectionnées automatiquement en fonction du profil du dataset."
        ),
        bullets=[
            f"**{i+1}. {s.get('label', s.get('key', '?'))}** — {s.get('rationale', '')}"
            for i, s in enumerate(steps) if not s.get("optional", False)
        ],
    )


def build_descriptive_section(stats: dict[str, Any] | None) -> ReportSection | None:
    """Construit la section descriptives numériques et temporelles."""
    if not stats:
        return None

    rows = []
    temp_bullets = []
    for col, s in list(stats.items())[:25]:
        if not isinstance(s, dict):
            continue
        stype = s.get("type")
        if stype == "numeric":
            rows.append([
                col,
                _fmt(s.get("mean")),
                _fmt(s.get("median")),
                _fmt(s.get("std")),
                _fmt(s.get("skewness")),
                _fmt(s.get("null_rate"), pct=True),
            ])
        elif stype == "temporal":
            temp_bullets.append(
                f"**Index Temporel `{col}`** : Plage {s.get('min')} → {s.get('max')} "
                f"({s.get('periods_count')} périodes calendaires sans trous majeurs)."
            )

    if not rows and not temp_bullets:
        return None

    return ReportSection(
        title="Statistiques descriptives & Temporelles",
        body="Vue d'ensemble des distributions et dimensions temporelles :",
        bullets=temp_bullets,
        table={
            "headers": ["Variable", "Moyenne", "Médiane", "Écart-type", "Asymétrie", "Manquants"],
            "rows": rows,
        } if rows else None,
    )


def build_modeling_section(model_results: dict[str, Any] | None) -> ReportSection | None:
    """Construit la section modélisation avec tableau comparatif et régression OLS formelle."""
    if not model_results:
        return None

    task = model_results.get("task_type") or model_results.get("task")
    all_models = model_results.get("ranking") or model_results.get("models") or model_results.get("comparison") or []

    best = None
    if isinstance(all_models, list) and len(all_models) > 0 and isinstance(all_models[0], dict):
        best = all_models[0]
    elif isinstance(model_results.get("best"), dict):
        best = model_results["best"]

    bullets = []
    if isinstance(best, dict) and best:
        metrics = best.get("test_metrics") or best.get("metrics") or {}
        name = best.get("name") or best.get("model_key") or "Meilleur modèle"
        bullets.append(f"**Meilleur modèle global** : {name}")
        for k, v in metrics.items():
            try:
                bullets.append(f"{k.upper()} = {_fmt(v)}")
            except Exception:
                pass

    rows = []
    for m in (all_models or []):
        metrics = m.get("test_metrics") or m.get("metrics") or {}
        rows.append([
            m.get("name") or m.get("model_key") or "?",
            _fmt(metrics.get("r2") if task == "regression" else metrics.get("accuracy")),
            _fmt(metrics.get("rmse") if task == "regression" else metrics.get("f1")),
            _fmt(metrics.get("mae") if task == "regression" else metrics.get("roc_auc")),
        ])

    main_sec = ReportSection(
        title="Modélisation prédictive & Benchmark",
        body=f"Tâche détectée : {task or 'modélisation'}. {len(all_models)} algorithmes ont été évalués.",
        bullets=bullets,
        table={
            "headers": ["Modèle", "R² / Acc.", "RMSE / F1", "MAE / AUC"],
            "rows": rows,
        } if rows else None,
    )

    # Si régression linéaire OLS disponible, insérer la sous-section détaillée
    ols_entry = next((m for m in all_models if "ols" in str(m.get("model_key", "")).lower() or "linear" in str(m.get("model_key", "")).lower()), None)
    if ols_entry and ols_entry.get("model_summary"):
        summ = ols_entry["model_summary"]
        coefs = summ.get("coefficients") or []
        ols_rows = []
        for c in coefs:
            stars = "***" if c.get("p_value", 1) < 0.001 else ("**" if c.get("p_value", 1) < 0.01 else ("*" if c.get("p_value", 1) < 0.05 else ""))
            ols_rows.append([
                c.get("variable", "?"),
                f"{c.get('coefficient', 0):.4f}",
                f"{c.get('std_error', 0):.4f}",
                f"{c.get('t_statistic', 0):.2f}",
                f"{c.get('p_value', 0):.4f} {stars}",
                f"[{c.get('ci_lower', 0):.3f} ; {c.get('ci_upper', 0):.3f}]",
            ])

        sub = ReportSection(
            title="Détail Économétrique OLS & Équation Formelle",
            body=(
                f"**Équation estimée** : `{summ.get('equation', 'Y = Xβ')}`\n\n"
                f"R² ajusté = **{summ.get('r2_adjusted', 0):.4f}** | Statistique F = **{summ.get('f_statistic', 0):.2f}** (p = {summ.get('f_pvalue', 0):.4e})"
            ),
            table={
                "headers": ["Variable", "Coeff β", "Std Error", "t-stat", "p-valeur", "IC 95%"],
                "rows": ols_rows,
            } if ols_rows else None,
        )
        main_sec.subsections.append(sub)

    return main_sec
