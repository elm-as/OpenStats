"""
Génération PDF style cabinet de conseil avec ReportLab.
"""

from __future__ import annotations

import io
import re
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    KeepTogether,
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY

from app.core.professional_report.builder import ReportContent, ReportSection


# ── Couleurs corporatives ────────────────────────────────────────────────

ACCENT = colors.HexColor("#06b6d4")
SECONDARY = colors.HexColor("#1e3a8a")
GRAY_TXT = colors.HexColor("#1f2937")
GRAY_LIGHT = colors.HexColor("#6b7280")
BG_HEAD = colors.HexColor("#0e7490")

SEVERITY_COLOR = {
    "critical": colors.HexColor("#dc2626"),
    "warning": colors.HexColor("#d97706"),
    "success": colors.HexColor("#059669"),
    "methodological": colors.HexColor("#7c3aed"),
    "info": colors.HexColor("#2563eb"),
}


def _make_styles():
    """Styles personnalisés."""
    base = getSampleStyleSheet()
    return {
        "h1": ParagraphStyle(
            "H1", parent=base["Heading1"], fontSize=24, textColor=SECONDARY,
            spaceAfter=14, spaceBefore=14, fontName="Helvetica-Bold",
        ),
        "h2": ParagraphStyle(
            "H2", parent=base["Heading2"], fontSize=16, textColor=ACCENT,
            spaceAfter=10, spaceBefore=18, fontName="Helvetica-Bold",
            borderPadding=4, leftIndent=0,
        ),
        "h3": ParagraphStyle(
            "H3", parent=base["Heading3"], fontSize=13, textColor=GRAY_TXT,
            spaceAfter=6, spaceBefore=10, fontName="Helvetica-Bold",
        ),
        "body": ParagraphStyle(
            "Body", parent=base["BodyText"], fontSize=10.5, leading=15,
            textColor=GRAY_TXT, alignment=TA_JUSTIFY, spaceAfter=8,
        ),
        "bullet": ParagraphStyle(
            "Bullet", parent=base["BodyText"], fontSize=10, leading=14,
            textColor=GRAY_TXT, leftIndent=14, bulletIndent=4, spaceAfter=4,
        ),
        "small": ParagraphStyle(
            "Small", parent=base["BodyText"], fontSize=9, textColor=GRAY_LIGHT,
        ),
        "cover_title": ParagraphStyle(
            "CoverTitle", parent=base["Title"], fontSize=38, textColor=colors.white,
            alignment=TA_LEFT, leading=46, fontName="Helvetica-Bold", leftIndent=2*cm,
        ),
        "cover_sub": ParagraphStyle(
            "CoverSub", parent=base["Title"], fontSize=18, textColor=ACCENT,
            alignment=TA_LEFT, leading=26, fontName="Helvetica", leftIndent=2*cm, spaceAfter=20,
        ),
        "cover_meta": ParagraphStyle(
            "CoverMeta", parent=base["BodyText"], fontSize=11, textColor=GRAY_LIGHT,
            alignment=TA_CENTER,
        ),
    }


# ── Markdown ultra-light → ReportLab inline ──────────────────────────────


def _md_to_rl(text: str) -> str:
    """Convertit **bold** → <b>bold</b>, `code` → <font face=Courier>code</font>."""
    if not text:
        return ""
    # Escape HTML brut
    text = (text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))
    # **bold**
    text = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", text)
    # `code`
    text = re.sub(r"`([^`]+)`", r'<font face="Courier" color="#0891b2">\1</font>', text)
    return text


# ── Cover page ───────────────────────────────────────────────────────────


def _cover(content: ReportContent, styles: dict) -> list:
    story = []
    # Espacement pour descendre dans le bloc de couleur
    story.append(Spacer(1, 4 * cm))
    story.append(Paragraph(content.title, styles["cover_title"]))
    story.append(Spacer(1, 0.5 * cm))
    story.append(Paragraph(content.subtitle, styles["cover_sub"]))
    # Espace pour sortir du bloc de couleur
    story.append(Spacer(1, 8 * cm))

    # Tableau métadonnées
    meta_rows = [
        ["Date du rapport", content.date],
        ["Auteur", content.author],
    ]
    for k, v in (content.metadata or {}).items():
        meta_rows.append([str(k), str(v)])

    t = Table(meta_rows, colWidths=[5 * cm, 8 * cm])
    t.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 11),
        ("TEXTCOLOR", (0, 0), (0, -1), GRAY_LIGHT),
        ("TEXTCOLOR", (1, 0), (1, -1), GRAY_TXT),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica-Bold"),
        ("ALIGN", (0, 0), (0, -1), "RIGHT"),
        ("ALIGN", (1, 0), (1, -1), "LEFT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LINEABOVE", (0, 0), (-1, 0), 1, ACCENT),
        ("LINEBELOW", (0, -1), (-1, -1), 1, ACCENT),
    ]))
    story.append(t)
    story.append(PageBreak())
    return story


# ── Section rendering ────────────────────────────────────────────────────


