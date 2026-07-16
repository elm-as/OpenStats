"""
Générateur de rapports PDF.
Rapport exécutif complet couvrant toutes les analyses disponibles :
- Profilage & nettoyage
- Statistiques descriptives & corrélations & VIF
- Tests d'hypothèses
- Modélisation prédictive & SHAP
- Séries temporelles (univariées & multivariées)
- Analyse factorielle (ACP, AFC, ACM)
- Transformations appliquées
"""

from __future__ import annotations

import os
import io
from datetime import datetime
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, Image, HRFlowable, KeepTogether,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY

try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import seaborn as sns
    HAS_MATPLOTLIB = True
except ImportError:
    HAS_MATPLOTLIB = False


# ── Palette de couleurs ────────────────────────────────────────────

BLUE_DARK  = colors.HexColor("#1a365d")
BLUE_MED   = colors.HexColor("#2b6cb0")
BLUE_LIGHT = colors.HexColor("#ebf8ff")
GRAY_BG    = colors.HexColor("#edf2f7")
CYAN       = colors.HexColor("#0891b2")
GREEN      = colors.HexColor("#059669")
RED        = colors.HexColor("#dc2626")
AMBER      = colors.HexColor("#d97706")
VIOLET     = colors.HexColor("#7c3aed")


def generate_report(
    output_path: str,
    title: str,
    organization: str,
    data_summary: dict,
    cleaning_log: list[dict],
    descriptive_stats: dict,
    correlation_results: dict,
    test_results: list[dict],
    model_results: dict,
    shap_results: dict | None = None,
    timeseries_results: dict | None = None,
    multivariate_ts_results: dict | None = None,
    pca_results: dict | None = None,
    ca_results: dict | None = None,
    mca_results: dict | None = None,
    vif_results: list | None = None,
    transform_logs: list | None = None,
    llm_summary: str | None = None,
) -> str:
    """Génère le rapport PDF exécutif complet."""

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )

    styles = getSampleStyleSheet()
    _register_custom_styles(styles)

    story = []
    section_num = [0]  # mutable counter

    def next_section():
        section_num[0] += 1
        return section_num[0]

    # ── Page de garde ──
    story.extend(_build_cover_page(styles, title, organization))
    story.append(PageBreak())

    # ── Table des matières dynamique ──
    toc_items = ["Résumé Exécutif", "Anatomie des Données"]
    if correlation_results or vif_results:
        toc_items.append("Analyses Exploratoires")
    if test_results:
        toc_items.append("Tests d'Hypothèses")
    if pca_results or ca_results or mca_results:
        toc_items.append("Analyse Factorielle")
    if transform_logs:
        toc_items.append("Transformations Appliquées")
    if model_results and model_results.get("ranking"):
        toc_items.append("Modélisation Prédictive")
    if timeseries_results:
        toc_items.append("Séries Temporelles")
    if multivariate_ts_results:
        toc_items.append("Séries Temporelles Multivariées")

    story.extend(_build_toc(styles, toc_items))
    story.append(PageBreak())

    # ── Section : Résumé exécutif ──
    n = next_section()
    story.extend(_build_executive_summary(styles, n, llm_summary, data_summary,
                                           model_results, timeseries_results, multivariate_ts_results,
                                           pca_results, test_results))
    story.append(PageBreak())

    # ── Section : Anatomie des données ──
    n = next_section()
    story.extend(_build_data_anatomy(styles, n, data_summary, cleaning_log, descriptive_stats))
    story.append(PageBreak())

    # ── Section : Analyses exploratoires ──
    if correlation_results or vif_results:
        n = next_section()
        story.extend(_build_exploratory_analysis(styles, n, correlation_results, vif_results))
        story.append(PageBreak())

    # ── Section : Tests d'hypothèses ──
    if test_results:
        n = next_section()
        story.extend(_build_hypothesis_tests(styles, n, test_results))
        story.append(PageBreak())

    # ── Section : Analyse factorielle ──
    if pca_results or ca_results or mca_results:
        n = next_section()
        story.extend(_build_factor_analysis(styles, n, pca_results, ca_results, mca_results))
        story.append(PageBreak())

    # ── Section : Transformations ──
    if transform_logs:
        n = next_section()
        story.extend(_build_transforms_section(styles, n, transform_logs))
        story.append(PageBreak())

    # ── Section : Modélisation prédictive ──
    if model_results and model_results.get("ranking"):
        n = next_section()
        story.extend(_build_model_performance(styles, n, model_results, shap_results))
        story.append(PageBreak())

    # ── Section : Séries temporelles univariées ──
    if timeseries_results:
        n = next_section()
        story.extend(_build_timeseries_section(styles, n, timeseries_results))
        story.append(PageBreak())

    # ── Section : Séries temporelles multivariées ──
    if multivariate_ts_results:
        n = next_section()
        story.extend(_build_multivariate_ts_section(styles, n, multivariate_ts_results))

    doc.build(story)
    return output_path


