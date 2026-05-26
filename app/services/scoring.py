"""
PAEI Scoring Engine (v3: 132-point scale)

Three sections (dimensions), 12 questions each:
  Section 0 — IS (Q0–Q11):    how you currently operate
  Section 1 — SHOULD (Q12–Q23): what the job demands
  Section 2 — WANT (Q24–Q35):  your natural preference

Scoring:
  RANK_POINTS = {1: 5, 2: 3, 3: 2, 4: 1}  → 11 pts/question, 132 pts/section
  Dominance factor: if a role is ranked 1 or 2 in >75% of 12 questions,
    boost its score by 1.05 then rebalance all 4 roles to sum to 132.
  Dominant threshold: raw score > 33 (= 132 / 4, equal-distribution point)
  Display normalization: (raw / 132) × 100  (UI and PDF only)
"""

from typing import Dict, List

SCORING_KEY: Dict[int, Dict[str, str]] = {
    # ── Section 0: Is (Q0–Q11) ────────────────────────────────────────────────
    0:  {"a": "I", "b": "P", "c": "E", "d": "A"},
    1:  {"a": "P", "b": "A", "c": "I", "d": "E"},
    2:  {"a": "A", "b": "P", "c": "E", "d": "I"},
    3:  {"a": "E", "b": "A", "c": "P", "d": "I"},
    4:  {"a": "P", "b": "A", "c": "E", "d": "I"},
    5:  {"a": "A", "b": "I", "c": "P", "d": "E"},
    6:  {"a": "I", "b": "E", "c": "A", "d": "P"},
    7:  {"a": "E", "b": "A", "c": "P", "d": "I"},
    8:  {"a": "A", "b": "P", "c": "E", "d": "I"},
    9:  {"a": "P", "b": "I", "c": "A", "d": "E"},
    10: {"a": "I", "b": "A", "c": "E", "d": "P"},
    11: {"a": "I", "b": "E", "c": "P", "d": "A"},
    # ── Section 1: Should (Q12–Q23) ───────────────────────────────────────────
    12: {"a": "A", "b": "I", "c": "E", "d": "P"},
    13: {"a": "A", "b": "P", "c": "E", "d": "I"},
    14: {"a": "A", "b": "E", "c": "P", "d": "I"},
    15: {"a": "I", "b": "A", "c": "E", "d": "P"},
    16: {"a": "P", "b": "I", "c": "A", "d": "E"},
    17: {"a": "E", "b": "A", "c": "I", "d": "P"},
    18: {"a": "I", "b": "P", "c": "E", "d": "A"},
    19: {"a": "P", "b": "A", "c": "I", "d": "E"},
    20: {"a": "A", "b": "P", "c": "E", "d": "I"},
    21: {"a": "E", "b": "A", "c": "P", "d": "I"},
    22: {"a": "P", "b": "A", "c": "E", "d": "I"},
    23: {"a": "A", "b": "I", "c": "P", "d": "E"},
    # ── Section 2: Want (Q24–Q35) ─────────────────────────────────────────────
    24: {"a": "P", "b": "I", "c": "E", "d": "A"},
    25: {"a": "I", "b": "E", "c": "A", "d": "P"},
    26: {"a": "A", "b": "P", "c": "E", "d": "I"},
    27: {"a": "P", "b": "I", "c": "A", "d": "E"},
    28: {"a": "I", "b": "A", "c": "E", "d": "P"},
    29: {"a": "P", "b": "E", "c": "I", "d": "A"},
    30: {"a": "A", "b": "I", "c": "P", "d": "E"},
    31: {"a": "P", "b": "E", "c": "A", "d": "I"},
    32: {"a": "E", "b": "P", "c": "I", "d": "A"},
    33: {"a": "I", "b": "A", "c": "P", "d": "E"},
    34: {"a": "P", "b": "E", "c": "A", "d": "I"},
    35: {"a": "I", "b": "P", "c": "A", "d": "E"},
}

SECTIONS = ["is", "should", "want"]
ROLES = ["P", "A", "E", "I"]
RANK_POINTS = {1: 5, 2: 3, 3: 2, 4: 1}
DOMINANT_THRESHOLD = 33   # raw score > 33 → dominant (capital letter)
SECTION_TOTAL = 132       # 12 questions × 11 pts = 132

