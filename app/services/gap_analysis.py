"""
Gap Analysis Service

Computes gaps between Is / Should / Want dimensions per role,
classifies severity, and generates plain-language interpretation.
"""

from typing import Dict, List

GAP_GREEN = 4   # ≤4 → aligned
GAP_AMBER = 6   # 5-6 → watch
# ≥7 → tension (red)

ROLE_NAMES = {
    "P": "Producer",
    "A": "Administrator",
    "E": "Entrepreneur",
    "I": "Integrator",
}

# External tension: Should vs Is (job expectation vs current behaviour)
# Internal tension: Is vs Want (current behaviour vs natural preference)
TENSION_DESCRIPTIONS = {
    "P": {
        "external_high": (
            "Your job demands significantly more results-driven, action-oriented "
            "behaviour than you are currently demonstrating. Consider taking on more "
            "initiative and ownership of deliverables."
        ),
        "external_low": (
            "Your current work style is more action-driven than your job requires. "
            "This extra energy can be a strength but watch for impatience with process."
        ),
        "internal_high": (
            "You are operating in a more results-focused mode than you naturally prefer. "
            "This extra effort may cause fatigue over time — look for ways to align "
            "your tasks with your natural strengths."
        ),
        "internal_low": (
            "You prefer more action and results than your current role allows. "
            "Seek opportunities for direct ownership and tangible outcomes."
        ),
    },
    "A": {
        "external_high": (
            "Your organisation expects more structured, process-oriented behaviour "
            "than you currently exhibit. Investing in systems and procedures will "
            "close this gap."
        ),
        "external_low": (
            "You are more process-focused than your role demands. While thoroughness "
            "is valuable, ensure it does not slow decision-making."
        ),
        "internal_high": (
            "Your current role requires more systematic rigour than feels natural to "
            "you. Build routines and checklists to reduce cognitive load."
        ),
        "internal_low": (
            "You have a stronger preference for structure than your current role "
            "exercises. Seek ways to bring more order and clarity to your work."
        ),
    },
    "E": {
        "external_high": (
            "Your organisation expects more entrepreneurial, visionary behaviour than "
            "you are currently showing. Look for opportunities to propose new ideas "
            "and challenge the status quo."
        ),
        "external_low": (
            "You bring more entrepreneurial energy than your role currently requires. "
            "Channel this into specific innovation projects to avoid restlessness."
        ),
        "internal_high": (
            "Your role calls for more creativity than comes naturally to you. "
            "Carve out dedicated thinking time and exposure to new perspectives."
        ),
        "internal_low": (
            "You crave more creative freedom than your current role provides. "
            "Seek stretch assignments or side projects that allow strategic thinking."
        ),
    },
    "I": {
        "external_high": (
            "Your organisation values stronger people-integration skills than you "
            "are demonstrating. Invest in relationship-building and consensus-seeking."
        ),
        "external_low": (
            "You are more people-focused than your role requires. Your relational "
            "strengths are an asset — ensure tasks and results are not secondary."
        ),
        "internal_high": (
            "Your current role demands more team-building than feels natural. "
            "Focus on active listening and involving others in decisions."
        ),
        "internal_low": (
            "You value collaboration more than your role currently provides. "
            "Seek cross-functional projects to satisfy your integrative nature."
        ),
    },
}


def compute_gaps(scaled: Dict[str, Dict[str, int]]) -> List[Dict]:
    """
    Compute gap analysis for all four PAEI roles.

    Returns list of {
      role, role_name,
      is_score, should_score, want_score,
      external_gap, internal_gap,
      external_severity, internal_severity,
      external_message, internal_message
    }
    """
    results = []
    for role in ["P", "A", "E", "I"]:
        is_score     = scaled["is"][role]
        should_score = scaled["should"][role]
        want_score   = scaled["want"][role]

        external_gap = abs(should_score - is_score)
        internal_gap = abs(is_score - want_score)

        results.append({
            "role": role,
            "role_name": ROLE_NAMES[role],
            "is_score": is_score,
            "should_score": should_score,
            "want_score": want_score,
            "external_gap": external_gap,
            "internal_gap": internal_gap,
            "external_severity": _severity(external_gap),
            "internal_severity": _severity(internal_gap),
            "external_message": _tension_message(
                role, "external", should_score - is_score
            ),
            "internal_message": _tension_message(
                role, "internal", is_score - want_score
            ),
        })
    return results


def _severity(gap: int) -> str:
    if gap <= GAP_GREEN:
        return "aligned"
    if gap <= GAP_AMBER:
        return "watch"
    return "tension"


def _tension_message(role: str, kind: str, delta: int) -> str:
    """delta > 0 means demand > actual; delta < 0 means actual > demand."""
    if abs(delta) <= GAP_GREEN:
        return "Well aligned — no significant gap."
    direction = "high" if delta > 0 else "low"
    key = f"{kind}_{direction}"
    return TENSION_DESCRIPTIONS[role].get(key, "")
