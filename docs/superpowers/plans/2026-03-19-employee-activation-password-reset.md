# Employee Activation & Password Reset — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the broken org employee activation redirect, add self-service forgot-password/reset-password flow, update the org welcome email with an expiry note, and add a FAQ section for employee activation in AdminHelp.

**Architecture:** Four independent changes across two repos. Backend adds one new auth endpoint and two email template changes. Frontend adds two new public pages and small edits to Landing.tsx, AdminHelp.tsx, and App.tsx. No database changes required.

**Tech Stack:** FastAPI + supabase-py (backend) · React 19 + TypeScript + Tailwind v4 + react-router-dom (frontend) · pytest (backend tests)

**Spec:** `/Users/vrln/adizes-frontend/docs/superpowers/specs/2026-03-19-employee-activation-password-reset-design.md`

---

## File Map

### Backend (`/Users/vrln/adizes-backend`)
| File | Action | Purpose |
|------|--------|---------|
| `app/routers/admin.py` | Modify | Add `options.redirect_to` to both `generate_link` calls in `_add_employee_to_node` |
| `app/services/email_service.py` | Modify | Add `_password_reset_html()` + register template; add expiry note to `_org_welcome_html()` |
| `app/schemas/auth.py` | Modify | Add `ForgotPasswordRequest` and `ForgotPasswordResponse` |
| `app/routers/auth.py` | Modify | Add `POST /auth/forgot-password` endpoint |

### Frontend (`/Users/vrln/adizes-frontend`)
| File | Action | Purpose |
|------|--------|---------|
| `src/api/auth.ts` | Modify | Add `forgotPassword(email)` function |
| `src/pages/ForgotPassword.tsx` | Create | Forgot password page with email input + status states |
| `src/pages/ResetPassword.tsx` | Create | Reset password page — reads recovery token from hash, sets new password |
| `src/pages/Landing.tsx` | Modify | Wire "Forgot password?" link; add `?message=password-updated` success banner |
| `src/App.tsx` | Modify | Add `/forgot-password` and `/reset-password` public routes |
| `src/pages/AdminHelp.tsx` | Modify | Add Employee Activation & Password Reset FAQ section |

---

## Task 1: Fix Org Employee Activation Redirect

**Files:**
- Modify: `app/routers/admin.py` (lines ~1037–1052 — the two `generate_link` calls in `_add_employee_to_node`)

Both `generate_link` calls currently have no `options` key at all, so Supabase redirects to the project root after token verification. Fix both to add `redirect_to`.

- [ ] **Step 1: Add `options.redirect_to` to the invite call**

In `_add_employee_to_node`, find the `type="invite"` call (around line 1037):

```python
# BEFORE (lines ~1037–1041):
lr = supabase_admin.auth.admin.generate_link({
    "type": "invite",
    "email": email,
    "data": {"name": name},
})
```

Change to:
```python
# AFTER:
lr = supabase_admin.auth.admin.generate_link({
    "type": "invite",
    "email": email,
    "data": {"name": name},
    "options": {"redirect_to": f"{settings.frontend_url}/register"},
})
```

- [ ] **Step 2: Add `options.redirect_to` to the recovery call**

Still in `_add_employee_to_node`, find the `type="recovery"` call (around line 1049):

```python
# BEFORE (lines ~1049–1052):
lr = supabase_admin.auth.admin.generate_link({
    "type": "recovery",
    "email": email,
})
```

Change to:
```python
# AFTER:
lr = supabase_admin.auth.admin.generate_link({
    "type": "recovery",
    "email": email,
    "options": {"redirect_to": f"{settings.frontend_url}/register"},
})
```

Note: `settings` is already imported in `admin.py`. `redirect_to` controls where Supabase redirects the browser after verifying the token — it does NOT change `lr.properties.action_link`, which is the magic link URL already assigned to `activation_url` in the existing code. The rest of the function is unchanged.

- [ ] **Step 3: Verify the function still compiles**

```bash
cd /Users/vrln/adizes-backend
docker exec adizes-backend python -c "from app.routers.admin import _add_employee_to_node; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
cd /Users/vrln/adizes-backend
git add app/routers/admin.py
git commit -m "fix: add redirect_to /register in org employee generate_link calls"
```

---

## Task 2: Email Template Changes

**Files:**
- Modify: `app/services/email_service.py`

