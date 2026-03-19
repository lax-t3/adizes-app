# Employee Activation & Password Reset — Design Spec

**Date:** 2026-03-19
**Status:** Approved

## Problem

1. **Broken activation redirect** — org employee welcome emails generate an activation link with `redirect_to=https://adizes-app.turiyaskills.co` (root), not `/register`. Employees who click the link land on the homepage with no way to set their password.

2. **No self-service password reset** — the login page has a non-functional "Forgot password?" link. Activated employees who forget their password have no way to reset it without admin intervention.

3. **No recovery path communicated** — the org welcome email doesn't tell employees what to do if their activation link expires.

4. **No admin guidance** — the AdminHelp FAQ has no documentation on activation or password reset flows.

---

## Scope

Four changes, all independent:

1. One-line backend fix to the org employee activation redirect URL
2. New forgot-password + reset-password flow (backend endpoint + 2 frontend pages + 1 email template)
3. Note added to `org_welcome` email template
4. New FAQ section in `AdminHelp.tsx`

**Out of scope:** The cohort direct-enrolment `/register` flow is unchanged. No changes to `Register.tsx`, `SetPassword.tsx`, or any existing auth endpoint.

---

## Architecture

### Two independent activation flows (unchanged relationship)

| Flow | Trigger | Redirect | Page |
|------|---------|----------|------|
| Cohort direct enrol | Admin enrolls user into cohort | `/register` | Name + Password (existing) |
| Org employee activation | Admin adds employee to org node | `/register` | Name + Password (existing, unchanged) |
| **Password reset (new)** | Employee clicks "Forgot password?" | `/reset-password` | Password + Confirm only (new) |

The `/register` page is not modified. The new `/reset-password` page handles only the password-reset recovery token — it is never used for initial activation.

---

## Piece 1: Fix Org Employee Activation Redirect

**File:** `app/routers/admin.py` — `_add_employee_to_node` function

**Change:** In both `generate_link` calls inside `_add_employee_to_node` (one for `type="invite"` for new users, one for `type="recovery"` for unactivated users), add `"redirect_to": f"{settings.frontend_url}/register"` to the `options` dict.

**Before:**
```python
lr = supabase_admin.auth.admin.generate_link({
    "type": "invite",
    "email": email,
})
```

**After:**
```python
lr = supabase_admin.auth.admin.generate_link({
    "type": "invite",
    "email": email,
    "options": {"redirect_to": f"{settings.frontend_url}/register"},
})
```

Same fix for the `type="recovery"` call in the same function.

---

## Piece 2: Forgot Password + Reset Password Flow

### Backend — `POST /auth/forgot-password`

**Router:** `app/routers/auth.py`
**Auth:** Public (no token required)
**Request:** `{ "email": string }`
**Response:** Always `200 { "status": "sent" | "not_activated" }` — never reveals whether the email exists

**Logic:**
```
1. Look up user by email via supabase_admin.auth.admin.list_users() filtered by email
2. If user not found → return { "status": "sent" } (silent — don't reveal)
3. If user found and email_confirmed_at IS NOT NULL (activated):
   → generate_link(type="recovery", email=email,
       options={"redirect_to": f"{settings.frontend_url}/reset-password"})
   → send "password_reset" email template with the action_link
   → return { "status": "sent" }
4. If user found and email_confirmed_at IS NULL (not activated):
   → return { "status": "not_activated" }
   (no email sent — employee must use their original activation link)
```

**Pydantic schema (add to `app/schemas/admin.py` or inline):**
```python
class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ForgotPasswordResponse(BaseModel):
    status: str  # "sent" | "not_activated"
```

### Backend — New email template: `password_reset`

**File:** `app/services/email_service.py`

Add `_password_reset_html()` function and register in `DEFAULT_TEMPLATES`:

```
Subject: Reset your Adizes PAEI Platform password
Variables: user_name, reset_link, platform_name
CTA: "Set New Password" → {{reset_link}}
Body: "You requested a password reset for your account on {{platform_name}}.
       Click the button below to set a new password. This link expires in 1 hour.
       If you did not request this, you can safely ignore this email."
```

### Frontend — `/forgot-password` page

**File:** `src/pages/ForgotPassword.tsx` (new)
**Route:** Public — add to `App.tsx` as `<Route path="/forgot-password" element={<ForgotPassword />} />`