# ═══════════════════════════════════════════════════════════════════
# ── Styles
# ═══════════════════════════════════════════════════════════════════

def _register_custom_styles(styles):
    styles.add(ParagraphStyle(
        "CoverTitle", parent=styles["Title"], fontSize=28, spaceAfter=20,
        alignment=TA_CENTER, textColor=BLUE_DARK,
    ))
    styles.add(ParagraphStyle(
        "CoverSubtitle", parent=styles["Normal"], fontSize=14, alignment=TA_CENTER,
        textColor=colors.HexColor("#4a5568"), spaceAfter=10,
    ))
    styles.add(ParagraphStyle(
        "SectionTitle", parent=styles["Heading1"], fontSize=18,
        textColor=BLUE_DARK, spaceAfter=12, spaceBefore=20,
    ))
    styles.add(ParagraphStyle(
        "SubSection", parent=styles["Heading2"], fontSize=14,
        textColor=colors.HexColor("#2d3748"), spaceAfter=8, spaceBefore=14,
    ))
    styles.add(ParagraphStyle(
        "SubSubSection", parent=styles["Heading3"], fontSize=12,
        textColor=colors.HexColor("#4a5568"), spaceAfter=6, spaceBefore=10,
    ))
    styles.add(ParagraphStyle(
        "BodyText2", parent=styles["Normal"], fontSize=10, leading=14,
        alignment=TA_JUSTIFY, spaceAfter=8,
    ))
    styles.add(ParagraphStyle(
        "Metric", parent=styles["Normal"], fontSize=11, textColor=BLUE_MED,
    ))
    styles.add(ParagraphStyle(
        "Highlight", parent=styles["Normal"], fontSize=10,
        textColor=CYAN, leading=14, spaceAfter=4,
    ))
    styles.add(ParagraphStyle(
        "TOCEntry", parent=styles["Normal"], fontSize=11, leading=20,
        textColor=BLUE_DARK, leftIndent=20,
    ))


# ═══════════════════════════════════════════════════════════════════
# ── Page de garde
# ═══════════════════════════════════════════════════════════════════

def _build_cover_page(styles, title: str, organization: str) -> list:
    elements = []
    elements.append(Spacer(1, 5 * cm))
    elements.append(Paragraph("OPENSTATS", styles["CoverTitle"]))
    elements.append(Spacer(1, 0.5 * cm))
    elements.append(HRFlowable(width="50%", thickness=2, color=CYAN))
    elements.append(Spacer(1, 1 * cm))
    elements.append(Paragraph(title, ParagraphStyle(
        "CoverMain", parent=styles["Title"], fontSize=22,
        alignment=TA_CENTER, textColor=BLUE_MED,
    )))
    elements.append(Spacer(1, 0.5 * cm))
    elements.append(Paragraph(organization, styles["CoverSubtitle"]))
    elements.append(Spacer(1, 3 * cm))
    elements.append(Paragraph(
        f"Date : {datetime.now().strftime('%d/%m/%Y à %H:%M')}", styles["CoverSubtitle"]
    ))
    elements.append(Paragraph("Classification : Confidentiel", styles["CoverSubtitle"]))
    return elements


# ═══════════════════════════════════════════════════════════════════
# ── Table des matières
# ═══════════════════════════════════════════════════════════════════

def _build_toc(styles, items: list[str]) -> list:
    elements = []
    elements.append(Paragraph("Table des Matières", styles["SectionTitle"]))
    elements.append(Spacer(1, 0.5 * cm))
    for i, item in enumerate(items, 1):
        elements.append(Paragraph(f"{i}. {item}", styles["TOCEntry"]))
    return elements


# ═══════════════════════════════════════════════════════════════════
# ── Résumé exécutif
# ═══════════════════════════════════════════════════════════════════

