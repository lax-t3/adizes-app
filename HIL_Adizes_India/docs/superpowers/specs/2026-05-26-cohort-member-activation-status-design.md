# Cohort Member Activation Status Design

**Goal:** Allow admins to see whether an enrolled user has activated their account (clicked the invite link and set their password), distinct from whether they have started or completed the assessment.

**Problem:** The current respondent list in `AdminCohortDetail` shows assessment status (`pending` / `in_progress` / `completed`) but not account activation state. A user who never opened their invite email and a user who activated their account but hasn't started yet both appear as `pending` — indistinguishable.

---

## Three Distinct States (Post-Fix)

| Account Badge | Assessment Status | Meaning |
|---------------|-------------------|---------|
| **Invite Pending** (amber) | pending | Enrolled; invite email sent; user has not clicked the link or set their password |
| **Active** (green) | pending | Account activated; assessment not yet started |
| **Active** (green) | in_progress | Assessment started but not submitted |
| **Active** (green) | completed | Assessment submitted |

---

## Backend Changes

### `app/schemas/admin.py`

Add `activated: bool` to `RespondentSummary`:

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

### `app/routers/admin.py` — `get_cohort`

The `auth_user` object is already fetched per member via `_get_auth_users_map()`. Add the activation check when building `RespondentSummary`:

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

---

## Frontend Changes

### `src/types/api.ts`

Add `activated` to `RespondentSummary`:

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

### `src/pages/AdminCohortDetail.tsx`

In the respondent table row, add an activation badge alongside the existing status badge:

```tsx
{/* Account activation state */}
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

The "Resend Invite" action should remain accessible for all members but is most relevant when `activated === false`. Optionally surface it more prominently (e.g. show inline) for unactivated members.

---

## Files to Touch

| File | Change |
|------|--------|
| `adizes-backend/app/schemas/admin.py` | Add `activated: bool` to `RespondentSummary` |
| `adizes-backend/app/routers/admin.py` | Pass `activated` from `auth_user.email_confirmed_at` in `get_cohort` |
| `adizes-frontend/src/types/api.ts` | Add `activated: boolean` to `RespondentSummary` interface |
| `adizes-frontend/src/pages/AdminCohortDetail.tsx` | Show activation badge per row |

No new API endpoints, no new migrations, no schema changes. Pure read-only data already available on the `auth_user` object.

---

## Testing

1. Enroll a fresh email → member appears as **Invite Pending** + `pending`
2. Click the invite link, set a password → member flips to **Active** + `pending`
3. Start the assessment → **Active** + `in_progress`
4. Submit → **Active** + `completed`
