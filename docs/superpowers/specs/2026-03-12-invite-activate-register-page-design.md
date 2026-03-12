# Design: Unified Register / Activate Account Page

**Date:** 2026-03-12
**Status:** Approved
**Scope:** `adizes-frontend` — `src/pages/Register.tsx`, `src/pages/SetPassword.tsx`, new `src/lib/jwt.ts`

---

## Problem

Invited users (admins and cohort members) land on `/set-password` after clicking their email link. This is a separate page from `/register`, duplicating the name/email/password form and creating an inconsistent UX. The current `/set-password` also required a separate page with its own layout, logo, and styling.

## Goal

Consolidate the invite acceptance flow into the existing `/register` page. The page detects an invite token in the URL hash and switches to "Activate Account" mode — same layout, zero duplication.

---

## Design

### Mode Detection

On mount, `Register` reads `window.location.hash` and parses it as `URLSearchParams`. If `access_token` is present AND `type` is `invite` or `recovery`, the page enters **Activate mode**. Otherwise it behaves exactly as today (Normal mode).

The invalid-token card (see below) is shown when `access_token` is absent from the hash OR `type` is neither `"invite"` nor `"recovery"`. This is purely a hash-parameter check — no JWT validation. If the token string is present but malformed, Activate mode still renders (with empty name/email fields); the user will receive an API error on submit.

### JWT Decode Helper — `src/lib/jwt.ts`

```ts
export function decodeJwt(token: string): Record<string, any>
```

Decodes the base64url payload of a JWT without signature verification. Used to extract `email` and `user_metadata.name` from the invite token. Returns `{}` on any parse error (never throws). Extracted from `SetPassword.tsx` into a shared utility.

`src/lib/` already exists (contains `utils.ts`); add `jwt.ts` as a new file within it.

---

### Normal Mode (unchanged)

| Field | Behaviour |
|-------|-----------|
| Full Name | Editable, required |
| Email | Editable, required |
| Password | Editable, min 8 chars |
| Terms checkbox | Required to submit |

The existing Register form has no confirm-password field; this is intentional and unchanged.

- Submit calls `POST /auth/register` via existing `register()` in `src/api/auth.ts`
- On success: store JWT in Zustand auth store, redirect to `/dashboard`

---

### Activate Mode

**Field order and behaviour:**

| # | Field | Behaviour |
|---|-------|-----------|
| 1 | Email | Pre-filled from JWT `email` claim, **read-only**; shown only if a value was decoded (conditional render) |
| 2 | Full Name | Pre-filled from `user_metadata.name` in JWT, **editable**, required |
| 3 | Password | Editable, min 8 chars |
| 4 | Confirm Password | Must match Password; state variable: `confirmPassword` (not `confirm`, which shadows `window.confirm`) |
| 5 | Terms checkbox | Required to submit |

**UI differences from Normal mode:**
- Page heading: "Activate Your Account" (instead of "Create an account")
- Subheading: "Set your name and password to get started."
- "Already have an account? Sign in" link: **hidden**
- Submit button idle label: `"Activate Account"`
- Submit button loading label: `"Activating…"` (plain text, matching Normal mode pattern; no spinner SVG needed)

**API calls:**

The Activate mode submit must NOT use `apiClient` — it auto-attaches the Zustand stored token and its 401 interceptor redirects to login. Instead, add two new helpers to `src/api/auth.ts` using raw `axios`. Add `import axios from "axios"` at the top of `src/api/auth.ts` (not currently present):

```ts
import axios from "axios";  // add this import

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

// Called after invite/recovery token activation
export async function setPassword(inviteToken: string, password: string): Promise<void> {
  await axios.post(
    `${API_URL}/auth/set-password`,
    { password },
    { headers: { Authorization: `Bearer ${inviteToken}` } }
  );
}

// Save name + email from invite flow. Non-fatal — callers catch and ignore.
// Named saveInviteProfile (not updateProfile) to avoid collision with the
// identically-named export in src/api/profile.ts which uses apiClient.
export async function saveInviteProfile(inviteToken: string, name: string, email: string): Promise<void> {
  await axios.put(
    `${API_URL}/auth/profile`,
    { name, email },
    { headers: { Authorization: `Bearer ${inviteToken}` } }
  );
}
```

**Submit flow:**
1. Validate: passwords match and length ≥ 8 — show inline error if not
2. Call `setPassword(accessToken!, password)` — use the non-null assertion (`!`) because `accessToken` is typed `string | null` but Activate mode only renders when it is non-null (guarded by mode detection on mount)
3. If `name.trim()` is non-empty and `email` is non-empty, call `saveInviteProfile(accessToken!, name.trim(), email)` — non-fatal (catch and ignore error)
4. Replace form content inside `CardContent` with success panel (see below)
5. After **2 seconds**, call `window.location.replace("/")` (not React Router `navigate`) to redirect to the login page. Using `replace` removes the `#access_token=…` hash from the browser history stack. This is intentionally shorter than the 3-second delay in the legacy `SetPassword.tsx`

**Success state:** Inside the existing `Card`/`CardContent` shell, the form is replaced by a centered success panel:

```tsx
<div className="text-center py-4">
  <div className="text-5xl mb-4">✅</div>
  <h2 className="text-lg font-semibold text-gray-900 mb-2">Account Activated!</h2>
  <p className="text-sm text-gray-500">Your account is ready. Redirecting to login…</p>
</div>
```

The card's logo, heading ("Activate Your Account"), and outer layout remain visible. Only the `CardContent` form area changes.

**Error handling:** Display error inline using the same red box pattern as Normal mode:

```tsx
<p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>
```

Common errors: expired token, password too short, passwords do not match.

**Invalid / malformed token state:** Shown when `accessToken` is null OR `tokenType` is not `"invite"` or `"recovery"`. This replaces the entire page (no Card, no Footer):

```tsx
<div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
  <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
    <div className="text-5xl mb-4">🔗</div>
    <h1 className="text-xl font-semibold text-gray-900 mb-2">Invalid Invite Link</h1>
    <p className="text-sm text-gray-500">
      This invite link is invalid or has expired. Please ask your administrator to resend the invite.
    </p>
  </div>
</div>
```

---

### SetPassword.tsx — Redirect Shim

`SetPassword.tsx` is replaced wholesale with a minimal redirect that preserves the URL hash so existing email links continue to work. All existing imports (axios, useNavigate, useState, etc.) are removed; only `useEffect` is needed:

```tsx
import { useEffect } from "react";

export function SetPassword() {
  useEffect(() => {
    window.location.replace(`/register${window.location.hash}`);
  }, []);
  return null;
}
```

This can be deleted entirely once all outstanding invite emails have been acted on. When deleted, the `/set-password` route entry in `App.tsx` must also be removed.

---

## File Changes

| File | Change |
|------|--------|
| `src/lib/jwt.ts` | New — `decodeJwt()` helper (add to existing `src/lib/` directory) |
| `src/pages/Register.tsx` | Add mode detection, Activate mode UI and submit logic |
| `src/pages/SetPassword.tsx` | Replace with redirect shim → `/register` + hash |
| `src/api/auth.ts` | Add `setPassword(inviteToken, password)` and `saveInviteProfile(inviteToken, name, email)` helpers |
| `src/App.tsx` | Future (when shim is retired): remove `/set-password` route and `SetPassword` import |

No backend changes required. No new routes required in this phase.

---

## Out of Scope

- Email verification for self-registered users (existing behaviour unchanged)
- Password strength meter changes
- Any changes to admin or cohort invite endpoints