def _build_executive_summary(styles, n, llm_summary, data_summary,
                              model_results, ts_results, mv_ts_results,
                              pca_results, test_results) -> list:
    elements = []
    elements.append(Paragraph(f"{n}. Résumé Exécutif", styles["SectionTitle"]))

    if llm_summary:
        elements.append(Paragraph(llm_summary, styles["BodyText2"]))
        return elements

    shape = data_summary.get("shape", {})
    parts = [
        f"Ce rapport présente l'analyse complète d'un jeu de données contenant "
        f"<b>{shape.get('rows', 'N/A')}</b> observations et "
        f"<b>{shape.get('columns', 'N/A')}</b> variables.",
    ]

    # Résumé de chaque analyse effectuée
    analyses_done = []
    if data_summary.get("dictionary"):
        analyses_done.append("profilage et dictionnaire de données")
    if model_results and model_results.get("ranking"):
        best = model_results["ranking"][0]
        task = model_results.get("task_type", "prédiction")
        analyses_done.append(
            f"modélisation prédictive ({task}) — meilleur modèle : <b>{best.get('model_name', 'N/A')}</b>"
        )
    if ts_results and ts_results.get("best_model"):
        analyses_done.append(
            f"séries temporelles — meilleur modèle : <b>{ts_results['best_model'].upper()}</b>"
        )
    if mv_ts_results:
        rec = mv_ts_results.get("recommendation", "")
        analyses_done.append(f"séries temporelles multivariées (VAR/VECM) — {rec[:80]}")
    if pca_results:
        n_comp = pca_results.get("n_components", "?")
        cum = pca_results.get("cumulative_variance", [])
        pct = f"{cum[-1]*100:.1f}%" if cum else "?"
        analyses_done.append(f"ACP ({n_comp} composantes, {pct} de variance expliquée)")
    if test_results:
        analyses_done.append(f"{len(test_results)} test(s) d'hypothèses")

    if analyses_done:
        parts.append("Les analyses réalisées comprennent : " + " ; ".join(analyses_done) + ".")

    elements.append(Paragraph(" ".join(parts), styles["BodyText2"]))
    return elements


# ═══════════════════════════════════════════════════════════════════
# ── Anatomie des données
# ═══════════════════════════════════════════════════════════════════

def _build_data_anatomy(styles, n, data_summary, cleaning_log, descriptive_stats) -> list:
    elements = []
    elements.append(Paragraph(f"{n}. Anatomie des Données", styles["SectionTitle"]))

    # Vue d'ensemble
    shape = data_summary.get("shape", {})
    elements.append(Paragraph(f"{n}.1 Vue d'ensemble", styles["SubSection"]))
    info_data = [
        ["Métrique", "Valeur"],
        ["Nombre de lignes", str(shape.get("rows", "N/A"))],
        ["Nombre de colonnes", str(shape.get("columns", "N/A"))],
        ["Taille mémoire (MB)", str(data_summary.get("memory_usage_mb", "N/A"))],
    ]
    elements.append(_make_table(info_data))
    elements.append(Spacer(1, 0.5 * cm))

    # Dictionnaire de données
    dictionary = data_summary.get("dictionary", [])
    if dictionary:
        elements.append(Paragraph(f"{n}.2 Dictionnaire de données", styles["SubSection"]))
        dict_data = [["Variable", "Type", "Nullité %", "Cardinalité"]]
        for entry in dictionary[:40]:
            dict_data.append([
                _truncate(entry.get("nom_brut", ""), 25),
                entry.get("type_statistique", ""),
                f"{entry.get('taux_nullite', 0) * 100:.1f}%",
                str(entry.get("cardinalite", "")),
            ])
        elements.append(_make_table(dict_data))
        elements.append(Spacer(1, 0.5 * cm))

    # Nettoyage
    if cleaning_log:
        elements.append(Paragraph(f"{n}.3 Bilan du nettoyage", styles["SubSection"]))
        for log_entry in cleaning_log:
            msg = log_entry.get("message", "")
            elements.append(Paragraph(
                f"• <b>{log_entry.get('step', '')}</b> : {msg}", styles["BodyText2"]
            ))
        elements.append(Spacer(1, 0.3 * cm))

    # Statistiques descriptives
    if descriptive_stats:
        elements.append(Paragraph(f"{n}.4 Statistiques descriptives", styles["SubSection"]))
        stat_data = [["Variable", "Moyenne", "Médiane", "Écart-type", "Asymétrie", "Min", "Max"]]
        for col, st in list(descriptive_stats.items())[:25]:
            if st.get("type") == "numeric":
                stat_data.append([
                    _truncate(col, 20),
                    _fmt(st.get("mean")), _fmt(st.get("median")),
                    _fmt(st.get("std")), _fmt(st.get("skewness")),
                    _fmt(st.get("min")), _fmt(st.get("max")),
                ])
        if len(stat_data) > 1:
            elements.append(_make_table(stat_data))

    return elements


# ═══════════════════════════════════════════════════════════════════
# ── Analyses exploratoires (corrélations + VIF)
# ═══════════════════════════════════════════════════════════════════

