"""
Style Interpretation Service (v2)

Detects dominant roles from the 'Current State' (is) dimension (raw score > 33).
Generates narrative content for all 5 PDF pages and the frontend results view.
"""

from typing import Dict, List, Optional

STYLE_DESCRIPTIONS = {
    "P": {
        "name":    "Producer",
        "tagline": "The Driven Achiever",
        "strengths": (
            "You are a results-oriented doer who excels at getting things done. "
            "Decisive, action-focused, and motivated by tangible achievements — you "
            "respond well to crisis and thrive on short-term goals."
        ),
        "watchouts": (
            "Your drive for results can cause you to overlook the big picture or "
            "dismiss process and people considerations. Slowing down to listen and "
            "plan strategically will amplify your effectiveness."
        ),
        "working_with_others": (
            "Administrators may feel you move too fast — give them space for due diligence. "
            "Entrepreneurs respect your execution — partner with them to balance vision "
            "with delivery. Integrators need acknowledgment — a word of appreciation goes a long way."
        ),
        "at_your_best": (
            "You are channelling decisive, results-focused energy. You set clear targets, "
            "move fast, and create momentum that others can follow. Your clarity of purpose "
            "is contagious right now. Your P dimension is firing on all cylinders."
        ),
        "friction_shows_up": (
            "You may be perceived as pushing too hard for results at the expense of process "
            "and people — or not pushing hard enough when the situation demands it. "
            "The P dimension is under pressure."
        ),
        "under_stress": (
            "Dictator Trap (P - Stressor) — under prolonged stress you may become a domineering, go-it-alone "
            "bulldozer: bypassing others, dismissing input, and over-relying on your own execution."
        ),
    },
    "A": {
        "name":    "Administrator",
        "tagline": "The Reliable Architect",
        "strengths": (
            "You bring discipline, consistency, and rigour to everything you touch. "
            "Your ability to create systems, maintain standards, and catch errors before "
            "they become problems makes you invaluable in any organisation."
        ),
        "watchouts": (
            "Your preference for process and precedent can slow adaptation to change. "
            "Trust that not every decision requires a procedure — learn to tolerate "
            "calculated ambiguity and speed."
        ),
        "working_with_others": (
            "Producers can seem reckless to you — channel their energy by building systems "
            "they can operate within. Entrepreneurs need freedom; set boundaries without stifling. "
            "Integrators are natural allies — collaborate on culture and communication."
        ),
        "at_your_best": (
            "Your systematic and orderly nature is working at full capacity. You are "
            "creating reliability and precision that the team depends on. Structure that "
            "seemed rigid is now the scaffold everyone is grateful for. Your A dimension is firing on all cylinders."
        ),
        "friction_shows_up": (
            "Resistance can surface when structure feels forced on others — or when lack of "
            "structure creates confusion. Your A dimension is under pressure and the gap "
            "between expectation and reality is showing."
        ),
        "under_stress": (
            "Perfectionist Trap (A - Stressor) — under prolonged stress you may become overly rigid, inflexible, "
            "and change-resistant: defending process for its own sake and blocking progress."
        ),
    },
    "E": {
        "name":    "Entrepreneur",
        "tagline": "The Visionary Catalyst",
        "strengths": (
            "You see possibilities others miss and have the courage to pursue them. "
            "Your creativity, charisma, and willingness to take risks make you a "
            "powerful driver of innovation and change."
        ),
        "watchouts": (
            "Ideas without follow-through create chaos. Your shifting priorities can "
            "frustrate those around you. Build trust by completing initiatives before "
            "launching new ones, and respect the implementation effort your team invests."
        ),
        "working_with_others": (
            "Producers are your best implementers — respect their need for clear direction. "
            "Administrators ground your ideas in reality; listen to their cautions. "
            "Integrators help you read the room — consult them before announcing big changes."
        ),
        "at_your_best": (
            "Your creative, strategic radar is fully engaged. You are seeing opportunities "
            "others miss and generating ideas that challenge the status quo. Your energy "
            "is infectious and people are following your lead. Your E dimension is firing on all cylinders."
        ),
        "friction_shows_up": (
            "Creative energy that isn't channelled can come across as distraction or "
            "unfulfilled promises. Or the absence of innovation may frustrate you when "
            "the role needs it. The E dimension is under pressure."
        ),
        "under_stress": (
            "Know-It-All Trap (E - Stressor) — under prolonged stress you may become impractical, chaotic, and "
            "idea-without-delivery: starting fires, abandoning initiatives, and demoralising "
            "those tasked with execution."
        ),
    },
    "I": {
        "name":    "Integrator",
        "tagline": "The Cohesive Shepherd",
        "strengths": (
            "You are the glue that holds teams together. Your empathy, listening skills, "
            "and ability to build consensus create psychologically safe environments "
            "where people do their best work."
        ),
        "watchouts": (
            "Avoiding conflict can delay necessary decisions and leave problems unresolved. "
            "Developing the ability to deliver hard truths with care — and standing firm "
            "when consensus is impossible — will make you a more effective leader."
        ),
        "working_with_others": (
            "Producers can seem insensitive — help them understand the human impact of their "
            "decisions. Administrators appreciate your consistency; partner to build team culture. "
            "Entrepreneurs need your political savvy — help them bring others along on the journey."
        ),
        "at_your_best": (
            "Your empathy and listening are at their most effective. You are creating trust, "
            "resolving tensions, and holding the group together. The team is performing better "
            "because you are in the room. Your I dimension is firing on all cylinders."
        ),
        "friction_shows_up": (
            "Friction emerges when team cohesion is under stress — either from too much focus "
            "on harmony at the cost of results, or from insufficient relationship investment. "
            "The I dimension is under pressure."
        ),
        "under_stress": (
            "Harmony Trap (I - Stressor) — under prolonged stress you may become conflict-avoidant and "
            "politically spineless: giving vague answers, deferring to the loudest voice, "
            "and sacrificing honesty for the sake of harmony."
        ),
    },
}

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

