# Ranking-Based Scoring Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-choice 0–50 scoring with Adizes-standard rank-order 12–48 scoring, including a new click-to-rank assessment UX and database migration.

**Architecture:** DB migration adds `ranks` JSONB to `answers` and `status` column to `assessments`; backend scoring engine reads rank weights (5−rank) instead of counting selections; frontend Assessment page becomes a sequential click-to-rank interface; Dashboard handles `expired` status for old assessments.

**Tech Stack:** FastAPI + Pydantic v2 + Supabase PostgreSQL (backend); React 19 + TypeScript + Zustand v5 + Tailwind CSS v4 (frontend); pytest (backend tests).

**Spec:** `docs/superpowers/specs/2026-03-13-ranking-scoring-redesign.md`

---

## Chunk 1: Backend — Migration, Scoring Engine, Schemas, Routers

---

### Task 1: Write database migration

**Files:**
- Create: `adizes-backend/migrations/003_ranking_scoring.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- migrations/003_ranking_scoring.sql
-- Ranking-based scoring redesign
-- Run order: this file after 001 and 002

-- 1. Add ranks JSONB to answers table
--    One row per question per assessment (UNIQUE constraint unchanged).
--    ranks = {"a": 1, "b": 3, "c": 4, "d": 2}  -- value = rank (1=most preferred)
ALTER TABLE answers ADD COLUMN IF NOT EXISTS ranks JSONB;
CREATE INDEX IF NOT EXISTS idx_answers_ranks ON answers USING gin(ranks);

-- 2. Add status column to assessments
--    assessments previously had no status column; status was derived from completed_at.
ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'in_progress', 'completed', 'expired'));

-- 3. Derive initial status from existing timestamps (preserves audit trail)
UPDATE assessments SET status = 'completed' WHERE completed_at IS NOT NULL;
UPDATE assessments SET status = 'in_progress'
  WHERE completed_at IS NULL AND started_at IS NOT NULL;
-- rows with neither timestamp remain 'pending'

-- 4. Mark ALL existing assessments expired (clean slate — full re-take)
UPDATE assessments SET status = 'expired', updated_at = NOW();
```

- [ ] **Step 2: Apply migration locally**

```bash
cd /Users/vrln/adizes-backend
docker exec -i supabase_db_adizes-backend psql -U postgres -d postgres \
  < migrations/003_ranking_scoring.sql
```

Expected: `ALTER TABLE`, `CREATE INDEX`, `UPDATE N` (for each UPDATE statement, no errors).

- [ ] **Step 3: Verify columns exist**

```bash
docker exec -i supabase_db_adizes-backend psql -U postgres -d postgres -c \
  "\d answers" | grep ranks
docker exec -i supabase_db_adizes-backend psql -U postgres -d postgres -c \
  "\d assessments" | grep status
```

Expected: `ranks` column visible in answers; `status` column visible in assessments.

- [ ] **Step 4: Commit**

```bash
cd /Users/vrln/adizes-backend
git add migrations/003_ranking_scoring.sql
git commit -m "feat: add migration 003 — ranks JSONB, assessments status, expire all"
```

---

### Task 2: Rewrite backend scoring tests

**Files:**
- Modify: `adizes-backend/tests/test_scoring.py`

The old tests use `_make_answers([(q, option_key)])` — single choice. The new tests use rank maps `{a:1, b:2, c:3, d:4}` per question. Scores are now 12–48 per role per section.

- [ ] **Step 1: Replace the entire test file**

