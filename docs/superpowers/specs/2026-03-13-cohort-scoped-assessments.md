# Adizes AMSI — Cohort-Scoped Assessments & Assessment Timeline

**Date:** 2026-03-13
**Status:** Approved for implementation
**Scope:** DB migration, backend submit/query logic, user dashboard timeline, admin respondent view

---

## Problem Statement

The `assessments` table has no `cohort_id` column. Assessments are scoped to `user_id` only. When a user completes an assessment for Cohort A and is later enrolled in Cohort B, the existing result bleeds through — they appear as "Completed" in Cohort B without having taken the assessment for that cohort. Every endpoint derives status by querying the latest assessment for the user globally.

---

## Decision: Add `cohort_id` to `assessments` (Approach A)

Add `cohort_id UUID NOT NULL REFERENCES cohorts(id)` directly to the `assessments` table. Every assessment is scoped to a specific `(user_id, cohort_id)` pair.

**Key business rules:**
- A user is enrolled in a cohort **at most once** (enforced by the composite PK on `cohort_members`)
- Therefore a user has **at most one assessment per cohort**
- A user enrolled in multiple cohorts over time takes a fresh assessment for each — this history of cohort assessments is the "timeline"
- All queries change from `eq("user_id", uid)` to `eq("user_id", uid).eq("cohort_id", cid)`

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
- Each `(user_id, cohort_id)` pair has at most one assessment row (one enrollment = one assessment)
- `ON DELETE CASCADE` on cohorts: deleting a cohort hard-deletes all its assessments and answers. No cohort-delete endpoint currently exists in the admin router — this constraint is a safety measure for future implementation.
- The `answers` table is unchanged (already cascades from assessments)
- The `status` column (`pending | in_progress | completed | expired`) was added in migration `005_ranking_scoring.sql` and is already present on the table.
- `started_at TIMESTAMPTZ DEFAULT now()` is set implicitly on insert; since assessments are submitted atomically (all 36 answers at once), `started_at` equals the insert timestamp. Semantics unchanged.

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

**Email logic:** The existing email-sending code in `assessment.py` currently looks up the cohort name by querying `cohort_members` with an arbitrary `.limit(1)`. Since `cohort_id` is now part of the request payload, the email code must use `body.cohort_id` directly to fetch the cohort name.

### 2.2 `my_assessments` (`app/routers/auth.py`)

**Current behaviour:** Fetches the single latest assessment per user (no cohort filter), attaches it to every enrolled cohort.

**New behaviour:** For each cohort enrollment, query the assessment for `(user_id, cohort_id)`. Since there is at most one assessment per enrollment, `.limit(1)` is retained. Return a list of per-cohort assessment items, ordered by `enrolled_at DESC` (most recent cohort first) — this ordering produces the user's assessment timeline.

**New response shape** (`app/schemas/auth.py`):

```python
class CohortAssessmentHistory(BaseModel):
    cohort_id: str
    cohort_name: str
    enrolled_at: Optional[str] = None
    status: str                              # "pending" | "completed" | "expired"
    result_id: Optional[str] = None
    completed_at: Optional[str] = None
    dominant_style: Optional[str] = None
```

Note: `status` does not include `"in_progress"` — assessments are submitted atomically (all 36 answers at once). `"in_progress"` is a DB-level value only and is not surfaced to users.

`MyAssessmentItem` is replaced by `CohortAssessmentHistory`. They carry the same fields; the rename makes the cohort-scoping intent explicit.

**Status derivation:** If no assessment exists for `(user_id, cohort_id)`, status is `"pending"`. Otherwise read `status` from the row.

### 2.3 Admin Cohort List (`app/routers/admin.py` — `list_cohorts`)

The `list_cohorts` endpoint computes `completed_count` per cohort. After this migration it must scope the assessment query to the cohort:

```python
comp_rows = supabase_admin.table("assessments")
    .select("user_id")
    .eq("cohort_id", c["id"])         # ← new filter
    .eq("status", "completed")
    .execute()
completed_count = len(comp_rows.data or [])
```

No deduplication is needed — at most one completed assessment per `(user_id, cohort_id)` pair.

### 2.4 Admin Cohort Detail (`app/routers/admin.py` — `get_cohort`)

**Current behaviour:** Queries latest assessment per user, no cohort filter.