def _build_exploratory_analysis(styles, n, correlation_results, vif_results) -> list:
    elements = []
    elements.append(Paragraph(f"{n}. Analyses Exploratoires", styles["SectionTitle"]))
    sub = 1

    # Corrélations
    sig_pairs = correlation_results.get("significant_pairs", []) if correlation_results else []
    if sig_pairs:
        elements.append(Paragraph(f"{n}.{sub} Corrélations significatives", styles["SubSection"]))
        sub += 1
        corr_data = [["Variable 1", "Variable 2", "Coefficient", "Force"]]
        for pair in sig_pairs[:20]:
            corr_data.append([
                pair["var1"], pair["var2"],
                _fmt(pair["coefficient"]), pair.get("strength", ""),
            ])
        elements.append(_make_table(corr_data))
        elements.append(Spacer(1, 0.5 * cm))

    # Heatmap de corrélation (graphique matplotlib)
    if HAS_MATPLOTLIB and correlation_results:
        pearson = correlation_results.get("pearson", correlation_results)
        matrix = pearson.get("matrix")
        cols = pearson.get("columns", [])
        if matrix and cols and len(cols) <= 20:
            heatmap_img = _make_correlation_heatmap(matrix, cols)
            if heatmap_img:
                elements.append(Paragraph(f"{n}.{sub} Matrice de corrélation", styles["SubSection"]))
                sub += 1
                elements.append(Image(heatmap_img, width=14 * cm, height=12 * cm))
                elements.append(Spacer(1, 0.5 * cm))

    # VIF
    if vif_results:
        elements.append(Paragraph(f"{n}.{sub} Facteur d'Inflation de la Variance (VIF)", styles["SubSection"]))
        sub += 1
        vif_data = [["Variable", "VIF", "Multicolinéarité"]]
        for v in vif_results[:20]:
            mc = v.get("multicollinearity", "")
            vif_data.append([v["variable"], _fmt(v["vif"]), mc])
        elements.append(_make_table(vif_data))

        severe = [v for v in vif_results if v.get("multicollinearity") == "severe"]
        if severe:
            elements.append(Paragraph(
                f"⚠ <b>{len(severe)} variable(s)</b> présentent une multicolinéarité sévère (VIF > 10).",
                styles["Highlight"],
            ))

    return elements


# ═══════════════════════════════════════════════════════════════════
# ── Tests d'hypothèses
# ═══════════════════════════════════════════════════════════════════

def _build_hypothesis_tests(styles, n, test_results) -> list:
    elements = []
    elements.append(Paragraph(f"{n}. Tests d'Hypothèses", styles["SectionTitle"]))

    test_data = [["Test", "Statistique", "p-value", "Décision", "Taille d'effet"]]
    for test in test_results:
        stat = _fmt(test.get("statistic"))
        pval = test.get("p_value")
        pval_str = f"{pval:.6f}" if isinstance(pval, (int, float)) else str(pval)
        decision = "Rejet H₀" if isinstance(pval, (int, float)) and pval < 0.05 else "Non rejet"
        es = test.get("effect_size", {})
        es_str = es.get("interpretation", "—") if es else "—"
        test_data.append([
            test.get("test", ""),
            stat, pval_str, decision, es_str,
        ])

    elements.append(_make_table(test_data))

    # Détails individuels
    for i, test in enumerate(test_results, 1):
        elements.append(Spacer(1, 0.3 * cm))
        interp = test.get("interpretation", "")
        if interp:
            elements.append(Paragraph(
                f"<b>Test {i}</b> — {test.get('test', '')} : {interp}", styles["BodyText2"]
            ))

    return elements


# ═══════════════════════════════════════════════════════════════════
# ── Analyse factorielle
# ═══════════════════════════════════════════════════════════════════

