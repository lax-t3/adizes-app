"""
Style Interpretation Service

Detects the dominant PAEI style from 'Want' dimension scores
and returns structured narrative text for the report.
"""

from typing import Dict, List

STYLE_DESCRIPTIONS = {
    "P": {
        "name": "Producer",
        "tagline": "The Driven Achiever",
        "strengths": (
            "You are a results-oriented doer who excels at getting things done. "
            "You are decisive, action-focused, and motivated by tangible achievements. "
            "You respond well to crisis situations and thrive on short-term goals."
        ),
        "blind_spots": (
            "Your drive for results can cause you to overlook the big picture or "
            "dismiss process and people considerations. Slowing down to listen and "
            "plan strategically will amplify your effectiveness significantly."
        ),
        "working_with_others": (
            "Administrators may feel you move too fast; give them space for due diligence. "
            "Entrepreneurs respect your execution — partner with them to balance vision "
            "with delivery. Integrators need your acknowledgment — a word of appreciation "
            "goes a long way."
        ),
    },
    "A": {
        "name": "Administrator",
        "tagline": "The Reliable Architect",
        "strengths": (
            "You bring discipline, consistency, and rigour to everything you touch. "
            "Your ability to create systems, maintain standards, and catch errors "
            "before they become problems makes you invaluable in any organisation."
        ),
        "blind_spots": (
            "Your preference for process and precedent can slow adaptation to change. "
            "Trust that not every decision requires a procedure — learn to tolerate "
            "calculated ambiguity and speed."
        ),
        "working_with_others": (
            "Producers can seem reckless to you — channel their energy by building "
            "systems they can operate within. Entrepreneurs need freedom; set boundaries "
            "without stifling. Integrators are natural allies — collaborate on culture "
            "and communication."
        ),
    },
    "E": {
        "name": "Entrepreneur",
        "tagline": "The Visionary Catalyst",
        "strengths": (
            "You see possibilities others miss and have the courage to pursue them. "
            "Your creativity, charisma, and willingness to take risks make you a "
            "powerful driver of innovation and change."
        ),
        "blind_spots": (
            "Ideas without follow-through create chaos. Your shifting priorities can "
            "frustrate those around you. Build trust by completing initiatives before "
            "launching new ones, and respect the implementation effort your team invests."
        ),
        "working_with_others": (
            "Producers are your best implementers — respect their need for clear "
            "direction. Administrators ground your ideas in reality; listen to their "
            "cautions. Integrators help you read the room — consult them before "
            "announcing big changes."
        ),
    },
    "I": {
        "name": "Integrator",
        "tagline": "The Cohesive Shepherd",
        "strengths": (
            "You are the glue that holds teams together. Your empathy, listening skills, "
            "and ability to build consensus create psychologically safe environments "
            "where people do their best work."
        ),
        "blind_spots": (
            "Avoiding conflict can delay necessary decisions and leave problems "
            "unresolved. Developing the ability to deliver hard truths with care — "
            "and standing firm when consensus is impossible — will make you a "
            "more effective leader."
        ),
        "working_with_others": (
            "Producers can seem insensitive — help them understand the human impact "
            "of their decisions. Administrators appreciate your consistency; partner "
            "to build team culture. Entrepreneurs need your political savvy — help "
            "them bring others along on the journey."
        ),
    },
}

# Combined style descriptions for dual-dominant profiles
COMBINED_STYLES = {
    frozenset(["P", "A"]): "The Systematic Executor — you deliver results with rigour and control.",
    frozenset(["P", "E"]): "The Entrepreneurial Driver — you generate bold ideas and execute them relentlessly.",
    frozenset(["P", "I"]): "The People-Powered Achiever — you get results by bringing the best out of others.",
    frozenset(["A", "E"]): "The Innovative Organiser — you vision the future and build the systems to get there.",
    frozenset(["A", "I"]): "The Steady Team Builder — you create stable, process-driven cultures where people thrive.",
    frozenset(["E", "I"]): "The Inspiring Visionary — you see the future and bring people on the journey with passion.",
    frozenset(["P", "A", "E"]): "The Versatile Leader — strong across execution, process, and innovation.",
    frozenset(["P", "A", "I"]): "The Complete Manager — balanced across results, systems, and people.",
    frozenset(["P", "E", "I"]): "The Dynamic Leader — entrepreneurial, results-driven, and people-centered.",
    frozenset(["A", "E", "I"]): "The Balanced Strategist — innovative yet organised, with strong people sense.",
}


def interpret(scaled_scores: Dict[str, Dict[str, int]], profile: Dict[str, str]) -> Dict:
    """
    Generate interpretation based on 'Want' dimension dominant roles.

    Returns {
      dominant_roles: list,
      style_label: str,
      style_tagline: str,
      strengths: str,
      blind_spots: str,
      working_with_others: str,
      combined_description: str | None,
      mismanagement_risks: list[str]
    }
    """
    want_scores = scaled_scores["want"]
    dominant = [r for r in ["P", "A", "E", "I"] if want_scores[r] > 30]

    if not dominant:
        # Fall back to highest scorer
        dominant = [max(want_scores, key=want_scores.get)]

    # Primary role = highest Want score
    primary = max(dominant, key=lambda r: want_scores[r])
    desc = STYLE_DESCRIPTIONS[primary]

    combined_desc = None
    if len(dominant) > 1:
        key = frozenset(dominant[:2])
        combined_desc = COMBINED_STYLES.get(key)

    mismanagement_risks = [
        _mismanagement_label(r) for r in dominant
    ]

    return {
        "dominant_roles": dominant,
        "style_label": desc["name"],
        "style_tagline": desc["tagline"],
        "strengths": desc["strengths"],
        "blind_spots": desc["blind_spots"],
        "working_with_others": desc["working_with_others"],
        "combined_description": combined_desc,
        "mismanagement_risks": mismanagement_risks,
    }


def _mismanagement_label(role: str) -> str:
    labels = {
        "P": "Lone Ranger — may become a domineering, go-it-alone bulldozer under stress.",
        "A": "Bureaucrat — may become overly rigid, inflexible, and change-resistant under stress.",
        "E": "Arsonist — may become impractical, chaotic, and idea-without-delivery under stress.",
        "I": "Super-Follower — may become conflict-avoidant and politically spineless under stress.",
    }
    return labels.get(role, "")
