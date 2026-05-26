"""
Gap Analysis Service (v2: 3 gap types, 132-scale thresholds)

Three gap types per PAEI role:
  Execution Gap  = SHOULD − IS   (role demand vs current behaviour)
  Engagement Gap = SHOULD − WANT (role demand vs natural preference)
  Authenticity Gap = IS − WANT   (current behaviour vs natural preference)

Severity thresholds (132 scale):
  < 6   → low    (not displayed)
  6–15  → medium (🟡 MODERATE)
  > 15  → high   (🔴 HIGH)
"""

from typing import Dict, List

ROLE_NAMES = {"P": "Producer", "A": "Administrator", "E": "Entrepreneur", "I": "Integrator"}

GAP_TYPES = ["execution", "engagement", "authenticity"]

# Direction-aware narrative library — keyed by (role, gap_type, direction)
# direction: "high" = first lens > second lens; "low" = second lens > first lens
NARRATIVES: Dict[str, Dict[str, Dict[str, str]]] = {
    "P": {
        "execution": {
            "high": "Your role demands significantly more results-driven, action-oriented behaviour than you are currently demonstrating. Consider proactively taking direct ownership of critical deliverables.",
            "low":  "You are operating in a more execution-focused mode than your role currently requires. This extra drive is an asset — ensure it doesn't create impatience with those who move at a different pace.",
        },
        "engagement": {
            "high": "Your role requires more results-oriented energy than you naturally prefer to sustain. Look for ways to delegate high-urgency tasks to those who find them energising.",
            "low":  "Your natural drive for results exceeds what your role currently demands. Channel this into stretch initiatives or areas where direct ownership adds the most value.",
        },
        "authenticity": {
            "high": "You are currently operating in a more action-focused mode than you naturally prefer. This sustained adaptation may create fatigue over time — look for opportunities to reset.",
            "low":  "Your natural preference for results and decisive action is not fully expressed in your current behaviour. Find one area where you can take full, visible ownership.",
        },
    },
    "A": {
        "execution": {
            "high": "Your role expects more structured, process-oriented behaviour than you currently exhibit. Investing in systems and checklists will close this gap.",
            "low":  "You are more process-focused than your role demands. While thoroughness is valuable, watch for over-engineering that slows decision-making.",
        },
        "engagement": {
            "high": "Your role requires more systematic rigour than feels natural to you. Build templates and routines to carry the structural load.",
            "low":  "Your natural preference for structure exceeds what your role requires. Channel this into areas that genuinely need more order and clarity.",
        },
        "authenticity": {
            "high": "You are currently operating with more administrative rigour than your natural preference. Sustained adaptation here creates cognitive overhead — look for templates that reduce the manual effort.",
            "low":  "Your preference for structure and process is not fully expressed in your current behaviour. Bring your A-instincts to an area that currently lacks clarity.",
        },
    },
    "E": {
        "execution": {
            "high": "Your role demands significantly more entrepreneurial, visionary energy than you are currently showing. Look for opportunities to propose ideas and challenge the status quo.",
            "low":  "You bring more entrepreneurial energy than your role currently requires. Channel this into a specific innovation project with a clear outcome.",
        },
        "engagement": {
            "high": "Your role requires more creative and forward-looking thinking than you naturally gravitate toward. Block dedicated time for exploratory thinking.",
            "low":  "You carry more entrepreneurial instinct than your role currently channels. Seek assignments that let you operate at that strategic level.",
        },
        "authenticity": {
            "high": "You are currently performing at a higher creative intensity than your natural preference. This sustained E-behaviour without intrinsic energy is a slow drain.",
            "low":  "Your entrepreneurial instincts are underexpressed in your current behaviour. Choose one initiative where you can operate at your natural strategic and creative level.",
        },
    },
    "I": {
        "execution": {
            "high": "Your organisation values stronger people-integration skills than you are currently demonstrating. Invest in relationship-building and consensus-seeking with key stakeholders.",
            "low":  "You are more people-focused than your role demands. Your relational strengths are an asset — ensure tasks and results don't become secondary.",
        },
        "engagement": {
            "high": "Your role demands more people-investment than feels instinctive. Prioritise a small number of key relationships rather than spreading thin.",
            "low":  "You have stronger integrative instincts than your role currently exercises. Bring them to cross-functional or collaborative projects.",
        },
        "authenticity": {
            "high": "You are currently investing more in team cohesion than your natural preference. Consensus-seeking beyond your natural level becomes a drain — set boundaries.",
            "low":  "Your preference for connection and collaboration is not fully expressed in current behaviour. Seek a project where team cohesion is the critical success factor.",
        },
    },
}