```python
"""Tests for the PAEI ranking-based scoring engine (v2: 12–48 scale)."""

import pytest
from app.services.scoring import score_answers, _build_profile_string, SCORING_KEY


def _all_rank_answers(rank_per_option: dict[str, int]) -> list[dict]:
    """Build 36 answers each with the same rank assignment for all options."""
    return [
        {"question_index": q, "ranks": dict(rank_per_option)}
        for q in range(36)
    ]


def _make_ranked_answers(
    overrides: dict[int, dict[str, int]],
    default_ranks: dict[str, int] | None = None,
) -> list[dict]:
    """Build 36 answers. overrides: {q_idx: {a:r, b:r, c:r, d:r}}. Others use default."""
    default = default_ranks or {"a": 1, "b": 2, "c": 3, "d": 4}
    return [
        {"question_index": q, "ranks": overrides.get(q, dict(default))}
        for q in range(36)
    ]


class TestBuildProfileString:
    def test_all_dominant(self):
        scores = {"P": 35, "A": 40, "E": 38, "I": 42}
        assert _build_profile_string(scores) == "PAEI"

    def test_none_dominant(self):
        # All below 30; use values in the valid 12–48 range
        scores = {"P": 14, "A": 16, "E": 20, "I": 25}
        assert _build_profile_string(scores) == "paei"

    def test_mixed(self):
        scores = {"P": 14, "A": 35, "E": 20, "I": 40}
        assert _build_profile_string(scores) == "pAeI"

    def test_boundary_at_30(self):
        # 30 is NOT dominant (must be > 30)
        scores = {"P": 30, "A": 31, "E": 30, "I": 31}
        assert _build_profile_string(scores) == "pApI"


class TestScoreAnswers:
    def test_max_score_is_48(self):
        """Ranking P option first (rank 1) for all 12 Is-section questions → P(is) = 48."""
        # From SCORING_KEY, P option per question in Is section (q 0-11):
        p_options = {
            0: "b", 1: "a", 2: "b", 3: "c",
            4: "a", 5: "c", 6: "d", 7: "c",
            8: "b", 9: "a", 10: "d", 11: "c",
        }
        # Build answers: for each Is question, P option = rank 1, others = 2,3,4
        answers = []
        for q in range(36):
            if q < 12 and q in p_options:
                p_opt = p_options[q]
                ranks = {}
                rank_val = 1
                for opt in ["a", "b", "c", "d"]:
                    if opt == p_opt:
                        ranks[opt] = 1
                    else:
                        rank_val_other = [2, 3, 4]
                        ranks[opt] = rank_val_other.pop(0)
                # assign remaining ranks to non-P options
                non_p = [o for o in ["a", "b", "c", "d"] if o != p_opt]
                ranks = {p_opt: 1, non_p[0]: 2, non_p[1]: 3, non_p[2]: 4}
            else:
                ranks = {"a": 1, "b": 2, "c": 3, "d": 4}
            answers.append({"question_index": q, "ranks": ranks})

        result = score_answers(answers)
        assert result["scaled"]["is"]["P"] == 48

    def test_min_score_is_12(self):
        """Ranking P option last (rank 4) for all 12 Is questions → P(is) = 12."""
        p_options = {
            0: "b", 1: "a", 2: "b", 3: "c",
            4: "a", 5: "c", 6: "d", 7: "c",
            8: "b", 9: "a", 10: "d", 11: "c",
        }
        answers = []
        for q in range(36):
            if q < 12 and q in p_options:
                p_opt = p_options[q]
                non_p = [o for o in ["a", "b", "c", "d"] if o != p_opt]
                ranks = {non_p[0]: 1, non_p[1]: 2, non_p[2]: 3, p_opt: 4}
            else:
                ranks = {"a": 1, "b": 2, "c": 3, "d": 4}
            answers.append({"question_index": q, "ranks": ranks})

        result = score_answers(answers)
        assert result["scaled"]["is"]["P"] == 12

    def test_scores_sum_to_120_per_section(self):
        """Across all 4 roles, each section must sum to exactly 120 (10 pts × 12 questions)."""
        answers = _all_rank_answers({"a": 1, "b": 2, "c": 3, "d": 4})
        result = score_answers(answers)
        for section in ["is", "should", "want"]:
            total = sum(result["scaled"][section].values())
            assert total == 120, f"{section} total was {total}, expected 120"

    def test_profile_strings_present(self):
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
                assert result["scaled"][dim][role] == 0

    def test_scoring_key_covers_all_36_questions(self):
        assert len(SCORING_KEY) == 36

    def test_each_question_has_all_4_roles(self):
        for q_idx, mapping in SCORING_KEY.items():
            roles = set(mapping.values())
            assert roles == {"P", "A", "E", "I"}, (
                f"Q{q_idx} does not cover all 4 roles: {mapping}"
            )

    def test_score_in_12_to_48_range(self):
        """All scores from a fully-answered assessment must fall in [12, 48]."""
        answers = _all_rank_answers({"a": 1, "b": 2, "c": 3, "d": 4})
        result = score_answers(answers)
        for section in ["is", "should", "want"]:
            for role in ["P", "A", "E", "I"]:
                score = result["scaled"][section][role]
                assert 12 <= score <= 48, f"{section}.{role} = {score} out of range"

    def test_dominant_threshold_at_30(self):
        """A role scoring exactly 30 is NOT dominant; 31 is dominant."""
        # 30 = rank-1 for 7 questions + rank-2 for 5 questions? Let's use direct scores.
        scores_30 = {"P": 30, "A": 31, "E": 14, "I": 45}
        profile = _build_profile_string(scores_30)
        assert profile[0] == "p"   # P=30, not dominant
        assert profile[1] == "A"   # A=31, dominant
```

- [ ] **Step 2: Run tests to confirm they all fail** (scoring.py not yet changed)

```bash
cd /Users/vrln/adizes-backend
docker exec adizes-backend python -m pytest tests/test_scoring.py -v 2>&1 | tail -20
```

Expected: multiple failures including `KeyError: 'ranks'` or `TypeError`.

- [ ] **Step 3: Commit the test file**

```bash
git add tests/test_scoring.py
git commit -m "test: rewrite scoring tests for rank-order 12-48 format"
```

---

### Task 3: Update scoring engine

**Files:**
- Modify: `adizes-backend/app/services/scoring.py`

Replace the `score_answers` function. `SCORING_KEY`, `SECTIONS`, `ROLES`, `DOMINANT_THRESHOLD`, `_build_profile_string`, and `get_dominant_roles` are unchanged.

- [ ] **Step 1: Replace `score_answers` in scoring.py**

Replace the entire `score_answers` function (lines 69–112):

```python
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
```

Note: `raw` and `scaled` both point to the same dict — in the ranking model there is no separate scaling step. The `raw_scores` and `scaled_scores` DB columns will both store the 12–48 values.

- [ ] **Step 2: Run tests**

