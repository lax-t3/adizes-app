# Cohort-Scoped Assessments Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `cohort_id` to the `assessments` table so that each assessment is scoped to a specific `(user_id, cohort_id)` pair, fixing the bug where a completed assessment from one cohort bleeds through to a new cohort enrollment.

**Architecture:** Migration deletes all existing assessment data (clean slate) and adds `cohort_id NOT NULL` FK to `assessments`. Backend routers scope every assessment query to `(user_id, cohort_id)`. Frontend passes `cohort_id` from query params through the assessment submission flow. Enrollment email logic gets three-case branching based on `email_confirmed_at`.

**Tech Stack:** FastAPI (Python), Supabase (PostgreSQL), React + TypeScript + Zustand, supabase-py client

---

## File Structure

**Backend (`/Users/vrln/adizes-backend`)**

| File | Change |
|------|--------|
| `migrations/006_cohort_scoped_assessments.sql` | New — wipes data, adds `cohort_id` |
| `app/schemas/assessment.py` | Add `cohort_id: str` to `SubmitRequest` |
| `app/schemas/auth.py` | Rename `MyAssessmentItem` → `CohortAssessmentHistory` |
| `app/schemas/admin.py` | Add `RespondentDetail` Pydantic model with `cohort_id` |
| `app/services/email_service.py` | Add `cohort_enrollment_existing` to `DEFAULT_TEMPLATES` |
| `app/routers/assessment.py` | Validate enrollment, insert `cohort_id`, fix email cohort lookup |
| `app/routers/auth.py` | `my_assessments`: per-cohort query instead of global latest |
| `app/routers/admin.py` | Scope queries; 3-case enrollment email logic; `get_respondent` requires `cohort_id` |

**Frontend (`/Users/vrln/adizes-frontend`)**

| File | Change |
|------|--------|
| `src/types/api.ts` | Rename `MyAssessmentItem` → `CohortAssessmentHistory` |
| `src/api/assessment.ts` | `submitAssessment` accepts `cohort_id` as first param |
| `src/api/admin.ts` | `getRespondent(userId, cohortId)` passes `cohort_id` as query param |
| `src/api/results.ts` | Update return type to `CohortAssessmentHistory[]` |
| `src/store/assessmentStore.ts` | Add `cohortId: string \| null` state and `setCohortId` action |
| `src/pages/Assessment.tsx` | Read `cohort_id` from query param, guard redirect, pass to submit |
| `src/pages/Dashboard.tsx` | Pass `cohort_id` to Begin Assessment navigation |
| `src/pages/AdminRespondent.tsx` | Read `cohort_id` from `useSearchParams`, pass to API call |
| `src/pages/AdminCohortDetail.tsx` | Add `?cohort_id=${cohortId}` to View Results links |

---

## Chunk 1: Backend Foundation

### Task 1: DB Migration

**Files:**
- Create: `migrations/006_cohort_scoped_assessments.sql`

**Context:**
- The `assessments` table currently has no `cohort_id` column.
- We are doing a clean slate — there are only 2 users, all PDFs already manually deleted from S3.
- The `answers` table FK cascades from `assessments`, so deleting assessments auto-deletes answers.
- Existing migrations: `001_initial_schema.sql`, `002_seed_questions.sql`, `003_add_user_name.sql`, `004_email_settings.sql`, `005_ranking_scoring.sql`.

- [ ] **Step 1: Write the migration file**

```sql
-- migrations/006_cohort_scoped_assessments.sql
-- Clean slate: delete all existing assessment data
-- (PDFs have been manually deleted from Supabase Storage by administrator)
DELETE FROM answers;
DELETE FROM assessments;

-- Add cohort_id column: every assessment is now scoped to a (user_id, cohort_id) pair
ALTER TABLE assessments
  ADD COLUMN cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE;

-- Index for fast per-(user, cohort) lookups
CREATE INDEX idx_assessments_user_cohort ON assessments(user_id, cohort_id);
```

- [ ] **Step 2: Apply migration to local Supabase**

```bash
docker exec -i supabase_db_adizes-backend psql -U postgres -d postgres \
  < /Users/vrln/adizes-backend/migrations/006_cohort_scoped_assessments.sql
```

Expected output: `DELETE 0` or `DELETE N`, then `ALTER TABLE`, then `CREATE INDEX`

- [ ] **Step 3: Verify column added**

```bash
docker exec supabase_db_adizes-backend psql -U postgres -d postgres \
  -c "\d assessments"
```

Expected: column `cohort_id uuid not null` visible in table description.

- [ ] **Step 4: Commit**

```bash
cd /Users/vrln/adizes-backend
git add migrations/006_cohort_scoped_assessments.sql
git commit -m "feat: add cohort_id to assessments — cohort-scoped assessments migration"
```

---

### Task 2: Backend Schemas

**Files:**
- Modify: `app/schemas/assessment.py`
- Modify: `app/schemas/auth.py`
- Modify: `app/schemas/admin.py`

**Context:**
- `app/schemas/assessment.py`: `SubmitRequest` currently has only `answers: List[AnswerInput]`. Add `cohort_id: str`.
- `app/schemas/auth.py`: `MyAssessmentItem` (line 43–50) is renamed to `CohortAssessmentHistory`. Fields unchanged. The `status` field should be `"pending" | "in_progress" | "completed" | "expired"` but note `"in_progress"` is DB-only and not surfaced; keep the union complete for Pydantic.
- `app/schemas/admin.py`: Add a new `RespondentDetail` Pydantic model. The existing `get_respondent` endpoint returns a raw dict — we'll add the model but keep the existing dict return shape in the router (the model documents the intended shape).

- [ ] **Step 1: Write a test that the new SubmitRequest requires cohort_id**

In `/Users/vrln/adizes-backend/tests/test_cohort_scoping.py`:

```python
"""Tests for cohort-scoped assessment schemas and logic."""
import pytest
from pydantic import ValidationError
from app.schemas.assessment import SubmitRequest, AnswerInput


def _make_answer(q: int) -> dict:
    return {"question_index": q, "ranks": {"a": 1, "b": 2, "c": 3, "d": 4}}


class TestSubmitRequestCohortId:
    def test_submit_request_requires_cohort_id(self):
        with pytest.raises(ValidationError):
            SubmitRequest(answers=[AnswerInput(**_make_answer(i)) for i in range(36)])

    def test_submit_request_accepts_cohort_id(self):
        req = SubmitRequest(
            cohort_id="00000000-0000-0000-0000-000000000001",
            answers=[AnswerInput(**_make_answer(i)) for i in range(36)],
        )
        assert req.cohort_id == "00000000-0000-0000-0000-000000000001"

    def test_submit_request_rejects_empty_cohort_id(self):
        with pytest.raises(ValidationError):
            SubmitRequest(
                cohort_id="",
                answers=[AnswerInput(**_make_answer(i)) for i in range(36)],
            )
```

