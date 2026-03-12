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

### New `handleActivate` Submit Flow

1. Validate: password length ≥ 8, then passwords match — show inline error if not (unchanged)
2. Call `setPassword(accessToken!, activatePassword)` — sets the password via invite/recovery token
3. If `activateName.trim()` is non-empty and `activateEmail` is non-empty, call `saveInviteProfile(accessToken!, activateName.trim(), activateEmail)` — non-fatal (catch and ignore)
4. Call `login(activateEmail, activatePassword)` from `src/api/auth.ts` — logs in with the newly-set credentials
5. Call `loginStore(user, role, token)` — stores JWT in Zustand auth store (same pattern as `handleRegister`)
6. Call `navigate("/dashboard")` via React Router — lands on Dashboard

**Fallback on auto-login failure:** If step 4 throws, do not surface a confusing error. The password was already set successfully. Show the existing success panel (`setActivateSuccess(true)`) and redirect to `/` after 2 seconds so the user can log in manually. The success message in this case should read: "Account activated! Redirecting to login…" (unchanged from current text).

### State Removed

- `activateSuccess` — no longer needed in the happy path (navigation happens immediately)
- The `setTimeout(() => window.location.replace("/"), 2000)` call — replaced by `navigate("/dashboard")` in the happy path; the 2-second fallback redirect remains only in the catch block for auto-login failure

### Imports Added

- `login` from `src/api/auth.ts` — already exported, just not imported in Register.tsx yet

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
