# Adizes AMSI — Cohort-Scoped Assessments & Attempt Timeline

**Date:** 2026-03-13
**Status:** Approved for implementation
**Scope:** DB migration, backend submit/query logic, user dashboard timeline, admin respondent timeline

---

## Problem Statement

The `assessments` table has no `cohort_id` column. Assessments are scoped to `user_id` only. When a user completes an assessment for Cohort A and is later enrolled in Cohort B, the existing result bleeds through — they appear as "Completed" in Cohort B without having taken the assessment for that cohort. Every endpoint derives status by querying the latest assessment for the user globally.

---

## Decision: Add `cohort_id` to `assessments` (Approach A)

Add `cohort_id UUID NOT NULL REFERENCES cohorts(id)` directly to the `assessments` table. Every assessment is now scoped to a specific `(user_id, cohort_id)` pair. All queries change from `eq("user_id", uid)` to `eq("user_id", uid).eq("cohort_id", cid)`. A user must take a fresh assessment for each cohort they enroll in.

---

## Section 1: Data Model

### Migration `006_cohort_scoped_assessments.sql`

```sql
-- 1. Delete all existing assessment data (clean slate)
--    PDFs already manually deleted from Supabase Storage by administrator.
DELETE FROM answers;
DELETE FROM assessments;

-- 2. Add cohort_id to assessments
ALTER TABLE assessments
  ADD COLUMN cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE;

-- 3. Index for fast per-(user, cohort) lookups
CREATE INDEX idx_assessments_user_cohort ON assessments(user_id, cohort_id);
```

**Invariants after migration:**
- Every assessment row has a non-null `cohort_id`
- A user can have multiple assessment rows for the same cohort (retakes / multiple attempts)
- Deleting a cohort cascades to its assessments and their answers
- The `answers` table is unchanged (already cascades from assessments)

---

## Section 2: Backend Logic

### 2.1 Submit Assessment (`app/routers/assessment.py`)

**New payload field:** The frontend sends `cohort_id: str` alongside the answers array.

```json
{
  "cohort_id": "uuid-of-cohort",
  "answers": [{ "question_index": 0, "ranks": {"a":1,"b":2,"c":3,"d":4} }, ...]
}
```

**Backend validation before saving:**
1. Verify the authenticated user is enrolled in `cohort_id` (row exists in `cohort_members`)
2. Return HTTP 403 if not enrolled

**Assessment insert:** Add `cohort_id` to the insert dict:
```python
supabase_admin.table("assessments").insert({
    "id": result_id,
    "user_id": user_id,
    "cohort_id": cohort_id,       # ← new
    "status": "completed",
    ...
})
```

**Schema change** (`app/schemas/assessment.py`): Add `cohort_id: str` field to `SubmitRequest`.

### 2.2 `my_assessments` (`app/routers/auth.py`)

**Current behaviour:** Fetches the single latest assessment per user (no cohort filter), attaches it to every enrolled cohort.

**New behaviour:** For each cohort enrollment, query ALL assessments for `(user_id, cohort_id)` ordered by `completed_at DESC`. Return them as a structured history.

**New response shape** (`app/schemas/auth.py`):

```python
class AssessmentAttempt(BaseModel):
    result_id: str
    completed_at: str
    dominant_style: Optional[str] = None
    status: str  # "completed" | "expired"

class CohortAssessmentHistory(BaseModel):
    cohort_id: str
    cohort_name: str
    enrolled_at: Optional[str] = None
    status: str                              # derived from latest attempt or "pending"
    latest: Optional[AssessmentAttempt] = None
    history: List[AssessmentAttempt] = []    # all attempts, newest first (includes latest)
```

**Status derivation:** If no assessments exist for `(user_id, cohort_id)`, status is `"pending"`. Otherwise read `status` from the most recent row.

**Remove `.limit(1)`.** Fetch all rows, sort client-side or via `order("completed_at", desc=True)`.

### 2.3 Admin Cohort Detail (`app/routers/admin.py` — `get_cohort`)

**Current behaviour:** Queries latest assessment per user, no cohort filter.

**New behaviour:**
- Query: `eq("user_id", uid).eq("cohort_id", cohort_id).order("completed_at", desc=True)`
- Use the **most recent** assessment row for status, dominant style, and team aggregate scores
- Multiple attempts per user are allowed; only the latest counts for team stats

### 2.4 Admin Respondent Detail (`app/routers/admin.py` — `get_respondent`)

**New behaviour:** Return **all** assessment attempts for `(user_id, cohort_id)`, newest first. The respondent detail response adds an `attempts` array:

```python
class RespondentDetail(BaseModel):
    user_id: str
    name: str
    email: str
    cohort_id: str
    attempts: List[AssessmentAttempt]   # all attempts, newest first
    # latest attempt's scores/profile/interpretation remain at top level for backwards compat
    scaled_scores: Optional[dict] = None
    profile: Optional[dict] = None
    interpretation: Optional[dict] = None
    assessment_status: str
```

---

## Section 3: User Dashboard Timeline

### API response change

