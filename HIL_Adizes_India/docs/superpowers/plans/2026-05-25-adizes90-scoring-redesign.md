# Adizes90 Scoring Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the PAEI scoring engine (12–48 → 132 scale), introduce a 3-gap model (Execution / Engagement / Authenticity), redesign the 5-page PDF, and update the frontend results views.

**Architecture:** Backend scoring changes are fully backward-isolated — `score_answers()` return signature changes from `{raw, scaled}` to `{raw, display}`. The Lambda receives `scaled_scores` in display% (0–100) and pre-computed `gaps` from the backend. Frontend components EnergyMatrix and GapCard replace the Recharts radar and bar chart.

**Tech Stack:** Python 3.11 / FastAPI / pytest · Node.js / EJS / Puppeteer (Lambda) · React 19 / TypeScript / Tailwind v4

**Phase 2 (Adizes360) is OUT OF SCOPE** — see spec Section 7–11 for future work.

---

## File Map

| Action | Path |
|--------|------|
| Create | `adizes-backend/migrations/010_clean_slate.sql` |
| Rewrite | `adizes-backend/app/services/scoring.py` |
| Rewrite | `adizes-backend/tests/test_scoring.py` |
| Rewrite | `adizes-backend/app/services/gap_analysis.py` |
| Rewrite | `adizes-backend/tests/test_gap_analysis.py` |
| Modify | `adizes-backend/app/services/interpretation.py` |
| Modify | `adizes-backend/app/routers/assessment.py` |
| Modify | `adizes-frontend/src/types/api.ts` |
| Create | `adizes-backend/lambda/pdf-generator-v2/lib/gaps.js` |
| Modify | `adizes-backend/lambda/pdf-generator-v2/index.js` |
| Rewrite | `adizes-backend/lambda/pdf-generator-v2/template/report.html` |
| Create | `adizes-frontend/src/components/ui/EnergyMatrix.tsx` |
| Create | `adizes-frontend/src/components/ui/GapCard.tsx` |
| Modify | `adizes-frontend/src/components/ui/GapBadge.tsx` |
| Modify | `adizes-frontend/src/components/ui/ScoresTable.tsx` |
| Modify | `adizes-frontend/src/pages/Results.tsx` |
| Modify | `adizes-frontend/src/pages/AdminRespondent.tsx` |
| Modify | `adizes-frontend/src/pages/AdminCohortDetail.tsx` |

---

### Task 1: Migration 010 — Clean Slate

**Files:**
- Create: `adizes-backend/migrations/010_clean_slate.sql`

**Why delete:** Rank 1 used to award 4 pts; it now awards 5 pts. All stored scores are incompatible with the new engine. Cascade FK on `answers` table removes linked rows automatically.

- [ ] **Step 1: Create the migration file**

```sql
-- Migration 010: Clean slate for new scoring engine
-- Rank points change (rank 1: 4 pts → 5 pts, total 120 → 132) makes all
-- existing scores incompatible. answers cascade via FK ON DELETE CASCADE.
DELETE FROM assessments;
```

Save to `/Users/vrln/adizes-backend/migrations/010_clean_slate.sql`

- [ ] **Step 2: Apply to local Supabase**

```bash
docker exec -i supabase_db_adizes-backend psql -U postgres -d postgres \
  < /Users/vrln/adizes-backend/migrations/010_clean_slate.sql
```

Expected output: `DELETE 0` (or the count of rows deleted — zero if DB was already reset)

- [ ] **Step 3: Commit**

```bash
cd /Users/vrln/adizes-backend
git add migrations/010_clean_slate.sql
git commit -m "feat: migration 010 — clean slate for 132-point scoring engine"
```

---

### Task 2: Scoring Engine — Core (RANK_POINTS + 132 Scale)

**Files:**
- Rewrite: `adizes-backend/app/services/scoring.py`
- Rewrite: `adizes-backend/tests/test_scoring.py`

- [ ] **Step 1: Write failing tests**

Replace the entire content of `adizes-backend/tests/test_scoring.py`:

```python
"""Tests for the PAEI ranking-based scoring engine (v3: 132-point scale)."""

import pytest
from app.services.scoring import score_answers, _build_profile_string, SCORING_KEY, RANK_POINTS, DOMINANT_THRESHOLD


def _all_rank_answers(rank_per_option: dict) -> list:
    """Build 36 answers each with the same rank assignment for all options."""
    return [
        {"question_index": q, "ranks": dict(rank_per_option)}
        for q in range(36)
    ]


class TestConstants:
    def test_rank_points_mapping(self):
        assert RANK_POINTS == {1: 5, 2: 3, 3: 2, 4: 1}

    def test_dominant_threshold_is_33(self):
        assert DOMINANT_THRESHOLD == 33

    def test_scoring_key_covers_all_36_questions(self):
        assert len(SCORING_KEY) == 36

    def test_each_question_has_all_4_roles(self):
        for q_idx, mapping in SCORING_KEY.items():
            roles = set(mapping.values())
            assert roles == {"P", "A", "E", "I"}, f"Q{q_idx}: {mapping}"


class TestBuildProfileString:
    def test_all_dominant(self):
        scores = {"P": 40, "A": 40, "E": 35, "I": 34}
        assert _build_profile_string(scores) == "PAEI"

    def test_none_dominant(self):
        scores = {"P": 20, "A": 25, "E": 30, "I": 33}
        # 33 is NOT dominant (must be > 33)
        assert _build_profile_string(scores) == "paei"

    def test_boundary_at_33(self):
        scores = {"P": 33, "A": 34, "E": 33, "I": 34}
        assert _build_profile_string(scores) == "pAeI"

    def test_mixed(self):
        scores = {"P": 20, "A": 40, "E": 25, "I": 50}
        assert _build_profile_string(scores) == "pAeI"


class TestScoreAnswers:
    def test_returns_raw_display_profile_keys(self):
        answers = _all_rank_answers({"a": 1, "b": 2, "c": 3, "d": 4})
        result = score_answers(answers)
        assert set(result.keys()) == {"raw", "display", "profile"}

    def test_raw_sums_to_132_per_section(self):
        """P+A+E+I must equal 132 per section (11 pts × 12 questions)."""
        answers = _all_rank_answers({"a": 1, "b": 2, "c": 3, "d": 4})
        result = score_answers(answers)
        for section in ["is", "should", "want"]:
            total = sum(result["raw"][section].values())
            assert total == 132, f"{section} total was {total}"

    def test_display_sums_to_100_per_section(self):
        """Display% values (rounded) must sum to approximately 100 per section."""
        answers = _all_rank_answers({"a": 1, "b": 2, "c": 3, "d": 4})
        result = score_answers(answers)
        for section in ["is", "should", "want"]:
            total = sum(result["display"][section].values())
            # Rounding may cause off-by-1
            assert 98 <= total <= 102, f"{section} display total was {total}"

    def test_max_raw_score_when_role_always_rank1(self):
        """Ranking P option rank 1 in all 12 Is questions → raw P(is) >= 60 (before possible boost)."""
        # P option per Is question (from SCORING_KEY):
        p_opts = {0:"b",1:"a",2:"b",3:"c",4:"a",5:"c",6:"d",7:"c",8:"b",9:"a",10:"d",11:"c"}
        answers = []
        for q in range(36):
            if q < 12:
                p_opt = p_opts[q]
                non_p = [o for o in "abcd" if o != p_opt]
                answers.append({"question_index": q, "ranks": {p_opt:1, non_p[0]:2, non_p[1]:3, non_p[2]:4}})
            else:
                answers.append({"question_index": q, "ranks": {"a":1,"b":2,"c":3,"d":4}})
        result = score_answers(answers)
        # P gets 5 pts × 12 = 60 raw, plus dominance boost → final > 60 after rebalance
        # but due to boost and rebalance, result may be slightly above 60
        # minimum raw P without boost = 60, with boost and rebalance ≈ 61-62
        assert result["raw"]["is"]["P"] >= 60

    def test_min_raw_score_when_role_always_rank4(self):
        """Ranking P option rank 4 in all 12 Is questions → P(is) = 12."""
        p_opts = {0:"b",1:"a",2:"b",3:"c",4:"a",5:"c",6:"d",7:"c",8:"b",9:"a",10:"d",11:"c"}
        answers = []
        for q in range(36):
            if q < 12:
                p_opt = p_opts[q]
                non_p = [o for o in "abcd" if o != p_opt]
                answers.append({"question_index": q, "ranks": {non_p[0]:1, non_p[1]:2, non_p[2]:3, p_opt:4}})
            else:
                answers.append({"question_index": q, "ranks": {"a":1,"b":2,"c":3,"d":4}})
        result = score_answers(answers)
        # P gets 1 pt × 12 = 12 raw, P dominance_ratio = 0/12 = 0% → no boost
        assert result["raw"]["is"]["P"] == 12

    def test_display_is_percentage_of_raw(self):
        """display[section][role] ≈ round(raw[section][role] / 132 * 100)."""
        answers = _all_rank_answers({"a": 1, "b": 2, "c": 3, "d": 4})
        result = score_answers(answers)
        for section in ["is", "should", "want"]:
            for role in ["P", "A", "E", "I"]:
                expected = round(result["raw"][section][role] / 132 * 100)
                assert result["display"][section][role] == expected

    def test_profile_strings_present_for_all_sections(self):
        answers = _all_rank_answers({"a": 1, "b": 2, "c": 3, "d": 4})
        result = score_answers(answers)
        assert set(result["profile"].keys()) == {"is", "should", "want"}

    def test_profile_string_length_is_4(self):
        answers = _all_rank_answers({"a": 1, "b": 2, "c": 3, "d": 4})
        result = score_answers(answers)
        for dim in ["is", "should", "want"]:
            assert len(result["profile"][dim]) == 4

    def test_invalid_question_index_ignored(self):
        answers = [{"question_index": 999, "ranks": {"a": 1, "b": 2, "c": 3, "d": 4}}]
        result = score_answers(answers)
        for dim in ["is", "should", "want"]:
            for role in ["P", "A", "E", "I"]:
                assert result["raw"][dim][role] == 0
```

- [ ] **Step 2: Run tests to confirm they all fail**

```bash
docker exec -it adizes-backend python -m pytest tests/test_scoring.py -v 2>&1 | head -40
```

Expected: multiple FAILED and ERRORS (old `scaled` key, old threshold, etc.)

- [ ] **Step 3: Rewrite scoring.py**

Replace the entire content of `adizes-backend/app/services/scoring.py`:

```python
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


def score_answers(answers: List[Dict]) -> Dict:
    """
    Score a completed ranking assessment (v3: 132-point scale).

    Args:
        answers: list of {question_index: int, ranks: {a:int, b:int, c:int, d:int}}
                 ranks values must be a permutation of {1,2,3,4}
                 rank 1 = most preferred (5 pts), rank 4 = least preferred (1 pt)

    Returns:
        {
          "raw":     {is:{P,A,E,I}, should:{P,A,E,I}, want:{P,A,E,I}}  -- 132-scale, post-dominance
          "display": {is:{P,A,E,I}, should:{P,A,E,I}, want:{P,A,E,I}}  -- 0-100%, for UI and PDF bars
          "profile": {is: "paEI", should: "PaEi", want: "paei"}
        }
    """
    raw: Dict[str, Dict[str, float]] = {s: {"P": 0.0, "A": 0.0, "E": 0.0, "I": 0.0} for s in SECTIONS}

    for answer in answers:
        q_idx = answer.get("question_index")
        ranks = answer.get("ranks", {})
        if q_idx not in SCORING_KEY:
            continue
        section = SECTIONS[q_idx // 12]
        q_mapping = SCORING_KEY[q_idx]
        for opt, rank in ranks.items():
            role = q_mapping.get(opt)
            if role and isinstance(rank, int) and rank in RANK_POINTS:
                raw[section][role] += RANK_POINTS[rank]

    # Apply dominance factor per section, then round to int
    for s_idx, section in enumerate(SECTIONS):
        section_start = s_idx * 12
        raw[section] = _apply_dominance_factor(raw[section], answers, section_start)

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
    section_start: int,
) -> Dict[str, float]:
    """Boost roles with >75% top-2 ranking consistency by 1.05, then rebalance to 132."""
    q_indices = set(range(section_start, section_start + 12))
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
        if top2_count[role] / 12 > 0.75:
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
```