def _build_factor_analysis(styles, n, pca_results, ca_results, mca_results) -> list:
    elements = []
    elements.append(Paragraph(f"{n}. Analyse Factorielle", styles["SectionTitle"]))
    sub = 1

    # ACP
    if pca_results:
        elements.append(Paragraph(f"{n}.{sub} ACP — Analyse en Composantes Principales", styles["SubSection"]))
        sub += 1

        # Infos générales
        elements.append(Paragraph(
            f"Variables : {pca_results.get('n_variables', '?')} | "
            f"Composantes retenues : {pca_results.get('n_components', '?')} | "
            f"Observations : {pca_results.get('n_observations', '?')}",
            styles["BodyText2"],
        ))

        # Valeurs propres
        eigenvalues = pca_results.get("eigenvalues", [])
        variance = pca_results.get("explained_variance_ratio", [])
        cumul = pca_results.get("cumulative_variance", [])
        labels = pca_results.get("component_labels", [])
        if eigenvalues:
            ev_data = [["Composante", "Valeur propre", "% Variance", "% Cumulé"]]
            for i, (ev, vr, cv) in enumerate(zip(eigenvalues, variance, cumul)):
                lbl = labels[i] if i < len(labels) else f"CP{i+1}"
                ev_data.append([lbl, _fmt(ev), f"{vr*100:.1f}%", f"{cv*100:.1f}%"])
            elements.append(_make_table(ev_data))
            elements.append(Spacer(1, 0.3 * cm))

        # Contributions des variables
        loadings = pca_results.get("loadings", {})
        if loadings and labels:
            elements.append(Paragraph("Saturations (loadings) :", styles["SubSubSection"]))
            top_labels = labels[:5]
            load_data = [["Variable"] + top_labels]
            for var, vals in list(loadings.items())[:20]:
                row = [_truncate(var, 20)]
                for lbl in top_labels:
                    row.append(_fmt(vals.get(lbl)))
                load_data.append(row)
            elements.append(_make_table(load_data))
        elements.append(Spacer(1, 0.5 * cm))

    # AFC
    if ca_results:
        elements.append(Paragraph(f"{n}.{sub} AFC — Analyse Factorielle des Correspondances", styles["SubSection"]))
        sub += 1

        elements.append(Paragraph(
            f"Variable ligne : <b>{ca_results.get('row_variable', '?')}</b> | "
            f"Variable colonne : <b>{ca_results.get('col_variable', '?')}</b> | "
            f"Inertie totale : {_fmt(ca_results.get('total_inertia'))}",
            styles["BodyText2"],
        ))

        eigenvalues = ca_results.get("eigenvalues", [])
        variance = ca_results.get("explained_variance_ratio", [])
        cumul = ca_results.get("cumulative_variance", [])
        labels = ca_results.get("component_labels", [])
        if eigenvalues:
            ev_data = [["Dimension", "Valeur propre", "% Inertie", "% Cumulé"]]
            for i, (ev, vr, cv) in enumerate(zip(eigenvalues, variance, cumul)):
                lbl = labels[i] if i < len(labels) else f"Dim{i+1}"
                ev_data.append([lbl, _fmt(ev), f"{vr*100:.1f}%", f"{cv*100:.1f}%"])
            elements.append(_make_table(ev_data))
        elements.append(Spacer(1, 0.5 * cm))

    # ACM
    if mca_results:
        elements.append(Paragraph(f"{n}.{sub} ACM — Analyse des Correspondances Multiples", styles["SubSection"]))
        sub += 1

        elements.append(Paragraph(
            f"Variables : {mca_results.get('n_variables', '?')} | "
            f"Modalités : {mca_results.get('n_modalities', '?')} | "
            f"Observations : {mca_results.get('n_observations', '?')}",
            styles["BodyText2"],
        ))

        eigenvalues = mca_results.get("eigenvalues", [])
        variance = mca_results.get("explained_variance_ratio", [])
        cumul = mca_results.get("cumulative_variance", [])
        labels = mca_results.get("component_labels", [])
        if eigenvalues:
            ev_data = [["Dimension", "Valeur propre", "% Variance (Benzécri)", "% Cumulé"]]
            for i, (ev, vr, cv) in enumerate(zip(eigenvalues, variance, cumul)):
                lbl = labels[i] if i < len(labels) else f"Dim{i+1}"
                ev_data.append([lbl, _fmt(ev), f"{vr*100:.1f}%", f"{cv*100:.1f}%"])
            elements.append(_make_table(ev_data))

    return elements


# ═══════════════════════════════════════════════════════════════════
# ── Transformations appliquées
# ═══════════════════════════════════════════════════════════════════

def _build_transforms_section(styles, n, transform_logs) -> list:
    elements = []
    elements.append(Paragraph(f"{n}. Transformations Appliquées", styles["SectionTitle"]))

    t_data = [["Colonne", "Transformation", "Détails"]]
    for log in transform_logs:
        col = log.get("column", "")
        transform = log.get("transform", "")
        detail = log.get("message", log.get("detail", ""))
        t_data.append([_truncate(col, 20), transform, _truncate(str(detail), 40)])

    elements.append(_make_table(t_data))
    elements.append(Paragraph(
        f"Total : <b>{len(transform_logs)}</b> transformation(s) appliquée(s).",
        styles["BodyText2"],
    ))
    return elements


# ═══════════════════════════════════════════════════════════════════
# ── Modélisation prédictive
# ═══════════════════════════════════════════════════════════════════

