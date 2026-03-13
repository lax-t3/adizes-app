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
- `ON DELETE CASCADE` on cohorts: deleting a cohort hard-deletes all its assessments and answers. No cohort-delete endpoint currently exists in the admin router — this is a safety constraint for future implementation.
- The `answers` table is unchanged (already cascades from assessments)
- The `status` column (`pending | in_progress | completed | expired`) was added in migration `005_ranking_scoring.sql` and is already present on the table.
- `started_at TIMESTAMPTZ DEFAULT now()` is set implicitly on insert; since assessments are submitted atomically (not started separately), `started_at` equals the insert timestamp. Semantics unchanged.

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

**Email logic:** The existing email-sending code in `assessment.py` currently looks up the cohort name by querying `cohort_members`. Since `cohort_id` is now part of the request payload, the email code must use `body.cohort_id` directly to fetch the cohort name instead of querying `cohort_members` arbitrarily.

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
    status: str                              # "pending" | "completed" | "expired" — derived from latest attempt or "pending"
    latest: Optional[AssessmentAttempt] = None
    history: List[AssessmentAttempt] = []    # all attempts, newest first. latest == history[0] by design (convenience duplication)
```

Note: `status` does not include `"in_progress"` — assessments are submitted atomically (all 36 answers at once), so there is no intermediate in-progress state surfaced to users. `"in_progress"` is reserved as a DB value for future use but not returned by this endpoint.

`latest` equals `history[0]` — this is intentional convenience so callers don't need `history[0]` access patterns.

**Status derivation:** If no assessments exist for `(user_id, cohort_id)`, status is `"pending"`. Otherwise read `status` from the most recent row.

**Remove `.limit(1)`.** Fetch all rows via `order("completed_at", desc=True)`.

### 2.3 Admin Cohort List (`app/routers/admin.py` — `list_cohorts`)

The `list_cohorts` endpoint computes `completed_count` per cohort. After this migration it must scope the assessment query to the cohort:

```python
comp_rows = supabase_admin.table("assessments")
    .select("user_id")
    .eq("cohort_id", c["id"])         # ← new filter
    .eq("status", "completed")
    .execute()
# Deduplicate: count distinct users (only latest per user counts)
completed_count = len({r["user_id"] for r in (comp_rows.data or [])})
```

Deduplication (using a set) is required because a user can have multiple completed attempts per cohort — only one should be counted.

### 2.4 Admin Cohort Detail (`app/routers/admin.py` — `get_cohort`)

**Current behaviour:** Queries latest assessment per user, no cohort filter.

**New behaviour:**
- Query: `eq("user_id", uid).eq("cohort_id", cohort_id).order("completed_at", desc=True)`
- Use the **most recent** assessment row for status, dominant style, and team aggregate scores
- Multiple attempts per user are allowed; only the latest counts for team stats

### 2.5 Admin Respondent Detail (`app/routers/admin.py` — `get_respondent`)

**URL change:** The endpoint becomes `GET /admin/respondents/{user_id}?cohort_id=<uuid>`. The `cohort_id` query parameter is required. Return 400 if missing.

**New behaviour:** Return **all** assessment attempts for `(user_id, cohort_id)`, newest first. The respondent detail response adds an `attempts` array:

```python
class RespondentDetail(BaseModel):
    user_id: str
    name: str
    email: str
    cohort_id: str
    attempts: List[AssessmentAttempt]   # all attempts, newest first
    # latest attempt's scores/profile/interpretation at top level for chart rendering
    scaled_scores: Optional[dict] = None
    profile: Optional[dict] = None
    interpretation: Optional[dict] = None
    assessment_status: str