- [ ] **Step 4: Run tests**

```bash
docker exec -it adizes-backend python -m pytest tests/test_scoring.py -v
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/vrln/adizes-backend
git add app/services/scoring.py tests/test_scoring.py
git commit -m "feat: scoring engine v3 — 132-point scale, RANK_POINTS {1:5,2:3,3:2,4:1}, threshold 33"
```

---

### Task 3: Scoring Engine — Dominance Factor Tests

**Files:**
- Modify: `adizes-backend/tests/test_scoring.py`

- [ ] **Step 1: Add dominance factor tests**

Append to `adizes-backend/tests/test_scoring.py`:

```python

class TestDominanceFactor:
    def test_dominance_factor_boosts_and_rebalances(self):
        """Role ranked top-2 in 10/12 questions (83%) gets 1.05x boost, total stays 132."""
        from app.services.scoring import _apply_dominance_factor

        # P options in Is section: Q0=b, Q1=a, Q2=b, Q3=c, Q4=a, Q5=c,
        #                           Q6=d, Q7=c, Q8=b, Q9=a, Q10=d, Q11=c
        # Rank P=rank1 in Q0-Q9 (10 questions), default for Q10-Q11 (P=rank4,rank3)
        overrides = {
            0: {"b":1,"a":2,"c":3,"d":4},
            1: {"a":1,"b":2,"c":3,"d":4},
            2: {"b":1,"a":2,"c":3,"d":4},
            3: {"c":1,"a":2,"b":3,"d":4},
            4: {"a":1,"b":2,"c":3,"d":4},
            5: {"c":1,"a":2,"b":3,"d":4},
            6: {"d":1,"a":2,"b":3,"c":4},
            7: {"c":1,"a":2,"b":3,"d":4},
            8: {"b":1,"a":2,"c":3,"d":4},
            9: {"a":1,"b":2,"c":3,"d":4},
            10: {"a":1,"b":2,"c":3,"d":4},   # P=d → rank 4 (not top-2)
            11: {"a":1,"b":2,"c":3,"d":4},   # P=c → rank 3 (not top-2)
        }
        answers = [
            {"question_index": q, "ranks": overrides.get(q, {"a":1,"b":2,"c":3,"d":4})}
            for q in range(36)
        ]
        # Seed section_scores with plausible values summing to 132
        section_scores = {"P": 53.0, "A": 28.0, "E": 30.0, "I": 21.0}
        result = _apply_dominance_factor(section_scores, answers, 0)

        assert abs(sum(result.values()) - 132) < 0.1   # rebalanced to 132
        assert result["P"] > section_scores["P"]        # P was boosted

    def test_no_boost_below_threshold(self):
        """Role ranked top-2 in exactly 9/12 questions (75%) does NOT get boosted."""
        from app.services.scoring import _apply_dominance_factor

        # P top-2 in Q0-Q8 only (9/12 = 75% — not > 75%)
        overrides = {
            0: {"b":1,"a":2,"c":3,"d":4},
            1: {"a":1,"b":2,"c":3,"d":4},
            2: {"b":1,"a":2,"c":3,"d":4},
            3: {"c":1,"a":2,"b":3,"d":4},
            4: {"a":1,"b":2,"c":3,"d":4},
            5: {"c":1,"a":2,"b":3,"d":4},
            6: {"d":1,"a":2,"b":3,"c":4},
            7: {"c":1,"a":2,"b":3,"d":4},
            8: {"b":1,"a":2,"c":3,"d":4},
            9:  {"a":1,"b":2,"c":3,"d":4},   # P=a → rank 1 — wait, this is top-2
        }
        # Fix: Q9 default has P=a=rank1 which IS top-2. Use explicit override to exclude it.
        overrides[9]  = {"b":1,"a":2,"c":3,"d":4}   # P=a → rank 2 → still top-2, need rank 3+
        overrides[9]  = {"b":1,"c":2,"a":3,"d":4}   # P=a → rank 3 (not top-2)
        overrides[10] = {"a":1,"b":2,"c":3,"d":4}   # P=d → rank 4 (not top-2)
        overrides[11] = {"a":1,"b":2,"c":3,"d":4}   # P=c → rank 3 (not top-2)
        answers = [
            {"question_index": q, "ranks": overrides.get(q, {"a":1,"b":2,"c":3,"d":4})}
            for q in range(36)
        ]
        section_scores = {"P": 48.0, "A": 28.0, "E": 30.0, "I": 26.0}
        result = _apply_dominance_factor(section_scores, answers, 0)

        # 9/12 = 75% which is NOT > 75%, no boost, scores returned unchanged
        assert result == section_scores

    def test_full_score_answers_with_dominance_total_132(self):
        """End-to-end: score_answers always returns raw totals = 132 per section."""
        # Use answers that trigger P dominance (all 12 Is questions, P=rank1)
        p_opts = {0:"b",1:"a",2:"b",3:"c",4:"a",5:"c",6:"d",7:"c",8:"b",9:"a",10:"d",11:"c"}
        answers = []
        for q in range(36):
            if q < 12:
                p_opt = p_opts[q]
                non_p = [o for o in "abcd" if o != p_opt]
                answers.append({"question_index": q, "ranks": {p_opt:1, non_p[0]:2, non_p[1]:3, non_p[2]:4}})
            else:
                answers.append({"question_index": q, "ranks": {"a":1,"b":2,"c":3,"d":4}})
        result = score_answers(answers)
        for section in ["is", "should", "want"]:
            total = sum(result["raw"][section].values())
            assert total == 132, f"{section} raw total = {total}"
```

- [ ] **Step 2: Run tests**

```bash
docker exec -it adizes-backend python -m pytest tests/test_scoring.py -v
```

Expected: all tests PASS

- [ ] **Step 3: Commit**

```bash
cd /Users/vrln/adizes-backend
git add tests/test_scoring.py
git commit -m "test: dominance factor coverage for scoring engine v3"
```

---

### Task 4: Gap Model — Three Gap Types + New Thresholds

**Files:**
- Rewrite: `adizes-backend/app/services/gap_analysis.py`
- Rewrite: `adizes-backend/tests/test_gap_analysis.py`

- [ ] **Step 1: Write failing tests**

Replace the entire content of `adizes-backend/tests/test_gap_analysis.py`:

```python
"""Tests for the gap analysis service (v2: 3 gap types, 132-scale thresholds)."""

import pytest
from app.services.gap_analysis import compute_gaps, get_top_gaps, _severity


class TestSeverity:
    def test_low_below_6(self):
        assert _severity(0) == "low"
        assert _severity(5) == "low"

    def test_medium_6_to_15(self):
        assert _severity(6) == "medium"
        assert _severity(15) == "medium"

    def test_high_above_15(self):
        assert _severity(16) == "high"
        assert _severity(40) == "high"


class TestComputeGaps:
    def _raw(self, **overrides):
        base = {
            "is":     {"P": 33, "A": 33, "E": 33, "I": 33},
            "should": {"P": 33, "A": 33, "E": 33, "I": 33},
            "want":   {"P": 33, "A": 33, "E": 33, "I": 33},
        }
        base.update(overrides)
        return base

    def test_returns_4_roles(self):
        gaps = compute_gaps(self._raw())
        assert len(gaps) == 4
        assert {g["role"] for g in gaps} == {"P", "A", "E", "I"}

    def test_three_gap_types_per_role(self):
        gaps = compute_gaps(self._raw())
        for g in gaps:
            assert "execution_gap" in g
            assert "engagement_gap" in g
            assert "authenticity_gap" in g
            assert "execution_gap_signed" in g
            assert "engagement_gap_signed" in g
            assert "authenticity_gap_signed" in g
            assert "execution_severity" in g
            assert "engagement_severity" in g
            assert "authenticity_severity" in g

    def test_all_gaps_zero_when_equal(self):
        gaps = compute_gaps(self._raw())
        for g in gaps:
            assert g["execution_gap"] == 0
            assert g["engagement_gap"] == 0
            assert g["authenticity_gap"] == 0

    def test_execution_gap_is_should_minus_is(self):
        raw = self._raw(**{"should": {"P": 50, "A": 33, "E": 33, "I": 33}})
        gaps = compute_gaps(raw)
        p = next(g for g in gaps if g["role"] == "P")
        assert p["execution_gap"] == 17           # abs(50-33)
        assert p["execution_gap_signed"] == 17    # positive: role > current
        assert p["execution_severity"] == "high"

    def test_execution_gap_negative_signed(self):
        raw = self._raw(**{"is": {"P": 50, "A": 33, "E": 33, "I": 16}})
        gaps = compute_gaps(raw)
        p = next(g for g in gaps if g["role"] == "P")
        assert p["execution_gap_signed"] == -17   # IS > SHOULD

    def test_engagement_gap_is_should_minus_want(self):
        raw = self._raw(**{"want": {"P": 20, "A": 33, "E": 33, "I": 33}})
        gaps = compute_gaps(raw)
        p = next(g for g in gaps if g["role"] == "P")
        assert p["engagement_gap"] == 13          # abs(33-20)
        assert p["engagement_gap_signed"] == 13   # SHOULD > WANT
        assert p["engagement_severity"] == "medium"

    def test_authenticity_gap_is_is_minus_want(self):
        raw = self._raw(**{"want": {"P": 25, "A": 33, "E": 33, "I": 33}})
        gaps = compute_gaps(raw)
        p = next(g for g in gaps if g["role"] == "P")
        assert p["authenticity_gap"] == 8         # abs(33-25)
        assert p["authenticity_gap_signed"] == 8  # IS > WANT
        assert p["authenticity_severity"] == "medium"

    def test_scores_stored_in_gap_record(self):
        raw = self._raw()
        gaps = compute_gaps(raw)
        for g in gaps:
            assert "is_score" in g
            assert "should_score" in g
            assert "want_score" in g


class TestGetTopGaps:
    def _gaps_with_known_values(self):
        # Create gaps where E has highest execution (20), P has medium authenticity (10)
        raw = {
            "is":     {"P": 40, "A": 33, "E": 15, "I": 33},
            "should": {"P": 40, "A": 33, "E": 35, "I": 33},  # E execution = 20
            "want":   {"P": 30, "A": 33, "E": 33, "I": 33},  # P authenticity = 10
        }
        return compute_gaps(raw)

    def test_returns_top_3_by_default(self):
        gaps = self._gaps_with_known_values()
        top = get_top_gaps(gaps)
        assert len(top) == 3

    def test_sorted_by_absolute_magnitude(self):
        gaps = self._gaps_with_known_values()
        top = get_top_gaps(gaps)
        mags = [t["gap_abs"] for t in top]
        assert mags == sorted(mags, reverse=True)

    def test_each_item_has_required_fields(self):
        gaps = self._gaps_with_known_values()
        top = get_top_gaps(gaps)
        for t in top:
            assert "role" in t
            assert "gap_type" in t     # "execution" | "engagement" | "authenticity"
            assert "gap_abs" in t
            assert "gap_signed" in t
            assert "severity" in t

    def test_custom_n(self):
        gaps = self._gaps_with_known_values()
        assert len(get_top_gaps(gaps, n=1)) == 1
        assert len(get_top_gaps(gaps, n=5)) == 5

    def test_highest_gap_is_first(self):
        gaps = self._gaps_with_known_values()
        top = get_top_gaps(gaps, n=1)
        assert top[0]["role"] == "E"
        assert top[0]["gap_type"] == "execution"
        assert top[0]["gap_abs"] == 20
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
docker exec -it adizes-backend python -m pytest tests/test_gap_analysis.py -v 2>&1 | head -30
```

Expected: multiple FAILED — old gap fields, old severity levels.

- [ ] **Step 3: Rewrite gap_analysis.py**

Replace the entire content of `adizes-backend/app/services/gap_analysis.py`:

```python
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
```

- [ ] **Step 4: Run tests**

```bash
docker exec -it adizes-backend python -m pytest tests/test_gap_analysis.py -v
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/vrln/adizes-backend
git add app/services/gap_analysis.py tests/test_gap_analysis.py
git commit -m "feat: gap analysis v2 — execution/engagement/authenticity gaps, severity thresholds 6/15"
```

---

### Task 5: Interpretation Service — New Fields + Updated Signature

**Files:**
- Modify: `adizes-backend/app/services/interpretation.py`

- [ ] **Step 1: Replace interpretation.py**

Replace the entire content of `adizes-backend/app/services/interpretation.py`:

```python
"""
Style Interpretation Service (v2)

Detects dominant roles from 'Want' dimension (raw score > 33).
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
            "is contagious right now."
        ),
        "friction_shows_up": (
            "You may be perceived as pushing too hard for results at the expense of process "
            "and people — or not pushing hard enough when the situation demands it. "
            "The P dimension is under pressure."
        ),
        "under_stress": (
            "Lone Ranger — under prolonged stress you may become a domineering, go-it-alone "
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
            "seemed rigid is now the scaffold everyone is grateful for."
        ),
        "friction_shows_up": (
            "Resistance can surface when structure feels forced on others — or when lack of "
            "structure creates confusion. Your A dimension is under pressure and the gap "
            "between expectation and reality is showing."
        ),
        "under_stress": (
            "Bureaucrat — under prolonged stress you may become overly rigid, inflexible, "
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
            "is infectious and people are following your lead."
        ),
        "friction_shows_up": (
            "Creative energy that isn't channelled can come across as distraction or "
            "unfulfilled promises. Or the absence of innovation may frustrate you when "
            "the role needs it. The E dimension is under pressure."
        ),
        "under_stress": (
            "Arsonist — under prolonged stress you may become impractical, chaotic, and "
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
            "because you are in the room."
        ),
        "friction_shows_up": (
            "Friction emerges when team cohesion is under stress — either from too much focus "
            "on harmony at the cost of results, or from insufficient relationship investment. "
            "The I dimension is under pressure."
        ),
        "under_stress": (
            "Super-Follower — under prolonged stress you may become conflict-avoidant and "
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
        "execution_high":     "Strain from meeting execution demands beyond your current mode — watch for impatience or burnout.",
        "execution_low":      "Effort leaking into P-behaviours the role doesn't require — redirect that energy intentionally.",
        "authenticity_high":  "Sustained P-performance beyond your natural preference — fatigue builds slowly, look for delegation opportunities.",
        "authenticity_low":   "P-instincts are underexpressed in current behaviour — frustration and loss of purpose may build.",
    },
    "A": {
        "execution_high":     "Over-investing in structure beyond natural capacity — watch for rigidity or slowing decision-making.",
        "execution_low":      "Under-delivering on process expectations — gaps in systems or quality may be emerging.",
        "authenticity_high":  "Operating with more A-behaviour than feels natural — cognitive overhead; build templates to carry the load.",
        "authenticity_low":   "Structure instincts suppressed — disorder or inefficiency may surface without you initially noticing.",
    },
    "E": {
        "execution_high":     "Role demands innovation beyond current engagement level — idea drought or creative avoidance risk.",
        "execution_low":      "Creative energy exceeds role need — restlessness or scattered priorities may be visible to others.",
        "authenticity_high":  "Performing entrepreneurial behaviour without intrinsic energy — slow drain, protect your creative reserves.",
        "authenticity_low":   "Entrepreneurial instincts underused — loss of strategic meaning or growing frustration with operational constraints.",
    },
    "I": {
        "execution_high":     "Role demands people investment beyond current behaviour — relationship debt accumulating.",
        "execution_low":      "Over-investing in integration beyond role need — people-pleasing at the cost of results.",
        "authenticity_high":  "More I-behaviour than feels natural — consensus-seeking becoming a drain; set relational limits.",
        "authenticity_low":   "I-instincts suppressed — team connection weakening without you noticing until it becomes visible.",
    },
}


def interpret(
    raw_scores: Dict[str, Dict[str, int]],
    profile: Dict[str, str],
    gaps: Optional[List[Dict]] = None,
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
    want_scores = raw_scores["want"]
    dominant = [r for r in ["P", "A", "E", "I"] if want_scores[r] > 33]

    if not dominant:
        dominant = [max(want_scores, key=want_scores.get)]

    primary = max(dominant, key=lambda r: want_scores[r])
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
    }


def _build_identity_line(dominant: List[str], combined_desc: Optional[str]) -> str:
    if combined_desc:
        prefix = combined_desc.split(" — ")[0].replace("The ", "")
        roles_str = "–".join(dominant[:2])
        return f"{prefix} — {roles_str} Weighted"
    elif len(dominant) == 1:
        desc = STYLE_DESCRIPTIONS[dominant[0]]
        return f"{desc['name']} — {desc['tagline']}"
    else:
        return "Adaptive Style — Balanced Profile"


def _mismanagement_label(role: str) -> str:
    return STYLE_DESCRIPTIONS[role]["under_stress"]
```

- [ ] **Step 2: Run all existing tests to confirm no regression**

```bash
docker exec -it adizes-backend python -m pytest tests/ -v --tb=short
```

Expected: scoring and gap tests PASS; any interpretation tests are n/a (no dedicated test file currently)

- [ ] **Step 3: Commit**

```bash
cd /Users/vrln/adizes-backend
git add app/services/interpretation.py
git commit -m "feat: interpretation v2 — watchouts, identity_line, at_your_best, friction, early_warnings"
```

---

### Task 6: Assessment Router — Updated Payload and DB Storage

**Files:**
- Modify: `adizes-backend/app/routers/assessment.py`

**Key changes:**
- `compute_gaps(scores["scaled"])` → `compute_gaps(scores["raw"])`
- `interpret(scores["scaled"], scores["profile"])` → `interpret(scores["raw"], scores["profile"], gaps=gaps)`
- DB `scaled_scores` now stores display% (0–100) not 132-scale
- Lambda payload `scaled_scores` now also display% (Lambda uses it for bar widths)

- [ ] **Step 1: Update assessment.py**

In `adizes-backend/app/routers/assessment.py`, change the submit handler. Three locations:

**Location 1** — scoring calls (around line 173):

Old:
```python
    scores = score_answers(answers_dicts)
    gaps = compute_gaps(scores["scaled"])
    interp = interpret(scores["scaled"], scores["profile"])
```

New:
```python
    scores = score_answers(answers_dicts)
    gaps = compute_gaps(scores["raw"])
    interp = interpret(scores["raw"], scores["profile"], gaps=gaps)
```

**Location 2** — DB insert (around line 181):

Old:
```python
        "raw_scores": scores["raw"],
        "scaled_scores": scores["scaled"],
```

New:
```python
        "raw_scores": scores["raw"],
        "scaled_scores": scores["display"],
```

**Location 3** — Lambda payload builder (around line 20):

The `_build_pdf_payload` function passes `scores["scaled"]` via `scores` dict. Update it to pass `display` as `scaled_scores`:

Old:
```python
def _build_pdf_payload(result_id: str, user_name: str, now: str,
                        scores: dict, gaps: list, interp: dict) -> dict:
    """Build the JSON payload for the PDF Lambda function."""
    return {
        "assessment_id": result_id,
        "user_name": user_name,
        "completed_at": now,
        "profile": scores["profile"],
        "scaled_scores": scores["scaled"],
        "gaps": gaps,
        "interpretation": interp,
    }
```

New:
```python
def _build_pdf_payload(result_id: str, user_name: str, now: str,
                        scores: dict, gaps: list, interp: dict) -> dict:
    """Build the JSON payload for the PDF Lambda function."""
    return {
        "assessment_id": result_id,
        "user_name": user_name,
        "completed_at": now,
        "profile": scores["profile"],
        "scaled_scores": scores["display"],   # display% 0-100 for bar widths
        "gaps": gaps,
        "interpretation": interp,
    }
```

- [ ] **Step 2: Run full test suite**

```bash
docker exec -it adizes-backend python -m pytest tests/ -v --tb=short
```

Expected: all tests PASS

- [ ] **Step 3: Rebuild Docker and verify the endpoint works**

```bash
cd /Users/vrln/adizes-backend && docker compose up --build -d
```

Wait ~30s for the container to start, then verify the API is healthy:

```bash
curl -s http://localhost:8000/health | python3 -m json.tool
```

Expected: `{"status": "ok"}` or similar

- [ ] **Step 4: Commit**

```bash
cd /Users/vrln/adizes-backend
git add app/routers/assessment.py
git commit -m "feat: assessment router — use raw for gaps/interpret, display% for DB and Lambda"
```

---

### Task 7: Frontend Types — api.ts Update

**Files:**
- Modify: `adizes-frontend/src/types/api.ts`

- [ ] **Step 1: Update GapDetail and Interpretation interfaces**

In `adizes-frontend/src/types/api.ts`:

**Replace `GapDetail`:**

Old:
```typescript
export interface GapDetail {
  role: string;
  role_name: string;
  is_score: number;
  should_score: number;
  want_score: number;
  external_gap: number;
  internal_gap: number;
  external_severity: "aligned" | "watch" | "tension";
  internal_severity: "aligned" | "watch" | "tension";
  external_message: string;
  internal_message: string;
}
```

New:
```typescript
export interface GapDetail {
  role: string;
  role_name: string;
  is_score: number;
  should_score: number;
  want_score: number;
  execution_gap: number;
  execution_gap_signed: number;
  execution_severity: "low" | "medium" | "high";
  execution_narrative: string;
  engagement_gap: number;
  engagement_gap_signed: number;
  engagement_severity: "low" | "medium" | "high";
  engagement_narrative: string;
  authenticity_gap: number;
  authenticity_gap_signed: number;
  authenticity_severity: "low" | "medium" | "high";
  authenticity_narrative: string;
}

export interface TopGap {
  role: string;
  role_name: string;
  gap_type: "execution" | "engagement" | "authenticity";
  gap_abs: number;
  gap_signed: number;
  severity: "low" | "medium" | "high";
  narrative: string;
  is_score: number;
  should_score: number;
  want_score: number;
}
```

**Replace `Interpretation`:**

Old:
```typescript
export interface Interpretation {
  dominant_roles: string[];
  style_label: string;
  style_tagline: string;
  strengths: string;
  blind_spots: string;
  working_with_others: string;
  combined_description: string | null;
  mismanagement_risks: string[];
}
```

New:
```typescript
export interface Interpretation {
  dominant_roles: string[];
  identity_line: string;
  style_label: string;
  style_tagline: string;
  strengths: string;
  watchouts: string;
  working_with_others: string;
  combined_description: string | null;
  mismanagement_risks: string[];
  at_your_best: string;
  friction_shows_up: string;
  early_warnings: string[];
}
```

- [ ] **Step 2: Run TypeScript type-check**

```bash
cd /Users/vrln/adizes-frontend && npx tsc --noEmit 2>&1 | head -50
```

Expected: errors in Results.tsx and AdminRespondent.tsx referencing `blind_spots` — these will be fixed in Tasks 15–16.

- [ ] **Step 3: Commit**

```bash
cd /Users/vrln/adizes-frontend
git add src/types/api.ts
git commit -m "feat: api types — GapDetail v2 (3 gaps), TopGap, Interpretation v2 (watchouts, identity_line)"
```

---

### Task 8: Lambda — gaps.js (Replaces tensions.js)

**Files:**
- Create: `adizes-backend/lambda/pdf-generator-v2/lib/gaps.js`

- [ ] **Step 1: Create gaps.js**

Create `/Users/vrln/adizes-backend/lambda/pdf-generator-v2/lib/gaps.js`:

```javascript
'use strict';

const ROLES = ['P', 'A', 'E', 'I'];

const ROLE_NAMES = {
  P: 'Producer',
  A: 'Administrator',
  E: 'Entrepreneur',
  I: 'Integrator',
};

const ROLE_COLORS = {
  P: '#C8102E',
  A: '#1D3557',
  E: '#E87722',
  I: '#2A9D8F',
};

const ROLE_TINTS = {
  P: 'rgba(200,16,46,0.07)',
  A: 'rgba(29,53,87,0.07)',
  E: 'rgba(232,119,34,0.07)',
  I: 'rgba(42,157,143,0.07)',
};

const GAP_TYPE_META = {
  execution: {
    label:      'Execution Gap',
    formula:    'Role Expectations − Current State',
    lensA:      'should',
    lensALabel: 'Role Expectations',
    lensB:      'is',
    lensBLabel: 'Current State',
  },
  engagement: {
    label:      'Engagement Gap',
    formula:    'Role Expectations − Intrinsic Preference',
    lensA:      'should',
    lensALabel: 'Role Expectations',
    lensB:      'want',
    lensBLabel: 'Intrinsic Preference',
  },
  authenticity: {
    label:      'Authenticity Gap',
    formula:    'Current State − Intrinsic Preference',
    lensA:      'is',
    lensALabel: 'Current State',
    lensB:      'want',
    lensBLabel: 'Intrinsic Preference',
  },
};

// Action cues per gap type, role, and direction
// direction: "high" = signed >= 0 (first lens > second); "low" = signed < 0
const ACTION_CUES = {
  execution: {
    P: {
      high: 'Take direct ownership of a critical deliverable this cycle — close the loop yourself.',
      low:  'Identify one area where you can reduce execution overhead to free up strategic headspace.',
    },
    A: {
      high: 'Invest an hour this week building or refining a process your team will use repeatedly.',
      low:  'Identify one area where structural overhead can be reduced to free up speed.',
    },
    E: {
      high: 'Propose one forward-looking idea or experiment this cycle — don\'t wait for permission.',
      low:  'Channel your entrepreneurial energy into a specific innovation project with a clear outcome.',
    },
    I: {
      high: 'Schedule one-to-ones with two stakeholders you have under-invested in this month.',
      low:  'Balance relationship investment with task accountability — results need attention too.',
    },
  },
  engagement: {
    P: {
      high: 'Look for tasks with longer time horizons that better match your natural energy.',
      low:  'Direct your extra results-drive into areas where direct ownership adds the most value.',
    },
    A: {
      high: 'Use checklists and templates to carry the structural load — reduce the manual effort.',
      low:  'Deliberately allow one area to run with less oversight this month.',
    },
    E: {
      high: 'Block 30 minutes per week for exploratory thinking — protect it from operational demands.',
      low:  'Channel your creative energy into a specific project with a defined outcome.',
    },
    I: {
      high: 'Prioritise two key relationships this month — depth over breadth.',
      low:  'Apply your people instincts in a cross-functional or collaborative context.',
    },
  },
  authenticity: {
    P: {
      high: 'Look for ways to redirect effort toward longer-horizon work that energises you.',
      low:  'Find one project where direct execution is the right tool — own it fully and visibly.',
    },
    A: {
      high: 'Build systems and templates that carry the structural load without constant manual effort.',
      low:  'Bring your structural instincts to an area that currently operates without enough clarity.',
    },
    E: {
      high: 'Block 30 minutes per week for exploratory thinking — protect it from operational demands.',
      low:  'Choose one initiative where you can operate at your natural strategic and creative level.',
    },
    I: {
      high: 'Invest in one meaningful team relationship that has been crowded out by delivery pressure.',
      low:  'Seek a project where team cohesion is the critical success factor — your instincts are needed.',
    },
  },
};

/**
 * Select top N gaps by absolute magnitude from the backend-computed gaps array.
 *
 * @param {Array} gaps - backend gaps: [{role, execution_gap, execution_gap_signed,
 *                        execution_severity, ...same for engagement, authenticity, ...}]
 * @param {number} n
 * @returns {Array} top N items: [{role, gap_type, gap_abs, gap_signed, severity, meta}]
 */
function getTopGaps(gaps, n) {
  const all = [];
  for (const g of gaps) {
    for (const gapType of ['execution', 'engagement', 'authenticity']) {
      all.push({
        role:      g.role,
        gap_type:  gapType,
        gap_abs:   g[`${gapType}_gap`],
        gap_signed: g[`${gapType}_gap_signed`],
        severity:  g[`${gapType}_severity`],
        narrative: g[`${gapType}_narrative`],
        meta:      GAP_TYPE_META[gapType],
      });
    }
  }
  return all.sort((a, b) => b.gap_abs - a.gap_abs).slice(0, n);
}

/**
 * Determine Stretch / Balance / Protect / Complement roles from the gaps array.
 */
function computeActionPath(gaps) {
  const gapsByRole = {};
  for (const g of gaps) gapsByRole[g.role] = g;

  const stretchRole = ROLES.reduce((a, b) =>
    gapsByRole[a].execution_gap >= gapsByRole[b].execution_gap ? a : b);
  const balanceRole = ROLES.reduce((a, b) =>
    gapsByRole[a].authenticity_gap >= gapsByRole[b].authenticity_gap ? a : b);
  const protectPeakGap = (role) =>
    Math.max(gapsByRole[role].execution_gap, gapsByRole[role].engagement_gap, gapsByRole[role].authenticity_gap);
  const protectRole = ROLES.reduce((a, b) => protectPeakGap(a) <= protectPeakGap(b) ? a : b);

  // Complement: role with the lowest raw want score (seek it in others)
  // We don't have want scores here directly; use engagement gap proxy:
  // high engagement gap (want << should) means natural deficit → good complement
  const complementRole = ROLES.reduce((a, b) =>
    gapsByRole[a].engagement_gap >= gapsByRole[b].engagement_gap ? a : b);

  return { stretchRole, balanceRole, protectRole, complementRole };
}

/**
 * Generate full action path messages for Page 5.
 */
function generateActionPathMessages(gaps, actionPath, scaledScores) {
  const gapsByRole = {};
  for (const g of gaps) gapsByRole[g.role] = g;

  const { stretchRole, balanceRole, protectRole, complementRole } = actionPath;
  const sg = gapsByRole[stretchRole];
  const bg = gapsByRole[balanceRole];

  return {
    stretch: {
      role:      stretchRole,
      roleName:  ROLE_NAMES[stretchRole],
      roleColor: ROLE_COLORS[stretchRole],
      description: sg.execution_gap_signed > 0
        ? `Your role demands more ${ROLE_NAMES[stretchRole]} behaviour than you are currently expressing — the gap is activation, not capability.`
        : `You are expressing more ${ROLE_NAMES[stretchRole]} behaviour than your role requires — redirect this energy intentionally.`,
      action: ACTION_CUES.execution[stretchRole][sg.execution_gap_signed >= 0 ? 'high' : 'low'],
    },
    balance: {
      role:      balanceRole,
      roleName:  ROLE_NAMES[balanceRole],
      roleColor: ROLE_COLORS[balanceRole],
      description: bg.authenticity_gap_signed > 0
        ? `You are operating with more ${ROLE_NAMES[balanceRole]} behaviour than your natural self prefers — this gap costs energy over time.`
        : `You prefer more ${ROLE_NAMES[balanceRole]} engagement than you are currently expressing — find space to express it.`,
      action: ACTION_CUES.authenticity[balanceRole][bg.authenticity_gap_signed >= 0 ? 'high' : 'low'],
    },
    protect: {
      role:      protectRole,
      roleName:  ROLE_NAMES[protectRole],
      roleColor: ROLE_COLORS[protectRole],
      description: `Your ${ROLE_NAMES[protectRole]} dimension shows the strongest alignment across Current State, Role Expectations, and Intrinsic Preference — this is your most stable foundation.`,
      action: `Don't sacrifice your ${ROLE_NAMES[protectRole]} strength under pressure or in pursuit of closing other gaps.`,
    },
    complement: {
      role:      complementRole,
      roleName:  ROLE_NAMES[complementRole],
      roleColor: ROLE_COLORS[complementRole],
      description: `Your ${ROLE_NAMES[complementRole]} dimension shows the largest gap between what your role demands and what you naturally prefer — actively seek colleagues who lead with this energy.`,
      action: `Build relationships with strong ${ROLE_NAMES[complementRole]}s on your team. Their instincts cover your natural gap.`,
    },
  };
}

module.exports = {
  ROLES, ROLE_NAMES, ROLE_COLORS, ROLE_TINTS, GAP_TYPE_META, ACTION_CUES,
  getTopGaps, computeActionPath, generateActionPathMessages,
};
```

- [ ] **Step 2: Run the existing Lambda unit tests (if present) or verify syntax**

```bash
cd /Users/vrln/adizes-backend/lambda/pdf-generator-v2
node -e "const g = require('./lib/gaps'); console.log(Object.keys(g));"
```

Expected: `[ 'ROLES', 'ROLE_NAMES', 'ROLE_COLORS', 'ROLE_TINTS', 'GAP_TYPE_META', 'ACTION_CUES', 'getTopGaps', 'computeActionPath', 'generateActionPathMessages' ]`

- [ ] **Step 3: Commit**

```bash
cd /Users/vrln/adizes-backend
git add lambda/pdf-generator-v2/lib/gaps.js
git commit -m "feat: lambda gaps.js — getTopGaps, computeActionPath, generateActionPathMessages for 132-scale"
```

---

### Task 9: Lambda — index.js Update

**Files:**
- Modify: `adizes-backend/lambda/pdf-generator-v2/index.js`

- [ ] **Step 1: Replace index.js content**

Replace the entire content of `adizes-backend/lambda/pdf-generator-v2/index.js`:

```javascript
'use strict';

const chromium    = require('@sparticuz/chromium');
const puppeteer   = require('puppeteer-core');
const ejs         = require('ejs');
const fs          = require('fs');
const path        = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const {
  getTopGaps, computeActionPath, generateActionPathMessages,
  ROLES, ROLE_NAMES, ROLE_COLORS, ROLE_TINTS, GAP_TYPE_META,
} = require('./lib/gaps');

const TEMPLATE_PATH = path.join(__dirname, 'template', 'report.html');

function inlineAssets(html) {
  const templateDir = path.join(__dirname, 'template');

  const css = fs.readFileSync(path.join(templateDir, 'styles.css'), 'utf8');
  const beforeCss = html;
  html = html.replace(
    /<link rel="stylesheet" href="\.\/styles\.css">/,
    `<style>${css}</style>`,
  );
  if (html === beforeCss) {
    console.warn('[pdf-v2] WARNING: styles.css <link> tag not found — PDF will be unstyled');
  }

  html = html.replace(/src="\.\/assets\/([^"]+)"/g, (_match, filename) => {
    const assetPath = path.join(templateDir, 'assets', filename);
    if (!fs.existsSync(assetPath)) {
      console.warn(`[pdf-v2] Asset not found: ${assetPath}`);
      return `src=""`;
    }
    const ext  = path.extname(filename).toLowerCase();
    const mime = ext === '.svg' ? 'image/svg+xml' : `image/${ext.slice(1)}`;
    const b64  = fs.readFileSync(assetPath).toString('base64');
    return `src="data:${mime};base64,${b64}"`;
  });

  return html;
}