Two changes: (a) add expiry note to `_org_welcome_html()`, (b) add new `_password_reset_html()` function and register it.

- [ ] **Step 1: Add expiry note to `_org_welcome_html()`**

In `_org_welcome_html()` (around line 160), find the current body between the CTA and the divider table:

```python
      {cta}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0 24px;"><tr><td style="border-top:1px solid #e8e8e8;font-size:1px;line-height:1px;">&nbsp;</td></tr></table>
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#666666;line-height:1.75;">If you did not expect this email, you can safely ignore it.</p>
```

Insert a new paragraph between the CTA and the divider table:

```python
      {cta}
      <p style="margin:32px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#666666;line-height:1.75;">This activation link expires in <strong>24 hours</strong>. If it has expired, please contact your administrator and ask them to resend your welcome email from the platform. Once your account is activated, you can reset your password at any time from the login page.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0 24px;"><tr><td style="border-top:1px solid #e8e8e8;font-size:1px;line-height:1px;">&nbsp;</td></tr></table>
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#666666;line-height:1.75;">If you did not expect this email, you can safely ignore it.</p>
```

- [ ] **Step 2: Add `_password_reset_html()` function**

Add this new function after `_org_welcome_html()` (after line ~173, before `DEFAULT_TEMPLATES`):

```python
def _password_reset_html() -> str:
    cta = _cta("{{reset_link}}", "Set New Password")
    body = f"""
  <!-- Body -->
  <tr>
    <td style="padding:40px 48px 36px;" bgcolor="#ffffff">
      <p style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#1a1a1a;font-weight:400;line-height:1.35;">Hello {{{{user_name}}}},</p>
      <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.75;">We received a request to reset the password for your account on <strong style="color:#1a1a1a;">{{{{platform_name}}}}</strong>.</p>
      <p style="margin:0 0 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.75;">Click the button below to set a new password. This link is valid for <strong>1 hour</strong>.</p>
      {cta}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0 24px;"><tr><td style="border-top:1px solid #e8e8e8;font-size:1px;line-height:1px;">&nbsp;</td></tr></table>
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#666666;line-height:1.75;">If you did not request a password reset, you can safely ignore this email. Your password will not be changed.</p>
    </td>
  </tr>"""
    return _build_template("user_email", body)
```

- [ ] **Step 3: Register `password_reset` in `DEFAULT_TEMPLATES`**

In `DEFAULT_TEMPLATES` (around line 176), add a new entry after `"org_welcome"`:

```python
    "password_reset": {
        "id": "password_reset",
        "name": "Password Reset",
        "subject": "Reset your {{platform_name}} password",
        "html_body": _password_reset_html(),
    },
```

- [ ] **Step 4: Write a unit test for the new template**

In `tests/test_org_module.py` (or a new file `tests/test_email_templates.py`), add:

```python
class TestPasswordResetTemplate:
    def test_renders_user_name(self):
        from app.services.email_service import _render, DEFAULT_TEMPLATES
        tmpl = DEFAULT_TEMPLATES["password_reset"]
        result = _render(tmpl["html_body"], {
            "user_name": "Jane Smith",
            "reset_link": "https://example.com/reset-password#token=abc",
            "platform_name": "Adizes India",
            "platform_url": "https://adizes-app.turiyaskills.co",
        })
        assert "Jane Smith" in result
        assert "Set New Password" in result
        assert "https://example.com/reset-password#token=abc" in result
        assert "1 hour" in result

    def test_org_welcome_contains_expiry_note(self):
        from app.services.email_service import DEFAULT_TEMPLATES
        html = DEFAULT_TEMPLATES["org_welcome"]["html_body"]
        assert "24 hours" in html
        assert "reset your password" in html.lower()
```

- [ ] **Step 5: Run the tests**

```bash
cd /Users/vrln/adizes-backend
docker exec adizes-backend python -m pytest tests/ -v -k "Template or template or email" 2>&1 | tail -20
```