def _render_section(section: ReportSection, styles: dict, level: int = 1) -> list:
    """Convertit une section en flow ReportLab."""
    elems = []
    style_key = "h2" if level == 1 else "h3"
    elems.append(Paragraph(_md_to_rl(section.title), styles[style_key]))

    if section.body:
        elems.append(Paragraph(_md_to_rl(section.body), styles["body"]))

    if section.bullets:
        for b in section.bullets:
            elems.append(Paragraph("• " + _md_to_rl(b), styles["bullet"]))
        elems.append(Spacer(1, 0.3 * cm))

    # Insights
    for ins in section.insights or []:
        elems.extend(_render_insight(ins, styles))

    # Table
    if section.table:
        elems.extend(_render_table(section.table, styles))

    # Subsections
    for sub in section.subsections or []:
        elems.append(Spacer(1, 0.3 * cm))
        elems.extend(_render_section(sub, styles, level=level + 1))

    elems.append(Spacer(1, 0.4 * cm))
    return elems


def _render_insight(ins: dict[str, Any], styles: dict) -> list:
    sev = ins.get("severity", "info")
    color = SEVERITY_COLOR.get(sev, SEVERITY_COLOR["info"])

    title = _md_to_rl(ins.get("title", ""))
    msg = _md_to_rl(ins.get("message", ""))
    sug = _md_to_rl(ins.get("suggestion") or "")

    body = f'<b><font color="{color.hexval()}">■ {title.upper()}</font></b><br/><br/>{msg}'
    if sug:
        body += f'<br/><br/><b>💡 Action Stratégique Recommandée :</b> <font color="#374151">{sug}</font>'

    p = Paragraph(body, ParagraphStyle(
        "Ins", parent=styles["body"], fontSize=10, leading=14,
        leftIndent=8, borderColor=color, borderWidth=0,
        spaceBefore=4, spaceAfter=6,
    ))
    return [
        Table([[p]], colWidths=[16.5 * cm], style=TableStyle([
            ("LINEBEFORE", (0, 0), (0, -1), 3, color),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ])),
        Spacer(1, 0.2 * cm),
    ]


def _render_table(table_data: dict, styles: dict) -> list:
    headers = table_data.get("headers", [])
    rows = table_data.get("rows", [])
    if not rows:
        return []
    data = [headers] + rows

    n_cols = len(headers)
    col_w = (17 * cm) / max(n_cols, 1)

    t = Table(data, colWidths=[col_w] * n_cols, repeatRows=1)
    t.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BACKGROUND", (0, 0), (-1, 0), ACCENT),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f3f4f6")]),
        ("LINEBELOW", (0, -1), (-1, -1), 0.5, GRAY_LIGHT),
    ]))
    return [t, Spacer(1, 0.4 * cm)]


# ── Header / Footer ──────────────────────────────────────────────────────


def _header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(GRAY_LIGHT)
    # Footer
    canvas.drawString(2 * cm, 1.2 * cm, "Rapport Analytique — OpenStats")
    canvas.drawRightString(19 * cm, 1.2 * cm, f"Page {doc.page}")
    # Top bar
    canvas.setStrokeColor(ACCENT)
    canvas.setLineWidth(2)
    canvas.line(2 * cm, 28 * cm, 19 * cm, 28 * cm)
    canvas.restoreState()

def _cover_bg(canvas, doc):
    """Dessine le bloc de couleur massif sur la page de garde."""
    canvas.saveState()
    # Bloc bleu nuit
    canvas.setFillColor(SECONDARY)
    canvas.rect(0, doc.height + doc.bottomMargin - 12*cm, A4[0], 16*cm, stroke=0, fill=1)
    
    # Ligne d'accentuation cyan en bas du bloc
    canvas.setFillColor(ACCENT)
    canvas.rect(0, doc.height + doc.bottomMargin - 12*cm, A4[0], 0.2*cm, stroke=0, fill=1)
    canvas.restoreState()


# ── Main ─────────────────────────────────────────────────────────────────


def generate_pdf(content: ReportContent) -> bytes:
    """Génère un PDF depuis un ReportContent. Retourne les bytes."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=2 * cm, rightMargin=2 * cm,
        topMargin=2 * cm, bottomMargin=2 * cm,
        title=content.title, author=content.author,
    )
    styles = _make_styles()

    story = []

    # Cover
    story.extend(_cover(content, styles))

    # Executive summary
    if content.executive_summary:
        story.append(Paragraph("Résumé exécutif", styles["h2"]))
        story.append(Paragraph(_md_to_rl(content.executive_summary), styles["body"]))
        story.append(Spacer(1, 0.5 * cm))

    # Key findings
    if content.key_findings:
        story.append(Paragraph("Faits saillants", styles["h2"]))
        for kf in content.key_findings:
            story.append(Paragraph("• " + _md_to_rl(kf), styles["bullet"]))
        story.append(Spacer(1, 0.5 * cm))

    # Outline / Plan
    if content.sections:
        story.append(Paragraph("Sommaire Analytique", styles["h2"]))
        for idx, sec in enumerate(content.sections):
            story.append(Paragraph(f"<b>{idx+1}.</b> {_md_to_rl(sec.title)}", styles["bullet"]))
        story.append(Spacer(1, 0.5 * cm))

    # Sections
    for idx, section in enumerate(content.sections):
        section.title = f"{idx+1}. {section.title}" # Prefix section titles with numbers
        story.extend(_render_section(section, styles))

    doc.build(story, onFirstPage=_cover_bg, onLaterPages=_header_footer)
    buf.seek(0)
    return buf.read()