exports.handler = async (event) => {
  const {
    user_name,
    completed_at,
    profile,
    scaled_scores,   // display% 0-100 — used for bar widths
    gaps,            // pre-computed by backend (132-scale, 3 gap types per role)
    interpretation,
  } = event;
  const assessment_id = event.result_id || event.assessment_id;

  console.log(`[pdf-v2] Starting PDF for assessment ${assessment_id}, user: ${user_name}`);

  // ── Compute derived data from pre-computed gaps ────────────────────────────
  const topGaps     = getTopGaps(gaps, 3);
  const actionPath  = computeActionPath(gaps);
  const actionPathMsgs = generateActionPathMessages(gaps, actionPath, scaled_scores);

  const gapsMap = {};
  for (const g of gaps) gapsMap[g.role] = g;

  // ── Render EJS template ────────────────────────────────────────────────────
  const templateSrc  = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const renderedHtml = ejs.render(templateSrc, {
    user_name,
    completed_at,
    profile,
    scaled_scores,    // display% for bar widths
    interpretation,
    gaps,
    gapsMap,
    topGaps,
    actionPath: actionPathMsgs,
    ROLES,
    ROLE_NAMES,
    ROLE_COLORS,
    ROLE_TINTS,
    GAP_TYPE_META,
  });

  const html = inlineAssets(renderedHtml);

  // ── Puppeteer — render to PDF ──────────────────────────────────────────────
  const browser = await puppeteer.launch({
    args:            chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath:  await chromium.executablePath(),
    headless:        chromium.headless,
  });

  let pdfBytes;

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123 });
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 });

    pdfBytes = await page.pdf({
      format:          'A4',
      printBackground: true,
      margin: { top: '18mm', bottom: '22mm', left: '15mm', right: '15mm' },
    });

    console.log(`[pdf-v2] PDF generated, ${pdfBytes.length} bytes`);
  } finally {
    await browser.close();
  }

  // ── Upload to S3 ───────────────────────────────────────────────────────────
  const s3  = new S3Client({ region: process.env.AWS_REGION });
  const key = `reports/${assessment_id}.pdf`;

  await s3.send(new PutObjectCommand({
    Bucket:      process.env.S3_BUCKET_NAME,
    Key:         key,
    Body:        pdfBytes,
    ContentType: 'application/pdf',
  }));

  const pdfUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  console.log(`[pdf-v2] Uploaded to S3: ${pdfUrl}`);

  // ── PATCH Supabase assessments.pdf_url ─────────────────────────────────────
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const resp = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/assessments?id=eq.${assessment_id}`,
        {
          method: 'PATCH',
          headers: {
            apikey:         process.env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization:  `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            Prefer:         'return=minimal',
          },
          body: JSON.stringify({ pdf_url: pdfUrl }),
        },
      );
      if (!resp.ok) throw new Error(`Supabase PATCH ${resp.status}: ${await resp.text()}`);
      console.log(`[pdf-v2] Supabase pdf_url updated for ${assessment_id}`);
      break;
    } catch (err) {
      console.error(`[pdf-v2] Supabase PATCH attempt ${attempt} failed: ${err.message}`);
      if (attempt === 2) console.error(`[pdf-v2] Giving up on Supabase PATCH`);
    }
  }

  return { statusCode: 200, assessment_id, pdf_url: pdfUrl };
};
```

- [ ] **Step 2: Verify syntax**

```bash
cd /Users/vrln/adizes-backend/lambda/pdf-generator-v2
node -e "require('./index'); console.log('syntax ok');" 2>&1 | head -5
```

Expected: `syntax ok` (will warn about missing env vars if any, but no syntax errors)

- [ ] **Step 3: Commit**

```bash
cd /Users/vrln/adizes-backend
git add lambda/pdf-generator-v2/index.js
git commit -m "feat: lambda index.js — switch from tensions.js to gaps.js, receive pre-computed gaps"
```

---

### Task 10: Lambda — EJS Template Redesign (Pages 1–2)

**Files:**
- Rewrite: `adizes-backend/lambda/pdf-generator-v2/template/report.html`

Note: This rewrites the entire template. The old 5-page template is replaced with a new 5-page design matching the approved mockups. `scaled_scores` values are now 0–100 display% (bar width = value directly).

- [ ] **Step 1: Replace report.html with new template (Pages 1–2)**

Replace the entire content of `adizes-backend/lambda/pdf-generator-v2/template/report.html` with:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>PAEI Energy Alignment Profile — <%= user_name %></title>
  <link rel="stylesheet" href="./styles.css">
</head>
<body>

<%
  /* ── Helpers ─────────────────────────────────────────────────────── */
  function pct(val) { return Math.round(val); }  /* display% already 0-100 */
  function signed(d) { return (d > 0 ? '+' : '') + d; }
  function severityBadge(sev) {
    if (sev === 'high')   return { emoji: '🔴', label: 'HIGH',     cls: 'sev-high' };
    if (sev === 'medium') return { emoji: '🟡', label: 'MODERATE', cls: 'sev-medium' };
    return { emoji: '⚪', label: 'LOW', cls: 'sev-low' };
  }
  function lensScore(role, lensKey) {
    return pct(scaled_scores[lensKey][role]);
  }
  const dateStr = new Date(completed_at).toLocaleDateString('en-GB',
    { year: 'numeric', month: 'long', day: 'numeric' });

  /* Top gap for core insight narrative */
  const topGap = topGaps[0] || null;

  const LENS_LABELS = {
    is:     'Current State',
    should: 'Role Expectations',
    want:   'Intrinsic Preference',
  };
%>

<!-- ═══════════════════════════════════════════════════════════
     PAGE 1 — Energy Alignment Snapshot
     ═══════════════════════════════════════════════════════════ -->
<div class="page page-break">
  <div class="page-header">
    <img class="logo" src="./assets/logo.png" alt="HILeadership">
    <span class="header-tagline">PAEI Energy Alignment Profile</span>
  </div>

  <div class="snapshot-hero">
    <div class="snapshot-name"><%= user_name %></div>
    <div class="snapshot-date"><%= dateStr %></div>
    <div class="identity-badge"><%= interpretation.identity_line %></div>
  </div>

  <!-- 3×4 Energy Alignment Matrix -->
  <div class="section-label">Energy Alignment Matrix</div>
  <div class="matrix-table">
    <!-- Header row -->
    <div class="matrix-row matrix-header">
      <div class="matrix-lens-label"></div>
      <% ROLES.forEach(function(role) { %>
      <div class="matrix-role-header" style="color:<%- ROLE_COLORS[role] %>;">
        <%= ROLE_NAMES[role] %>&nbsp;(<%= role %>)
      </div>
      <% }); %>
    </div>
    <!-- Data rows: IS, SHOULD, WANT -->
    <% ['is','should','want'].forEach(function(lens, li) { %>
    <div class="matrix-row<%= lens === 'want' ? ' matrix-row-want' : '' %>">
      <div class="matrix-lens-label"><%= LENS_LABELS[lens] %></div>
      <% ROLES.forEach(function(role) {
           const val = pct(scaled_scores[lens][role]);
           const opacity = lens === 'want' ? '0.65' : '1';
      %>
      <div class="matrix-cell">
        <div class="matrix-bar-track">
          <div class="matrix-bar-fill"
               style="width:<%- val %>%;background:<%- ROLE_COLORS[role] %>;opacity:<%= opacity %>;"></div>
        </div>
        <div class="matrix-bar-label"><%= val %>%</div>
      </div>
      <% }); %>
    </div>
    <% }); %>
  </div>

  <!-- Core Insight -->
  <div class="section-label">Core Insight</div>
  <div class="core-insight-block">
    <% if (topGap) {
         const nb = severityBadge(topGap.severity);
    %>
    <span class="core-insight-accent" style="border-color:<%- ROLE_COLORS[topGap.role] %>;"></span>
    <div class="core-insight-text">
      <strong><%= ROLE_NAMES[topGap.role] %> (<%= topGap.role %>) — <%= topGap.meta.label %>:</strong>
      <%= topGap.narrative %>
    </div>
    <% } else { %>
    <div class="core-insight-text"><%= interpretation.style_tagline %></div>
    <% } %>
  </div>

  <!-- Top Energy Misalignments -->
  <div class="section-label">Top Energy Misalignments</div>
  <div class="top-gaps-row">
    <% topGaps.forEach(function(tg) {
         const nb = severityBadge(tg.severity);
         if (tg.severity === 'low') return;
    %>
    <div class="gap-pill gap-pill-<%= nb.cls %>">
      <div class="gap-pill-role" style="background:<%- ROLE_COLORS[tg.role] %>;">
        <%= tg.role %>
      </div>
      <div class="gap-pill-text">
        <span class="gap-pill-type"><%= tg.meta.label %></span>
        <span class="gap-pill-sev"><%= nb.emoji %> <%= nb.label %> &nbsp;<%= signed(tg.gap_signed) %>&nbsp;pts</span>
      </div>
    </div>
    <% }); %>
  </div>

  <div class="page-footer">
    <span>HILeadership | PAEI Energy Alignment Profile</span>
    <span>Confidential — Page 1</span>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════
     PAGE 2 — Gap Map
     ═══════════════════════════════════════════════════════════ -->
<div class="page page-break">
  <div class="page-header">
    <img class="logo" src="./assets/logo.png" alt="HILeadership">
    <span class="header-tagline">PAEI Energy Alignment Profile — Gap Map</span>
  </div>

  <h2 style="margin-bottom:4pt;">Gap Map</h2>
  <p style="font-size:8.5pt;color:#6b7280;margin-bottom:18pt;line-height:1.6;">
    The 3 largest energy misalignments across your PAEI profile. Each gap reflects where your
    perceptions of current behaviour, role expectations, and intrinsic preferences diverge most.
  </p>

  <% topGaps.forEach(function(tg) {
       const nb = severityBadge(tg.severity);
       const meta = tg.meta;
       const valA = pct(scaled_scores[meta.lensA][tg.role]);
       const valB = pct(scaled_scores[meta.lensB][tg.role]);
       const borderColor = tg.severity === 'high' ? '#C8102E' : '#E87722';
       const pillBg      = tg.severity === 'high' ? '#fff0f0' : '#fffbf0';
  %>
  <div class="gap-card" style="border-color:<%= borderColor %>;">
    <!-- Card header -->
    <div class="gap-card-header">
      <div class="gap-card-title-row">
        <div class="role-circle" style="background:<%- ROLE_COLORS[tg.role] %>;"><%= tg.role %></div>
        <div>
          <div class="gap-card-type"><%= meta.label %></div>
          <div class="gap-card-formula"><%= meta.formula %></div>
        </div>
      </div>
      <div class="gap-sev-pill" style="background:<%= pillBg %>;border-color:<%= borderColor %>;">
        <%= nb.emoji %> <strong style="color:<%= borderColor %>;"><%= nb.label %> &nbsp;<%= signed(tg.gap_signed) %>&nbsp;pts</strong>
      </div>
    </div>

    <!-- Comparison bars -->
    <div class="gap-bars">
      <div class="gap-bar-row">
        <div class="gap-bar-label"><%= meta.lensALabel %></div>
        <div class="gap-bar-track">
          <div class="gap-bar-fill" style="width:<%= valA %>%;background:<%- ROLE_COLORS[tg.role] %>;"></div>
        </div>
        <div class="gap-bar-val"><%= valA %>%</div>
      </div>
      <div class="gap-bar-row">
        <div class="gap-bar-label"><%= meta.lensBLabel %></div>
        <div class="gap-bar-track">
          <div class="gap-bar-fill" style="width:<%= valB %>%;background:<%- ROLE_COLORS[tg.role] %>;opacity:0.55;"></div>
        </div>
        <div class="gap-bar-val"><%= valB %>%</div>
      </div>
    </div>

    <!-- Narrative -->
    <div class="gap-card-narrative"><%= tg.narrative %></div>
  </div>
  <% }); %>

  <div class="page-footer">
    <span>HILeadership | PAEI Energy Alignment Profile</span>
    <span>Confidential — Page 2</span>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════
     PAGE 3 — What This Means
     ═══════════════════════════════════════════════════════════ -->
<div class="page page-break">
  <div class="page-header">
    <img class="logo" src="./assets/logo.png" alt="HILeadership">
    <span class="header-tagline">PAEI Energy Alignment Profile — What This Means</span>
  </div>

  <h2 style="margin-bottom:14pt;">What This Means</h2>

  <div class="meaning-grid">
    <div class="meaning-card best">
      <h3>✓ When you are at your best</h3>
      <p><%= interpretation.at_your_best %></p>
    </div>
    <div class="meaning-card friction">
      <h3>⚠ Where friction shows up</h3>
      <p><%= interpretation.friction_shows_up %></p>
    </div>
  </div>

  <div class="section-label">Early Warning Signs</div>
  <% (interpretation.early_warnings || []).forEach(function(warning) { %>
  <div class="warning-card"><%= warning %></div>
  <% }); %>
  <% if (!interpretation.early_warnings || interpretation.early_warnings.length === 0) { %>
  <div class="well-aligned-box">No significant early warning signs — your energy profile is well-aligned.</div>
  <% } %>

  <div class="page-footer">
    <span>HILeadership | PAEI Energy Alignment Profile</span>
    <span>Confidential — Page 3</span>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════
     PAGE 4 — Style Summary
     ═══════════════════════════════════════════════════════════ -->
<div class="page page-break">
  <div class="page-header">
    <img class="logo" src="./assets/logo.png" alt="HILeadership">
    <span class="header-tagline">PAEI Energy Alignment Profile — Style Summary</span>
  </div>

  <h2 style="margin-bottom:12pt;">Style Summary</h2>

  <div class="style-hero">
    <div class="style-hero-label"><%= interpretation.style_label %></div>
    <div class="style-hero-tagline"><%= interpretation.style_tagline %></div>
    <% if (interpretation.combined_description) { %>
    <div class="style-hero-desc"><%= interpretation.combined_description %></div>
    <% } %>
  </div>

  <div class="summary-grid">
    <div class="summary-card strengths">
      <h3>Strengths</h3>
      <p><%= interpretation.strengths %></p>
    </div>
    <div class="summary-card watchouts">
      <h3>Watchouts</h3>
      <p><%= interpretation.watchouts %></p>
    </div>
    <div class="summary-card stress">
      <h3>Under Stress</h3>
      <% (interpretation.mismanagement_risks || []).forEach(function(risk) { %>
      <p style="margin-bottom:5pt;"><%= risk %></p>
      <% }); %>
    </div>
  </div>

  <div class="page-footer">
    <span>HILeadership | PAEI Energy Alignment Profile</span>
    <span>Confidential — Page 4</span>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════
     PAGE 5 — Action Path
     ═══════════════════════════════════════════════════════════ -->
<div class="page">
  <div class="page-header">
    <img class="logo" src="./assets/logo.png" alt="HILeadership">
    <span class="header-tagline">PAEI Energy Alignment Profile — Action Path</span>
  </div>

  <h2 style="margin-bottom:4pt;">Your Action Path</h2>
  <p style="font-size:8.5pt;color:#6b7280;margin-bottom:16pt;">
    Four directions drawn from your energy alignment data. Internal shifts require personal adjustment;
    external shifts involve your role, environment, or relationships.
  </p>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12pt;">
    <div>
      <div class="action-path-section-label">Internal Shifts</div>
      <!-- Stretch -->
      <div class="action-card" style="border-left:3pt solid <%- actionPath.stretch.roleColor %>;">
        <div class="action-card-left">
          <div class="action-icon" style="background:<%- actionPath.stretch.roleColor %>;"><%= actionPath.stretch.role %></div>
          <div class="action-type-label stretch">Stretch</div>
        </div>
        <div class="action-card-right">
          <h3><%= actionPath.stretch.roleName %></h3>
          <p><%= actionPath.stretch.description %></p>
          <div class="action-prompt">→ <%= actionPath.stretch.action %></div>
        </div>
      </div>
      <!-- Balance -->
      <div class="action-card" style="border-left:3pt solid <%- actionPath.balance.roleColor %>;">
        <div class="action-card-left">
          <div class="action-icon" style="background:<%- actionPath.balance.roleColor %>;"><%= actionPath.balance.role %></div>
          <div class="action-type-label balance">Balance</div>
        </div>
        <div class="action-card-right">
          <h3><%= actionPath.balance.roleName %></h3>
          <p><%= actionPath.balance.description %></p>
          <div class="action-prompt">→ <%= actionPath.balance.action %></div>
        </div>
      </div>
      <!-- Protect -->
      <div class="action-card" style="border-left:3pt solid <%- actionPath.protect.roleColor %>;">
        <div class="action-card-left">
          <div class="action-icon" style="background:<%- actionPath.protect.roleColor %>;"><%= actionPath.protect.role %></div>
          <div class="action-type-label protect">Protect</div>
        </div>
        <div class="action-card-right">
          <h3><%= actionPath.protect.roleName %></h3>
          <p><%= actionPath.protect.description %></p>
          <div class="action-prompt">→ <%= actionPath.protect.action %></div>
        </div>
      </div>
    </div>

    <div>
      <div class="action-path-section-label">External Shifts</div>
      <!-- Complement -->
      <div class="action-card" style="border-left:3pt solid <%- actionPath.complement.roleColor %>;">
        <div class="action-card-left">
          <div class="action-icon" style="background:<%- actionPath.complement.roleColor %>;"><%= actionPath.complement.role %></div>
          <div class="action-type-label complement">Complement</div>
        </div>
        <div class="action-card-right">
          <h3><%= actionPath.complement.roleName %></h3>
          <p><%= actionPath.complement.description %></p>
          <div class="action-prompt">→ <%= actionPath.complement.action %></div>
        </div>
      </div>
      <!-- Role Design -->
      <div class="action-card" style="border-left:3pt solid #6b7280;">
        <div class="action-card-left">
          <div class="action-icon" style="background:#6b7280;">R</div>
          <div class="action-type-label" style="color:#6b7280;">Role Design</div>
        </div>
        <div class="action-card-right">
          <h3>Reshaping your role</h3>
          <p>Your Intrinsic Preference reveals the energy you find most natural.
          Look for ways to redesign tasks, delegate, or negotiate responsibilities
          so your role draws more on what energises you.</p>
          <div class="action-prompt">→ Identify one responsibility that drains you and explore who could own it instead.</div>
        </div>
      </div>
    </div>
  </div>

  <div style="margin-top:14pt;padding:10pt 12pt;background:#f9fafb;border-radius:5pt;border:1pt solid #e5e7eb;">
    <p style="font-size:8pt;color:#6b7280;line-height:1.6;">
      <strong style="color:#374151;">How to use this report:</strong> Your PAEI profile is a tool for
      self-awareness, not a fixed label. Strengths become liabilities when over-used. Use this report
      to open conversations with colleagues, coaches, and managers.
    </p>
  </div>

  <div class="page-footer">
    <span>HILeadership | PAEI Energy Alignment Profile</span>
    <span>Confidential — Page 5</span>
  </div>
</div>

</body>
</html>
```