**New behaviour:**
- Query: `eq("user_id", uid).eq("cohort_id", cohort_id).limit(1)`
- Use the single assessment row for status, dominant style, and team aggregate scores

### 2.5 Admin Respondent Detail (`app/routers/admin.py` — `get_respondent`)

**URL change:** The endpoint becomes `GET /admin/respondents/{user_id}?cohort_id=<uuid>`. The `cohort_id` query parameter is required. Return 400 if missing.

**New behaviour:** Fetch the single assessment for `(user_id, cohort_id)`. The response shape is unchanged — no `attempts` array needed (one assessment per enrollment).

```python
class RespondentDetail(BaseModel):
    user_id: str
    name: str
    email: str
    cohort_id: str
    scaled_scores: Optional[dict] = None
    profile: Optional[dict] = None
    interpretation: Optional[dict] = None
    assessment_status: str
```

**Frontend `src/api/admin.ts`:** Update `getRespondent(userId, cohortId)` to pass `cohort_id` as a query param.

**Frontend `AdminCohortDetail.tsx`:** Update the "View Results" link to include `cohort_id` in the URL: `/admin/respondents/${r.user_id}?cohort_id=${cohortId}`.

**`export_cohort_csv`** inherits the cohort-scoped `get_cohort` fix automatically. No changes needed.

### 2.6 Admin Stats (`app/routers/admin.py` — `get_stats`)

`get_stats` counts assessments globally across all cohorts. A user enrolled in two cohorts and completing both contributes 2 rows. This is correct — each cohort completion is a distinct event. No change required.

---

## Section 3: User Dashboard Timeline

### The timeline

The user's "assessment timeline" is the ordered list of `CohortAssessmentHistory` items returned by `my_assessments`, sorted newest cohort first. As the user is enrolled in more cohorts over time and completes each assessment, their timeline grows. No special timeline component is needed — the existing per-cohort cards, rendered in enrollment order, ARE the timeline.

### API response change

`GET /auth/my-assessments` returns `List[CohortAssessmentHistory]` instead of `List[MyAssessmentItem]`.

`MyAssessmentItem` is removed from `src/types/api.ts`. All consumers updated:
- `src/api/results.ts` — update `getMyAssessments` return type to `CohortAssessmentHistory[]`
- `src/pages/Dashboard.tsx` — field names unchanged (same fields, renamed type)

### Frontend types

`src/types/api.ts` replaces `MyAssessmentItem` with:

```ts
export interface CohortAssessmentHistory {
  cohort_id: string
  cohort_name: string
  enrolled_at?: string
  status: "pending" | "completed" | "expired"
  result_id?: string
  completed_at?: string
  dominant_style?: string
}
```

This is a rename with the same fields — `Dashboard.tsx` field access is unchanged.

### UI: `Dashboard.tsx`

No structural change to card layout. The cards are rendered in the order returned by the API (newest enrollment first). A user enrolled in multiple cohorts sees multiple cards — oldest cohorts scroll down, newest at the top. This ordering is the timeline.

The "Begin Assessment" button navigates to `/assessment?cohort_id=<uuid>`. This is the only new UI behaviour.

### Guard: missing cohort context

If the user reaches `/assessment` without a valid `cohort_id` query param (e.g. direct URL entry), the Assessment page redirects to `/dashboard` with a toast: "Please begin your assessment from your dashboard."

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

## Section 4: Admin Respondent View

### Route change

`AdminRespondent` route changes from `/admin/respondents/:id` to `/admin/respondents/:id?cohort_id=<uuid>`. The component reads `cohort_id` from `useSearchParams()`.

### UI: `AdminRespondent.tsx`

No attempt selector needed — one assessment per enrollment. The existing single-view layout is retained. The only change is: the component now passes `cohort_id` to the `getRespondent` API call, and the API returns results scoped to that cohort.

The admin cohort respondents list (`RespondentSummary`) is unchanged in shape — still shows status and dominant style for the single cohort-scoped assessment.

---

## Section 5: Enrollment Email Logic

### Current behaviour (what the code does today)