def compute_gaps(raw: Dict[str, Dict[str, int]]) -> List[Dict]:
    """
    Compute all three gap types for each PAEI role.

    Args:
        raw: {is:{P,A,E,I}, should:{P,A,E,I}, want:{P,A,E,I}} — 132-scale scores

    Returns:
        List of 4 dicts, one per role:
        {role, role_name, is_score, should_score, want_score,
         execution_gap, execution_gap_signed, execution_severity, execution_narrative,
         engagement_gap, engagement_gap_signed, engagement_severity, engagement_narrative,
         authenticity_gap, authenticity_gap_signed, authenticity_severity, authenticity_narrative}
    """
    results = []
    for role in ["P", "A", "E", "I"]:
        is_s     = raw["is"][role]
        should_s = raw["should"][role]
        want_s   = raw["want"][role]

        exec_signed   = should_s - is_s
        engage_signed = should_s - want_s
        auth_signed   = is_s - want_s

        results.append({
            "role":       role,
            "role_name":  ROLE_NAMES[role],
            "is_score":     is_s,
            "should_score": should_s,
            "want_score":   want_s,

            "execution_gap":         abs(exec_signed),
            "execution_gap_signed":  exec_signed,
            "execution_severity":    _severity(abs(exec_signed)),
            "execution_narrative":   _narrative(role, "execution", exec_signed),

            "engagement_gap":        abs(engage_signed),
            "engagement_gap_signed": engage_signed,
            "engagement_severity":   _severity(abs(engage_signed)),
            "engagement_narrative":  _narrative(role, "engagement", engage_signed),

            "authenticity_gap":         abs(auth_signed),
            "authenticity_gap_signed":  auth_signed,
            "authenticity_severity":    _severity(abs(auth_signed)),
            "authenticity_narrative":   _narrative(role, "authenticity", auth_signed),
        })
    return results


def get_top_gaps(gaps: List[Dict], n: int = 3) -> List[Dict]:
    """
    Return the top N gaps by absolute magnitude across all roles and types.

    Each returned item: {role, role_name, gap_type, gap_abs, gap_signed,
                          severity, narrative, is_score, should_score, want_score}
    """
    all_gaps = []
    for g in gaps:
        for gap_type in GAP_TYPES:
            all_gaps.append({
                "role":       g["role"],
                "role_name":  g["role_name"],
                "gap_type":   gap_type,
                "gap_abs":    g[f"{gap_type}_gap"],
                "gap_signed": g[f"{gap_type}_gap_signed"],
                "severity":   g[f"{gap_type}_severity"],
                "narrative":  g[f"{gap_type}_narrative"],
                "is_score":     g["is_score"],
                "should_score": g["should_score"],
                "want_score":   g["want_score"],
            })
    return sorted(all_gaps, key=lambda x: x["gap_abs"], reverse=True)[:n]


def _severity(gap: int) -> str:
    if gap < 6:
        return "low"
    if gap <= 15:
        return "medium"
    return "high"


def _narrative(role: str, gap_type: str, signed: int) -> str:
    direction = "high" if signed >= 0 else "low"
    return NARRATIVES.get(role, {}).get(gap_type, {}).get(direction, "")