# Early warning signs — directional narrative keyed by (role, gap_type, direction)
# direction: "high" = signed gap > 0 (first lens > second); "low" = signed < 0
EARLY_WARNINGS = {
    "P": {
        "execution_high":     "Your role is demanding more hands-on delivery than you're used to giving. Watch for impatience, a shorter fuse, or a creeping sense of burnout as you push to keep up.",
        "execution_low":      "You're putting more drive into getting things done than the role actually needs. That extra push can spill over as restlessness — redirect it toward something that genuinely calls for your energy.",
        "authenticity_high":  "You've been running in high-output mode for longer than feels natural to you. The fatigue builds slowly and quietly, so start looking for things to hand off before it catches up with you.",
        "authenticity_low":   "You're holding back your natural drive for results. Over time this can feel like frustration or a loss of purpose — as if you're not doing the work you're built for.",
    },
    "A": {
        "execution_high":     "Your role is asking for more structure and process than feels natural right now. Watch for rigidity, over-checking, or decisions slowing down as you try to keep everything in order.",
        "execution_low":      "You're delivering less process and rigour than the role expects. Small gaps in systems or quality may be starting to show — worth tightening before they grow.",
        "authenticity_high":  "You're maintaining more order and discipline than comes naturally, and that carries a quiet mental cost. Build templates and checklists so the structure runs itself instead of leaning on you.",
        "authenticity_low":   "Your instinct for order is being held back. Disorder or inefficiency may be creeping in around you without you noticing it at first.",
    },
    "E": {
        "execution_high":     "Your role needs more fresh thinking and initiative than you're currently bringing. Watch for an idea drought, or for quietly steering away from the creative parts of the work.",
        "execution_low":      "You have more creative energy than the role can absorb right now. To others this can look like restlessness or scattered priorities — channel it into one clear project with a defined outcome.",
        "authenticity_high":  "You're generating ideas because the role demands it, not because the spark is there. That slow drain is real, so protect your creative reserves and pace yourself.",
        "authenticity_low":   "Your strategic, big-picture instincts are going unused. This can build into frustration with day-to-day constraints and a gradual loss of meaning in the work.",
    },
    "I": {
        "execution_high":     "Your role needs more investment in people and relationships than you're currently giving. Watch for relationship debt quietly building up as the pace crowds out genuine connection.",
        "execution_low":      "You're investing more in harmony and relationships than the role calls for. Be careful this doesn't tip into people-pleasing at the expense of getting results.",
        "authenticity_high":  "You're doing more consensus-building and smoothing-over than feels natural, and it's wearing you down. It's okay to set limits on how much you absorb on behalf of others.",
        "authenticity_low":   "Your instinct to connect and support people is being held back. Team cohesion can weaken quietly until it suddenly becomes visible — keep an eye on the relationships around you.",
    },
}