- [ ] **Step 2: Run the test — it should FAIL**

```bash
cd /Users/vrln/adizes-backend
docker compose exec -T app pytest tests/test_cohort_scoping.py -v 2>&1 | head -40
```

Expected: FAIL (cohort_id field does not exist yet)

- [ ] **Step 3: Update `app/schemas/assessment.py` — add `cohort_id` to SubmitRequest**

Find line 53–55:
```python
class SubmitRequest(BaseModel):
    answers: List[AnswerInput]
```

Replace with:
```python
class SubmitRequest(BaseModel):
    cohort_id: str
    answers: List[AnswerInput]

    @model_validator(mode="after")
    def validate_cohort_id(self) -> "SubmitRequest":
        if not self.cohort_id or not self.cohort_id.strip():
            raise ValueError("cohort_id must not be empty")
        return self
```

- [ ] **Step 4: Update `app/schemas/auth.py` — rename MyAssessmentItem → CohortAssessmentHistory**

The existing `MyAssessmentItem` class at line 43 becomes:
```python
class CohortAssessmentHistory(BaseModel):
    cohort_id: str
    cohort_name: str
    enrolled_at: Optional[str] = None
    status: str  # "pending" | "completed" | "expired"
    result_id: Optional[str] = None
    completed_at: Optional[str] = None
    dominant_style: Optional[str] = None
```

Note: The import in `app/routers/auth.py` must also be updated (Task 5 handles this).

- [ ] **Step 5: Update `app/schemas/admin.py` — add RespondentDetail model**

Add after the `CohortDetailResponse` class (currently the last model at line 73–79):

```python
class RespondentDetail(BaseModel):
    user_id: str
    name: str
    email: str
    cohort_id: str
    scaled_scores: Optional[dict] = None
    profile: Optional[dict] = None
    interpretation: Optional[dict] = None
    assessment_status: str  # "pending" | "completed" | "expired"
```

- [ ] **Step 6: Run the test — it should PASS**

```bash
docker compose exec -T app pytest tests/test_cohort_scoping.py -v 2>&1 | head -40
```

Expected: PASS all 3 tests

- [ ] **Step 7: Also verify existing scoring tests still pass**

```bash
docker compose exec -T app pytest tests/test_scoring.py -v 2>&1 | tail -10
```

Expected: PASS

- [ ] **Step 8: Commit**

```bash
cd /Users/vrln/adizes-backend
git add app/schemas/assessment.py app/schemas/auth.py app/schemas/admin.py tests/test_cohort_scoping.py
git commit -m "feat: add cohort_id to SubmitRequest schema, rename MyAssessmentItem, add RespondentDetail"
```

---

### Task 3: Email Service — Add `cohort_enrollment_existing` Template

**Files:**
- Modify: `app/services/email_service.py`

**Context:**
- Current `DEFAULT_TEMPLATES` (line 148–167) has three templates: `user_enrolled`, `admin_invite`, `assessment_complete`.
- Need to add `cohort_enrollment_existing` for already-activated users enrolled in a new cohort.
- This template has NO invite_link — it just has a dashboard link CTA.
- Variables: `user_name`, `cohort_name`, `platform_name`, `platform_url`, `user_email`.
- The `_cta` helper and `_build_template` helper are already available.
- Subject: `"You've been enrolled in {{cohort_name}} — {{platform_name}}"`
- CTA label: `"Go to Dashboard & Begin Assessment"` → `{{platform_url}}`

- [ ] **Step 1: Add a test for the new template in `tests/test_cohort_scoping.py`**

Add to `tests/test_cohort_scoping.py`:

```python
from app.services.email_service import DEFAULT_TEMPLATES, _render


class TestCohortEnrollmentExistingTemplate:
    def test_template_exists(self):
        assert "cohort_enrollment_existing" in DEFAULT_TEMPLATES

    def test_template_has_required_fields(self):
        tmpl = DEFAULT_TEMPLATES["cohort_enrollment_existing"]
        assert "subject" in tmpl
        assert "html_body" in tmpl

    def test_template_subject_renders(self):
        tmpl = DEFAULT_TEMPLATES["cohort_enrollment_existing"]
        rendered = _render(tmpl["subject"], {
            "cohort_name": "Batch 2026",
            "platform_name": "Adizes India",
        })
        assert "Batch 2026" in rendered
        assert "Adizes India" in rendered

    def test_template_body_has_no_invite_link_placeholder(self):
        tmpl = DEFAULT_TEMPLATES["cohort_enrollment_existing"]
        # This template should NOT include {{invite_link}} — no activation needed
        assert "{{invite_link}}" not in tmpl["html_body"]

    def test_template_body_has_platform_url_cta(self):
        tmpl = DEFAULT_TEMPLATES["cohort_enrollment_existing"]
        assert "{{platform_url}}" in tmpl["html_body"]
```

- [ ] **Step 2: Run — expect FAIL**

```bash
docker compose exec -T app pytest tests/test_cohort_scoping.py::TestCohortEnrollmentExistingTemplate -v 2>&1 | head -20
```

Expected: FAIL — `"cohort_enrollment_existing" not in DEFAULT_TEMPLATES`

- [ ] **Step 3: Add `_cohort_enrollment_existing_html()` function and entry in `DEFAULT_TEMPLATES`**

In `/Users/vrln/adizes-backend/app/services/email_service.py`, after `_assessment_complete_html()` (around line 146) and before `DEFAULT_TEMPLATES = {`, add:

```python
def _cohort_enrollment_existing_html() -> str:
    cta = _cta("{{platform_url}}", "Go to Dashboard &amp; Begin Assessment")
    body = f"""
  <!-- Body -->
  <tr>
    <td style="padding:40px 48px 36px;" bgcolor="#ffffff">
      <p style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#1a1a1a;font-weight:400;line-height:1.35;">Hello {{{{user_name}}}},</p>
      <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.75;">You have been enrolled in the <strong style="color:#1a1a1a;">{{{{cohort_name}}}}</strong> cohort for the <strong style="color:#1a1a1a;">Adizes Management Style Assessment (AMSI)</strong>.</p>
      <p style="margin:0 0 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.75;">Log in to your dashboard to begin the assessment for this cohort.</p>
      {cta}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0 24px;"><tr><td style="border-top:1px solid #e8e8e8;font-size:1px;line-height:1px;">&nbsp;</td></tr></table>
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#666666;line-height:1.75;">Sign in at <a href="{{{{platform_url}}}}" style="color:#C8102E;text-decoration:none;">{{{{platform_url}}}}</a></p>
    </td>
  </tr>"""
    return _build_template("user_email", body)
```