```bash
cd /Users/vrln/adizes-backend
docker exec adizes-backend python -m pytest tests/test_scoring.py -v
```

Expected: all tests PASS. If the Docker container doesn't have the code yet, rebuild first:
```bash
docker compose up --build -d
docker exec adizes-backend python -m pytest tests/test_scoring.py -v
```

- [ ] **Step 3: Commit**

```bash
git add app/services/scoring.py
git commit -m "feat: ranking-based scoring engine — 5-rank formula, 12-48 output"
```

---

### Task 4: Update answer input schema

**Files:**
- Modify: `adizes-backend/app/schemas/assessment.py`

- [ ] **Step 1: Replace `AnswerInput` and `SubmitRequest`**

```python
from pydantic import BaseModel, model_validator
from typing import List, Optional


class Option(BaseModel):
    key: str          # 'a', 'b', 'c', 'd'
    text: str
    paei_role: str    # 'P', 'A', 'E', 'I'


class Question(BaseModel):
    id: str
    question_index: int   # 0-based, 0–35
    text: str
    options: List[Option]


class Section(BaseModel):
    name: str             # 'is', 'should', 'want'
    label: str            # 'Is', 'Should', 'Want'
    description: str
    questions: List[Question]


class QuestionsResponse(BaseModel):
    sections: List[Section]


class AnswerInput(BaseModel):
    question_index: int                  # 0-based, 0–35
    ranks: dict[str, int]                # {"a":1,"b":3,"c":4,"d":2} — rank 1=most preferred

    @model_validator(mode="after")
    def validate_ranks(self) -> "AnswerInput":
        keys = set(self.ranks.keys())
        vals = set(self.ranks.values())
        if keys != {"a", "b", "c", "d"}:
            raise ValueError(
                f"ranks must contain exactly keys a,b,c,d — got {sorted(keys)}"
            )
        if vals != {1, 2, 3, 4}:
            raise ValueError(
                f"ranks values must be a permutation of {{1,2,3,4}} — got {sorted(vals)}"
            )
        return self

    @property
    def option_key(self) -> str:
        """Return the rank-1 (most preferred) option key."""
        return next(k for k, v in self.ranks.items() if v == 1)


class SubmitRequest(BaseModel):
    answers: List[AnswerInput]


class SubmitResponse(BaseModel):
    result_id: str
    message: str = "Assessment submitted successfully"
```

- [ ] **Step 2: Rebuild Docker and verify schema works**

```bash
cd /Users/vrln/adizes-backend
docker compose up --build -d
# Give it 5 seconds to start, then check health
sleep 5 && docker logs adizes-backend --tail 10
```

Expected: server starts without import errors.

- [ ] **Step 3: Commit**

```bash
git add app/schemas/assessment.py
git commit -m "feat: AnswerInput — ranks dict with validation, option_key derived"
```

---

### Task 5: Update assessment router

**Files:**
- Modify: `adizes-backend/app/routers/assessment.py`

Two changes:
1. In `submit_assessment`: extract `option_key` from `ranks`, store `ranks` JSONB, write `status='completed'` on assessment row.
2. The 36-answer count check stays, no expired guard needed (submitting creates a fresh assessment regardless).

- [ ] **Step 1: Update `submit_assessment` — assessment insert and answer insert**

In `submit_assessment`, find the `# Persist assessment` block (line ~149) and add `status`:

```python
    # Persist assessment
    supabase_admin.table("assessments").insert({
        "id": result_id,
        "user_id": user_id,
        "user_name": user_name,
        "completed_at": now,
        "status": "completed",        # ← new
        "raw_scores": scores["raw"],
        "scaled_scores": scores["scaled"],
        "profile": scores["profile"],
        "gaps": [g for g in gaps],
        "interpretation": interp,
    }).execute()
```

- [ ] **Step 2: Update answer_rows insert to include `ranks`**

Find the `answer_rows` block (line ~162) and update:

```python
    # Persist individual answers
    answer_rows = [
        {
            "assessment_id": result_id,
            "question_index": a["question_index"],
            "option_key": a["option_key"],   # derived from ranks by AnswerInput.option_key property
            "ranks": a["ranks"],              # ← new: full rank map {"a":1,"b":3,"c":4,"d":2}
        }
        for a in answers_dicts
    ]
    supabase_admin.table("answers").insert(answer_rows).execute()
```

Note: `a["option_key"]` works because `AnswerInput.option_key` is a `@property`, and `model_dump()` includes computed properties in Pydantic v2 only if explicitly included. Use `a.get("option_key") or next(k for k, v in a["ranks"].items() if v == 1)` to be safe, or compute it directly:

Replace with:
```python
    answer_rows = [
        {
            "assessment_id": result_id,
            "question_index": a["question_index"],
            "option_key": next(k for k, v in a["ranks"].items() if v == 1),
            "ranks": a["ranks"],
        }
        for a in answers_dicts
    ]
```

- [ ] **Step 3: Update `answers_dicts` derivation**