EXECUTIVE_SUMMARIES = {
    "P": (
        "{name}, you are wired as a Producer — a decisive, results-driven leader who "
        "creates momentum that others can follow. Right now, something is creating friction "
        "between the energy you bring and what the role is drawing out of you. "
        "This report shows you exactly where that tension is and what to do about it."
    ),
    "A": (
        "{name}, you are wired as an Administrator — a disciplined, systematic thinker "
        "who builds the reliability that organisations depend on. Your data shows a gap "
        "between how you operate and what the role is asking of you. "
        "This report pinpoints where that pressure is concentrated and how to respond."
    ),
    "E": (
        "{name}, you are wired as an Entrepreneur — a strategic, creative thinker who "
        "sees possibilities others miss. Right now, your day-to-day behaviour is not fully "
        "expressing that instinct. The gap between what you do and what energises you is "
        "significant. This report shows where those tensions are and what to do about them."
    ),
    "I": (
        "{name}, you are wired as an Integrator — the leader who builds the trust and "
        "connection that make teams perform. Your profile shows a gap between how you "
        "invest in people and what the role is currently calling for. "
        "This report shows you where alignment is strongest and where to focus next."
    ),
}

DAILY_FEEL = {
    "P": {
        "execution": (
            "You may find yourself moving fast but feeling unsatisfied — delivering results "
            "your role needs, yet sensing the effort is unsustainable at this pace."
        ),
        "engagement": (
            "You may feel pulled between what you want to produce and what the role "
            "actually rewards — like running hard in the wrong direction."
        ),
        "authenticity": (
            "You may notice a quiet disconnect — doing what the role expects, but not "
            "feeling like it reflects your natural way of working."
        ),
    },
    "A": {
        "execution": (
            "You may feel the weight of maintaining standards while others move past them — "
            "holding the line costs energy when the environment pushes against it."
        ),
        "engagement": (
            "You may sense that the structure you want to build is not what the role "
            "rewards — your instinct for order is undervalued or overspent."
        ),
        "authenticity": (
            "You may find yourself operating with less discipline than feels right — "
            "cutting corners that quietly bother you, or over-engineering what doesn't need it."
        ),
    },
    "E": {
        "execution": (
            "You may find yourself in process-heavy meetings thinking 'we should be building "
            "something new.' That restlessness is real data — your entrepreneurial instinct "
            "is looking for an outlet the role isn't providing."
        ),
        "engagement": (
            "You may feel your best ideas are underused — bringing creative energy to a role "
            "that rewards execution, leaving your strategic instincts frustrated."
        ),
        "authenticity": (
            "You may notice you are performing more innovation than you feel — generating "
            "ideas because the role demands it, while the internal creative drive has quietened."
        ),
    },
    "I": {
        "execution": (
            "You may feel the relational fabric around you fraying — your instinct says "
            "invest in people, but the role's pace is leaving less room for that."
        ),
        "engagement": (
            "You may sense that the connecting and listening you want to do is being "
            "crowded out by task demands — integration is needed but not rewarded."
        ),
        "authenticity": (
            "You may find yourself going through relationship motions without the genuine "
            "warmth behind them — performing cohesion rather than feeling it."
        ),
    },
}