Expected: all template tests pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/vrln/adizes-backend
git add app/services/email_service.py tests/
git commit -m "feat: add password_reset email template and expiry note to org_welcome"
```

---

## Task 3: Backend — `POST /auth/forgot-password` Endpoint

**Files:**
- Modify: `app/schemas/auth.py`
- Modify: `app/routers/auth.py`

- [ ] **Step 1: Add schemas to `app/schemas/auth.py`**

Append to the end of `app/schemas/auth.py` (after the last class, around line 51):

```python
class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    status: str  # "sent" | "not_activated"
```

`EmailStr` and `BaseModel` are already imported at line 1 of `auth.py`.

- [ ] **Step 2: Write the failing test**

Create `tests/test_forgot_password.py`:

```python
"""Unit tests for forgot-password logic (schema validation only — endpoint integration
requires live Supabase, so we test the logic layer here)."""
import pytest
from app.schemas.auth import ForgotPasswordRequest, ForgotPasswordResponse
from pydantic import ValidationError


class TestForgotPasswordSchemas:
    def test_valid_request(self):
        req = ForgotPasswordRequest(email="user@example.com")
        assert req.email == "user@example.com"

    def test_invalid_email_raises(self):
        with pytest.raises(ValidationError):
            ForgotPasswordRequest(email="not-an-email")

    def test_response_sent(self):
        resp = ForgotPasswordResponse(status="sent")
        assert resp.status == "sent"

    def test_response_not_activated(self):
        resp = ForgotPasswordResponse(status="not_activated")
        assert resp.status == "not_activated"
```

- [ ] **Step 3: Run the failing test**

```bash
cd /Users/vrln/adizes-backend
docker exec adizes-backend python -m pytest tests/test_forgot_password.py -v 2>&1 | tail -15
```

Expected: FAIL (schemas not yet defined).

- [ ] **Step 4: Add imports and endpoint to `app/routers/auth.py`**

Add these imports at the top of `auth.py` (after the existing imports at lines 1–9):

```python
from app.config import settings
from app.services.email_service import smtp_configured, send_template_email
from app.schemas.auth import (
    LoginRequest, RegisterRequest, AuthResponse,
    ProfileResponse, UpdateProfileRequest, ChangePasswordRequest,
    CohortAssessmentHistory,
    ForgotPasswordRequest, ForgotPasswordResponse,
)
```

Note: replace the existing `from app.schemas.auth import (...)` block entirely with the one above (adds the two new schemas).

Then add this endpoint after `change_password` (after line ~153) and before the `# ─── My Assessments` section:

```python
# ─── Forgot Password ──────────────────────────────────────────────────────────

@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(body: ForgotPasswordRequest):
    """
    Request a password reset link.
    Always returns 200 to avoid email enumeration.
    Returns status="not_activated" if the user exists but hasn't activated their account.
    Returns status="sent" for all other cases (activated, unknown email).
    """
    if not smtp_configured():
        raise HTTPException(status_code=400, detail="SMTP is not configured")

    # Find user by email — supabase-py has no filter on list_users(), must iterate
    try:
        all_users = supabase_admin.auth.admin.list_users()
        target = next((u for u in all_users if u.email == body.email), None)
    except Exception:
        target = None

    # Unknown email — return "sent" to avoid revealing existence
    if target is None:
        return ForgotPasswordResponse(status="sent")

    # Not activated — tell them to use their activation link instead
    if getattr(target, "email_confirmed_at", None) is None:
        return ForgotPasswordResponse(status="not_activated")

    # Activated — generate recovery link and send email
    try:
        lr = supabase_admin.auth.admin.generate_link({
            "type": "recovery",
            "email": body.email,
            "options": {"redirect_to": f"{settings.frontend_url}/reset-password"},
        })
        user_name = (getattr(target, "user_metadata", None) or {}).get("name") or body.email
        send_template_email("password_reset", body.email, {
            "user_name": user_name,
            "reset_link": lr.properties.action_link,
            "platform_name": "Adizes India",
            "platform_url": settings.frontend_url,
        })
    except Exception:
        pass  # Log in production; return "sent" to avoid enumeration

    return ForgotPasswordResponse(status="sent")
```

- [ ] **Step 5: Run the schema tests**

```bash
cd /Users/vrln/adizes-backend
docker exec adizes-backend python -m pytest tests/test_forgot_password.py -v 2>&1 | tail -15
```

Expected: all 4 tests PASS.

- [ ] **Step 6: Run full test suite**

```bash
cd /Users/vrln/adizes-backend
docker exec adizes-backend python -m pytest tests/ -v 2>&1 | tail -20
```

Expected: all existing tests still pass.

- [ ] **Step 7: Commit**