- [ ] **Step 2: Test with local render**

```bash
cd /Users/vrln/adizes-backend/lambda/pdf-generator-v2
node test-local.js 2>&1 | tail -20
```

Expected: No errors; output shows PDF generation or template render success.

- [ ] **Step 3: Commit**

```bash
cd /Users/vrln/adizes-backend
git add lambda/pdf-generator-v2/template/report.html
git commit -m "feat: lambda template — 5-page redesign with 3x4 matrix, gap cards, new action path layout"
```

---

### Task 11: Lambda — Deploy

**Files:**
- No code changes — deploy existing code to AWS Lambda

- [ ] **Step 1: Deploy**

```bash
cd /Users/vrln/adizes-backend/lambda/pdf-generator-v2
export SUPABASE_URL=https://swiznkamzxyfzgckebqi.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY /Users/vrln/adizes-backend/.env | cut -d'=' -f2)
export S3_BUCKET_NAME=adizes-pdf-reports
AWS_PROFILE=lax-t3-assumed ./deploy.sh
```

Expected: `✓ Lambda deployed: adizes-pdf-generator-v2 → <ECR_URI>`

- [ ] **Step 2: Smoke test by triggering a PDF**

After completing a test assessment (Tasks 13–16 must be done first), or via direct Lambda invocation:

```bash
AWS_PROFILE=lax-t3-assumed aws lambda invoke \
  --function-name adizes-pdf-generator-v2 \
  --region ap-south-1 \
  --payload file:///tmp/test-payload.json \
  --cli-binary-format raw-in-base64-out \
  /tmp/lambda-response.json
cat /tmp/lambda-response.json
```

Expected: `{"statusCode": 200, "assessment_id": "...", "pdf_url": "https://..."}`

- [ ] **Step 3: Commit (no code change, tag the deploy)**

```bash
cd /Users/vrln/adizes-backend
git tag lambda-v2-redesign-deploy-$(date +%Y%m%d)
git push origin master --tags
```

---

### Task 12: Frontend — EnergyMatrix Component

**Files:**
- Create: `adizes-frontend/src/components/ui/EnergyMatrix.tsx`

- [ ] **Step 1: Write failing type-check**

```bash
cd /Users/vrln/adizes-frontend
npx tsc --noEmit 2>&1 | grep EnergyMatrix
```