`GET /auth/my-assessments` returns `List[CohortAssessmentHistory]` instead of `List[MyAssessmentItem]`.

### Frontend state

`src/types/api.ts` replaces `MyAssessmentItem` with:

```ts
export interface AssessmentAttempt {
  result_id: string
  completed_at: string
  dominant_style?: string
  status: "completed" | "expired"
}

export interface CohortAssessmentHistory {
  cohort_id: string
  cohort_name: string
  enrolled_at?: string
  status: "pending" | "in_progress" | "completed" | "expired"
  latest: AssessmentAttempt | null
  history: AssessmentAttempt[]  // all attempts, newest first
}
```

### UI: `Dashboard.tsx`

Each cohort card now has two zones:

**Zone 1 — Current state** (unchanged layout): shows the latest attempt's result, or expired/pending CTA.

**Zone 2 — Attempt history** (new, below Zone 1): visible only when `history.length > 1`.

```
┌──────────────────────────────────────────────┐
│  [Current result / CTA — existing layout]    │
├──────────────────────────────────────────────┤
│  Previous attempts (2)          ▼ collapsed  │
│  ────────────────────────────────────────    │
│  Attempt 1  ·  13 Mar 2026  ·  A   [View]   │
│  Attempt 2  ·  20 Mar 2026  ·  pA  [View]   │
└──────────────────────────────────────────────┘
```

- Collapsed by default, expandable with a toggle
- Each row: attempt number, date, dominant style badge, "View" link → `/results?id=<result_id>`
- No charts in the history list — just the summary row

### Frontend `assessment.ts` API call change

`submitAssessment` now accepts `cohort_id` as a parameter:

```ts
export async function submitAssessment(
  cohort_id: string,
  answers: Array<{ question_index: number; ranks: Record<string, number> }>
): Promise<SubmitResponse>
```

The `Assessment.tsx` page must obtain and pass `cohort_id`. It comes from the dashboard: the user taps "Begin Assessment" on a specific cohort card, so the cohort context is known. Pass it via router state or query param to the Assessment route.

### Passing cohort context to Assessment page

The "Begin Assessment" button (in `NoAssessmentCTA` and `ExpiredAssessmentCTA`) navigates to `/assessment?cohort_id=<uuid>`. The Assessment page reads `cohort_id` from the query params and stores it in `assessmentStore` alongside the answers.

---

## Section 4: Admin Respondent Timeline

### UI: `AdminRespondent.tsx`

When `attempts.length > 1`, an **attempt selector** renders above the charts:

```
  Attempt 1 · 13 Mar 2026 · A    Attempt 2 · 20 Mar 2026 · pA   [latest]
  ───────────────────────────────────────────────────────────────────────
  [Charts and interpretation for selected attempt]
```

- Tabs or a segmented control, one tab per attempt, newest last (so latest is rightmost / default)
- Each tab label: `Attempt N · DD Mon YYYY · <dominant_style>`
- Selecting a tab fetches (or uses cached) scores for that `result_id`
- If only one attempt, no selector rendered (existing single-view layout)

The admin cohort respondents list (`RespondentSummary`) is unchanged in shape — still shows latest attempt's status and dominant style.

---

## Section 5: Store changes

`assessmentStore.ts` adds `cohortId: string | null` and `setCohortId`:

```ts
cohortId: string | null
setCohortId: (id: string) => void
// cohortId added to reset()
```

---

## Files Affected

| File | Change |
|------|--------|
| `migrations/006_cohort_scoped_assessments.sql` | New — wipes data, adds `cohort_id` to assessments |
| `app/schemas/assessment.py` | `SubmitRequest` adds `cohort_id: str` |
| `app/schemas/auth.py` | New `AssessmentAttempt`, `CohortAssessmentHistory`; remove `MyAssessmentItem` |
| `app/schemas/admin.py` | `RespondentDetail` adds `attempts: List[AssessmentAttempt]` |
| `app/routers/assessment.py` | Validate cohort enrollment, insert `cohort_id` |
| `app/routers/auth.py` | `my_assessments` returns `List[CohortAssessmentHistory]` |
| `app/routers/admin.py` | `get_cohort` and `get_respondent` scope queries to `cohort_id` |
| `src/types/api.ts` | Replace `MyAssessmentItem` with `AssessmentAttempt` + `CohortAssessmentHistory` |
| `src/api/assessment.ts` | `submitAssessment` accepts `cohort_id` |
| `src/store/assessmentStore.ts` | Add `cohortId` state |
| `src/pages/Assessment.tsx` | Read `cohort_id` from query param, pass to submit |
| `src/pages/Dashboard.tsx` | Render `CohortAssessmentHistory`; previous attempts collapse |
| `src/pages/AdminRespondent.tsx` | Attempt selector; charts update per selected attempt |
| `tests/test_scoring.py` | No change (scoring logic unchanged) |

---

## Out of Scope

- PDF generation changes (PDFs already reference `result_id` — no change needed)
- Question content
- Cohort management flows (create/delete/bulk enroll)
- Email templates
