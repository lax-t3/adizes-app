"""
PDF Report Service

Renders the full AMSI report as HTML via Jinja2,
then converts to PDF using WeasyPrint.
"""

import os
from pathlib import Path
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

TEMPLATE_DIR = Path(__file__).parent.parent.parent / "templates"


def generate_pdf(assessment_data: dict) -> bytes:
    env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)))
    template = env.get_template("report.html")

    html_content = template.render(
        user_name=_get_user_name(assessment_data),
        completed_at=assessment_data.get("completed_at", "")[:10],
        profile=assessment_data.get("profile", {}),
        scaled=assessment_data.get("scaled_scores", {}),
        gaps=assessment_data.get("gaps", []),
        interpretation=assessment_data.get("interpretation", {}),
    )

    pdf_bytes = HTML(string=html_content).write_pdf()
    return pdf_bytes


def _get_user_name(data: dict) -> str:
    users = data.get("users") or {}
    return users.get("name", "Participant")
