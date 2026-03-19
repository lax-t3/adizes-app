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

**Change:** Both `generate_link` calls inside `_add_employee_to_node` are missing the `options` key entirely. Add `"options": {"redirect_to": f"{settings.frontend_url}/register"}` to both.

Note: `redirect_to` controls where Supabase redirects the browser **after** token verification — it does not change the `action_link` URL used in the email itself. The existing `activation_url = lr.properties.action_link` assignment is unaffected.

**Invite call (new user) — Before:**
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

**Recovery call (unactivated user) — Before:**
```python
lr = supabase_admin.auth.admin.generate_link({
    "type": "recovery",
    "email": email,
})
```
**After:**
```python
lr = supabase_admin.auth.admin.generate_link({
    "type": "recovery",
    "email": email,
    "options": {"redirect_to": f"{settings.frontend_url}/register"},
})
```

---

## Piece 2: Forgot Password + Reset Password Flow

### Backend — `POST /auth/forgot-password`

**Router:** `app/routers/auth.py`
**Auth:** Public (no token required)
**Request:** `{ "email": string }`
**Response:** Always `200 { "status": "sent" | "not_activated" }` — never reveals whether the email exists

**Logic:**
```
1. If smtp_configured() is False → raise HTTPException(400, "SMTP is not configured")

2. Call supabase_admin.auth.admin.list_users() — returns ALL users (no filter param exists
   in supabase-py). Find match with:
     target = next((u for u in all_users if u.email == email), None)

3. If target is None → return { "status": "sent" } (silent — don't reveal non-existence)

4. If target found and email_confirmed_at IS NOT NULL (activated):
   → lr = generate_link(type="recovery", email=email,
         options={"redirect_to": f"{settings.frontend_url}/reset-password"})
   → user_name = (target.user_metadata or {}).get("name") or email
   → send_template_email("password_reset", email, {
         "user_name": user_name,
         "reset_link": lr.properties.action_link,
         "platform_name": "Adizes India",
     })
   → return { "status": "sent" }

5. If target found and email_confirmed_at IS NULL (not activated):
   → return { "status": "not_activated" }
   (no email sent — employee must use their original activation link)
```

**Pydantic schemas — add to `app/schemas/auth.py`** (not admin.py — this is an auth endpoint):
```python
class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ForgotPasswordResponse(BaseModel):
    status: str  # "sent" | "not_activated"
```

### Backend — New email template: `password_reset`

**File:** `app/services/email_service.py`

Add `_password_reset_html()` function following the same pattern as `_org_welcome_html()` and register in `DEFAULT_TEMPLATES`:

```
id:       "password_reset"
name:     "Password Reset"
subject:  "Reset your Adizes PAEI Platform password"
variables: user_name, reset_link, platform_name
CTA button: "Set New Password" → {{reset_link}}
Body text:
  "You requested a password reset for your account on {{platform_name}}.
   Click the button below to set a new password. This link expires in 1 hour.
   If you did not request this, you can safely ignore this email."
Footer: same divider + disclaimer pattern as existing templates
```

### Frontend — `/forgot-password` page

**File:** `src/pages/ForgotPassword.tsx` (new named export `ForgotPassword`)
**Route:** Public — add to `App.tsx` as `<Route path="/forgot-password" element={<ForgotPassword />} />`

**UI:**
- Same visual style as Login / Register (logo bar, centered card, brand colors `#C8102E` / `#1D3557`)
- Single email input field
- "Send Reset Link" submit button (disabled while loading)
- Three response states after submit:
  - **Activated:** Green box — "Reset link sent. Check your inbox — the link expires in 1 hour."
  - **Not activated:** Amber box — "Your account isn't activated yet. Please click the activation link in your welcome email first. Contact your administrator if you need it resent."
  - **Unknown email:** Same green box as activated (security — never reveal whether email exists)
- "← Back to login" link always visible, routes to `/`

**API call:** Add `forgotPassword(email: string)` to `src/api/auth.ts`:
```typescript
export async function forgotPassword(email: string) {
  const res = await api.post('/auth/forgot-password', { email });
  return res.data as { status: 'sent' | 'not_activated' };
}
```

### Frontend — `/reset-password` page

**File:** `src/pages/ResetPassword.tsx` (new named export `ResetPassword`)
**Route:** Public — add to `App.tsx` as `<Route path="/reset-password" element={<ResetPassword />} />`

**Token handling:** Same pattern as `Register.tsx` — parse `access_token` and `type` from `window.location.hash`. If no valid recovery token found (missing or wrong type), show the expired/invalid error state immediately.

**Critical — Bearer token:** The `access_token` from the hash must be passed as the `Authorization: Bearer <token>` header when calling `POST /auth/set-password`. Match the pattern used in `Register.tsx` which passes `accessToken` to `setPassword(accessToken, password)`. The user is not logged in via the store — the hash token is the auth credential for this call.

**UI:**
- Same visual style as other auth pages
- "Set new password" heading
- New password input + Confirm password input (min 8 chars, must match)
- "Set Password" submit button (disabled while loading)
- **Expired/invalid token state** (no valid hash token): Red box — "This link has expired or is invalid." + link "Request a new reset link →" pointing to `/forgot-password`
- **On success:** `navigate('/?message=password-updated', { replace: true })`