def interpret(
    raw_scores: Dict[str, Dict[str, int]],
    profile: Dict[str, str],
    gaps: Optional[List[Dict]] = None,
    user_name: str = "",
) -> Dict:
    """
    Generate interpretation for the 5-page report and frontend results view.

    Args:
        raw_scores: {is:{P,A,E,I}, should:{P,A,E,I}, want:{P,A,E,I}} — 132-scale
        profile:    {is: "paEI", ...}
        gaps:       output of compute_gaps() — optional, used for Pages 3/4 content

    Returns:
        Dict with all fields for frontend display and PDF generation.
    """
    # Dominant PAEI code is derived from the Current State (is) lens — how the
    # person actually behaves today — not from My Natural Preference (want).
    is_scores = raw_scores["is"]
    dominant = [r for r in ["P", "A", "E", "I"] if is_scores[r] > 33]

    if not dominant:
        dominant = [max(is_scores, key=is_scores.get)]

    primary = max(dominant, key=lambda r: is_scores[r])
    desc = STYLE_DESCRIPTIONS[primary]

    combined_desc = None
    if len(dominant) > 1:
        key = frozenset(dominant[:2])
        combined_desc = COMBINED_STYLES.get(key)

    identity_line = _build_identity_line(dominant, combined_desc)

    mismanagement_risks = [STYLE_DESCRIPTIONS[r]["under_stress"] for r in dominant]

    # Pages 3-4 content (requires gaps)
    at_your_best     = desc["at_your_best"]
    friction_shows_up = desc["friction_shows_up"]
    early_warnings   = []

    if gaps:
        from app.services.gap_analysis import get_top_gaps
        top_gaps = get_top_gaps(gaps, n=3)

        # at_your_best: from the most aligned role (lowest peak gap)
        peak_gap_per_role = {}
        for g in gaps:
            peak = max(g["execution_gap"], g["engagement_gap"], g["authenticity_gap"])
            peak_gap_per_role[g["role"]] = peak
        most_aligned_role = min(peak_gap_per_role, key=peak_gap_per_role.get)
        at_your_best = STYLE_DESCRIPTIONS[most_aligned_role]["at_your_best"]

        # friction_shows_up: from the highest-gap role
        most_stressed_role = max(peak_gap_per_role, key=peak_gap_per_role.get)
        friction_shows_up = STYLE_DESCRIPTIONS[most_stressed_role]["friction_shows_up"]

        # early_warnings: from signed direction of top 3 gaps
        for tg in top_gaps:
            role = tg["role"]
            gap_type = tg["gap_type"]
            direction = "high" if tg["gap_signed"] >= 0 else "low"
            key = f"{gap_type}_{direction}"
            warning = EARLY_WARNINGS.get(role, {}).get(key, "")
            if warning and warning not in early_warnings:
                early_warnings.append(warning)

    return {
        "dominant_roles":     dominant,
        "identity_line":      identity_line,
        "style_label":        desc["name"],
        "style_tagline":      desc["tagline"],
        "strengths":          desc["strengths"],
        "watchouts":          desc["watchouts"],
        "working_with_others": desc["working_with_others"],
        "combined_description": combined_desc,
        "mismanagement_risks": mismanagement_risks,
        "at_your_best":        at_your_best,
        "friction_shows_up":   friction_shows_up,
        "early_warnings":      early_warnings,
        "executive_summary":    EXECUTIVE_SUMMARIES[primary].format(name=_first_name(user_name)),
        "daily_feel":           DAILY_FEEL,
    }


def _build_identity_line(dominant: List[str], combined_desc: Optional[str]) -> str:
    if combined_desc:
        prefix = combined_desc.split(" — ")[0].replace("The ", "")
        roles_str = "–".join(dominant[:2])
        return f"{prefix} — {roles_str} Dominant"
    elif len(dominant) == 1:
        desc = STYLE_DESCRIPTIONS[dominant[0]]
        return f"{desc['name']} — {desc['tagline']}"
    else:
        return "Adaptive Style — Balanced Profile"


def _mismanagement_label(role: str) -> str:
    return STYLE_DESCRIPTIONS[role]["under_stress"]


def _first_name(user_name: str) -> str:
    name = (user_name or "").strip()
    if not name:
        return "Your profile"
    return name.split()[0]