The current code does:
```python
answers_dicts = [a.model_dump() for a in body.answers]
```
This is fine — `model_dump()` will include `question_index` and `ranks`. The `option_key` property is not included in `model_dump()` by default (it's a `@property`, not a field), which is why step 2 computes it explicitly.

- [ ] **Step 4: Rebuild Docker and test submit endpoint**

```bash
cd /Users/vrln/adizes-backend
docker compose up --build -d
sleep 5
# Quick smoke test — wrong payload should return 422
curl -s -X POST http://localhost:8000/assessment/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TEST_BAD_TOKEN" \
  -d '{"answers":[{"question_index":0,"option_key":"a"}]}' | python3 -m json.tool
```

Expected: 401 Unauthorized (correct — auth check fires before schema validation; the schema change itself is validated by unit tests).

- [ ] **Step 5: Commit**

```bash
git add app/routers/assessment.py
git commit -m "feat: assessment submit — store ranks JSONB, write status=completed"
```

---

### Task 6: Update admin and auth routers for `status` column

**Files:**
- Modify: `adizes-backend/app/routers/admin.py`
- Modify: `adizes-backend/app/routers/auth.py`
- Modify: `adizes-backend/app/schemas/admin.py`
- Modify: `adizes-backend/app/schemas/auth.py`

**admin.py** — cohort detail endpoint (line ~152): switch from `completed_at`-based status to `status` column.
**auth.py** — `my_assessments` endpoint: use `status` column, return `expired` when relevant.

- [ ] **Step 1: Update `RespondentSummary` schema to include `"expired"`**

In `app/schemas/admin.py`, update the comment on `status`:
```python
class RespondentSummary(BaseModel):
    user_id: str
    name: str
    email: str
    status: str           # 'pending' | 'in_progress' | 'completed' | 'expired'
    dominant_style: Optional[str] = None
    completed_at: Optional[str] = None
```

- [ ] **Step 2: Update `MyAssessmentItem` schema**

In `app/schemas/auth.py`, update comment:
```python
class MyAssessmentItem(BaseModel):
    cohort_id: str
    cohort_name: str
    enrolled_at: Optional[str] = None
    status: str  # "pending" | "completed" | "expired"
    result_id: Optional[str] = None
    completed_at: Optional[str] = None
    dominant_style: Optional[str] = None
```

- [ ] **Step 3: Update cohort detail in `admin.py` — use `status` column**

Find the assessment query block (line ~152) and update:

```python
        assessment = (
            supabase_admin.table("assessments")
            .select("id, completed_at, scaled_scores, interpretation, status")
            .eq("user_id", uid)
            .order("completed_at", desc=True, nulls_last=True)
            .limit(1)
            .execute()
        )

        a = assessment.data[0] if assessment.data else None
        a_status = a.get("status", "pending") if a else "pending"
        dominant = None
        if a and a_status == "completed" and a.get("interpretation"):
            dominant = "".join(a["interpretation"].get("dominant_roles", []))
        if a and a_status == "completed" and a.get("scaled_scores"):
            all_scaled.append(a["scaled_scores"])

        respondents.append(RespondentSummary(
            user_id=uid,
            name=name,
            email=email,
            status=a_status,
            dominant_style=dominant,
            completed_at=a["completed_at"] if a else None,
        ))
```

- [ ] **Step 4: Update `my_assessments` in `auth.py` — use `status` column, return `expired`**

Replace the assessment query and status derivation (lines ~175–201):

```python
    # Fetch latest assessment for this user (any status)
    assessment_resp = (
        supabase_admin.table("assessments")
        .select("id, completed_at, interpretation, status")
        .eq("user_id", user_id)
        .order("completed_at", desc=True, nulls_last=True)
        .limit(1)
        .execute()
    )
    latest = assessment_resp.data[0] if assessment_resp.data else None
    latest_status = latest.get("status", "pending") if latest else "pending"

    dominant = None
    result_id = None
    completed_at_val = None

    if latest_status == "completed" and latest:
        result_id = latest["id"]
        completed_at_val = latest["completed_at"]
        if latest.get("interpretation"):
            dominant = "".join(latest["interpretation"].get("dominant_roles", []))

    result = []
    for m in (members.data or []):
        cohort = m.get("cohorts") or {}
        result.append(MyAssessmentItem(
            cohort_id=m["cohort_id"],
            cohort_name=cohort.get("name", ""),
            enrolled_at=m.get("enrolled_at"),
            status=latest_status,
            result_id=result_id,
            completed_at=completed_at_val,
            dominant_style=dominant,
        ))

    return result
```

- [ ] **Step 5: Rebuild Docker and verify**

```bash
cd /Users/vrln/adizes-backend
docker compose up --build -d
sleep 5 && docker logs adizes-backend --tail 5
```

Expected: starts cleanly, no import errors.

- [ ] **Step 6: Commit**

```bash
git add app/schemas/admin.py app/schemas/auth.py app/routers/admin.py app/routers/auth.py
git commit -m "feat: use status column for assessment state — support expired in API responses"
```

---

### Task 7: Push backend branch and update production DB

**Files:** none (git + infra)

- [ ] **Step 1: Push all backend commits**

```bash
cd /Users/vrln/adizes-backend
git push origin adizes-backend:adizes-backend
```

- [ ] **Step 2: Apply migration to production Supabase**

In Supabase Cloud dashboard → SQL Editor, paste and run the content of `migrations/003_ranking_scoring.sql`.

Alternatively via CLI if configured:
```bash
supabase db push --db-url "postgresql://postgres.<project-ref>:password@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"
```

- [ ] **Step 3: Redeploy backend on App Runner**

In AWS App Runner console → `adizes-backend` service → Deploy (or push triggers auto-deploy if configured).

---

## Chunk 2: Frontend — Types, Store, Assessment UX

---

### Task 8: Update TypeScript types

**Files:**
- Modify: `adizes-frontend/src/types/api.ts`
- Modify: `adizes-frontend/src/api/assessment.ts`

- [ ] **Step 1: Add `"expired"` to status union types in `types/api.ts`**

Change line 90 (`MyAssessmentItem.status`):
```ts
  status: "pending" | "completed" | "expired";
```

Change line 111 (`RespondentSummary.status`):
```ts
  status: "pending" | "in_progress" | "completed" | "expired";
```

- [ ] **Step 2: Update `submitAssessment` signature in `api/assessment.ts`**

```ts
import { apiClient } from "./client";
import type { QuestionsResponse, SubmitResponse } from "@/types/api";

export async function getQuestions(): Promise<QuestionsResponse> {
  const { data } = await apiClient.get<QuestionsResponse>("/assessment/questions");
  return data;
}

export async function submitAssessment(
  answers: Array<{ question_index: number; ranks: Record<string, number> }>
): Promise<SubmitResponse> {
  const { data } = await apiClient.post<SubmitResponse>("/assessment/submit", { answers });
  return data;
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/vrln/adizes-frontend
git add src/types/api.ts src/api/assessment.ts
git commit -m "feat: add expired status to API types, update submitAssessment signature"
```

---

### Task 9: Update assessment store

**Files:**
- Modify: `adizes-frontend/src/store/assessmentStore.ts`

Replace the `answers` shape and `saveAnswer` action.

- [ ] **Step 1: Rewrite the store**

```ts
import { create } from 'zustand';
import type { Section } from '@/types/api';

// RankMap: one entry per option key, null = not yet ranked
export type RankMap = Record<string, number | null>;  // { a: 1|2|3|4|null, ... }

interface AssessmentState {
  // Questions loaded from API
  sections: Section[];
  setSections: (sections: Section[]) => void;

  // Navigation
  currentSection: 0 | 1 | 2;
  currentQuestion: number;

  // Answers: key = question_index (0-based), value = rank map for that question
  answers: Record<number, RankMap>;
  saveRanks: (questionIndex: number, rankMap: RankMap) => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
  nextSection: () => void;

  // Result after submission
  resultId: string | null;
  setResultId: (id: string) => void;

  reset: () => void;
}

export const useAssessmentStore = create<AssessmentState>((set) => ({
  sections: [],
  setSections: (sections) => set({ sections }),

  currentSection: 0,
  currentQuestion: 0,
  answers: {},

  saveRanks: (questionIndex, rankMap) =>
    set((state) => ({
      answers: { ...state.answers, [questionIndex]: rankMap },
    })),

  nextQuestion: () =>
    set((state) => ({ currentQuestion: state.currentQuestion + 1 })),

  prevQuestion: () =>
    set((state) => ({ currentQuestion: Math.max(0, state.currentQuestion - 1) })),

  nextSection: () =>
    set((state) => ({
      currentSection: Math.min(2, state.currentSection + 1) as 0 | 1 | 2,
      currentQuestion: 0,
    })),

  resultId: null,
  setResultId: (id) => set({ resultId: id }),

  reset: () => set({
    sections: [],
    currentSection: 0,
    currentQuestion: 0,
    answers: {},
    resultId: null,
  }),
}));
```

- [ ] **Step 2: Commit**

```bash
git add src/store/assessmentStore.ts
git commit -m "feat: assessment store — RankMap state shape, saveRanks replaces saveAnswer"
```

---

### Task 10: Rewrite Assessment page (click-to-rank UX)

**Files:**
- Modify: `adizes-frontend/src/pages/Assessment.tsx`

This is a full rewrite of the question interaction layer. The section intro, header, progress bar, loading/error states, and submit flow are preserved. The option cards and Next button change.

- [ ] **Step 1: Rewrite Assessment.tsx**

```tsx
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAssessmentStore } from "@/store/assessmentStore";
import type { RankMap } from "@/store/assessmentStore";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Card, CardContent } from "@/components/ui/Card";
import { ArrowRight, ArrowLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { getQuestions, submitAssessment } from "@/api/assessment";

const ORDINALS = ["1st", "2nd", "3rd", "4th"];

// Opacity levels for rank badges: rank 1 = full, rank 4 = lightest
const RANK_BADGE_STYLES: Record<number, string> = {
  1: "bg-primary text-white",
  2: "bg-primary/75 text-white",
  3: "bg-primary/45 text-white",
  4: "bg-primary/25 text-primary",
};
const RANK_CARD_STYLES: Record<number, string> = {
  1: "border-primary bg-primary/10",
  2: "border-primary/60 bg-primary/6",
  3: "border-primary/35 bg-primary/3",
  4: "border-primary/20 bg-gray-50",
};

function isRankMapComplete(rankMap: RankMap): boolean {
  return Object.values(rankMap).every((v) => v !== null);
}

function initRankMap(optionKeys: string[]): RankMap {
  return Object.fromEntries(optionKeys.map((k) => [k, null]));
}

export function Assessment() {
  const navigate = useNavigate();
  const {
    sections,
    setSections,
    currentSection,
    currentQuestion,
    answers,
    saveRanks,
    nextQuestion,
    prevQuestion,
    nextSection,
    setResultId,
  } = useAssessmentStore();

  const [showIntro, setShowIntro] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (sections.length === 0) {
      setLoadingQuestions(true);
      getQuestions()
        .then((data) => setSections(data.sections))
        .catch(() => setError("Failed to load questions. Please refresh the page."))
        .finally(() => setLoadingQuestions(false));
    }
  }, []);

  // Clear any pending auto-advance when question changes
  useEffect(() => {
    return () => {
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    };
  }, [currentSection, currentQuestion]);

  if (loadingQuestions) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading assessment…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-red-200">
          <CardContent className="p-8 text-center">
            <p className="text-red-600 font-medium mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (sections.length === 0) return null;

  const section = sections[currentSection];
  const question = section.questions[currentQuestion];
  const totalPerSection = section.questions.length;
  const totalQuestions = sections.reduce((acc, s) => acc + s.questions.length, 0);
  const answeredSoFar = currentSection * totalPerSection + currentQuestion;
  const progress = (answeredSoFar / totalQuestions) * 100;
  const isLastSection = currentSection === sections.length - 1;
  const isLastQuestion = currentQuestion === totalPerSection - 1;

  const optionKeys = question.options.map((o) => o.key);
  const currentRankMap: RankMap =
    answers[question.question_index] ?? initRankMap(optionKeys);
  const rankedCount = Object.values(currentRankMap).filter((v) => v !== null).length;
  const isComplete = rankedCount === 4;
  const nextRankOrdinal = ORDINALS[rankedCount] ?? "";

  const handleOptionClick = (optionKey: string) => {
    const currentRank = currentRankMap[optionKey];

    if (currentRank !== null) {
      // Clear this rank and all ranks greater than it
      const newMap: RankMap = { ...currentRankMap };
      for (const [k, v] of Object.entries(newMap)) {
        if (v !== null && v >= currentRank) newMap[k] = null;
      }
      saveRanks(question.question_index, newMap);
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    } else {
      const nextRank = rankedCount + 1;
      const newMap: RankMap = { ...currentRankMap, [optionKey]: nextRank };

      // Auto-assign rank 4 to the last unranked option when 3 are done
      if (nextRank === 3) {
        const lastUnranked = optionKeys.find((k) => newMap[k] === null && k !== optionKey);
        if (lastUnranked) newMap[lastUnranked] = 4;
      }

      saveRanks(question.question_index, newMap);

      const willBeComplete = nextRank === 3 || nextRank === 4;
      if (willBeComplete) {
        autoAdvanceTimer.current = setTimeout(() => handleNext(newMap), 400);
      }
    }
  };

  const handleNext = (completedMap?: RankMap) => {
    const map = completedMap ?? currentRankMap;
    if (!isRankMapComplete(map)) return;

    if (!isLastQuestion) {
      nextQuestion();
    } else if (!isLastSection) {
      nextSection();
      setShowIntro(true);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const answerPayload = Object.entries(answers).map(([idx, rankMap]) => ({
        question_index: Number(idx),
        ranks: rankMap as Record<string, number>,
      }));
      const result = await submitAssessment(answerPayload);
      setResultId(result.result_id);
      navigate(`/results?id=${result.result_id}`);
    } catch {
      setError("Failed to submit assessment. Please try again.");
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    if (currentQuestion > 0) {
      prevQuestion();
    } else if (currentSection > 0) {
      useAssessmentStore.setState((state) => ({
        currentSection: (state.currentSection - 1) as 0 | 1 | 2,
        currentQuestion: sections[currentSection - 1].questions.length - 1,
      }));
    }
  };

  const isAtStart = currentSection === 0 && currentQuestion === 0;

  // Section intro screen
  if (showIntro) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-2xl"
        >
          <Card className="border-t-4 border-t-primary shadow-lg">
            <CardContent className="p-6 sm:p-12 text-center">
              <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary-light text-primary">
                <span className="font-display text-2xl font-bold">{currentSection + 1}</span>
              </div>
              <h2 className="font-display text-4xl font-bold text-gray-900 mb-4">
                Section {currentSection + 1} of 3: {section.label}
              </h2>
              <p className="text-xl text-gray-600 mb-4">{section.description}</p>
              <p className="text-sm text-gray-400 mb-4">{totalPerSection} questions</p>
              <p className="text-sm text-gray-500 mb-8 sm:mb-12 max-w-md mx-auto">
                For each question, click the options in order of preference — <strong>1st</strong> for most like you,
                through to <strong>4th</strong> for least like you.
              </p>
              <Button size="lg" onClick={() => setShowIntro(false)} className="w-full sm:w-auto px-12 text-lg h-14">
                Begin Section <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (submitting) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Calculating your results…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-gray-900">AMSI</span>
              <span className="text-gray-400">|</span>
              <span className="text-sm font-medium text-gray-600">{section.label}</span>
            </div>
            <div className="text-sm font-medium text-gray-500">
              {answeredSoFar + 1} of {totalQuestions}
            </div>
          </div>
          <ProgressBar value={progress} className="h-1.5" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 py-8 sm:py-12">
        <div className="w-full max-w-3xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${currentSection}-${currentQuestion}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-medium text-gray-900 mb-4 text-center leading-tight">
                {question.text}
              </h2>

              {/* Rank prompt */}
              <p className="text-center text-sm font-medium text-gray-500 mb-6">
                {isComplete ? (
                  <span className="text-primary">All ranked — advancing…</span>
                ) : (
                  <>Select your <strong className="text-gray-800">{nextRankOrdinal} choice</strong> — {4 - rankedCount} remaining</>
                )}
              </p>

              <div className="space-y-3">
                {question.options.map((option) => {
                  const rank = currentRankMap[option.key];
                  const isRanked = rank !== null;
                  return (
                    <button
                      key={option.key}
                      onClick={() => handleOptionClick(option.key)}
                      className={cn(
                        "w-full text-left p-4 sm:p-5 rounded-xl border-2 transition-all duration-200 flex items-center gap-4",
                        isRanked
                          ? RANK_CARD_STYLES[rank as number]
                          : "border-gray-200 bg-white hover:border-primary/40 hover:bg-primary/5 text-gray-700"
                      )}
                    >
                      {/* Rank badge */}
                      <div
                        className={cn(
                          "flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm transition-all",
                          isRanked
                            ? RANK_BADGE_STYLES[rank as number]
                            : "border-2 border-gray-300 text-gray-400"
                        )}
                      >
                        {isRanked ? rank : ""}
                      </div>
                      <span className={cn(
                        "text-base font-medium flex-1",
                        isRanked ? "text-gray-800" : "text-gray-700"
                      )}>
                        {option.text}
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Footer Controls */}
          <div className="mt-8 sm:mt-12 flex flex-wrap items-center justify-between gap-4">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={isAtStart}
              className="text-gray-500"
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>

            {/* Manual advance — shown only when complete, as a fallback if auto-advance stalls */}
            {isComplete && (
              <Button
                onClick={() => handleNext()}
                size="lg"
                className="px-8"
              >
                {isLastQuestion && isLastSection ? "Complete Assessment" : "Next Question"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Verify the frontend compiles**

```bash
cd /Users/vrln/adizes-frontend
npm run build 2>&1 | tail -20
```

Expected: `✓ built in Xs` with no TypeScript errors. If type errors appear, check `RankMap` import in Assessment.tsx and `Record<string, number>` cast in submit payload.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Assessment.tsx
git commit -m "feat: click-to-rank assessment UX — rank badges, auto-advance, undo support"
```

---

## Chunk 3: Frontend — Dashboard, Results, AdminRespondent

---

### Task 11: Update Dashboard — expired state

**Files:**
- Modify: `adizes-frontend/src/pages/Dashboard.tsx`

Two changes:
1. `StatusBadge` component: add `"expired"` branch
2. Show expired state card when `status === "expired"` instead of results/CTA

- [ ] **Step 1: Update `StatusBadge` (around line 468)**

Find the `StatusBadge` function and add the expired case:

```tsx
function StatusBadge({ status }: { status: MyAssessmentItem["status"] }) {
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
        Completed
      </span>
    );
  }
  if (status === "expired") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full">
        <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
        Expired
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      Yet to start
    </span>
  );
}
```

- [ ] **Step 2: Add `ExpiredAssessmentCTA` component (near `NoAssessmentCTA`, around line 324)**

Add after the existing `NoAssessmentCTA` component:

```tsx
// ─── Expired-assessment CTA ────────────────────────────────────────────────
function ExpiredAssessmentCTA() {
  const navigate = useNavigate();
  return (
    <div className="text-center py-12 px-6">
      <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-orange-50 text-orange-500 mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">Your previous assessment has expired</h3>
      <p className="text-gray-500 mb-6 max-w-md mx-auto">
        The assessment has been updated to a new ranking format. Please retake to see your results.
      </p>
      <Button onClick={() => navigate("/assessment")}>
        Begin Assessment
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Use `ExpiredAssessmentCTA` in the dashboard body**

Find where `completedItem` is determined (around line 499):
```tsx
const completedItem = myAssessments.find((a) => a.status === "completed");
```

Add an `expiredItem` check just below it:
```tsx
const expiredItem = myAssessments.find((a) => a.status === "expired");
```

Then find where `NoAssessmentCTA` or the "no assessments" state is rendered (the section that checks `completedItem`) and add the expired branch. The logic should be: show `ExpiredAssessmentCTA` when there's no completed item but there is an expired item. Replace the existing condition:

```tsx
{/* Main content area — show results, expired CTA, or no-assessment CTA */}
{completedItem ? (
  /* existing results rendering */
  ...
) : expiredItem ? (
  <ExpiredAssessmentCTA />
) : (
  <NoAssessmentCTA hasEnrollment={myAssessments.length > 0} />
)}
```

Note: read the surrounding code carefully before editing to find the exact conditional. The `NoAssessmentCTA` receives `hasEnrollment` — keep that prop.

- [ ] **Step 4: Add `ArrowRight` import if not already imported**

Check the imports at the top of `Dashboard.tsx`. If `ArrowRight` is not imported from `lucide-react`, add it.

- [ ] **Step 5: Verify build**

```bash
npm run build 2>&1 | tail -15
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat: dashboard — expired assessment state card and StatusBadge expired branch"
```

---

### Task 12: Update Results page — chart domain and tooltip copy

**Files:**
- Modify: `adizes-frontend/src/pages/Results.tsx`

- [ ] **Step 1: Update radar chart domain (line ~180)**

```tsx
<PolarRadiusAxis angle={30} domain={[12, 48]} tick={{ fill: "#9ca3af" }} />
```

- [ ] **Step 2: Update bar chart domain (line ~210)**

```tsx
<XAxis type="number" domain={[12, 48]} tick={{ fill: "#9ca3af" }} />
```

- [ ] **Step 3: Update profile badge tooltip copy (line ~139)**

Find the `InfoTooltip` for the profile badge and change the text:
```tsx
<InfoTooltip text="Your PAEI profile based on the 'Want' dimension — how you want to behave. A CAPITAL letter means that role scored above 30 (dominant). A lowercase letter means it scored 30 or below (non-dominant). Scores range from 12–48. Most people have 1–2 dominant roles." />
```

- [ ] **Step 4: Update gap analysis tooltip copy (line ~222)**

Find the gap analysis `InfoTooltip` and update `"0–50 scale"` → `"12–48 scale"`:
```tsx
<InfoTooltip text="Ext (External): gap between how you behave (Is) and what your role demands (Should). Int (Internal): gap between role demands (Should) and your natural preference (Want). Numbers show point difference on the 12–48 scale." />
```

- [ ] **Step 5: Verify build and commit**

```bash
npm run build 2>&1 | tail -10
git add src/pages/Results.tsx
git commit -m "feat: results — chart domain 12-48, updated tooltip copy"
```

---

### Task 13: Update AdminRespondent — expired badge and chart domain

**Files:**
- Modify: `adizes-frontend/src/pages/AdminRespondent.tsx`

- [ ] **Step 1: Update chart domain for radar and bar charts**

Find both `domain` props (same pattern as Results.tsx):
```tsx
<PolarRadiusAxis angle={30} domain={[12, 48]} ... />
<XAxis type="number" domain={[12, 48]} ... />
```

- [ ] **Step 2: Add expired badge when status is "expired"**

Find where the respondent profile/results section renders. Add an expired guard before the charts section. Locate where `result` data is rendered and add:

```tsx
{result.assessment_status === "expired" ? (
  <div className="flex items-center gap-3 px-4 py-3 bg-orange-50 border border-orange-200 rounded-lg text-orange-700 text-sm font-medium">
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
    Expired — awaiting retake under the new ranking format
  </div>
) : (
  /* existing charts and scores */
  ...
)}
```

Note: Read `AdminRespondent.tsx` to understand how assessment data is loaded and what `assessment_status` field is available. Adjust the field name to match what the API returns (from `RespondentSummary.status` or a dedicated field on the respondent detail response).

- [ ] **Step 3: Verify build and commit**

```bash
npm run build 2>&1 | tail -10
git add src/pages/AdminRespondent.tsx
git commit -m "feat: admin respondent — expired badge, chart domain 12-48"
```

---

### Task 14: Push frontend and final smoke test

**Files:** none (git push + manual test)

- [ ] **Step 1: Push all frontend commits**

```bash
cd /Users/vrln/adizes-frontend
git push origin main:adizes-frontend
```

- [ ] **Step 2: Smoke test locally**

```bash
# Start local stack
cd /Users/vrln/adizes-backend && supabase start
# Refresh .env with new keys (supabase status -o env)
# Apply all 3 migrations
docker exec -i supabase_db_adizes-backend psql -U postgres -d postgres < migrations/001_initial_schema.sql
docker exec -i supabase_db_adizes-backend psql -U postgres -d postgres < migrations/002_seed_questions.sql
docker exec -i supabase_db_adizes-backend psql -U postgres -d postgres < migrations/003_ranking_scoring.sql
# Recreate test users (see CLAUDE.md)
docker compose up --build -d
cd /Users/vrln/adizes-frontend && npm run dev
```

Then manually verify:
- [ ] Login as `user@adizes.com` — dashboard shows enrolled cohort
- [ ] Click "Begin Assessment" — section intro shows ranking instructions
- [ ] Answer question: clicking option 1 shows "①" badge; clicking option 2 shows "②"; clicking 3rd auto-assigns 4th and advances
- [ ] Clicking a ranked option (e.g. rank 2) clears that option and ranks above it
- [ ] Complete all 36 questions — results page loads with scores in 12–48 range
- [ ] Radar chart domain shows 12–48 axis, not 0–50
- [ ] Login as `admin@adizes.com` — AdminRespondent shows completed score after retake
- [ ] Old assessments (if any) show "Expired — awaiting retake" rather than stale scores

- [ ] **Step 3: Final commit if any last-minute fixes**

```bash
cd /Users/vrln/adizes-frontend
git add -p  # stage only intentional changes
git commit -m "fix: <describe any last-minute corrections>"
git push origin main:adizes-frontend
```
