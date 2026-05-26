# Admin & Assessment UX Improvements

Two independent features, both captured here for a single implementation sprint.

---

## Feature 1 — Cohort Member Activation Status

**Goal:** Allow admins to see whether an enrolled user has activated their account (clicked the invite link and set their password), distinct from whether they have started or completed the assessment.

**Problem:** The current respondent list in `AdminCohortDetail` shows assessment status (`pending` / `in_progress` / `completed`) but not account activation state. A user who never opened their invite email and a user who activated their account but hasn't started yet both appear as `pending` — indistinguishable.

### Three Distinct States (Post-Fix)

| Account Badge | Assessment Status | Meaning |
|---------------|-------------------|---------|
| **Invite Pending** (amber) | pending | Enrolled; invite sent; user has not set their password |
| **Active** (green) | pending | Account activated; assessment not yet started |
| **Active** (green) | in_progress | Assessment started but not submitted |
| **Active** (green) | completed | Assessment submitted |

### Backend Changes

**`app/schemas/admin.py`** — add `activated: bool` to `RespondentSummary`:

```python
class RespondentSummary(BaseModel):
    user_id: str
    name: str
    email: str
    status: str           # 'pending' | 'in_progress' | 'completed' | 'expired'
    activated: bool       # True if email_confirmed_at is not None in auth.users
    dominant_style: str | None
    completed_at: str | None
```

**`app/routers/admin.py` — `get_cohort`** — the `auth_user` object is already fetched per member via `_get_auth_users_map()`. Add the activation check:

```python
activated = (
    getattr(auth_user, "email_confirmed_at", None) is not None
    if auth_user else False
)

respondents.append(RespondentSummary(
    user_id=uid,
    name=name,
    email=email,
    status=a_status,
    activated=activated,      # ← new
    dominant_style=dominant,
    completed_at=a["completed_at"] if a else None,
))
```

### Frontend Changes

**`src/types/api.ts`** — add `activated` to `RespondentSummary`:

```ts
export interface RespondentSummary {
  user_id: string;
  name: string;
  email: string;
  status: "pending" | "in_progress" | "completed" | "expired";
  activated: boolean;
  dominant_style: string | null;
  completed_at: string | null;
}
```

**`src/pages/AdminCohortDetail.tsx`** — add activation badge per row:

```tsx
{r.activated ? (
  <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 border border-green-200">
    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
    Active
  </span>
) : (
  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">
    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
    Invite Pending
  </span>
)}
```

The "Resend Invite" action should remain accessible for all members; surface it more prominently (e.g. show inline) for unactivated members.

### Files to Touch (Feature 1)

| File | Change |
|------|--------|
| `adizes-backend/app/schemas/admin.py` | Add `activated: bool` to `RespondentSummary` |
| `adizes-backend/app/routers/admin.py` | Pass `activated` from `auth_user.email_confirmed_at` in `get_cohort` |
| `adizes-frontend/src/types/api.ts` | Add `activated: boolean` to `RespondentSummary` interface |
| `adizes-frontend/src/pages/AdminCohortDetail.tsx` | Show activation badge per row |

No new API endpoints, no migrations, no schema changes. Pure read-only data already on the `auth_user` object.

### Testing (Feature 1)

1. Enroll a fresh email → member appears as **Invite Pending** + `pending`
2. Click invite link, set password → member flips to **Active** + `pending`
3. Start assessment → **Active** + `in_progress`
4. Submit → **Active** + `completed`

---

## Feature 2 — Assessment Navigation & Completion UX

### Problems Reported

**Problem A — No way to jump to incomplete questions on validation failure.**
When trying to submit with unanswered questions, an alert shows which questions are incomplete (e.g., Q1, Q4) but the only option is to dismiss it and navigate backwards one question at a time. With 36 questions, going from Q36 back to Q4 then Q1 required 33 + 4 = 37 individual back-button presses.

**Problem B — 4th option can be accidentally deselected.**
When a user ranks options 1st, 2nd, and 3rd, the remaining option is auto-assigned 4th rank. Clicking on that auto-assigned option toggles it off, leaving the question with no 4th-ranked option — and no visible indicator of the problem until the final submit attempt. The user likely pressed it inadvertently and it silently unranked itself.

**Problem C — No way to return to submit screen after fixing incomplete questions.**
After fixing Q4 and Q1, the user had to navigate forward one question at a time through all remaining questions to reach the submit screen again — another 34 presses.

---

### Design

#### A — Incomplete-question jump from the error state

When submit is attempted and validation fails, replace the plain alert with an inline error panel that:

1. Lists each incomplete question by its **display number** (the number the user sees, 1–36 across all sections, or the section-relative number e.g. "Is Q4")
2. Each question number is a **clickable button** that navigates the assessment directly to that question
3. The panel stays visible until all questions are answered

Example panel:

```
⚠ 2 questions need attention before you can submit.
  Jump to: [Question 4]  [Question 1]
```

Implementation notes:
- The assessment page already knows which questions have incomplete `ranks` objects (some rank values missing or not a permutation of 1–4)
- The incomplete list is derived from the same validation logic already used at submit time
- `handleJumpToQuestion(questionIndex)` sets `currentIndex` in the assessment page/store and scrolls to top

#### B — Lock the auto-assigned 4th rank option

When 3 of 4 options have been explicitly ranked (rank values 1, 2, 3 assigned), the remaining option is displayed with rank 4. That option must not be deselectable by clicking.

Implementation:
- When rendering a rank-option button: if the option's rank was derived automatically (i.e., it is the only option with no explicit rank selection), mark it as `autoRanked`
- `autoRanked` options render their rank badge identically to explicitly-ranked ones (no visual difference needed) but their click handler is a no-op — or at most shows a brief tooltip: "This option is ranked 4th automatically"
- Alternatively (simpler): once all 4 ranks are filled, disable the click handlers for all options in that question. The user can only change ranks by clicking a different option (which triggers a re-rank of the others) — never by clicking the rank-4 option alone to deselect it.

The simpler approach is preferred: when `ranks` contains all four values {1,2,3,4}, every option click either re-ranks (if the user clicks a differently-ranked option to indicate a new 1st preference) or is a no-op on the already-rank-4 option.

Determine the existing ranking interaction model before implementing — the fix must be consistent with how re-ranking currently works.

#### C — "Return to submit" shortcut after fixing incomplete questions

Track a `farthestIndex` alongside `currentIndex` in the assessment store. `farthestIndex` advances as the user moves forward but never decreases when the user navigates backward.

When `currentIndex < farthestIndex` (user has navigated backward to fix something):

- Show a **"↑ Back to where I was"** button alongside the normal Next button
- This button sets `currentIndex = farthestIndex` (or directly to the submit screen if `farthestIndex` was at/past the last question)

After jumping back to fix an incomplete question and answering it:
- If there are no remaining incomplete questions, the "↑ Back to where I was" button takes them directly to the submit screen
- If there are still incomplete questions, the button takes them to the farthest point they previously reached

This avoids any complex "smart jump" logic: the button is simply a shortcut to the high-water mark.

---

### Files to Touch (Feature 2)

| File | Change |
|------|--------|
| Assessment page component | Replace submit-failure plain alert with clickable incomplete-question panel; implement `handleJumpToQuestion` |
| Assessment page component | Add `farthestIndex` tracking; show "Back to where I was" button when `currentIndex < farthestIndex` |
| Assessment store (Zustand) | Add `farthestIndex: number` alongside `currentIndex`; expose `setFarthestIndex` |
| Ranking option component | Make rank-4 auto-assigned option a no-op on click once all 4 ranks are filled |

Exact file paths to confirm during implementation (explore `adizes-frontend/src/`):
- Assessment page: likely `src/pages/Assessment.tsx`
- Assessment store: likely `src/store/assessmentStore.ts` or `src/store/useAssessmentStore.ts`
- Ranking component: likely `src/components/RankingQuestion.tsx` or similar

---

### Testing (Feature 2)

**Problem A fix:**
1. Start assessment, answer all questions except Q4 and Q30
2. Navigate to submit screen and attempt to submit
3. Error panel appears listing "Question 4" and "Question 30" as clickable buttons
4. Click "Question 4" → assessment jumps directly to Q4
5. Answer Q4 → error panel updates to show only "Question 30"
6. Click "Question 30" → jumps to Q30, answer it → panel disappears → submit succeeds

**Problem B fix:**
1. On any question, rank options 1st, 2nd, 3rd → 4th is auto-filled
2. Click the auto-ranked (4th) option → nothing happens (no deselect)
3. Click a different option to assign it rank 1 → re-ranking shuffles correctly
4. The 4th slot is always filled when 3 options have explicit ranks

**Problem C fix:**
1. Start assessment, navigate forward to Q36
2. Navigate backward to Q4 to fix a mistake
3. "Back to where I was" button is visible on Q4
4. Click it → jumps directly back to Q36 / submit screen
5. Also verify: if Q4 was the only incomplete question and you fix it, "Back to where I was" takes you to submit, not Q36