```bash
cd /Users/vrln/adizes-backend
git add app/schemas/auth.py app/routers/auth.py tests/test_forgot_password.py
git commit -m "feat: add POST /auth/forgot-password endpoint with activation status check"
```

---

## Task 4: Frontend — `forgotPassword` API + ForgotPassword Page

**Files:**
- Modify: `src/api/auth.ts`
- Create: `src/pages/ForgotPassword.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add `forgotPassword` to `src/api/auth.ts`**

Append to the end of `src/api/auth.ts` (after the `saveInviteProfile` function, after line 44):

```typescript
/**
 * Request a password reset link. Always resolves (never throws on 200).
 * Returns status="sent" (link sent or unknown email) or status="not_activated".
 */
export async function forgotPassword(email: string): Promise<{ status: 'sent' | 'not_activated' }> {
  const { data } = await apiClient.post<{ status: 'sent' | 'not_activated' }>(
    '/auth/forgot-password',
    { email }
  );
  return data;
}
```

- [ ] **Step 2: Create `src/pages/ForgotPassword.tsx`**

```typescript
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '@/api/auth';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<'idle' | 'sent' | 'not_activated' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await forgotPassword(email);
      setResult(res.status);
    } catch {
      setResult('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-10">
          <img src="/logo.png" alt="Adizes Institute" className="h-12 w-auto" referrerPolicy="no-referrer" />
        </div>

        <h1 className="text-3xl font-display mb-2 text-gray-900">Forgot password?</h1>
        <p className="text-base text-gray-500 mb-8">
          Enter your email address and we'll check your account status.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-900" htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#C8102E] focus:border-transparent transition-all"
              placeholder="name@company.com"
            />
          </div>

          {result === 'sent' && (
            <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
              Reset link sent. Check your inbox — the link expires in 1 hour.
            </div>
          )}
          {result === 'not_activated' && (
            <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
              Your account isn't activated yet. Please click the activation link in your
              welcome email first. Contact your administrator if you need it resent.
            </div>
          )}
          {result === 'error' && (
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
              Something went wrong. Please try again.
            </div>
          )}

          <button
            type="submit"
            disabled={loading || result === 'sent'}
            className="w-full h-11 bg-[#C8102E] text-white rounded-md text-base font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Sending…' : 'Send Reset Link'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/" className="text-sm font-medium text-[#C8102E] hover:text-red-700 transition-colors">
            ← Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add `/forgot-password` route to `src/App.tsx`**

Add this import near the other page imports (around line 8–24):

```typescript
import { ForgotPassword } from './pages/ForgotPassword';
```

Add the route inside the public routes block (after the `/set-password` route, around line 75):

```tsx
<Route path="/forgot-password" element={<ForgotPassword />} />
```

The public routes block should now look like:
```tsx
<Route path="/" element={<Landing />} />
<Route path="/register" element={<Register />} />
<Route path="/set-password" element={<SetPassword />} />
<Route path="/forgot-password" element={<ForgotPassword />} />
<Route path="/terms" element={<PolicyPage slug="terms" />} />
<Route path="/privacy" element={<PolicyPage slug="privacy" />} />
<Route path="/refund" element={<PolicyPage slug="refund" />} />
<Route path="/admin" element={<Landing />} />
```

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/vrln/adizes-frontend
npx tsc --noEmit 2>&1 | grep -v "auth.ts\|client.ts" | head -20
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/vrln/adizes-frontend
git add src/api/auth.ts src/pages/ForgotPassword.tsx src/App.tsx
git commit -m "feat: add ForgotPassword page and forgotPassword API function"
```

---

## Task 5: Frontend — ResetPassword Page + Landing Banner

**Files:**
- Create: `src/pages/ResetPassword.tsx`
- Modify: `src/App.tsx` (add `/reset-password` route)
- Modify: `src/pages/Landing.tsx` (wire "Forgot password?" link + success banner)

- [ ] **Step 1: Create `src/pages/ResetPassword.tsx`**

The token is parsed from `window.location.hash` exactly like `Register.tsx` does for invite tokens. The existing `setPassword(token, password)` function in `src/api/auth.ts` already handles the Bearer header correctly (raw axios, Authorization header).

```typescript
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { setPassword } from '@/api/auth';

function parseResetToken(): string | null {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const token = params.get('access_token');
  const type = params.get('type');
  if (token && type === 'recovery') return token;
  return null;
}

export function ResetPassword() {
  const [token] = useState<string | null>(() => parseResetToken());
  const [password, setPasswordValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Expired / invalid token — show error state immediately
  if (!token) {
    return (
      <div className="flex min-h-screen bg-white items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-10">
            <img src="/logo.png" alt="Adizes Institute" className="h-12 w-auto" referrerPolicy="no-referrer" />
          </div>
          <h1 className="text-3xl font-display mb-4 text-gray-900">Link expired</h1>
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-4 text-sm text-red-600 mb-6">
            This password reset link has expired or is invalid.
          </div>
          <Link
            to="/forgot-password"
            className="text-sm font-medium text-[#C8102E] hover:text-red-700 transition-colors"
          >
            Request a new reset link →
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await setPassword(token, password);
      navigate('/?message=password-updated', { replace: true });
    } catch (err: any) {
      const detail = err?.response?.data?.detail ?? '';
      setError(
        detail || 'Failed to set password. The link may have expired.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-10">
          <img src="/logo.png" alt="Adizes Institute" className="h-12 w-auto" referrerPolicy="no-referrer" />
        </div>

        <h1 className="text-3xl font-display mb-2 text-gray-900">Set new password</h1>
        <p className="text-base text-gray-500 mb-8">Choose a strong password for your account.</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-900" htmlFor="password">
              New password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPasswordValue(e.target.value)}
              className="flex h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#C8102E] focus:border-transparent transition-all"
              placeholder="••••••••"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-900" htmlFor="confirm">
              Confirm password
            </label>
            <input
              id="confirm"
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="flex h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#C8102E] focus:border-transparent transition-all"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
              {error}{' '}
              {error.toLowerCase().includes('expired') && (
                <Link to="/forgot-password" className="underline font-medium">
                  Request a new link →
                </Link>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-[#C8102E] text-white rounded-md text-base font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Setting password…' : 'Set Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add `/reset-password` route to `src/App.tsx`**

Add this import (after the `ForgotPassword` import added in Task 4):

```typescript
import { ResetPassword } from './pages/ResetPassword';
```

Add the route after `/forgot-password`:

```tsx
<Route path="/reset-password" element={<ResetPassword />} />
```

- [ ] **Step 3: Update `src/pages/Landing.tsx`**

Three changes to `Landing.tsx`:

**Change 1 — Add `useSearchParams` to the imports** (line 2, currently `useNavigate, Link, useLocation`):

```tsx
import { useNavigate, Link, useLocation, useSearchParams } from "react-router-dom";
```

**Change 2 — Add state for success message** (after the existing `useState` calls, around line 18):

```tsx
const [searchParams] = useSearchParams();
// Read once into state so we can clear the URL without losing the message
const [showPasswordUpdated] = useState(
  () => searchParams.get('message') === 'password-updated'
);

// Clear the ?message query param from the URL after reading it
useEffect(() => {
  if (showPasswordUpdated) {
    navigate('/', { replace: true });
  }
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

Note: `useEffect` is not yet imported in Landing.tsx — add it to the React import at line 1:
```tsx
import React, { useState, useEffect } from "react";
```

**Change 3 — Add success banner above the login form** (in the JSX, inside `<CardContent className="px-0">`, before the `<form>` tag around line 139):

```tsx
<CardContent className="px-0">
  {showPasswordUpdated && (
    <div className="mb-5 rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
      Your password has been updated. Please log in.
    </div>
  )}
  <form onSubmit={handleLogin} className="space-y-5">
```

**Change 4 — Wire the "Forgot password?" link** (line 160, currently `<a href="#">`):

```tsx
// BEFORE:
<a href="#" className="text-sm font-medium text-primary hover:text-primary-dark">
  Forgot password?
</a>

// AFTER:
<Link to="/forgot-password" className="text-sm font-medium text-primary hover:text-primary-dark">
  Forgot password?
</Link>
```

`Link` is already imported at line 2 of `Landing.tsx`.

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/vrln/adizes-frontend
npx tsc --noEmit 2>&1 | grep -v "auth.ts\|client.ts" | head -20
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/vrln/adizes-frontend
git add src/pages/ResetPassword.tsx src/App.tsx src/pages/Landing.tsx
git commit -m "feat: add ResetPassword page, wire forgot-password link, add password-updated banner"
```

---

## Task 6: Frontend — AdminHelp FAQ

**Files:**
- Modify: `src/pages/AdminHelp.tsx`

- [ ] **Step 1: Add `KeyRound` to the lucide-react import**

In `AdminHelp.tsx` line 2, the current import is:
```tsx
import { ChevronDown, ChevronUp, HelpCircle, Users, ShieldCheck, BookOpen, FileText, Mail } from "lucide-react";
```

Add `KeyRound`:
```tsx
import { ChevronDown, ChevronUp, HelpCircle, Users, ShieldCheck, BookOpen, FileText, Mail, KeyRound } from "lucide-react";
```

- [ ] **Step 2: Add the new FAQ items array**

Add this new array after the `userFAQs` array (after line 210, before `const contactInfo`):

```typescript
const employeeActivationFAQs: FAQItem[] = [
  {
    q: "How does employee account activation work?",
    a: [
      "When you add an employee to an organisation, they receive a welcome email with an activation link valid for 24 hours.",
      "They click the link, set their name and password, and their account becomes active.",
      "If they miss the 24-hour window, go to the employee's node in the Organisations page and click 'Resend Welcome Email' to generate a fresh link.",
    ],
  },
  {
    q: "What if an employee never activated their account?",
    a: "Their status shows as 'Pending' in the employee list. They cannot use self-service password reset until they have activated. Ask them to check their original welcome email, or resend it from the admin panel. Once activated, they can reset their password independently at any time.",
  },
  {
    q: "How does self-service password reset work for employees?",
    a: [
      "Activated employees can reset their own password by clicking 'Forgot password?' on the login page.",
      "They enter their email address. If their account is activated, a reset link is sent to their inbox (valid for 1 hour).",
      "If their account is still in 'Pending' status, the page will tell them to activate their account first using their welcome email.",
      "Admins do not need to be involved in this process.",
    ],
  },
];
```

- [ ] **Step 3: Add the new `FAQSection` to the JSX**

In the `AdminHelp` component return (around line 240–258), add the new section after the existing "Administrator Guide" section and before "Do's and Don'ts":

```tsx
<FAQSection
  title="Administrator Guide — Managing Cohorts & Users"
  icon={ShieldCheck}
  color="border-primary"
  items={adminFAQs}
/>

<FAQSection
  title="Employee Activation & Password Reset"
  icon={KeyRound}
  color="border-[#1D3557]"
  items={employeeActivationFAQs}
/>

<FAQSection
  title="Do's and Don'ts for Administrators"
  icon={BookOpen}
  color="border-amber-500"
  items={dosDonts}
/>
```

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/vrln/adizes-frontend
npx tsc --noEmit 2>&1 | grep -v "auth.ts\|client.ts" | head -20
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/vrln/adizes-frontend
git add src/pages/AdminHelp.tsx
git commit -m "feat: add Employee Activation & Password Reset FAQ to AdminHelp"
```

---

## Deploy

After all tasks pass, deploy:

```bash
# Backend: push branch, rebuild Docker, push to ECR
cd /Users/vrln/adizes-backend
git push origin adizes-backend
AWS_ACCOUNT_ID=094492115510
AWS_REGION=ap-south-1
ECR_REPO=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/adizes-backend
aws ecr get-login-password --region $AWS_REGION --profile lax-t3-assumed | \
  docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
docker buildx build --platform linux/amd64 --provenance=false -t $ECR_REPO:latest .
docker push $ECR_REPO:latest

# Frontend: push branch (Netlify auto-deploys)
cd /Users/vrln/adizes-frontend
git push origin adizes-frontend
```

## Smoke Test Checklist

- [ ] Add an employee to an org node — click the activation link in email — should land on `/register` with email pre-filled
- [ ] Log in as admin, go to `/admin/help` — verify "Employee Activation & Password Reset" section is present
- [ ] On login page, click "Forgot password?" — verify it navigates to `/forgot-password`
- [ ] On `/forgot-password`, enter an unactivated user's email — verify amber "not activated" message
- [ ] On `/forgot-password`, enter an activated user's email — verify green "Reset link sent" message
- [ ] Click the reset link in the email — verify it lands on `/reset-password` with password fields
- [ ] Set a new password — verify redirect to login with green "Your password has been updated" banner
- [ ] Navigate to `/reset-password` with no hash — verify the "link expired" error and link to `/forgot-password`