# Correct per-question section assignments from PAEI_Questions_Turiyaskills_Format.xlsx.
# Questions are interleaved across sections — NOT sequential blocks of 12.
SECTION_MAP: Dict[int, str] = {
    **{idx: "is"     for idx in (0, 4, 7, 9, 10, 14, 19, 21, 23, 29, 33, 35)},
    **{idx: "should" for idx in (2, 5, 6, 12, 13, 18, 20, 24, 26, 27, 31, 34)},
    **{idx: "want"   for idx in (1, 3, 8, 11, 15, 16, 17, 22, 25, 28, 30, 32)},
}


def score_answers(answers: List[Dict], section_map: Dict[int, str] = None) -> Dict:
    """
    Score a completed ranking assessment (v3: 132-point scale).

    Args:
        answers:     list of {question_index: int, ranks: {a:int, b:int, c:int, d:int}}
                     ranks values must be a permutation of {1,2,3,4}
                     rank 1 = most preferred (5 pts), rank 4 = least preferred (1 pt)
        section_map: {question_index: section} — defaults to SECTION_MAP (correct Excel assignments).
                     Pass the DB-fetched map in production to stay in sync with the questions table.

    Returns:
        {
          "raw":     {is:{P,A,E,I}, should:{P,A,E,I}, want:{P,A,E,I}}  -- 132-scale, post-dominance
          "display": {is:{P,A,E,I}, should:{P,A,E,I}, want:{P,A,E,I}}  -- 0-100%, for UI and PDF bars
          "profile": {is: "paEI", should: "PaEi", want: "paei"}
        }
    """
    if section_map is None:
        section_map = SECTION_MAP

    raw: Dict[str, Dict[str, float]] = {s: {"P": 0.0, "A": 0.0, "E": 0.0, "I": 0.0} for s in SECTIONS}

    for answer in answers:
        q_idx = answer.get("question_index")
        ranks = answer.get("ranks", {})
        if q_idx not in SCORING_KEY:
            continue
        section = section_map.get(q_idx)
        if section not in SECTIONS:
            continue
        q_mapping = SCORING_KEY[q_idx]
        for opt, rank in ranks.items():
            role = q_mapping.get(opt)
            if role and isinstance(rank, int) and rank in RANK_POINTS:
                raw[section][role] += RANK_POINTS[rank]

    # Apply dominance factor per section, then round to int
    for section in SECTIONS:
        section_q_indices = {idx for idx, s in section_map.items() if s == section}
        raw[section] = _apply_dominance_factor(raw[section], answers, section_q_indices)

    raw_int: Dict[str, Dict[str, int]] = {
        s: {r: round(raw[s][r]) for r in ROLES} for s in SECTIONS
    }

    display = {
        s: {r: round(raw_int[s][r] / SECTION_TOTAL * 100) for r in ROLES}
        for s in SECTIONS
    }

    profile = {s: _build_profile_string(raw_int[s]) for s in SECTIONS}

    return {"raw": raw_int, "display": display, "profile": profile}


def _apply_dominance_factor(
    section_scores: Dict[str, float],
    answers: List[Dict],
    q_indices: set,
) -> Dict[str, float]:
    """Boost roles with >75% top-2 ranking consistency by 1.05, then rebalance to 132."""
    n = len(q_indices)
    top2_count: Dict[str, int] = {"P": 0, "A": 0, "E": 0, "I": 0}

    for answer in answers:
        q_idx = answer.get("question_index")
        if q_idx not in q_indices or q_idx not in SCORING_KEY:
            continue
        ranks = answer.get("ranks", {})
        q_mapping = SCORING_KEY[q_idx]
        for opt, rank in ranks.items():
            role = q_mapping.get(opt)
            if role and isinstance(rank, int) and rank <= 2:
                top2_count[role] += 1

    adjusted = dict(section_scores)
    boosted = False
    for role in ROLES:
        if n > 0 and top2_count[role] / n > 0.75:
            adjusted[role] = section_scores[role] * 1.05
            boosted = True

    if not boosted:
        return section_scores

    total = sum(adjusted.values())
    if total == 0:
        return section_scores
    scale = SECTION_TOTAL / total
    return {r: adjusted[r] * scale for r in ROLES}


def _build_profile_string(scores: Dict[str, int]) -> str:
    """Return e.g. 'paEI' — capital if dominant (raw > 33)."""
    return "".join(r if scores[r] > DOMINANT_THRESHOLD else r.lower() for r in ROLES)


def get_dominant_roles(raw_scores: Dict[str, Dict[str, int]]) -> List[str]:
    """Return list of dominant role letters across all dimensions."""
    dominant = set()
    for section_scores in raw_scores.values():
        for role, score in section_scores.items():
            if score > DOMINANT_THRESHOLD:
                dominant.add(role)
    return sorted(dominant)