```

**Frontend `src/api/admin.ts`:** Update `getRespondent(userId, cohortId)` to pass `cohort_id` as a query param.

**Frontend `AdminCohortDetail.tsx`:** Update the "View Results" link to include `cohort_id` in the URL: `/admin/respondents/${r.user_id}?cohort_id=${cohortId}`.

**`export_cohort_csv`** inherits the cohort-scoped `get_cohort` fix automatically. If retakes are present, the CSV export shows the latest attempt per user (consistent with cohort detail). Multi-attempt CSV export is out of scope.

### 2.6 Admin Stats (`app/routers/admin.py` — `get_stats`)

`get_stats` counts assessments globally across all cohorts. After this migration, a user with two completed assessments (one per cohort) will count as 2 rows. This is correct — each cohort attempt is a distinct completion event. No change required.

---

## Section 3: User Dashboard Timeline

### API response change

`GET /auth/my-assessments` returns `List[CohortAssessmentHistory]` instead of `List[MyAssessmentItem]`.

`MyAssessmentItem` is removed from `src/types/api.ts`. All consumers updated:
- `src/api/results.ts` — update `getMyAssessments` return type to `CohortAssessmentHistory[]`
- `src/pages/Dashboard.tsx` — consumes `CohortAssessmentHistory`

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
  status: "pending" | "completed" | "expired"  // no "in_progress" — atomic submit
  latest: AssessmentAttempt | null              // == history[0], null if no attempts
  history: AssessmentAttempt[]                 // all attempts, newest first
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

### Guard: missing cohort context

If the user reaches `/assessment` without a valid `cohort_id` query param (e.g. direct URL entry), the Assessment page redirects to `/dashboard` and shows a toast: "Please begin your assessment from your dashboard."

### Frontend `assessment.ts` API call change

`submitAssessment` now accepts `cohort_id` as the first parameter:

```ts
export async function submitAssessment(
  cohort_id: string,
  answers: Array<{ question_index: number; ranks: Record<string, number> }>
): Promise<SubmitResponse>
```

### Passing cohort context to Assessment page

The "Begin Assessment" button (in `NoAssessmentCTA` and `ExpiredAssessmentCTA`) navigates to `/assessment?cohort_id=<uuid>`. The Assessment page reads `cohort_id` from the query params, stores it in `assessmentStore.cohortId`, and passes it to `submitAssessment`.

---

## Section 4: Admin Respondent Timeline

### Route change

`AdminRespondent` route changes from `/admin/respondents/:id` to `/admin/respondents/:id?cohort_id=<uuid>`. The component reads `cohort_id` from `useSearchParams()`.

### UI: `AdminRespondent.tsx`

When `attempts.length > 1`, an **attempt selector** renders above the charts:

```
  Attempt 1 · 13 Mar 2026 · A    Attempt 2 · 20 Mar 2026 · pA   [latest]
  ───────────────────────────────────────────────────────────────────────
  [Charts and interpretation for selected attempt]
```

- Tabs or a segmented control, one tab per attempt, newest last (so latest is rightmost / default)
- Each tab label: `Attempt N · DD Mon YYYY · <dominant_style>`
- Selecting a tab fetches (or uses cached) full scores for that `result_id` via `GET /results/{result_id}` (existing endpoint, already supports admin access — no new endpoint needed)
- If only one attempt, no selector rendered (existing single-view layout)

The admin cohort respondents list (`RespondentSummary`) is unchanged in shape — still shows latest attempt's status and dominant style.

---

## Section 5: Store changes

`assessmentStore.ts` adds `cohortId: string | null` and `setCohortId`:

```ts
cohortId: string | null
setCohortId: (id: string) => void
// cohortId included in reset()
```

---

## Files Affected

| File | Change |
|------|--------|
| `migrations/006_cohort_scoped_assessments.sql` | New — wipes data, adds `cohort_id` to assessments |
| `app/schemas/assessment.py` | `SubmitRequest` adds `cohort_id: str` |
| `app/schemas/auth.py` | New `AssessmentAttempt`, `CohortAssessmentHistory`; remove `MyAssessmentItem` |
| `app/schemas/admin.py` | `RespondentDetail` adds `attempts: List[AssessmentAttempt]` |
| `app/routers/assessment.py` | Validate cohort enrollment, insert `cohort_id`, fix email cohort lookup |
| `app/routers/auth.py` | `my_assessments` returns `List[CohortAssessmentHistory]` |
| `app/routers/admin.py` | `list_cohorts` deduped count, `get_cohort` scoped, `get_respondent` requires `cohort_id` query param |
| `src/types/api.ts` | Replace `MyAssessmentItem` with `AssessmentAttempt` + `CohortAssessmentHistory` |
| `src/api/assessment.ts` | `submitAssessment` accepts `cohort_id` as first param |
| `src/api/admin.ts` | `getRespondent(userId, cohortId)` passes `cohort_id` query param |
| `src/api/results.ts` | Update `getMyAssessments` return type to `CohortAssessmentHistory[]` |
| `src/store/assessmentStore.ts` | Add `cohortId` state and `setCohortId` action |
| `src/pages/Assessment.tsx` | Read `cohort_id` from query param, guard redirect if missing, pass to submit |
| `src/pages/Dashboard.tsx` | Render `CohortAssessmentHistory`; previous attempts collapse; pass `cohort_id` to Begin Assessment nav |
| `src/pages/AdminRespondent.tsx` | Read `cohort_id` from search params; attempt selector; charts update per selected attempt |
| `src/pages/AdminCohortDetail.tsx` | Pass `cohort_id` in View Results link |
| `tests/test_scoring.py` | No change (scoring logic unchanged) |

---

## Out of Scope

- PDF generation changes (PDFs already reference `result_id` — no change needed)
- Question content
- Cohort management flows (create/delete/bulk enroll)
- Email templates (other than the cohort lookup fix in submit)
- Multi-attempt CSV export
