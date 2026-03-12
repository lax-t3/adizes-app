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

On mount, `Register` reads `window.location.hash` and parses it as `URLSearchParams`. If `access_token` is present and `type` is `invite` or `recovery`, the page enters **Activate mode**. Otherwise it behaves exactly as today (Normal mode).

### JWT Decode Helper — `src/lib/jwt.ts`

```ts
export function decodeJwt(token: string): Record<string, any>
```

Decodes the base64url payload of a JWT without signature verification. Used to extract `email` and `user_metadata.name` from the invite token. Extracted from `SetPassword.tsx` into a shared utility.

---

### Normal Mode (unchanged)

| Field | Behaviour |
|-------|-----------|
| Full Name | Editable, required |
| Email | Editable, required |
| Password | Editable, min 8 chars |
| Confirm Password | Must match |
| Terms checkbox | Required to submit |

- Submit calls `POST /auth/register`
- On success: store JWT in Zustand auth store, redirect to `/dashboard`

---

### Activate Mode

| Field | Behaviour |
|-------|-----------|
| Full Name | Pre-filled from `user_metadata.name` in JWT, **editable** |
| Email | Pre-filled from JWT `email` claim, **read-only** |
| Password | Editable, min 8 chars |
| Confirm Password | Must match |
| Terms checkbox | Required to submit |

**UI differences from Normal mode:**
- Page heading: "Activate Your Account" (instead of "Create Account")
- Subheading: "Set your name and password to get started."
- "Already have an account? Log in" link: **hidden**
- Submit button label: "Activate Account"

**Submit flow:**
1. `POST /auth/set-password` with `{ password }`, `Authorization: Bearer <access_token>`
2. `PUT /auth/profile` with `{ name, email }`, `Authorization: Bearer <access_token>` (non-fatal if fails)
3. Show brief success state: "Your account is ready. Please log in."
4. After 2 seconds, redirect to `/` (login page)

**Error handling:** Display error inline (same red box as Normal mode). Common errors: expired token, password too short.

---

### SetPassword.tsx — Redirect Shim

`SetPassword.tsx` is replaced with a minimal redirect that preserves the URL hash so existing email links continue to work:

```tsx
export function SetPassword() {
  useEffect(() => {
    window.location.replace(`/register${window.location.hash}`);
  }, []);
  return null;
}
```

This can be deleted entirely once all outstanding invite emails have been acted on.

---

## File Changes

| File | Change |
|------|--------|
| `src/lib/jwt.ts` | New — `decodeJwt()` helper |
| `src/pages/Register.tsx` | Add mode detection, Activate mode UI and submit logic |
| `src/pages/SetPassword.tsx` | Replace with redirect shim → `/register` + hash |

No backend changes required. No new routes required.

---

## Out of Scope

- Email verification for self-registered users (existing behaviour unchanged)
- Password strength meter changes
- Any changes to admin or cohort invite endpoints