### Frontend — Landing.tsx success message

**File:** `src/pages/Landing.tsx`

Read `?message` query param using `useSearchParams` (already available via react-router-dom). If `message === 'password-updated'`, show a green success box **above the login form**: "Your password has been updated. Please log in." Clear the param from the URL after display using `navigate('/', { replace: true })` once the message has been rendered (use a `useEffect` with a short delay or on first render).

### Frontend — Login page "Forgot password?" link

**File:** `src/pages/Landing.tsx`

Change existing non-functional anchor:
```tsx
// Before:
<a href="#" className="...">Forgot password?</a>

// After:
<Link to="/forgot-password" className="...">Forgot password?</Link>
```

Add `import { Link } from 'react-router-dom'` if not already imported.

---

## Piece 3: org_welcome Email Update

**File:** `app/services/email_service.py` — `_org_welcome_html()`

Add a new paragraph **after the CTA button and before the `<table>` divider line**:

```html
<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;
          color:#666666;line-height:1.75;">
  This activation link expires in <strong>24 hours</strong>. If it has expired,
  please contact your administrator and ask them to resend your welcome email
  from the platform. Once your account is activated, you can reset your
  password at any time from the login page.
</p>
```

---

## Piece 4: Admin Help FAQ

**File:** `src/pages/AdminHelp.tsx`

Add a new FAQ section **"Employee Activation & Password Reset"** with three Q&A entries, following the existing FAQ entry pattern in the file:

**Q: How does employee account activation work?**
When you add an employee to an organisation, they receive a welcome email with an activation link valid for 24 hours. They click it, set their name and password, and their account becomes active. If they miss the link, go to the employee's node in the organisation page and click "Resend Welcome Email" to generate a fresh one.

**Q: What if an employee never activated their account?**
Their status shows as "Pending" in the employee list. They cannot use self-service password reset until they have activated. Ask them to check their original welcome email, or resend it from the admin panel. Once activated, they can reset their password independently at any time.

**Q: How does self-service password reset work for employees?**
Activated employees can reset their own password by clicking "Forgot password?" on the login page, entering their email, and following the link sent to their inbox (valid for 1 hour). Admins do not need to be involved. If an employee is still in "Pending" status, the reset page will tell them to activate their account first using their welcome email.

---

## Data Flow Summary

```
Employee added to org
  → _add_employee_to_node generates invite/recovery link
  → redirect_to = /register  ← (Piece 1 fix)
  → org_welcome email sent with activation link + expiry note  ← (Piece 3)

Employee clicks activation link
  → Supabase verifies token → redirects to /register#access_token=...&type=invite
  → Register.tsx activate mode: set name + password (existing, unchanged)
  → Account activated (email_confirmed_at set)

Employee forgets password later
  → Login page → "Forgot password?" → /forgot-password  ← (Piece 2)
  → Backend: smtp_configured() check → list_users() linear search by email
      Activated   → generate_link(recovery, redirect_to=/reset-password)
                  → password_reset email sent
                  → Employee clicks → /reset-password#access_token=...&type=recovery
                  → ResetPassword.tsx: access_token passed as Bearer header
                  → POST /auth/set-password → success
                  → navigate('/?message=password-updated', { replace: true })
                  → Landing.tsx shows green banner → cleared from URL
      Not activated → amber "activate first" message shown, no email sent
```

---

## Files Changed

### Backend (`adizes-backend`)
| File | Change |
|------|--------|
| `app/routers/admin.py` | Add `options.redirect_to` to both `generate_link` calls in `_add_employee_to_node` |
| `app/routers/auth.py` | Add `POST /auth/forgot-password` endpoint |
| `app/schemas/auth.py` | Add `ForgotPasswordRequest` and `ForgotPasswordResponse` |
| `app/services/email_service.py` | Add `_password_reset_html()` + register `password_reset` template; update `_org_welcome_html()` with expiry note |

### Frontend (`adizes-frontend`)
| File | Change |
|------|--------|
| `src/pages/ForgotPassword.tsx` | Create — forgot password page |
| `src/pages/ResetPassword.tsx` | Create — reset password page |
| `src/pages/Landing.tsx` | Wire "Forgot password?" link; add `?message=password-updated` banner |
| `src/pages/AdminHelp.tsx` | Add Employee Activation & Password Reset FAQ section |
| `src/App.tsx` | Add `/forgot-password` and `/reset-password` public routes |
| `src/api/auth.ts` | Add `forgotPassword(email)` function |

---

## Error States & Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| Unknown email on `/forgot-password` | Returns `{ status: "sent" }` — same green UI as activated (security) |
| Expired reset token on `/reset-password` | Red error box + link to `/forgot-password` |
| Expired activation token on `/register` | Existing behaviour unchanged (out of scope) |
| Employee submits `/forgot-password` twice | Second `generate_link` invalidates first token — only latest link works |
| SMTP not configured | `POST /auth/forgot-password` returns 400 — frontend shows generic error |
| `user_metadata.name` absent | `user_name` falls back to email address for the greeting |
| Passwords don't match in `/reset-password` | Client-side validation, button stays disabled |