def _build_model_performance(styles, n, model_results, shap_results) -> list:
    elements = []
    elements.append(Paragraph(f"{n}. Modélisation Prédictive", styles["SectionTitle"]))

    ranking = model_results.get("ranking", [])
    task = model_results.get("task_type", "")

    elements.append(Paragraph(
        f"Type de tâche : <b>{task.title()}</b> | "
        f"Modèles testés : <b>{len(ranking)}</b>",
        styles["BodyText2"],
    ))

    # Split info
    split = model_results.get("data_split", {})
    if split:
        elements.append(Paragraph(
            f"Taille train : {split.get('train_size', '?')} | "
            f"Taille test : {split.get('test_size', '?')} | "
            f"Features : {len(split.get('features', []))}",
            styles["BodyText2"],
        ))

    if ranking:
        elements.append(Paragraph(f"{n}.1 Classement des modèles", styles["SubSection"]))

        if task == "regression":
            perf_data = [["Rang", "Modèle", "R²", "RMSE", "MAE"]]
            for r in ranking:
                m = r.get("metrics", {})
                perf_data.append([
                    str(r.get("rank", "")),
                    r.get("model_name", ""),
                    _fmt(m.get("r2")), _fmt(m.get("rmse")), _fmt(m.get("mae")),
                ])
        else:
            perf_data = [["Rang", "Modèle", "Accuracy", "F1 (pondéré)", "AUC-ROC"]]
            for r in ranking:
                m = r.get("metrics", {})
                perf_data.append([
                    str(r.get("rank", "")),
                    r.get("model_name", ""),
                    _fmt(m.get("accuracy")), _fmt(m.get("f1_weighted")), _fmt(m.get("auc_roc")),
                ])

        elements.append(_make_table(perf_data))
        elements.append(Spacer(1, 0.5 * cm))

        # Graphique du classement
        chart_img = _make_model_ranking_chart(ranking, task)
        if chart_img:
            elements.append(Image(chart_img, width=14 * cm, height=max(4, len(ranking) * 0.8) * cm))
            elements.append(Spacer(1, 0.5 * cm))

        # Meilleur modèle
        best = ranking[0]
        elements.append(Paragraph(
            f"🏆 Meilleur modèle : <b>{best.get('model_name', 'N/A')}</b>",
            styles["SubSection"],
        ))

        # Feature importance
        fi = best.get("feature_importance", [])
        if fi:
            elements.append(Paragraph("Importance des variables (top 15) :", styles["SubSubSection"]))
            fi_data = [["Variable", "Importance"]]
            for f in fi[:15]:
                fi_data.append([_truncate(f["feature"], 25), _fmt(f["importance"])])
            elements.append(_make_table(fi_data))

    # SHAP
    if shap_results and not shap_results.get("error"):
        elements.append(Spacer(1, 0.5 * cm))
        elements.append(Paragraph(f"{n}.2 Explicabilité SHAP", styles["SubSection"]))
        gi = shap_results.get("global_importance", [])
        if gi:
            shap_data = [["Variable", "SHAP moyen"]]
            for s in gi[:15]:
                shap_data.append([_truncate(s["feature"], 25), _fmt(s["mean_shap"])])
            elements.append(_make_table(shap_data))

    return elements


# ═══════════════════════════════════════════════════════════════════
# ── Séries temporelles (univarié)
# ═══════════════════════════════════════════════════════════════════

def _build_timeseries_section(styles, n, ts) -> list:
    elements = []
    elements.append(Paragraph(f"{n}. Séries Temporelles", styles["SectionTitle"]))

    # Info
    elements.append(Paragraph(
        f"Variable date : <b>{ts.get('date_col', '?')}</b> | "
        f"Variable valeur : <b>{ts.get('value_col', '?')}</b> | "
        f"Observations : {ts.get('n_observations', '?')} | "
        f"Fréquence : {ts.get('frequency', '?')}",
        styles["BodyText2"],
    ))

    # Stationnarité
    stat = ts.get("stationarity", {})
    if stat:
        elements.append(Paragraph(f"{n}.1 Tests de stationnarité", styles["SubSection"]))
        stat_data = [["Test", "Statistique", "p-value", "Stationnaire ?"]]
        for test_name in ["adf", "kpss"]:
            t = stat.get(test_name, {})
            if t:
                stat_data.append([
                    test_name.upper(),
                    _fmt(t.get("statistic")),
                    _fmt(t.get("p_value")),
                    "Oui" if t.get("is_stationary") else "Non",
                ])
        elements.append(_make_table(stat_data))
        conclusion = stat.get("conclusion", "")
        if conclusion:
            elements.append(Paragraph(f"<b>Conclusion :</b> {conclusion}", styles["BodyText2"]))
        elements.append(Spacer(1, 0.3 * cm))

    # Décomposition
    decomp = ts.get("decomposition")
    if decomp:
        elements.append(Paragraph(f"{n}.2 Décomposition", styles["SubSection"]))
        elements.append(Paragraph(
            f"Modèle : <b>{decomp.get('model', '?')}</b> | "
            f"Période saisonnière : {decomp.get('period', '?')}",
            styles["BodyText2"],
        ))

    # Modèles
    models = ts.get("models", {})
    ranking = ts.get("ranking", [])
    if ranking:
        elements.append(Paragraph(f"{n}.3 Comparaison des modèles", styles["SubSection"]))
        rank_data = [["Modèle", "AIC", "BIC"]]
        for r in ranking:
            rank_data.append([r.get("model", ""), _fmt(r.get("aic")), _fmt(r.get("bic"))])
        elements.append(_make_table(rank_data))

        best = ts.get("best_model", "")
        if best:
            elements.append(Paragraph(
                f"🏆 Meilleur modèle : <b>{best.upper()}</b>", styles["Highlight"]
            ))

    # Détail de chaque modèle
    for key, model in models.items():
        elements.append(Spacer(1, 0.3 * cm))
        elements.append(Paragraph(f"Modèle : {model.get('model', key)}", styles["SubSubSection"]))
        details = []
        if "order" in model:
            details.append(f"Ordre : {model['order']}")
        if "seasonal_order" in model:
            details.append(f"Saisonnier : {model['seasonal_order']}")
        if "aic" in model:
            details.append(f"AIC : {_fmt(model['aic'])}")
        forecast = model.get("forecast", {})
        if forecast and forecast.get("values"):
            vals = forecast["values"]
            details.append(f"Prévisions ({len(vals)} pas) : [{_fmt(vals[0])} … {_fmt(vals[-1])}]")
        if details:
            elements.append(Paragraph(" | ".join(details), styles["BodyText2"]))

    return elements