Then add to `DEFAULT_TEMPLATES` dict (after `assessment_complete`):

```python
    "cohort_enrollment_existing": {
        "id": "cohort_enrollment_existing",
        "name": "Cohort Enrollment — Existing User",
        "subject": "You've been enrolled in {{cohort_name}} — {{platform_name}}",
        "html_body": _cohort_enrollment_existing_html(),
    },
```

- [ ] **Step 4: Run — expect PASS**

```bash
docker compose exec -T app pytest tests/test_cohort_scoping.py::TestCohortEnrollmentExistingTemplate -v 2>&1 | head -20
```

Expected: PASS all 5 tests

- [ ] **Step 5: Commit**

```bash
cd /Users/vrln/adizes-backend
git add app/services/email_service.py tests/test_cohort_scoping.py
git commit -m "feat: add cohort_enrollment_existing email template for activated users"
```

---

## Chunk 2: Backend Routers

### Task 4: assessment.py — Cohort Validation + Insert + Email Fix

**Files:**
- Modify: `app/routers/assessment.py`

**Context:**
- `submit_assessment` at line 127 currently ignores cohort_id entirely.
- New behavior:
  1. Read `body.cohort_id`
  2. Verify the user is a member of `cohort_id` in `cohort_members` → HTTP 403 if not
  3. Insert `cohort_id` into the assessment row
  4. Fix email cohort lookup: currently uses `cohort_members.limit(1)` which picks an arbitrary cohort. After this change, use `body.cohort_id` to look up the cohort name.
- `SubmitRequest` now includes `cohort_id` (Task 2 handled schema).

- [ ] **Step 1: Modify `submit_assessment` in `app/routers/assessment.py`**

At line 127, the function signature is `def submit_assessment(body: SubmitRequest, ...)`. After the 36-answers check (line 131), add the enrollment validation:

```python
    # Verify user is enrolled in the specified cohort
    cohort_id = body.cohort_id
    enrollment = (
        supabase_admin.table("cohort_members")
        .select("user_id")
        .eq("cohort_id", cohort_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not enrollment.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not enrolled in this cohort",
        )
```

- [ ] **Step 2: Add `cohort_id` to the assessment insert dict**

At line 149, the `supabase_admin.table("assessments").insert(...)` call currently inserts:
```python
{
    "id": result_id,
    "user_id": user_id,
    "user_name": user_name,
    "completed_at": now,
    ...
    "status": "completed",
}
```

Add `"cohort_id": cohort_id` to that dict:
```python
supabase_admin.table("assessments").insert({
    "id": result_id,
    "user_id": user_id,
    "user_name": user_name,
    "cohort_id": cohort_id,   # ← new
    "completed_at": now,
    "raw_scores": scores["raw"],
    "scaled_scores": scores["scaled"],
    "profile": scores["profile"],
    "gaps": [g for g in gaps],
    "interpretation": interp,
    "status": "completed",
}).execute()
```

- [ ] **Step 3: Fix the email cohort name lookup**

Currently at line 182–192:
```python
cohort_row = (
    supabase_admin.table("cohort_members")
    .select("cohort_id, cohorts(name)")
    .eq("user_id", user_id)
    .limit(1)
    .execute()
)
cohort_name_for_email = ""
if cohort_row.data:
    c = cohort_row.data[0].get("cohorts")
    cohort_name_for_email = c.get("name", "") if c else ""
```

Replace with a direct lookup using `cohort_id`:
```python
cohort_name_for_email = ""
try:
    cohort_name_row = (
        supabase_admin.table("cohorts")
        .select("name")
        .eq("id", cohort_id)
        .single()
        .execute()
    )
    if cohort_name_row.data:
        cohort_name_for_email = cohort_name_row.data.get("name", "")
except Exception:
    pass
```

- [ ] **Step 4: Rebuild Docker and test manually**

```bash
cd /Users/vrln/adizes-backend && docker compose up --build -d
```

Test that a submit without valid cohort enrollment returns 403:
```bash
# 1. Get a JWT token
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@adizes.com","password":"User@1234"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# 2. POST to /assessment/submit with a fake cohort_id (user is not enrolled in it)
curl -s -X POST http://localhost:8000/assessment/submit \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cohort_id":"00000000-0000-0000-0000-000000000000","answers":[]}' | python3 -m json.tool
```

Expected: `{"detail": "You are not enrolled in this cohort"}` with HTTP 403

Expected: HTTP 403 `{"detail": "You are not enrolled in this cohort"}`

- [ ] **Step 5: Commit**

```bash
cd /Users/vrln/adizes-backend
git add app/routers/assessment.py
git commit -m "feat: scope assessment submission to cohort — validate enrollment, persist cohort_id, fix email lookup"
```

---

### Task 5: auth.py — Cohort-Scoped my_assessments

**Files:**
- Modify: `app/routers/auth.py`

**Context:**
- Current `my_assessments` (line 163–203): fetches the single globally-latest assessment and attaches it to every cohort card.
- New behavior: for each cohort enrollment, independently query the assessment for `(user_id, cohort_id)`.
- Import rename: `MyAssessmentItem` → `CohortAssessmentHistory` (done in Task 2 schemas).
- Response ordering: `enrolled_at DESC` (most recent cohort first) — this is the user's assessment timeline.
- Status logic: if no assessment row exists for `(user_id, cohort_id)`, status is `"pending"`. Otherwise read `a["status"]`.

- [ ] **Step 1: Update the import in `app/routers/auth.py`**

At line 5:
```python
from app.schemas.auth import (
    LoginRequest, RegisterRequest, AuthResponse,
    ProfileResponse, UpdateProfileRequest, ChangePasswordRequest,
    MyAssessmentItem,
)
```

Change `MyAssessmentItem` to `CohortAssessmentHistory`:
```python
from app.schemas.auth import (
    LoginRequest, RegisterRequest, AuthResponse,
    ProfileResponse, UpdateProfileRequest, ChangePasswordRequest,
    CohortAssessmentHistory,
)
```

- [ ] **Step 2: Rewrite `my_assessments` endpoint**

Replace lines 163–203 with:

```python
@router.get("/my-assessments", response_model=list[CohortAssessmentHistory])
def my_assessments(current_user: dict = Depends(get_current_user)):
    """Return all cohort enrollments for the current user with per-cohort assessment status."""
    user_id = current_user["sub"]

    members = (
        supabase_admin.table("cohort_members")
        .select("cohort_id, enrolled_at, cohorts(id, name)")
        .eq("user_id", user_id)
        .order("enrolled_at", desc=True)
        .execute()
    )

    result = []
    for m in (members.data or []):
        cohort = m.get("cohorts") or {}
        cohort_id = m["cohort_id"]

        # Fetch this user's assessment for this specific cohort
        assessment_resp = (
            supabase_admin.table("assessments")
            .select("id, completed_at, interpretation, status")
            .eq("user_id", user_id)
            .eq("cohort_id", cohort_id)
            .limit(1)
            .execute()
        )
        a = assessment_resp.data[0] if assessment_resp.data else None
        a_status = a.get("status", "pending") if a else "pending"

        dominant = None
        if a_status == "completed" and a and a.get("interpretation"):
            dominant = "".join(a["interpretation"].get("dominant_roles", []))

        result.append(CohortAssessmentHistory(
            cohort_id=cohort_id,
            cohort_name=cohort.get("name", ""),
            enrolled_at=m.get("enrolled_at"),
            status=a_status,
            result_id=a["id"] if a_status == "completed" and a else None,
            completed_at=a["completed_at"] if a_status == "completed" and a else None,
            dominant_style=dominant,
        ))

    return result
```

- [ ] **Step 3: Rebuild Docker**

```bash
cd /Users/vrln/adizes-backend && docker compose up --build -d
```

- [ ] **Step 4: Test manually via Swagger UI**

Open `http://localhost:8000/docs`, authenticate as `user@adizes.com`, call `GET /auth/my-assessments`.

Expected: JSON array, one item per cohort enrollment, each with correct `status` based on `(user_id, cohort_id)` assessment.

- [ ] **Step 5: Commit**

```bash
cd /Users/vrln/adizes-backend
git add app/routers/auth.py
git commit -m "feat: scope my_assessments to (user_id, cohort_id) — per-cohort assessment status"
```

---

### Task 6: admin.py — Assessment Query Scoping

**Files:**
- Modify: `app/routers/admin.py`

**Context:** Three query sites need updating:
1. `list_cohorts` (line 62): currently queries assessments by `user_id IN (member_ids)` without cohort scoping → change to `eq("cohort_id", c["id"]).eq("status", "completed")`.
2. `get_cohort` (line 121): currently queries assessment per user globally → add `.eq("cohort_id", cohort_id)`.
3. `get_respondent` (line 594): currently queries globally for user's latest assessment, returns 404 if none → add required `cohort_id` query param, scope query, return 400 if param missing.

- [ ] **Step 1: Fix `list_cohorts` — scope completed_count by cohort**

In `list_cohorts` (around line 74–84), replace:

```python
        if member_ids:
            comp_rows = (
                supabase_admin.table("assessments")
                .select("user_id")
                .in_("user_id", member_ids)
                .not_.is_("completed_at", "null")
                .execute()
            )
            completed = len(comp_rows.data)
```

With:

```python
        comp_rows = (
            supabase_admin.table("assessments")
            .select("user_id")
            .eq("cohort_id", c["id"])
            .eq("status", "completed")
            .execute()
        )
        completed = len(comp_rows.data or [])
```

Note: `member_ids` check not needed — cohort-scoped query will return 0 rows if no members.
Also remove the `member_ids` variable line (line 73) if it's no longer needed, but keep it as it's still used for `total`.

- [ ] **Step 2: Fix `get_cohort` — scope per-user assessment to cohort**

In `get_cohort` (around line 152–159), replace:

```python
        assessment = (
            supabase_admin.table("assessments")
            .select("id, completed_at, scaled_scores, interpretation, status")
            .eq("user_id", uid)
            .order("completed_at", desc=True)
            .limit(1)
            .execute()
        )
```

With:

```python
        assessment = (
            supabase_admin.table("assessments")
            .select("id, completed_at, scaled_scores, interpretation, status")
            .eq("user_id", uid)
            .eq("cohort_id", cohort_id)
            .limit(1)
            .execute()
        )
```

- [ ] **Step 3: Fix `get_respondent` — add required cohort_id param**

Add `Optional` to imports at the top if not present:
```python
from typing import Optional
```

Replace the `get_respondent` function signature and query (lines 594–620):

```python
@router.get("/respondents/{user_id}")
def get_respondent(
    user_id: str,
    cohort_id: Optional[str] = None,
    admin: dict = Depends(require_admin),
):
    if not cohort_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="cohort_id query parameter is required",
        )

    try:
        auth_resp = supabase_admin.auth.admin.get_user_by_id(user_id)
        auth_user = auth_resp.user
        email = auth_user.email or ""
        meta = getattr(auth_user, "user_metadata", None) or {}
        name = meta.get("name", "")
    except Exception:
        raise HTTPException(status_code=404, detail="User not found")

    assessment = (
        supabase_admin.table("assessments")
        .select("*")
        .eq("user_id", user_id)
        .eq("cohort_id", cohort_id)
        .limit(1)
        .execute()
    )

    result_data = assessment.data[0] if assessment.data else None

    return {
        "user": {"id": user_id, "email": email, "name": name},
        "result": result_data,
        "cohort_id": cohort_id,
    }
```

