"""
PAEI Scoring Engine

Each of the 36 questions has 4 options. Each option maps to one PAEI role.
The assessment has 3 sections (dimensions):
  - Section 0: Is       (Q1–Q12)   — how you currently operate
  - Section 1: Should   (Q13–Q24)  — what the job demands
  - Section 2: Want     (Q25–Q36)  — your inner preference

Scoring:
  - Count selections per role per dimension → raw score (max 12)
  - Scale to 0–50: scaled = round(raw / 12 * 50)
  - Dominant trait: scaled score > 30 → capital letter (P), else lowercase (p)
"""

from typing import Dict, List

# Mapping: question_index (0-based) → { option_key: paei_role }
# option_key matches the 'option_key' stored in DB ('a','b','c','d')
SCORING_KEY: Dict[int, Dict[str, str]] = {
    # ── Section 0: Is (Q1–Q12) ────────────────────────────────────────────────
    0:  {"a": "I", "b": "P", "c": "E", "d": "A"},  # What colleagues value most
    1:  {"a": "P", "b": "A", "c": "I", "d": "E"},  # I want to be praised because
    2:  {"a": "A", "b": "P", "c": "E", "d": "I"},  # Heroes in our org
    3:  {"a": "E", "b": "A", "c": "P", "d": "I"},  # New job, most important
    4:  {"a": "P", "b": "A", "c": "E", "d": "I"},  # Day-to-day work, good at
    5:  {"a": "A", "b": "I", "c": "P", "d": "E"},  # Corporate culture
    6:  {"a": "I", "b": "E", "c": "A", "d": "P"},  # Most important for daily op
    7:  {"a": "E", "b": "A", "c": "P", "d": "I"},  # I spend most of my time
    8:  {"a": "A", "b": "P", "c": "E", "d": "I"},  # Spare time at work
    9:  {"a": "P", "b": "I", "c": "A", "d": "E"},  # My job is characterized by
    10: {"a": "I", "b": "A", "c": "E", "d": "P"},  # Closest colleagues think I am
    11: {"a": "I", "b": "E", "c": "P", "d": "A"},  # Perfect world job

    # ── Section 1: Should (Q13–Q24) ───────────────────────────────────────────
    12: {"a": "A", "b": "I", "c": "E", "d": "P"},  # Position in team, should be
    13: {"a": "A", "b": "P", "c": "E", "d": "I"},  # Superiors' demands
    14: {"a": "A", "b": "E", "c": "P", "d": "I"},  # A good day for me
    15: {"a": "I", "b": "A", "c": "E", "d": "P"},  # I need to feel that
    16: {"a": "P", "b": "I", "c": "A", "d": "E"},  # What I want others to notice
    17: {"a": "E", "b": "A", "c": "I", "d": "P"},  # Kind of new job
    18: {"a": "I", "b": "P", "c": "E", "d": "A"},  # Most important areas of resp
    19: {"a": "P", "b": "A", "c": "I", "d": "E"},  # Most important when deciding
    20: {"a": "A", "b": "P", "c": "E", "d": "I"},  # Most important aspect of job
    21: {"a": "E", "b": "A", "c": "P", "d": "I"},  # In my job I am good at
    22: {"a": "P", "b": "A", "c": "E", "d": "I"},  # Attitude toward dev work
    23: {"a": "A", "b": "I", "c": "P", "d": "E"},  # Most important reason to delay

    # ── Section 2: Want (Q25–Q36) ─────────────────────────────────────────────
    24: {"a": "P", "b": "I", "c": "E", "d": "A"},  # My job requires me to
    25: {"a": "I", "b": "E", "c": "A", "d": "P"},  # Kinds of tasks I like
    26: {"a": "A", "b": "P", "c": "E", "d": "I"},  # Most important quality
    27: {"a": "P", "b": "I", "c": "A", "d": "E"},  # Person taking over should like
    28: {"a": "I", "b": "A", "c": "E", "d": "P"},  # Deep down I see myself
    29: {"a": "P", "b": "E", "c": "I", "d": "A"},  # What pleases me most
    30: {"a": "A", "b": "I", "c": "P", "d": "E"},  # Type of work for satisfaction
    31: {"a": "P", "b": "E", "c": "A", "d": "I"},  # Managers praised for
    32: {"a": "E", "b": "P", "c": "I", "d": "A"},  # I want to be thought of
    33: {"a": "I", "b": "A", "c": "P", "d": "E"},  # What characterizes me in mtgs
    34: {"a": "P", "b": "E", "c": "A", "d": "I"},  # Colleagues expect me to
    35: {"a": "I", "b": "P", "c": "A", "d": "E"},  # Greatest concern in daily work
}

SECTIONS = ["is", "should", "want"]
ROLES = ["P", "A", "E", "I"]
DOMINANT_THRESHOLD = 30  # scaled score above this → dominant


def score_answers(answers: List[Dict]) -> Dict:
    """
    Score a completed ranking assessment (v2: rank-order, 12–48 scale).

    Args:
        answers: list of { question_index: int, ranks: {a:int, b:int, c:int, d:int} }
                 ranks values must be a permutation of {1,2,3,4}
                 rank 1 = most preferred (4 pts), rank 4 = least preferred (1 pt)

    Returns:
        {
          "raw":     { "is": {P,A,E,I}, ... }  -- raw 12-48 totals (same as scaled)
          "scaled":  { "is": {P,A,E,I}, ... }  -- 12-48 values (no scaling applied)
          "profile": { "is": "paEI", ... }
        }
    """
    scores = {s: {"P": 0, "A": 0, "E": 0, "I": 0} for s in SECTIONS}

    for answer in answers:
        q_idx = answer.get("question_index")
        ranks = answer.get("ranks", {})

        if q_idx not in SCORING_KEY:
            continue

        section = SECTIONS[q_idx // 12]
        q_mapping = SCORING_KEY[q_idx]   # { option_key: PAEI_role }

        for opt, rank in ranks.items():
            role = q_mapping.get(opt)
            if role and isinstance(rank, int) and 1 <= rank <= 4:
                scores[section][role] += (5 - rank)

    profile = {
        section: _build_profile_string(scores[section])
        for section in SECTIONS
    }

    return {"raw": scores, "scaled": scores, "profile": profile}


def _build_profile_string(scores: Dict[str, int]) -> str:
    """Return e.g. 'paEI' — capital if dominant (>30)."""
    return "".join(
        r if scores[r] > DOMINANT_THRESHOLD else r.lower()
        for r in ROLES
    )


def get_dominant_roles(scaled_scores: Dict[str, Dict[str, int]]) -> List[str]:
    """Return list of dominant role letters across all dimensions."""
    dominant = set()
    for section_scores in scaled_scores.values():
        for role, score in section_scores.items():
            if score > DOMINANT_THRESHOLD:
                dominant.add(role)
    return sorted(dominant)