Expected: no errors yet (file doesn't exist, nothing imports it yet)

- [ ] **Step 2: Create EnergyMatrix.tsx**

Create `/Users/vrln/adizes-frontend/src/components/ui/EnergyMatrix.tsx`:

```tsx
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import type { ScoreSet } from "@/types/api";

interface Props {
  display_scores: { is: ScoreSet; should: ScoreSet; want: ScoreSet };
}

const ROLES = ["P", "A", "E", "I"] as const;

const ROLE_META: Record<typeof ROLES[number], { label: string; color: string }> = {
  P: { label: "Producer",      color: "#C8102E" },
  A: { label: "Administrator", color: "#1D3557" },
  E: { label: "Entrepreneur",  color: "#E87722" },
  I: { label: "Integrator",    color: "#2A9D8F" },
};

const ROWS: { label: string; key: keyof Props["display_scores"]; dimmed?: boolean }[] = [
  { label: "Current State",       key: "is"     },
  { label: "Role Expectations",   key: "should" },
  { label: "Intrinsic Preference", key: "want", dimmed: true },
];

export function EnergyMatrix({ display_scores }: Props) {
  return (
    <div className="w-full">
      <div className="flex items-center gap-1.5 mb-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Energy Alignment Matrix
        </p>
        <InfoTooltip text="Each bar shows what percentage of your total energy goes to each PAEI role, per lens. Current State = how you operate now. Role Expectations = what your role demands. Intrinsic Preference = your natural inclination (shown lighter as an anchor lens). Scores sum to 100% per row." />
      </div>

      {/* Column headers */}
      <div className="grid gap-1" style={{ gridTemplateColumns: "130px repeat(4, 1fr)" }}>
        <div />
        {ROLES.map((r) => (
          <div
            key={r}
            className="text-center text-xs font-bold pb-1"
            style={{ color: ROLE_META[r].color }}
          >
            <span className="text-sm">{r}</span>
            <span className="hidden sm:block text-[10px] font-normal text-gray-400">
              {ROLE_META[r].label}
            </span>
          </div>
        ))}
      </div>

      {/* Data rows */}
      <div className="space-y-2">
        {ROWS.map(({ label, key, dimmed }) => (
          <div
            key={key}
            className="grid gap-1 items-center"
            style={{
              gridTemplateColumns: "130px repeat(4, 1fr)",
              opacity: dimmed ? 0.7 : 1,
            }}
          >
            <div className="text-xs font-medium text-gray-500 truncate pr-2">{label}</div>
            {ROLES.map((r) => {
              const val = display_scores[key][r];
              return (
                <div key={r} className="px-1">
                  <div className="bg-gray-100 rounded-sm h-3 overflow-hidden">
                    <div
                      className="h-full rounded-sm transition-all duration-300"
                      style={{ width: `${val}%`, backgroundColor: ROLE_META[r].color }}
                    />
                  </div>
                  <div className="text-[10px] text-gray-400 text-center mt-0.5">{val}%</div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
cd /Users/vrln/adizes-frontend && npx tsc --noEmit 2>&1 | grep EnergyMatrix
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
cd /Users/vrln/adizes-frontend
git add src/components/ui/EnergyMatrix.tsx
git commit -m "feat: EnergyMatrix component — 3x4 lens×role bar matrix, display% scale"
```

---

### Task 13: Frontend — GapCard + GapBadge + ScoresTable Updates

**Files:**
- Create: `adizes-frontend/src/components/ui/GapCard.tsx`
- Modify: `adizes-frontend/src/components/ui/GapBadge.tsx`
- Modify: `adizes-frontend/src/components/ui/ScoresTable.tsx`

- [ ] **Step 1: Create GapCard.tsx**

Create `/Users/vrln/adizes-frontend/src/components/ui/GapCard.tsx`:

```tsx
import type { TopGap } from "@/types/api";
import type { ScoreSet } from "@/types/api";

interface Props {
  gap: TopGap;
  display_scores: { is: ScoreSet; should: ScoreSet; want: ScoreSet };
}

const ROLE_COLORS: Record<string, string> = {
  P: "#C8102E", A: "#1D3557", E: "#E87722", I: "#2A9D8F",
};

const GAP_TYPE_META: Record<TopGap["gap_type"], {
  label: string; formula: string;
  lensA: keyof Props["display_scores"]; lensALabel: string;
  lensB: keyof Props["display_scores"]; lensBLabel: string;
}> = {
  execution:    { label: "Execution Gap",    formula: "Role Expectations − Current State",       lensA: "should", lensALabel: "Role Expectations",   lensB: "is",   lensBLabel: "Current State"        },
  engagement:   { label: "Engagement Gap",   formula: "Role Expectations − Intrinsic Preference", lensA: "should", lensALabel: "Role Expectations",   lensB: "want", lensBLabel: "Intrinsic Preference" },
  authenticity: { label: "Authenticity Gap", formula: "Current State − Intrinsic Preference",     lensA: "is",     lensALabel: "Current State",        lensB: "want", lensBLabel: "Intrinsic Preference" },
};

function SeverityPill({ severity, signed }: { severity: TopGap["severity"]; signed: number }) {
  const isHigh = severity === "high";
  const isMed  = severity === "medium";
  if (!isHigh && !isMed) return null;
  const borderColor = isHigh ? "#C8102E" : "#E87722";
  const bg          = isHigh ? "#fff0f0" : "#fffbf0";
  const label       = isHigh ? "HIGH" : "MODERATE";
  const emoji       = isHigh ? "🔴" : "🟡";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold border"
      style={{ background: bg, borderColor, color: borderColor }}
    >
      {emoji} {label}&nbsp;{signed > 0 ? "+" : ""}{signed}&nbsp;pts
    </span>
  );
}

export function GapCard({ gap, display_scores }: Props) {
  const meta = GAP_TYPE_META[gap.gap_type];
  const roleColor = ROLE_COLORS[gap.role] ?? "#6b7280";
  const valA = display_scores[meta.lensA][gap.role as keyof ScoreSet];
  const valB = display_scores[meta.lensB][gap.role as keyof ScoreSet];
  const borderColor = gap.severity === "high" ? "#C8102E" : gap.severity === "medium" ? "#E87722" : "#d1d5db";

  return (
    <div
      className="rounded-lg p-4 mb-3"
      style={{ border: `1.5px solid ${borderColor}` }}
    >
      {/* Card header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
            style={{ background: roleColor }}
          >
            {gap.role}
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900">{meta.label}</div>
            <div className="text-xs text-gray-400">{meta.formula}</div>
          </div>
        </div>
        <SeverityPill severity={gap.severity} signed={gap.gap_signed} />
      </div>

      {/* Comparison bars */}
      <div className="space-y-1.5 mb-3">
        {[
          { label: meta.lensALabel, val: valA, opacity: 1 },
          { label: meta.lensBLabel, val: valB, opacity: 0.55 },
        ].map(({ label, val, opacity }) => (
          <div key={label} className="grid gap-2 items-center" style={{ gridTemplateColumns: "120px 1fr 36px" }}>
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide truncate">{label}</div>
            <div className="bg-gray-100 rounded-sm h-3 overflow-hidden">
              <div
                className="h-full rounded-sm"
                style={{ width: `${val}%`, backgroundColor: roleColor, opacity }}
              />
            </div>
            <div className="text-[11px] text-gray-400 text-right">{val}%</div>
          </div>
        ))}
      </div>

      {/* Narrative */}
      {gap.narrative && (
        <p className="text-xs text-gray-600 leading-relaxed border-t border-gray-100 pt-2">
          {gap.narrative}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update GapBadge.tsx**

In `adizes-frontend/src/components/ui/GapBadge.tsx`, update thresholds from old scale to 132 scale:

Old:
```typescript
  let variant = "green";
  if (absGap >= 5 && absGap <= 6) variant = "amber";
  if (absGap >= 7) variant = "red";
```

New:
```typescript
  let variant = "green";
  if (absGap >= 6 && absGap <= 15) variant = "amber";
  if (absGap > 15) variant = "red";
```

- [ ] **Step 3: Update ScoresTable.tsx**

In `adizes-frontend/src/components/ui/ScoresTable.tsx`, update scale labels and tooltip:

Old (line 29–31):
```typescript
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Raw Scores (12–48)
        </p>
        <InfoTooltip text="Each role score ranges from 12 (always ranked last) to 48 (always ranked first). A score above 30 is considered dominant (shown as a capital letter in your profile). Is = how you currently behave. Should = what your role demands. Want = your natural preference." />
```

New:
```typescript
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Energy Scores (0–100%)
        </p>
        <InfoTooltip text="Each role score shows the percentage of your total energy directed at that role, per lens. Scores sum to 100% per row. A raw score above 33 (out of 132) is considered dominant — shown as a capital letter in your profile. Current State = how you behave now. Role Expectations = what your role demands. Intrinsic Preference = your natural preference." />
```

Also update row labels (old: Should/Want/Is; keep same order but update aria labels are fine as-is).

Also update the table header row cell to not show range:
Old (line 29): `Raw Scores (12–48)` → already updated above.

- [ ] **Step 4: Type-check**

```bash
cd /Users/vrln/adizes-frontend && npx tsc --noEmit 2>&1 | grep -E "GapCard|GapBadge|ScoresTable"
```

Expected: no errors from these files

- [ ] **Step 5: Commit**

```bash
cd /Users/vrln/adizes-frontend
git add src/components/ui/GapCard.tsx src/components/ui/GapBadge.tsx src/components/ui/ScoresTable.tsx
git commit -m "feat: GapCard component, GapBadge thresholds 6/15, ScoresTable display% labels"
```

---

### Task 14: Frontend — Results.tsx

**Files:**
- Modify: `adizes-frontend/src/pages/Results.tsx`

**Changes summary:**
- Remove Recharts `RadarChart` + `BarChart` imports and usage
- Add `EnergyMatrix` component (replacing radar)
- Add `GapCard` components for top-3 gaps (replacing bar chart + gap list)
- Update `blind_spots` → `watchouts`
- Update dominant style tooltip copy (threshold now raw > 33)
- Keep sticky PDF bar unchanged

- [ ] **Step 1: Replace Results.tsx**

Replace the entire content of `adizes-frontend/src/pages/Results.tsx`:

```tsx
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { useAssessmentStore } from "@/store/assessmentStore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Download, Loader2 } from "lucide-react";
import { Users, CheckCircle2, Info } from "lucide-react";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { motion } from "motion/react";
import { EnergyMatrix } from "@/components/ui/EnergyMatrix";
import { GapCard } from "@/components/ui/GapCard";
import { getResult } from "@/api/results";
import type { ResultResponse, TopGap } from "@/types/api";

function getTopGaps(result: ResultResponse): TopGap[] {
  const all: TopGap[] = [];
  for (const g of result.gaps) {
    for (const gapType of ["execution", "engagement", "authenticity"] as const) {
      all.push({
        role:       g.role,
        role_name:  g.role_name,
        gap_type:   gapType,
        gap_abs:    g[`${gapType}_gap`],
        gap_signed: g[`${gapType}_gap_signed`],
        severity:   g[`${gapType}_severity`],
        narrative:  g[`${gapType}_narrative`],
        is_score:     g.is_score,
        should_score: g.should_score,
        want_score:   g.want_score,
      });
    }
  }
  return all.sort((a, b) => b.gap_abs - a.gap_abs).slice(0, 3);
}

export function Results() {
  const { user } = useAuthStore();
  const { resultId } = useAssessmentStore();
  const [searchParams] = useSearchParams();
  const [result, setResult] = useState<ResultResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [checkingPdf, setCheckingPdf] = useState(false);
  const [pdfCheckMessage, setPdfCheckMessage] = useState("");
  const [error, setError] = useState("");

  const id = searchParams.get("id") ?? resultId;

  useEffect(() => {
    if (!id) {
      setError("No result found. Please complete the assessment first.");
      setLoading(false);
      return;
    }
    getResult(id)
      .then((r) => { setResult(r); setPdfUrl(r.pdf_url); })
      .catch(() => setError("Failed to load results. Please try again."))
      .finally(() => setLoading(false));
  }, [id]);

  const handleCheckAgain = async () => {
    if (!id) return;
    setCheckingPdf(true);
    setPdfCheckMessage("");
    try {
      const r = await getResult(id);
      if (r.pdf_url) { setPdfUrl(r.pdf_url); setPdfCheckMessage(""); }
      else setPdfCheckMessage("Still generating, try again shortly.");
    } catch {
      setPdfCheckMessage("Could not check status. Please try again.");
    } finally {
      setCheckingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading your results…</p>
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <p className="text-red-600 font-medium">{error || "Results not available."}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { profile, scaled_scores, interpretation } = result;
  const topGaps = getTopGaps(result);

  const profileBadges = (profile.want ?? "paei").split("").map((char) => {
    const role = char.toUpperCase() as "P" | "A" | "E" | "I";
    const isDominant = char === char.toUpperCase();
    return { role, char, isDominant };
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header Band */}
      <div className="bg-gray-900 text-white py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col md:flex-row md:items-end justify-between gap-6"
          >
            <div>
              <h1 className="text-4xl font-display font-bold tracking-tight mb-2">
                {result.user_name}'s Results
              </h1>
              <p className="text-gray-400 text-lg">
                Completed on {new Date(result.completed_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-4 bg-gray-800/50 p-4 rounded-xl border border-gray-700 backdrop-blur-sm">
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-gray-400 font-medium uppercase tracking-wider">Dominant Style</span>
                <InfoTooltip text="Your PAEI profile based on the 'Want' (Intrinsic Preference) dimension. A CAPITAL letter means that role's raw score exceeded 33 out of 132 (its proportional share). A lowercase letter means it scored 33 or below." />
              </div>
              <div className="flex gap-1.5">
                {profileBadges.map(({ role, char, isDominant }) =>
                  isDominant ? (
                    <Badge key={role} variant={role} className="text-xl px-3 py-1 shadow-sm">{char}</Badge>
                  ) : (
                    <Badge key={role} variant="outline" className="text-xl px-3 py-1 bg-gray-800 text-gray-300 border-gray-600">{char}</Badge>
                  )
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-4 sm:-mt-8">
        <div className="grid gap-6 sm:gap-8 lg:grid-cols-2">

          {/* Energy Alignment Matrix */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
            <Card className="h-full shadow-md border-t-4 border-t-primary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Energy Alignment Matrix
                  <InfoTooltip text="Three lenses for three assessment questions: Current State = how you operate now. Role Expectations = what your role demands. Intrinsic Preference = how you naturally prefer to act (shown lighter). Bars show the percentage of total energy per role, per lens." />
                </CardTitle>
                <CardDescription>
                  How your energy distributes across P, A, E, I — by lens.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EnergyMatrix display_scores={scaled_scores} />
              </CardContent>
            </Card>
          </motion.div>

          {/* Top Gap Cards */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
            <Card className="h-full shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Top Energy Misalignments
                  <InfoTooltip text="The 3 largest gaps across your 12 gap values (4 roles × 3 types). Execution Gap = Role Expectations − Current State. Engagement Gap = Role Expectations − Intrinsic Preference. Authenticity Gap = Current State − Intrinsic Preference. Thresholds on the 132-point scale: < 6 aligned, 6–15 moderate, > 15 high." />
                </CardTitle>
                <CardDescription>
                  Where your energy perceptions diverge most.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {topGaps.filter(g => g.severity !== "low").length === 0 ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
                    Your energy profile is well-aligned — no significant misalignments detected.
                  </div>
                ) : (
                  topGaps
                    .filter(g => g.severity !== "low")
                    .map((g, i) => (
                      <GapCard key={`${g.role}-${g.gap_type}-${i}`} gap={g} display_scores={scaled_scores} />
                    ))
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Interpretation */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }} className="lg:col-span-2">
            <Card className="shadow-md bg-white">
              <CardHeader>
                <div className="flex items-center gap-3 mb-1">
                  <span className="inline-block bg-primary text-white text-sm font-bold px-3 py-1 rounded-full">
                    {interpretation.style_label}
                  </span>
                  <span className="text-gray-500 italic text-sm">{interpretation.style_tagline}</span>
                </div>
                <CardTitle className="text-2xl font-display flex items-center gap-2">
                  Style Interpretation
                  <InfoTooltip text="Based on your dominant Intrinsic Preference roles. Describes how you naturally lead and collaborate. Strengths are your assets; Watchouts are where growth lies; Working with Others shows how to bridge style differences." />
                </CardTitle>
                {interpretation.combined_description && (
                  <CardDescription className="text-base">{interpretation.combined_description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-green-700 font-medium">
                      <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      Strengths
                      <InfoTooltip text="Natural advantages of your dominant PAEI style — behaviours and qualities that come easily to you." />
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed">{interpretation.strengths}</p>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-amber-700 font-medium">
                      <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
                        <Info className="h-5 w-5" />
                      </div>
                      Watchouts
                      <InfoTooltip text="Typical pitfalls of your style — patterns that can undermine effectiveness if left unchecked." />
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed">{interpretation.watchouts}</p>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-blue-700 font-medium">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <Users className="h-5 w-5" />
                      </div>
                      Working with Others
                      <InfoTooltip text="Practical tips for collaborating with the other three PAEI styles." />
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed">{interpretation.working_with_others}</p>
                  </div>
                </div>

                {interpretation.mismanagement_risks.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-gray-100">
                    <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      Under Stress
                      <InfoTooltip text="The dysfunctional extreme your dominant style can slide into under prolonged stress." />
                    </h4>
                    <div className="space-y-2">
                      {interpretation.mismanagement_risks.map((risk, i) => (
                        <div key={i} className="bg-red-50 border-l-4 border-red-400 px-4 py-2 rounded-r-md text-sm text-gray-700">
                          {risk}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 pt-3 pb-4 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)] z-50" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-4 px-0 sm:px-2">
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-gray-900">Your PDF report</p>
            {pdfUrl
              ? <p className="text-xs text-gray-500">Ready to download.</p>
              : <p className="text-xs text-gray-500">Being generated in the background.</p>
            }
          </div>
          <div className="flex flex-col items-end gap-1">
            {pdfUrl ? (
              <Button size="lg" onClick={() => window.open(pdfUrl, "_blank")} className="w-full sm:w-auto shadow-md hover:shadow-lg transition-all">
                <Download className="mr-2 h-5 w-5" /> Download Full Report (PDF)
              </Button>
            ) : (
              <Button size="lg" disabled className="w-full sm:w-auto opacity-60 cursor-not-allowed">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Generating report…
              </Button>
            )}
            {!pdfUrl && (
              <button onClick={handleCheckAgain} disabled={checkingPdf} className="text-xs text-primary hover:underline disabled:opacity-50">
                {checkingPdf ? "Checking…" : "Check again"}
              </button>
            )}
            {pdfCheckMessage && <p className="text-xs text-gray-500">{pdfCheckMessage}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/vrln/adizes-frontend && npx tsc --noEmit 2>&1 | grep "Results"
```

Expected: no errors

- [ ] **Step 3: Start dev server and test manually**

```bash
cd /Users/vrln/adizes-frontend && npm run dev
```

Navigate to `http://localhost:3000` → log in → complete or view an existing assessment result. Verify:
1. Energy Alignment Matrix renders with 3 rows × 4 columns of bars
2. Top 3 gap cards show (or "well-aligned" message if no gaps ≥ 6)
3. Interpretation section shows "Watchouts" (not "Blind Spots"), "Under Stress" (not "Mismanagement Risk")
4. Sticky PDF bar still shows

- [ ] **Step 4: Commit**

```bash
cd /Users/vrln/adizes-frontend
git add src/pages/Results.tsx
git commit -m "feat: Results.tsx — EnergyMatrix replaces radar, GapCard replaces bar chart, watchouts/under-stress"
```

---

### Task 15: Frontend — AdminRespondent.tsx + AdminCohortDetail.tsx

**Files:**
- Modify: `adizes-frontend/src/pages/AdminRespondent.tsx`
- Modify: `adizes-frontend/src/pages/AdminCohortDetail.tsx`

- [ ] **Step 1: Update AdminRespondent.tsx**

The admin view of an individual member's results mirrors Results.tsx. Apply the same swap:
- Remove Recharts imports (RadarChart, BarChart, etc.)
- Replace `GapBadge` gap rendering with `GapCard` components
- Add `EnergyMatrix` in place of the RadarChart
- Update `interpretation.blind_spots` → `interpretation.watchouts`
- Remove unused recharts imports

Read the full file first, then make these targeted edits:

**Remove unused imports** (around lines 13–26):

Remove:
```typescript
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
```

Add in its place:
```typescript
import { EnergyMatrix } from "@/components/ui/EnergyMatrix";
import { GapCard } from "@/components/ui/GapCard";
import type { TopGap } from "@/types/api";
```

**Add `getTopGaps` helper** (before the `AdminRespondent` function definition):

```typescript
function getTopGaps(gaps: GapDetail[]): TopGap[] {
  const all: TopGap[] = [];
  for (const g of gaps) {
    for (const gapType of ["execution", "engagement", "authenticity"] as const) {
      all.push({
        role:       g.role,
        role_name:  g.role_name,
        gap_type:   gapType,
        gap_abs:    g[`${gapType}_gap`],
        gap_signed: g[`${gapType}_gap_signed`],
        severity:   g[`${gapType}_severity`],
        narrative:  g[`${gapType}_narrative`],
        is_score:     g.is_score,
        should_score: g.should_score,
        want_score:   g.want_score,
      });
    }
  }
  return all.sort((a, b) => b.gap_abs - a.gap_abs).slice(0, 3);
}
```

**Replace RadarChart JSX** with `<EnergyMatrix display_scores={result.scaled_scores} />` inside the card that previously held the radar.

**Replace gap list JSX** (the `gaps.map(g => ...)` block) with:

```tsx
const topGaps = getTopGaps(result.gaps);
// ...
{topGaps.filter(g => g.severity !== "low").map((g, i) => (
  <GapCard key={`${g.role}-${g.gap_type}-${i}`} gap={g} display_scores={result.scaled_scores} />
))}
```

**Replace `interpretation.blind_spots`** with `interpretation.watchouts`.

**Replace `"Blind Spots"` label** with `"Watchouts"`.

- [ ] **Step 2: Update AdminCohortDetail.tsx**

Three changes only (minimal):

**A — Replace team radar with matrix bars:**

Find the `<RadarChart>` block inside `AdminCohortDetail`. Replace the entire chart card with:

```tsx
{cohort.team_scores && (
  <Card className="shadow-sm mb-6">
    <CardHeader>
      <CardTitle className="text-base">Team Energy Profile</CardTitle>
      <CardDescription>Average energy distribution across the cohort</CardDescription>
    </CardHeader>
    <CardContent>
      <EnergyMatrix display_scores={cohort.team_scores.average_scaled} />
    </CardContent>
  </Card>
)}
```

Add import at top:
```typescript
import { EnergyMatrix } from "@/components/ui/EnergyMatrix";
```

Remove Recharts imports that are now unused.

**B — Add `expired` badge state in members table:**

Find the status badge rendering in the respondents table. Add `expired` case:

Old pattern (find the `getStatusBadge` function or inline status check):
```typescript
// Whatever the current status badge logic is, ensure "expired" renders as:
```

New/updated logic (add `expired` case):
```typescript
function getStatusBadge(status: string) {
  if (status === "completed")  return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Completed</span>;
  if (status === "in_progress") return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">In Progress</span>;
  if (status === "expired")    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">Expired</span>;
  return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">Pending</span>;
}
```

**C — Update dominant style tooltip** in the table header:

Find: `"A score above 30 is considered dominant"` → Replace with: `"A score above 33 out of 132 (its proportional share) is considered dominant"`

- [ ] **Step 3: Type-check all pages**

```bash
cd /Users/vrln/adizes-frontend && npx tsc --noEmit 2>&1
```

Expected: zero errors

- [ ] **Step 4: Test in browser**

```bash
cd /Users/vrln/adizes-frontend && npm run dev
```

Log in as admin → navigate to a cohort → open a member's results. Verify:
1. Team Energy Profile uses EnergyMatrix bars (not radar chart)
2. Member results page shows GapCard components
3. "Expired" badge renders in amber (distinct from "Pending" grey)
4. "Watchouts" shows (not "Blind Spots") in interpretation section

- [ ] **Step 5: Commit**

```bash
cd /Users/vrln/adizes-frontend
git add src/pages/AdminRespondent.tsx src/pages/AdminCohortDetail.tsx
git commit -m "feat: admin pages — EnergyMatrix, GapCard, expired badge, watchouts label"
```

---

## Self-Review

### Spec coverage check

| Spec requirement | Task |
|---|---|
| RANK_POINTS = {1:5, 2:3, 3:2, 4:1}, total 132 | Task 2 |
| Dominance factor: >75% top-2 → ×1.05 → rebalance | Task 3 |
| DOMINANT_THRESHOLD = 33 | Task 2 |
| Display normalization: (raw/132)×100 | Task 2 |
| 3 gap types: Execution/Engagement/Authenticity | Task 4 |
| Severity thresholds: <6 low, 6-15 medium, >15 high | Task 4 |
| Top 3 gaps selection | Tasks 4, 8, 14, 15 |
| Migration 010 clean slate DELETE | Task 1 |
| `interpret()` new signature + new fields | Task 5 |
| `watchouts` (renamed from blind_spots) | Tasks 5, 14, 15, 16 |
| `identity_line`, `at_your_best`, `friction_shows_up`, `early_warnings` | Task 5 |
| Assessment router uses raw for gaps/interpret, display for DB | Task 6 |
| Lambda receives display% in scaled_scores | Tasks 6, 9 |
| Lambda uses gaps.js (not tensions.js) | Tasks 8, 9 |
| PDF Page 1: 3×4 matrix + core insight + top 3 pills | Task 10 |
| PDF Page 2: 3 gap cards with comparison bars | Task 10 |
| PDF Pages 3-5: new interpretation fields | Task 10 |
| Frontend: EnergyMatrix replaces radar | Tasks 12, 14, 15, 16 |
| Frontend: GapCard replaces bar chart | Tasks 13, 14, 15, 16 |
| Frontend: `expired` badge state | Task 16 |
| Frontend: api.ts types updated | Task 7 |

### Placeholder scan: None found.

### Type consistency check

- `score_answers()` returns `{raw, display, profile}` — used correctly in Task 6 (`scores["raw"]`, `scores["display"]`, `scores["profile"]`)
- `compute_gaps(raw)` takes 132-scale raw dict — passed correctly in Task 6
- `interpret(raw_scores, profile, gaps=gaps)` — called correctly in Task 6
- `get_top_gaps(gaps, n=3)` — used in Task 5 (Python) and Tasks 14/15 (frontend helper)
- `TopGap` type defined in Task 7, consumed in Tasks 13/14/15/16
- `GapDetail` has `execution_gap`, `engagement_gap`, `authenticity_gap` — consistent across Tasks 4, 7, 13
- Lambda `topGaps` from `getTopGaps(gaps, 3)` — `gaps` = event.gaps from backend = output of `compute_gaps()` ✓
- Lambda `actionPath` from `computeActionPath(gaps)` — correct ✓
- Lambda template uses `topGaps[n].meta.lensA` / `.lensB` — provided by `GAP_TYPE_META` in gaps.js ✓

---

**Plan complete and saved.**

Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks

**2. Inline Execution** — execute tasks in this session using executing-plans skill

Which approach?