Three code paths in `admin.py` send enrollment emails:
- **`enroll_user` (single enroll):** If user has no account → `generate_link(type="invite")` → `user_enrolled` template. If user already exists → `generate_link(type="recovery")` → same `user_enrolled` activation template. Existing *activated* users incorrectly receive the "Accept Invitation & Set Password" email.
- **`bulk_enroll`:** Same logic as single enroll.
- **`resend_invite`:** Always generates `type="recovery"` link → sends `user_enrolled` activation template, regardless of whether the user is activated.

### Correct three-case logic

The activation state of a user is determined by `email_confirmed_at` from Supabase Auth:

```python
auth_user = supabase_admin.auth.admin.get_user_by_id(user_id).user
is_activated = auth_user.email_confirmed_at is not None
```

| Case | Condition | Email action |
|------|-----------|--------------|
| New user | No account exists | `generate_link(type="invite")` → send `user_enrolled` (activation + set password) |
| Invited, not yet activated | Account exists, `email_confirmed_at` is `None` | `generate_link(type="recovery")` → send `user_enrolled` (re-send activation link) |
| Already activated | `email_confirmed_at` is not `None` | No link generated → send `cohort_enrollment_existing` (dashboard link only) |

This logic applies to **all three paths**: `enroll_user`, `bulk_enroll`, and `resend_invite`.

### New email template: `cohort_enrollment_existing`

Add to `DEFAULT_TEMPLATES` in `app/services/email_service.py`:

- **Template ID:** `cohort_enrollment_existing`
- **Subject:** `You've been enrolled in {{cohort_name}} — {{platform_name}}`
- **Body:** Greeting, enrollment notice for `{{cohort_name}}`, CTA button linking to `{{platform_url}}` labelled "Go to Dashboard & Begin Assessment"
- **Variables:** `user_name`, `cohort_name`, `platform_name`, `platform_url`, `user_email`

No `invite_link` variable is needed for this template.

### Resend invite endpoint

The resend endpoint currently always sends the activation email. After this change it applies the same three-case check:
- User not yet activated → fresh `type="recovery"` link → `user_enrolled` template
- User already activated → no link → `cohort_enrollment_existing` template

The endpoint name ("resend invite") remains unchanged — in the activated case it simply re-sends the enrollment notification.

---

## Section 6: Store changes

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
| `app/schemas/auth.py` | Rename `MyAssessmentItem` → `CohortAssessmentHistory` (same fields) |
| `app/schemas/admin.py` | `RespondentDetail` adds `cohort_id` field; remove `attempts` array |
| `app/routers/assessment.py` | Validate cohort enrollment, insert `cohort_id`, fix email cohort lookup |
| `app/routers/admin.py` | Enroll: check `email_confirmed_at`, send `cohort_enrollment_existing` for activated users or `user_enrolled` (invite link) for new users. List/detail/respondent: cohort-scoped queries, `get_respondent` requires `cohort_id` param |
| `app/routers/auth.py` | `my_assessments` scopes query to `cohort_id` per enrollment |
| `app/services/email_service.py` | Add `cohort_enrollment_existing` template to `DEFAULT_TEMPLATES` |
| `src/types/api.ts` | Rename `MyAssessmentItem` → `CohortAssessmentHistory` (same fields) |
| `src/api/assessment.ts` | `submitAssessment` accepts `cohort_id` as first param |
| `src/api/admin.ts` | `getRespondent(userId, cohortId)` passes `cohort_id` query param |
| `src/api/results.ts` | Update `getMyAssessments` return type to `CohortAssessmentHistory[]` |
| `src/store/assessmentStore.ts` | Add `cohortId` state and `setCohortId` action |
| `src/pages/Assessment.tsx` | Read `cohort_id` from query param, guard redirect if missing, pass to submit |
| `src/pages/Dashboard.tsx` | Use `CohortAssessmentHistory` type; pass `cohort_id` to Begin Assessment nav |
| `src/pages/AdminRespondent.tsx` | Read `cohort_id` from search params; pass to `getRespondent` API call |
| `src/pages/AdminCohortDetail.tsx` | Pass `cohort_id` in View Results link |
| `tests/test_scoring.py` | No change (scoring logic unchanged) |

---

## Out of Scope

- PDF generation changes (PDFs already reference `result_id` — no change needed)
- Question content
- Cohort management flows (create/delete/bulk enroll)
- Email template visual redesign (the new `cohort_enrollment_existing` template uses the existing HTML wrapper pattern)
- Multi-attempt CSV export