# ═══════════════════════════════════════════════════════════════════
# ── Séries temporelles multivariées (VAR / VECM)
# ═══════════════════════════════════════════════════════════════════

def _build_multivariate_ts_section(styles, n, mv) -> list:
    elements = []
    elements.append(Paragraph(f"{n}. Séries Temporelles Multivariées", styles["SectionTitle"]))

    value_cols = mv.get("value_cols", [])
    elements.append(Paragraph(
        f"Variables : <b>{', '.join(value_cols)}</b> | "
        f"Observations : {mv.get('n_observations', '?')} | "
        f"Fréquence : {mv.get('frequency', '?')}",
        styles["BodyText2"],
    ))

    # Stationnarité par variable
    stat = mv.get("stationarity", {})
    integration_diag = mv.get("integration_diagnostics", {})
    if stat:
        elements.append(Paragraph(f"{n}.1 Stationnarité", styles["SubSection"]))
        s_data = [["Variable", "ADF p-value", "KPSS p-value", "Stationnaire ?"]]
        for var_name, var_stat in stat.items():
            if isinstance(var_stat, dict):
                adf_p = _fmt(var_stat.get("adf", {}).get("p_value"))
                kpss_p = _fmt(var_stat.get("kpss", {}).get("p_value"))
                is_stat = "Oui" if var_stat.get("is_stationary") else "Non"
                s_data.append([var_name, adf_p, kpss_p, is_stat])
        if len(s_data) > 1:
            elements.append(_make_table(s_data))
        if integration_diag:
            orders = integration_diag.get("orders", {})
            order_text = ", ".join(f"{var}=I({order})" for var, order in orders.items())
            summary = integration_diag.get("interpretation", "")
            elements.append(Paragraph(
                f"Ordres d'intégration estimés : <b>{order_text or 'N/A'}</b>. {summary}",
                styles["BodyText2"],
            ))
        elements.append(Spacer(1, 0.3 * cm))

    # Causalité de Granger
    granger = mv.get("granger_causality", {})
    details = granger.get("details", [])
    if details:
        elements.append(Paragraph(f"{n}.2 Causalité de Granger", styles["SubSection"]))
        g_data = [["Cause", "Effet", "p-value", "Significatif ?"]]
        for d in details:
            g_data.append([
                d["cause"], d["effect"],
                _fmt(d["p_value"]),
                "Oui" if d.get("significant") else "Non",
            ])
        elements.append(_make_table(g_data))

        sig = [d for d in details if d.get("significant")]
        if sig:
            elements.append(Paragraph(
                f"<b>{len(sig)}</b> relation(s) causale(s) significative(s) détectée(s) (α = 0.05).",
                styles["Highlight"],
            ))
        elements.append(Spacer(1, 0.3 * cm))

    # Cointégration de Johansen
    johansen = mv.get("johansen_cointegration", {})
    if johansen:
        elements.append(Paragraph(f"{n}.3 Cointégration de Johansen", styles["SubSection"]))

        trace_tests = johansen.get("trace_tests", [])
        if trace_tests:
            j_data = [["Hypothèse", "Trace stat.", "Val. critique 95%", "Rejet ?"]]
            for t in trace_tests:
                j_data.append([
                    t.get("hypothesis", ""),
                    _fmt(t.get("statistic")),
                    _fmt(t.get("critical_value_95")),
                    "Oui" if t.get("reject") else "Non",
                ])
            elements.append(_make_table(j_data))

        rank = johansen.get("cointegration_rank", 0)
        interp = johansen.get("interpretation", "")
        elements.append(Paragraph(
            f"Rang de cointégration : <b>{rank}</b>. {interp}", styles["BodyText2"]
        ))
        assumption_message = johansen.get("assumption_message")
        if assumption_message:
            elements.append(Paragraph(
                f"Hypothèse I(1) : {assumption_message}",
                styles["BodyText2"],
            ))
        elements.append(Spacer(1, 0.3 * cm))

    # Modèles VAR / VECM
    models = mv.get("models", {})
    ranking = mv.get("ranking", [])
    if ranking:
        elements.append(Paragraph(f"{n}.4 Modèles estimés", styles["SubSection"]))
        r_data = [["Modèle", "AIC", "BIC"]]
        for r in ranking:
            r_data.append([r.get("model", ""), _fmt(r.get("aic")), _fmt(r.get("bic"))])
        elements.append(_make_table(r_data))

        best = mv.get("best_model", "")
        if best:
            elements.append(Paragraph(
                f"🏆 Meilleur modèle : <b>{best.upper()}</b>", styles["Highlight"]
            ))

    for key, model in models.items():
        elements.append(Spacer(1, 0.3 * cm))
        elements.append(Paragraph(f"Détails : {model.get('model', key)}", styles["SubSubSection"]))
        info = []
        if "lag_order" in model:
            info.append(f"Retards : {model['lag_order']}")
        if "coint_rank" in model:
            info.append(f"Rang coint. : {model['coint_rank']}")
        if "aic" in model:
            info.append(f"AIC : {_fmt(model['aic'])}")
        forecast = model.get("forecast", {})
        if forecast and forecast.get("dates"):
            info.append(f"Prévisions : {len(forecast['dates'])} pas")
        if info:
            elements.append(Paragraph(" | ".join(info), styles["BodyText2"]))

    # Recommandation
    rec = mv.get("recommendation", "")
    if rec:
        elements.append(Spacer(1, 0.3 * cm))
        elements.append(Paragraph(f"<b>Recommandation :</b> {rec}", styles["BodyText2"]))

    return elements


