# Design: Auto-Login After Account Activation

**Date:** 2026-03-12
**Status:** Approved
**Scope:** `adizes-frontend` — `src/pages/Register.tsx` only

---

## Problem

After an invited user sets their password via the Activate Account flow, they are redirected to the login page (`window.location.replace("/")`). They must then log in manually before they can reach the Dashboard and start their assessment. This is unnecessary friction — the credentials are already known at the moment of activation.

## Goal

Make account activation a seamless single flow: the user sets their password and lands directly on the Dashboard, already logged in, where they see the "Ready to begin your assessment?" call-to-action for their cohort.

---

## Design

### What Changes

**`src/pages/Register.tsx` — `handleActivate` function only.**

Replace the current post-activation behaviour (success panel + 2-second redirect to `/`) with an auto-login step followed by immediate navigation to `/dashboard`.

No backend changes. No new files. No new routes.

### Token Lifecycle Note

The `accessToken` in `window.location.hash` is a **session JWT** — Supabase converted the OTP to a full session token when the user clicked the verify link. It is not a one-time OTP. `setPassword` calls `admin.update_user_by_id` on the backend and does NOT consume this JWT. `saveInviteProfile` can safely use the same `accessToken` after `setPassword` returns.

### New `handleActivate` Submit Flow

1. Validate: password length ≥ 8, then passwords match — show inline error if not (unchanged)
2. Call `setPassword(accessToken!, activatePassword)` — sets the password using the session JWT
3. If `activateName.trim()` is non-empty, call `saveInviteProfile(accessToken!, activateName.trim(), activateEmail)` — non-fatal (catch and ignore); the session JWT is still valid here
4. If `activateEmail` is empty at this point, treat as auto-login failure: the password was set in step 2, so show the success panel and redirect to `/` (same as the auto-login fallback below). Do not attempt `login()` with an empty email.
5. Call `login(activateEmail, activatePassword)` from `src/api/auth.ts` — logs in with the newly-set credentials; `data` is an `AuthResponse` with fields `user_id`, `email`, `name`, `role`, `access_token`
6. Call `loginStore({ id: data.user_id, email: data.email, name: data.name || activateName.trim() }, data.role, data.access_token)` — stores JWT in Zustand. `data.name` is typed `string` but the backend reads from `user_metadata.name` which returns `""` if not yet populated (e.g., if `saveInviteProfile` in step 3 failed). Fall back to `activateName.trim()` in that case.
7. Call `navigate("/dashboard", { replace: true })` — replaces the history entry so the `#access_token=…` hash is cleared from the address bar and browser history

**Fallback on auto-login failure:** If step 5 throws, the password was already set. Show the existing success panel (`setActivateSuccess(true)`) and `window.location.replace("/")` after 2 seconds — user logs in manually. The success message reads: "Account activated! Redirecting to login…" (unchanged from current text). The `window.location.replace` in this fallback also clears the hash.

The existing `finally { setActivateLoading(false) }` block wraps the entire flow and remains unchanged.

The button label "Activating…" covers the entire async sequence (setPassword → saveInviteProfile → login). No intermediate UI state change between steps.

### State Usage Changed

- `activateSuccess` — remains declared; it drives the JSX success-panel branch. In the happy path it is **not** set (navigation fires immediately). It is only set to `true` in the auto-login `catch` block to trigger the fallback success panel.
- The `setTimeout(() => window.location.replace("/"), 2000)` call — moves from the happy path into the auto-login `catch` block only.

### Imports Changed

- Modify the existing `@/api/auth` import in `Register.tsx` (line 7) to add `login`:
  ```ts
  import { login, register as apiRegister, setPassword, saveInviteProfile } from "@/api/auth";
  ```

### No Changes To

- `setPassword` API helper
- `saveInviteProfile` API helper
- Normal registration mode (`handleRegister`)
- Invalid token card
- Activate mode UI (fields, labels, terms checkbox, error display)
- `SetPassword.tsx` redirect shim
- Backend

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| `setPassword` fails (expired token, network) | Show inline error in activate form — user stays on page and can retry or request a new invite |
| `saveInviteProfile` fails | Ignored — password was set, continue to auto-login |
| `login` fails after password was set | Show success panel ("Account activated! Redirecting to login…"), redirect to `/` after 2 seconds — user logs in manually |

---

## Out of Scope

- Redirecting directly to `/assessment` (user lands on Dashboard instead, where they see the cohort CTA)
- Detecting pending enrollment on every login and auto-redirecting to `/assessment`
- Any changes to the admin invite or enroll flow
- Multi-cohort handling (Dashboard already shows all pending cohorts)
