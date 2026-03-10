"""
Export Service — generates CSV bytes for admin cohort export.
"""

import io
import csv
from typing import List, Dict


def generate_cohort_csv(respondents: List[Dict]) -> bytes:
    """
    Generate CSV export for a cohort.

    Each row: Name, Email, Completed, Profile (Is/Should/Want),
    P/A/E/I scores for each dimension.
    """
    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        "Name", "Email", "Completed At",
        "Profile (Is)", "Profile (Should)", "Profile (Want)",
        "P (Is)", "A (Is)", "E (Is)", "I (Is)",
        "P (Should)", "A (Should)", "E (Should)", "I (Should)",
        "P (Want)", "A (Want)", "E (Want)", "I (Want)",
        "Dominant Style",
    ])

    for r in respondents:
        result = r.get("result") or {}
        scaled = result.get("scaled_scores", {})
        profile = result.get("profile", {})
        interp = result.get("interpretation", {})

        def sc(dim, role):
            return scaled.get(dim, {}).get(role, "")

        writer.writerow([
            r.get("name", ""),
            r.get("email", ""),
            r.get("completed_at", ""),
            profile.get("is", ""),
            profile.get("should", ""),
            profile.get("want", ""),
            sc("is", "P"), sc("is", "A"), sc("is", "E"), sc("is", "I"),
            sc("should", "P"), sc("should", "A"), sc("should", "E"), sc("should", "I"),
            sc("want", "P"), sc("want", "A"), sc("want", "E"), sc("want", "I"),
            ", ".join(interp.get("dominant_roles", [])),
        ])

    return output.getvalue().encode("utf-8")