# ═══════════════════════════════════════════════════════════════════
# ── Utilitaires
# ═══════════════════════════════════════════════════════════════════

def _make_table(data: list[list], col_widths=None) -> Table:
    table = Table(data, colWidths=col_widths, repeatRows=1)
    style = TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BLUE_MED),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("ALIGN", (0, 1), (0, -1), "LEFT"),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        ("FONTSIZE", (0, 1), (-1, -1), 7.5),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
        ("TOPPADDING", (0, 1), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 3),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e0")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, GRAY_BG]),
    ])
    table.setStyle(style)
    return table


def _fmt(val) -> str:
    if val is None:
        return "—"
    if isinstance(val, float):
        if abs(val) >= 1000:
            return f"{val:,.2f}"
        return f"{val:.4f}"
    return str(val)


def _truncate(s: str, max_len: int = 30) -> str:
    return s if len(s) <= max_len else s[:max_len-1] + "…"


# ═══════════════════════════════════════════════════════════════════
# ── Graphiques Matplotlib pour PDF
# ═══════════════════════════════════════════════════════════════════

def _make_correlation_heatmap(matrix: list[list], columns: list[str]) -> io.BytesIO | None:
    """Génère une heatmap de corrélation et retourne un BytesIO pour ReportLab."""
    if not HAS_MATPLOTLIB:
        return None
    try:
        import numpy as np

        fig, ax = plt.subplots(figsize=(8, 6))
        data = np.array(matrix)
        sns.heatmap(
            data, annot=True, fmt=".2f", cmap="RdBu_r",
            center=0, vmin=-1, vmax=1,
            xticklabels=columns, yticklabels=columns,
            ax=ax, cbar_kws={"shrink": 0.8},
            annot_kws={"size": 7},
        )
        ax.set_title("Matrice de corrélation", fontsize=12, fontweight="bold", color="#1a365d")
        ax.tick_params(axis="both", labelsize=7)
        plt.tight_layout()

        buf = io.BytesIO()
        fig.savefig(buf, format="png", dpi=150, bbox_inches="tight")
        plt.close(fig)
        buf.seek(0)
        return buf
    except Exception:
        return None


def _make_model_ranking_chart(ranking: list[dict], task_type: str) -> io.BytesIO | None:
    """Génère un bar chart du classement des modèles."""
    if not HAS_MATPLOTLIB or not ranking:
        return None
    try:
        fig, ax = plt.subplots(figsize=(8, max(3, len(ranking) * 0.5)))

        names = [r.get("name", r.get("key", "")) for r in ranking]
        # Choisir la métrique principale
        metric_key = "r2" if task_type == "regression" else "accuracy"
        scores = []
        for r in ranking:
            m = r.get("metrics", {})
            scores.append(m.get(metric_key, 0))

        y_pos = range(len(names))
        palette = sns.color_palette("viridis", n_colors=len(names))
        bars = ax.barh(y_pos, scores, color=palette)
        ax.set_yticks(list(y_pos))
        ax.set_yticklabels(names, fontsize=8)
        ax.set_xlabel(metric_key.upper(), fontsize=10)
        ax.set_title("Classement des modèles", fontsize=12, fontweight="bold", color="#1a365d")
        ax.invert_yaxis()

        for bar, score in zip(bars, scores):
            ax.text(bar.get_width() + 0.005, bar.get_y() + bar.get_height()/2,
                     f"{score:.4f}", va="center", fontsize=7, color="#4a5568")

        plt.tight_layout()
        buf = io.BytesIO()
        fig.savefig(buf, format="png", dpi=150, bbox_inches="tight")
        plt.close(fig)
        buf.seek(0)
        return buf
    except Exception:
        return None