**UI:**
- Same visual style as Login / Register (logo bar, centered card, brand colors)
- Single email input field
- "Send Reset Link" submit button (disabled while loading)
- Three response states:
  - **Success (activated):** Green box — "Reset link sent. Check your inbox — the link expires in 1 hour."
  - **Not activated:** Amber box — "Your account isn't activated yet. Please click the activation link in your welcome email first. Contact your administrator if you need it resent."
  - **Unknown email:** Same green box as success (don't reveal whether email exists)
- "← Back to login" link always visible, routes to `/`

**API call:** `POST /auth/forgot-password` via axios (new function in `src/api/auth.ts`)

### Frontend — `/reset-password` page

**File:** `src/pages/ResetPassword.tsx` (new)
**Route:** Public — add to `App.tsx` as `<Route path="/reset-password" element={<ResetPassword />} />`

**Token handling:** Same pattern as `Register.tsx` — parse `access_token` from `window.location.hash`, check `type === "recovery"`.

**UI:**
- Same visual style as other auth pages
- "Set new password" heading
- New password input + Confirm password input
- "Set Password" submit button
- **Expired/invalid token state** (shown if hash has no valid recovery token): Red box — "This link has expired or is invalid." + link "Request a new reset link →" pointing to `/forgot-password`
- **On success:** Redirect to `/` (login) with a brief "Password updated — please log in" message (pass via URL query param `?message=password-updated` and show it on the Landing page)

**API call:** Reuses existing `POST /auth/set-password` endpoint (already in `auth.py`)

### Frontend — Login page "Forgot password?" link

**File:** `src/pages/Landing.tsx`

Change existing non-functional anchor:
```tsx
// Before:
<a href="#" className="...">Forgot password?</a>

// After:
<Link to="/forgot-password" className="...">Forgot password?</Link>
```

Add `import { Link } from 'react-router-dom'` if not already present.

---

## Piece 3: org_welcome Email Update

**File:** `app/services/email_service.py` — `_org_welcome_html()`

Add two sentences below the CTA button (before the divider line):

```
This activation link expires in 24 hours. If it has expired, please contact
your administrator and ask them to resend your welcome email from the platform.
Once your account is activated, you can reset your password at any time from
the login page.
```

---

## Piece 4: Admin Help FAQ

**File:** `src/pages/AdminHelp.tsx`

Add a new FAQ section **"Employee Activation & Password Reset"** with three Q&A entries:

**Q: How does employee account activation work?**
When you add an employee to an organisation, they receive a welcome email with an activation link valid for 24 hours. They click it, set their name and password, and their account becomes active. If they miss the link, go to the employee's node in the organisation page and click "Resend Welcome Email" to generate a fresh one.

**Q: What if an employee never activated their account?**
Their status shows as "Pending" in the employee list. They cannot use self-service password reset until they've activated. Ask them to check their original welcome email, or resend it from the admin panel. Once activated, they can reset their password independently at any time.

**Q: How does self-service password reset work for employees?**
Activated employees can reset their own password by clicking "Forgot password?" on the login page, entering their email, and following the link sent to their inbox (valid for 1 hour). Admins do not need to be involved. If an employee is in "Pending" status, the reset page will tell them to activate their account first using their welcome email.

---

## Data Flow Summary

```
Employee added to org
  → _add_employee_to_node generates invite/recovery link
  → redirect_to = /register  ← (Piece 1 fix)
  → org_welcome email sent with activation link + expiry note  ← (Piece 3)

Employee clicks activation link
  → Supabase verifies token → redirects to /register#access_token=...
  → Register.tsx activate mode: set name + password
  → Account activated (email_confirmed_at set)

Employee forgets password later
  → Login page → "Forgot password?" → /forgot-password  ← (Piece 2)
  → Backend checks email_confirmed_at:
      Activated   → generate_link(recovery, redirect_to=/reset-password)
                  → password_reset email sent
                  → Employee clicks → /reset-password#access_token=...
                  → ResetPassword.tsx: set new password
                  → Redirect to login
      Not activated → "Please activate your account first" message shown
```

---

## Files Changed

### Backend (`adizes-backend`)
| File | Change |
|------|--------|
| `app/routers/admin.py` | Add `redirect_to` to both `generate_link` calls in `_add_employee_to_node` |
| `app/routers/auth.py` | Add `POST /auth/forgot-password` endpoint |
| `app/services/email_service.py` | Add `_password_reset_html()` + register `password_reset` template; update `_org_welcome_html()` with expiry note |

### Frontend (`adizes-frontend`)
| File | Change |
|------|--------|
| `src/pages/ForgotPassword.tsx` | Create — forgot password page |
| `src/pages/ResetPassword.tsx` | Create — reset password page |
| `src/pages/Landing.tsx` | Wire "Forgot password?" link to `/forgot-password` |
| `src/pages/AdminHelp.tsx` | Add Employee Activation & Password Reset FAQ section |
| `src/App.tsx` | Add `/forgot-password` and `/reset-password` public routes |

---

## Error States & Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| Unknown email on `/forgot-password` | Returns `{ status: "sent" }` — same UI as activated (security) |
| Expired reset token on `/reset-password` | Red error + link to `/forgot-password` |
| Expired activation token on `/register` | Existing behaviour unchanged (out of scope) |
| Employee submits `/forgot-password` twice | Second `generate_link` call invalidates first token — only latest link works |
| SMTP not configured | `POST /auth/forgot-password` returns 400 with `"SMTP not configured"` detail |
