"""
Génération de rapports professionnels (PDF, DOCX, PPTX).

Style cabinet de conseil / mémoire universitaire :
- Page de garde
- Résumé exécutif
- Méthodologie
- Insights clés (priorisés)
- Graphiques
- Recommandations
- Annexes techniques
"""

from app.core.professional_report.builder import (
    ReportBuilder,
    ReportSection,
    ReportContent,
    build_report_payload,
)
from app.core.professional_report.pdf_generator import generate_pdf
from app.core.professional_report.docx_generator import generate_docx
from app.core.professional_report.pptx_generator import generate_pptx

__all__ = [
    "ReportBuilder",
    "ReportSection",
    "ReportContent",
    "build_report_payload",
    "generate_pdf",
    "generate_docx",
    "generate_pptx",
]