Note: The frontend `AdminRespondent.tsx` must handle `result` being `null` (user hasn't taken the assessment yet for this cohort). We'll handle that in Task 12.

- [ ] **Step 4: Rebuild and verify**

```bash
cd /Users/vrln/adizes-backend && docker compose up --build -d
```

Test via Swagger: `GET /admin/respondents/{user_id}` without `cohort_id` → 400.
Test with `cohort_id` → correct response.

- [ ] **Step 5: Commit**

```bash
cd /Users/vrln/adizes-backend
git add app/routers/admin.py
git commit -m "feat: scope admin assessment queries to cohort_id in list_cohorts, get_cohort, get_respondent"
```

---

### Task 7: admin.py — Three-Case Enrollment Email Logic

**Files:**
- Modify: `app/routers/admin.py`

**Context:** Three enrollment code paths need the same three-case logic:
- **`enroll_user`** (line 189): Currently always sends `user_enrolled` with a recovery link for existing users.
- **`bulk_enroll`** (line 277): Same issue.
- **`resend_enrollment_invite`** (line 388): Always sends `user_enrolled` template even for activated users.

**Three cases:**
| Case | Condition | Email |
|------|-----------|-------|
| New user | No account | `generate_link(type="invite")` → `user_enrolled` |
| Invited, not activated | Account exists, `email_confirmed_at is None` | `generate_link(type="recovery")` → `user_enrolled` |
| Already activated | Account exists, `email_confirmed_at is not None` | No link → `cohort_enrollment_existing` |

**Activation check pattern:**
```python
auth_user = supabase_admin.auth.admin.get_user_by_id(str(user.id)).user
is_activated = getattr(auth_user, "email_confirmed_at", None) is not None
```

- [ ] **Step 1: Fix `enroll_user` email section**

In `enroll_user`, the existing user branch (line 240–249) generates a recovery link always:
```python
    if not invited_new:
        try:
            lr = supabase_admin.auth.admin.generate_link({
                "type": "recovery",
                ...
            })
            invite_link_val = lr.properties.action_link
        except Exception:
            pass
```

Replace the entire section from `if not invited_new:` through `pass` (lines 240–249), and the email-sending block (lines 251–267), with:

```python
    # Determine activation state for existing users
    is_activated = False
    if not invited_new:
        try:
            fetched = supabase_admin.auth.admin.get_user_by_id(str(target.id)).user
            is_activated = getattr(fetched, "email_confirmed_at", None) is not None
        except Exception:
            pass

        if not is_activated:
            # User exists but hasn't completed activation — send fresh recovery link
            try:
                lr = supabase_admin.auth.admin.generate_link({
                    "type": "recovery",
                    "email": body.email,
                    "options": {"redirect_to": f"{settings.frontend_url}/register"},
                })
                invite_link_val = lr.properties.action_link
            except Exception:
                pass

    # Fire-and-forget enrollment email
    try:
        _cohort_name_resp = supabase_admin.table("cohorts").select("name").eq("id", cohort_id).single().execute()
        cohort_name_val = (_cohort_name_resp.data.get("name", "") if _cohort_name_resp.data else "")
        meta = getattr(target, "user_metadata", None) or {}
        user_name_val = meta.get("name", "") or body.email

        if is_activated:
            # Activated user: dashboard link only (no invite_link needed)
            send_template_email("cohort_enrollment_existing", body.email, {
                "user_name": user_name_val,
                "user_email": body.email,
                "cohort_name": cohort_name_val,
                "platform_name": "Adizes India",
                "platform_url": settings.frontend_url,
            })
        else:
            # New or not-yet-activated user: activation/invite link
            send_template_email("user_enrolled", body.email, {
                "user_name": user_name_val,
                "user_email": body.email,
                "cohort_name": cohort_name_val,
                "invite_link": invite_link_val,
                "platform_name": "Adizes India",
                "platform_url": settings.frontend_url,
            })
    except Exception:
        pass  # Non-fatal
```

- [ ] **Step 2: Fix `bulk_enroll` email section**

In `bulk_enroll`, the existing user section (around lines 335–373) generates recovery links unconditionally. Apply the same three-case pattern per user:

In the loop, after `uid = str(user.id)` and the duplicate check, replace the existing user recovery link block and email-sending block with:

```python
            # Determine activation state for existing users
            is_activated = False
            if not invited_new:
                try:
                    fetched = supabase_admin.auth.admin.get_user_by_id(uid).user
                    is_activated = getattr(fetched, "email_confirmed_at", None) is not None
                except Exception:
                    pass

                if not is_activated:
                    try:
                        link_data = {
                            "type": "recovery",
                            "email": email,
                            "options": {"redirect_to": f"{settings.frontend_url}/register"},
                        }
                        lr = supabase_admin.auth.admin.generate_link(link_data)
                        invite_link_val = lr.properties.action_link
                    except Exception:
                        pass

            supabase_admin.table("cohort_members").insert({
                "cohort_id": cohort_id,
                "user_id": uid,
            }).execute()
            existing_ids.add(uid)
            enrolled.append({"email": email, "invited": invited_new})

            # Fire-and-forget enrollment email
            try:
                cohort_resp = supabase_admin.table("cohorts").select("name").eq("id", cohort_id).single().execute()
                cohort_name_val = cohort_resp.data.get("name", "") if cohort_resp.data else ""
                meta = getattr(user, "user_metadata", None) or {}
                user_name_val = (entry.name or meta.get("name", "")) or email

                if is_activated:
                    send_template_email("cohort_enrollment_existing", email, {
                        "user_name": user_name_val,
                        "user_email": email,
                        "cohort_name": cohort_name_val,
                        "platform_name": "Adizes India",
                        "platform_url": settings.frontend_url,
                    })
                else:
                    send_template_email("user_enrolled", email, {
                        "user_name": user_name_val,
                        "user_email": email,
                        "cohort_name": cohort_name_val,
                        "invite_link": invite_link_val,
                        "platform_name": "Adizes India",
                        "platform_url": settings.frontend_url,
                    })
            except Exception:
                pass  # Non-fatal
```

- [ ] **Step 3: Fix `resend_enrollment_invite`**

In `resend_enrollment_invite` (line 388), currently always generates recovery link and sends `user_enrolled`. Apply three-case logic.

The existing function already defines `cohort_name_val` (from `cohort_row.data.get("name", "")`) and `user_name_val` before the email send. Keep those lines. After those definitions (after `user_name_val = meta.get("name", "") or email`), **delete the existing `invite_link_val = ...` + `generate_link` block + `if not smtp_configured()` check + `send_template_email("user_enrolled", ...)` call**, and replace the entire section from there to the `return` statement with:

```python
    is_activated = getattr(auth_user, "email_confirmed_at", None) is not None

    invite_link_val = settings.frontend_url
    if not is_activated:
        try:
            lr = supabase_admin.auth.admin.generate_link({
                "type": "recovery",
                "email": email,
                "options": {"redirect_to": f"{settings.frontend_url}/register"},
            })
            invite_link_val = lr.properties.action_link
        except Exception:
            pass
```

Then replace the `send_template_email("user_enrolled", ...)` call at the end with:

```python
    if not smtp_configured():
        raise HTTPException(status_code=400, detail="SMTP is not configured. Please set up SMTP in Settings first.")

    try:
        if is_activated:
            send_template_email("cohort_enrollment_existing", email, {
                "user_name": user_name_val,
                "user_email": email,
                "cohort_name": cohort_name_val,
                "platform_name": "Adizes India",
                "platform_url": settings.frontend_url,
            })
        else:
            send_template_email("user_enrolled", email, {
                "user_name": user_name_val,
                "user_email": email,
                "cohort_name": cohort_name_val,
                "invite_link": invite_link_val,
                "platform_name": "Adizes India",
                "platform_url": settings.frontend_url,
            })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {e}")

    return {"message": f"Enrollment invite resent to {email}"}
```

Remove the old `invite_link_val = settings.frontend_url` + `generate_link` block that was there before (now replaced by the conditional above).

- [ ] **Step 4: Rebuild and verify**

```bash
cd /Users/vrln/adizes-backend && docker compose up --build -d
```

Test: backend starts without errors, `/admin/stats` returns 200.

- [ ] **Step 5: Commit**

```bash
cd /Users/vrln/adizes-backend
git add app/routers/admin.py
git commit -m "feat: three-case enrollment email logic — activated users get dashboard link, not activation email"
```

---

## Chunk 3: Frontend

### Task 8: Frontend Types and API Layer

**Files:**
- Modify: `src/types/api.ts`
- Modify: `src/api/assessment.ts`
- Modify: `src/api/admin.ts`
- Modify: `src/api/results.ts`

**Context:**
- `src/types/api.ts` line 86–94: rename `MyAssessmentItem` to `CohortAssessmentHistory`. Same fields.
- `src/api/assessment.ts`: `submitAssessment` currently accepts `answers` only. Add `cohort_id: string` as first param, pass in request body.
- `src/api/admin.ts` line 87–90: `getRespondent(userId)` → `getRespondent(userId, cohortId)`, pass `cohort_id` as query param.
- `src/api/results.ts` line 9: update return type from `MyAssessmentItem[]` to `CohortAssessmentHistory[]`.

- [ ] **Step 1: Update `src/types/api.ts` — rename MyAssessmentItem**

At line 86–94, change:
```ts
export interface MyAssessmentItem {
  cohort_id: string;
  cohort_name: string;
  enrolled_at: string | null;
  status: "pending" | "in_progress" | "completed" | "expired";
  result_id: string | null;
  completed_at: string | null;
  dominant_style: string | null;
}
```

To:
```ts
export interface CohortAssessmentHistory {
  cohort_id: string;
  cohort_name: string;
  enrolled_at: string | null;
  status: "pending" | "in_progress" | "completed" | "expired";
  result_id: string | null;
  completed_at: string | null;
  dominant_style: string | null;
}

// Alias for backwards compatibility during migration
export type MyAssessmentItem = CohortAssessmentHistory;
```

The alias lets Dashboard.tsx continue working unchanged — the rename in Dashboard is handled in Task 11 when we also update the navigation.

- [ ] **Step 2: Update `src/api/assessment.ts` — add cohort_id param**

Replace the existing `submitAssessment` function:
```ts
export async function submitAssessment(
  cohort_id: string,
  answers: Array<{ question_index: number; ranks: Record<string, number> }>
): Promise<SubmitResponse> {
  const { data } = await apiClient.post<SubmitResponse>("/assessment/submit", {
    cohort_id,
    answers,
  });
  return data;
}
```

- [ ] **Step 3: Update `src/api/admin.ts` — getRespondent with cohort_id**

Replace lines 87–90:
```ts
export async function getRespondent(userId: string, cohortId: string) {
  const { data } = await apiClient.get(`/admin/respondents/${userId}`, {
    params: { cohort_id: cohortId },
  });
  return data;
}
```

- [ ] **Step 4: Update `src/api/results.ts` — return type**

At line 9, update import and return type:
```ts
import type { ResultResponse, CohortAssessmentHistory } from "@/types/api";

export async function getMyAssessments(): Promise<CohortAssessmentHistory[]> {
  const { data } = await apiClient.get<CohortAssessmentHistory[]>("/auth/my-assessments");
  return data;
}
```

Also update the import line at the top to remove `MyAssessmentItem`.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/vrln/adizes-frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors (or only pre-existing ones unrelated to these changes).

- [ ] **Step 6: Commit**

```bash
cd /Users/vrln/adizes-frontend
git add src/types/api.ts src/api/assessment.ts src/api/admin.ts src/api/results.ts
git commit -m "feat: rename MyAssessmentItem to CohortAssessmentHistory, update API layer for cohort scoping"
```

---

### Task 9: assessmentStore.ts — Add cohortId State

**Files:**
- Modify: `src/store/assessmentStore.ts`

**Context:**
- Current store (line 1–65) has no `cohortId` field.
- Add `cohortId: string | null` and `setCohortId: (id: string) => void`.
- `cohortId` must be included in `reset()`.

- [ ] **Step 1: Update `src/store/assessmentStore.ts`**

Add `cohortId` to the interface and implementation.

Updated `interface AssessmentState`:
```ts
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

  // Cohort context for this assessment session
  cohortId: string | null;
  setCohortId: (id: string) => void;

  // Result after submission
  resultId: string | null;
  setResultId: (id: string) => void;

  reset: () => void;
}
```

Updated `create<AssessmentState>`:
- Add `cohortId: null` to initial state
- Add `setCohortId: (id) => set({ cohortId: id })`
- Add `cohortId: null` to the `reset()` call

```ts
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

  cohortId: null,
  setCohortId: (id) => set({ cohortId: id }),

  resultId: null,
  setResultId: (id) => set({ resultId: id }),

  reset: () => set({
    sections: [],
    currentSection: 0,
    currentQuestion: 0,
    answers: {},
    cohortId: null,
    resultId: null,
  }),
}));
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/vrln/adizes-frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/vrln/adizes-frontend
git add src/store/assessmentStore.ts
git commit -m "feat: add cohortId state to assessmentStore"
```

---

### Task 10: Assessment.tsx — Read cohort_id from Query Param + Guard + Submit

**Files:**
- Modify: `src/pages/Assessment.tsx`

**Context:**
- Currently `Assessment.tsx` ignores any query params and calls `submitAssessment(answerPayload)` with no cohort_id.
- New behavior:
  1. On mount, read `cohort_id` from `useSearchParams()`.
  2. If missing or empty, redirect to `/dashboard` and show a toast.
  3. Store `cohortId` via `setCohortId` from the store.
  4. In `handleSubmit`, pass `cohortId` as the first arg to `submitAssessment`.
- React Router's `useSearchParams` is already available (package is `react-router-dom`).
- For the toast, use a simple state-based error message displayed on the page (no external toast library needed — just redirect immediately with a query param that Dashboard can read, OR just redirect silently since the guard message is also in the section intro).
- Simplest approach: if no `cohort_id` in query params, redirect to `/dashboard` immediately (the user will see their dashboard and can click the correct "Begin Assessment" button with the cohort_id).

- [ ] **Step 1: Add `useSearchParams` to imports in `Assessment.tsx`**

At line 1:
```tsx
import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
```

- [ ] **Step 2: Add store imports for cohortId**

In the destructure from `useAssessmentStore` (around line 39–50), add `cohortId` and `setCohortId`:
```tsx
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
    cohortId,
    setCohortId,
  } = useAssessmentStore();
```

- [ ] **Step 3: Add the cohort_id guard effect**

After the existing `useEffect` that loads questions (lines 58–66), add a new effect:

```tsx
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const paramCohortId = searchParams.get("cohort_id");
    if (!paramCohortId) {
      // No cohort context — send user back to dashboard
      navigate("/dashboard");
      return;
    }
    setCohortId(paramCohortId);
  }, []);
```

Note: Place `const [searchParams] = useSearchParams();` at the top of the component body, just after the store destructure.

- [ ] **Step 4: Update `handleSubmit` to pass cohort_id**

In `handleSubmit` (around line 161–176):

```tsx
  const handleSubmit = async () => {
    if (!cohortId) {
      navigate("/dashboard");
      return;
    }
    setSubmitting(true);
    try {
      const answerPayload = Object.entries(answers).map(([idx, rankMap]) => ({
        question_index: Number(idx),
        ranks: rankMap as Record<string, number>,
      }));
      const result = await submitAssessment(cohortId, answerPayload);
      setResultId(result.result_id);
      useAssessmentStore.getState().reset();
      navigate(`/results?id=${result.result_id}`);
    } catch {
      setError("Failed to submit assessment. Please try again.");
      setSubmitting(false);
    }
  };
```

- [ ] **Step 5: Verify TypeScript**

```bash
cd /Users/vrln/adizes-frontend && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 6: Start dev server and test manually**

```bash
cd /Users/vrln/adizes-frontend && npm run dev
```

Navigate to `http://localhost:3000/assessment` (no cohort_id) — should redirect to `/dashboard`.
Navigate to `http://localhost:3000/assessment?cohort_id=some-valid-uuid` — should load assessment normally.

- [ ] **Step 7: Commit**

```bash
cd /Users/vrln/adizes-frontend
git add src/pages/Assessment.tsx
git commit -m "feat: Assessment reads cohort_id from query param, guards redirect if missing, passes to submit"
```

---

### Task 11: Dashboard.tsx — Pass cohort_id to Begin Assessment Navigation

**Files:**
- Modify: `src/pages/Dashboard.tsx`

**Context:**
- Currently `NoAssessmentCTA` and `ExpiredAssessmentCTA` both `navigate("/assessment")` without cohort_id.
- The "Start" button in `MyAssessmentsTab` also navigates to `/assessment` without cohort_id (line 476).
- After this change, all three should navigate to `/assessment?cohort_id=<uuid>`.
- `NoAssessmentCTA` and `ExpiredAssessmentCTA` need the `cohortId` passed as a prop.
- In `Dashboard`, `expiredItem` has `expiredItem.cohort_id`. For "no completed/expired" case, use the first pending item: `myAssessments.find(a => a.status === "pending")?.cohort_id ?? null`.

- [ ] **Step 1: Update `MyAssessmentsTab` "Start" button**

In `MyAssessmentsTab` (around line 476):
```tsx
                  ) : (
                    <Button size="sm" onClick={() => navigate(`/assessment?cohort_id=${item.cohort_id}`)}>
                      <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
                      {item.status === "expired" ? "Retake" : "Start"}
                    </Button>
```

Note: also add `"Retake"` label for expired status (better UX).

- [ ] **Step 2: Update `NoAssessmentCTA` to accept and use cohortId**

Change the component signature and navigation:
```tsx
function NoAssessmentCTA({ hasEnrollments, cohortId }: { hasEnrollments: boolean; cohortId: string | null }) {
  const navigate = useNavigate();
  return (
    ...
      {hasEnrollments ? (
        <>
          ...
          <Button onClick={() => navigate(cohortId ? `/assessment?cohort_id=${cohortId}` : "/dashboard")}>
            Start Assessment <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </>
      ) : (
        ...
      )}
    ...
  );
}
```

- [ ] **Step 3: Update `ExpiredAssessmentCTA` to accept and use cohortId**

```tsx
function ExpiredAssessmentCTA({ cohortId }: { cohortId: string | null }) {
  const navigate = useNavigate();
  return (
    ...
    <Button onClick={() => navigate(cohortId ? `/assessment?cohort_id=${cohortId}` : "/dashboard")}>
      Begin Assessment
      <ArrowRight className="ml-2 h-4 w-4" />
    </Button>
    ...
  );
}
```

- [ ] **Step 4: Update `Dashboard` component to derive cohortId and pass to CTAs**

In the `Dashboard` function, after `hasEnrollments`:
```tsx
  const pendingItem = myAssessments.find((a) => a.status === "pending");
  const pendingCohortId = pendingItem?.cohort_id ?? null;
```

Update the render:
```tsx
              ) : expiredItem ? (
                <ExpiredAssessmentCTA cohortId={expiredItem.cohort_id} />
              ) : (
                <NoAssessmentCTA hasEnrollments={hasEnrollments} cohortId={pendingCohortId} />
              )}
```

- [ ] **Step 5: Update `MyAssessmentsTab` import and type**

`Dashboard.tsx` uses `MyAssessmentItem` type for `items` and `myAssessments` state. Update imports to use `CohortAssessmentHistory` (but since we added a type alias in Task 8, no immediate breakage).

Update the import line near the top:
```tsx
import type { ResultResponse, CohortAssessmentHistory } from "@/types/api";
```

And change all `MyAssessmentItem` references:
- `useState<MyAssessmentItem[]>` → `useState<CohortAssessmentHistory[]>`
- `completedItem = myAssessments.find(...)` etc. — types flow through automatically

- [ ] **Step 6: Verify TypeScript**

```bash
cd /Users/vrln/adizes-frontend && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 7: Commit**

```bash
cd /Users/vrln/adizes-frontend
git add src/pages/Dashboard.tsx
git commit -m "feat: pass cohort_id to Begin Assessment navigation in Dashboard"
```

---

### Task 12: AdminRespondent.tsx — cohort_id from Search Params

**Files:**
- Modify: `src/pages/AdminRespondent.tsx`

**Context:**
- Current `AdminRespondent.tsx` uses `const { id } = useParams()` for user_id but ignores cohort_id.
- `getRespondent(id)` call needs to become `getRespondent(id, cohortId)`.
- `cohortId` is read from `useSearchParams()`.
- The backend now returns `{"user": {...}, "result": null, "cohort_id": "..."}` when no assessment exists.
- `AdminRespondent.tsx` must handle `data.result === null` — show a "No assessment yet for this cohort" state.
- The existing `RespondentData` local interface must include `cohort_id` in the response and handle nullable `result`.

- [ ] **Step 1: Add `useSearchParams` import**

```tsx
import { useParams, Link, useSearchParams } from "react-router-dom";
```

- [ ] **Step 2: Read cohortId from search params**

In the `AdminRespondent` function, after `const { id } = useParams<{ id: string }>();`:
```tsx
  const [searchParams] = useSearchParams();
  const cohortId = searchParams.get("cohort_id");
```

- [ ] **Step 3: Update the useEffect to pass cohortId**

```tsx
  useEffect(() => {
    if (!id || !cohortId) {
      setError("No respondent ID or cohort ID provided.");
      setLoading(false);
      return;
    }
    getRespondent(id, cohortId)
      .then((d) => {
        setData(d);
        setPdfUrl(d.result?.pdf_url ?? null);
      })
      .catch(() => setError("Failed to load respondent data."))
      .finally(() => setLoading(false));
  }, [id, cohortId]);
```

- [ ] **Step 4: Update `handleCheckAgain` to pass cohortId**

```tsx
  const handleCheckAgain = async () => {
    if (!id || !cohortId) return;
    setCheckingPdf(true);
    setPdfCheckMessage("");
    try {
      const fresh = await getRespondent(id, cohortId);
      if (fresh.result?.pdf_url) {
        setPdfUrl(fresh.result.pdf_url);
        setPdfCheckMessage("");
      } else {
        setPdfCheckMessage("Still generating, try again shortly.");
      }
    } catch {
      ...
    } finally {
      setCheckingPdf(false);
    }
  };
```

- [ ] **Step 5: Update the `RespondentData` local interface**

At the top of the file, update:
```tsx
interface RespondentData {
  user: { id: string; email: string; name: string };
  result: {
    id: string;
    user_name: string;
    completed_at: string;
    status: "pending" | "in_progress" | "completed" | "expired";
    profile: { is: string; should: string; want: string };
    scaled_scores: { is: ScoreSet; should: ScoreSet; want: ScoreSet };
    gaps: GapDetail[];
    interpretation: Interpretation;
    pdf_url: string | null;
  } | null;  // ← null when no assessment yet
  cohort_id: string;  // ← new
}
```

- [ ] **Step 6: Handle null result in the render**

After the loading/error checks (around line 80), and before the main content render, add a null result guard:

```tsx
  if (data && !data.result) {
    return (
      <div className="p-6 sm:p-10 max-w-3xl mx-auto">
        <Link to="/admin/cohorts" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to Cohorts
        </Link>
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{data.user.name || data.user.email}</h2>
            <p className="text-gray-500 mb-4">No assessment submitted yet for this cohort.</p>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              Awaiting assessment
            </span>
          </CardContent>
        </Card>
      </div>
    );
  }
```

- [ ] **Step 7: Handle non-null `data.result` in the main render body**

The null guard (Step 6) returns early when `data.result` is null. In the main render body below it, TypeScript may still flag `data.result` as `T | null`. Add a local variable to narrow the type after the guard:

```tsx
  // At the start of the main render block, after all early returns:
  const result = data.result!;  // safe: null case handled above by early return
  const { profile, scaled_scores, gaps, interpretation } = result;
```

Then replace all existing `data.result.xxx` references in the JSX (e.g. `data.result.profile`, `data.result.scaled_scores`, `data.result.gaps`, `data.result.interpretation`, `data.result.completed_at`, `data.result.user_name`, `data.result.id`, `data.result.pdf_url`, `data.result.status`) with the local `result.xxx` equivalent. The `pdfUrl` state is already seeded from `d.result?.pdf_url ?? null` in the useEffect, so no change needed there.

- [ ] **Step 8: Verify TypeScript**

```bash
cd /Users/vrln/adizes-frontend && npx tsc --noEmit 2>&1 | head -30
```

Fix any type errors.

- [ ] **Step 9: Commit**

```bash
cd /Users/vrln/adizes-frontend
git add src/pages/AdminRespondent.tsx
git commit -m "feat: AdminRespondent reads cohort_id from search params, handles pending (no result) state"
```

---

### Task 13: AdminCohortDetail.tsx — View Results Link with cohort_id

**Files:**
- Modify: `src/pages/AdminCohortDetail.tsx`

**Context:**
- Line 669: `<Link to={`/admin/respondents/${r.user_id}`}` — missing `cohort_id`.
- The cohort ID is available as `const { id } = useParams()` (from the URL `/admin/cohorts/:id`).

- [ ] **Step 1: Find and update the View Results link**

At line 669:
```tsx
<Link to={`/admin/respondents/${r.user_id}`} className="font-medium text-primary hover:text-primary-dark text-sm">
  View Results
```

Change to:
```tsx
<Link to={`/admin/respondents/${r.user_id}?cohort_id=${cohortId}`} className="font-medium text-primary hover:text-primary-dark text-sm">
  View Results
```

Where `cohortId` is from `const { id: cohortId } = useParams<{ id: string }>()` — rename the destructure if `id` is already used for something else, or alias it: `const { id } = useParams<{ id: string }>();` and use `id` in the link.

Check how `id` is already destructured (it is `const { id } = useParams()` for the cohort ID from the route `/admin/cohorts/:id`). So:

```tsx
<Link to={`/admin/respondents/${r.user_id}?cohort_id=${id}`} className="font-medium text-primary hover:text-primary-dark text-sm">
  View Results
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/vrln/adizes-frontend && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Build for production to catch any remaining issues**

```bash
cd /Users/vrln/adizes-frontend && npm run build 2>&1 | tail -20
```

Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/vrln/adizes-frontend
git add src/pages/AdminCohortDetail.tsx
git commit -m "feat: add cohort_id to AdminCohortDetail View Results link"
```

---

## End-to-End Verification Checklist

Run through these scenarios after all tasks are complete:

### Backend (via Supabase Studio or curl)
- [ ] Run migration `006_cohort_scoped_assessments.sql` on fresh local DB
- [ ] Verify `assessments` table has `cohort_id` NOT NULL column

### User Flow
- [ ] Log in as `user@adizes.com`
- [ ] Dashboard shows cohort cards — enrollment `enrolled_at` is visible, status is `pending`
- [ ] Click "Start" on a cohort card — URL is `/assessment?cohort_id=<uuid>`
- [ ] Complete assessment — submits successfully with `cohort_id`
- [ ] Navigate to Dashboard — cohort card now shows `completed` status
- [ ] Navigate directly to `/assessment` (no query param) — redirected to `/dashboard`

### Admin Flow
- [ ] Admin dashboard stats show correct counts
- [ ] Admin cohort list shows correct completed_count (scoped to cohort)
- [ ] Admin cohort detail shows per-cohort respondent status
- [ ] Click "View Results" for a completed respondent — URL includes `?cohort_id=<uuid>`
- [ ] Admin respondent page loads correct cohort-scoped results
- [ ] Admin respondent page for pending user shows "No assessment submitted yet" state

### Email (if SMTP configured)
- [ ] Enroll a new user → receives `user_enrolled` activation email
- [ ] Enroll an existing activated user → receives `cohort_enrollment_existing` email (no invite link)
- [ ] Resend invite for non-activated user → `user_enrolled` template
- [ ] Resend invite for activated user → `cohort_enrollment_existing` template
