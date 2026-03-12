# Invite / Activate Account — Unified Register Page Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the invite acceptance flow into `/register`, replacing the separate `/set-password` page with a mode-switching "Activate Account" UI detected from the URL hash token.

**Architecture:** `Register.tsx` reads `window.location.hash` on mount; if `access_token` + valid `type` are present it enters Activate mode (pre-filled email/name, `POST /auth/set-password`), otherwise it stays in Normal mode (unchanged). `SetPassword.tsx` becomes a one-liner redirect shim so old email links still work. A shared `decodeJwt` helper and two new API helpers complete the change.

**Tech Stack:** React 19 + TypeScript, Vite, Tailwind CSS v4, Axios, Zustand, `framer-motion` (already in project as `motion/react`)

---

## Chunk 1: Foundation — jwt helper + API helpers

### Task 1: `src/lib/jwt.ts` — `decodeJwt` helper

**Files:**
- Create: `src/lib/jwt.ts`

- [ ] **Step 1: Create the file**

```ts
// src/lib/jwt.ts

/**
 * Decode the payload of a JWT without signature verification.
 * Returns {} on any parse error — never throws.
 */
export function decodeJwt(token: string): Record<string, any> {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return {};
  }
}
```

- [ ] **Step 2: Manual smoke test in browser console**

With the dev server running (`npm run dev`), open DevTools console and run:

```js
// Paste and run — should decode a real JWT from a Supabase invite email
// Or use this static test:
const tok = "eyJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJ1c2VyX21ldGFkYXRhIjp7Im5hbWUiOiJKb2huIn19.sig";
// Import via module is not practical in console; just verify the decode logic:
const payload = tok.split(".")[1];
JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
// Expected: { email: "test@example.com", user_metadata: { name: "John" } }
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/vrln/adizes-frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/vrln/adizes-frontend
git add src/lib/jwt.ts
git commit -m "feat: add decodeJwt helper to src/lib/jwt.ts"
```

---

### Task 2: `src/api/auth.ts` — `setPassword` + `saveInviteProfile` helpers

**Files:**
- Modify: `src/api/auth.ts`

The existing file (`login`, `register`) uses `apiClient` from `./client`. These new helpers must use raw `axios` directly — `apiClient`'s interceptor auto-attaches the stored Zustand JWT and its 401 handler redirects to login, both wrong for an unauthenticated invite token.

- [ ] **Step 1: Add `axios` import and the two helpers**

Open `src/api/auth.ts`. The full file after edits:

```ts
import axios from "axios";
import { apiClient } from "./client";
import type { AuthResponse } from "@/types/api";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>("/auth/login", { email, password });
  return data;
}

export async function register(name: string, email: string, password: string): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>("/auth/register", { name, email, password });
  return data;
}

/**
 * Set password using the raw invite/recovery token from the URL hash.
 * Uses raw axios (not apiClient) because the invite token is not stored
 * in Zustand and apiClient's 401 interceptor would redirect to login.
 */
export async function setPassword(inviteToken: string, password: string): Promise<void> {
  await axios.post(
    `${API_URL}/auth/set-password`,
    { password },
    { headers: { Authorization: `Bearer ${inviteToken}` } }
  );
}

/**
 * Save name + email after invite acceptance.
 * Named saveInviteProfile (not updateProfile) to avoid collision with
 * the identically-named export in src/api/profile.ts which uses apiClient.
 * Non-fatal — callers catch and ignore errors from this call.
 */
export async function saveInviteProfile(
  inviteToken: string,
  name: string,
  email: string
): Promise<void> {
  await axios.put(
    `${API_URL}/auth/profile`,
    { name, email },
    { headers: { Authorization: `Bearer ${inviteToken}` } }
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/vrln/adizes-frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/vrln/adizes-frontend
git add src/api/auth.ts
git commit -m "feat: add setPassword and saveInviteProfile helpers to auth.ts"
```

---

## Chunk 2: SetPassword shim + Register Activate mode

### Task 3: `src/pages/SetPassword.tsx` — redirect shim

**Files:**
- Modify: `src/pages/SetPassword.tsx` (full replacement)

Replace the entire file. The shim preserves the URL hash so old invite emails (`/set-password#access_token=...`) redirect to `/register#access_token=...` intact.

- [ ] **Step 1: Replace SetPassword.tsx**

```tsx
// src/pages/SetPassword.tsx
import { useEffect } from "react";

/**
 * Redirect shim — forwards old /set-password invite links to /register,
 * preserving the URL hash so the invite token reaches the Register page.
 * Can be deleted once all outstanding invite emails have been acted on.
 * When deleted, also remove the /set-password route from App.tsx.
 */
export function SetPassword() {
  useEffect(() => {
    window.location.replace(`/register${window.location.hash}`);
  }, []);
  return null;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/vrln/adizes-frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Manual browser verification**

Navigate to: `http://localhost:3000/set-password#access_token=abc&type=invite`

Expected: browser immediately redirects to `http://localhost:3000/register#access_token=abc&type=invite`
(Register page will show the Invalid Invite Link card since `abc` is not a real token — that's correct.)

- [ ] **Step 4: Commit**

```bash
cd /Users/vrln/adizes-frontend
git add src/pages/SetPassword.tsx
git commit -m "feat: replace SetPassword with redirect shim to /register"
```

---

### Task 4: `src/pages/Register.tsx` — Activate mode

**Files:**
- Modify: `src/pages/Register.tsx`

This is the main task. Add Activate mode detection on mount, conditional UI, and the Activate submit flow. Normal mode is **entirely unchanged** — the existing form, submit handler, and state are left as-is.

#### 4a — Add state + mode detection

- [ ] **Step 1: Add imports and Activate-mode state variables**

At the top of `Register.tsx`, add to the existing imports:

```tsx
import { useEffect } from "react";  // add useEffect (useState is already imported)
import { decodeJwt } from "@/lib/jwt";
import { setPassword, saveInviteProfile } from "@/api/auth";
// keep existing imports: register as apiRegister, useAuthStore, Button, Card*, motion, Link, Footer
```

Add new state variables inside the `Register` function, after the existing `loading` state:

```tsx
// ── Activate mode state ──────────────────────────────────────────────
const [activateMode, setActivateMode] = useState(false);
const [accessToken, setAccessToken] = useState<string | null>(null);
const [activateName, setActivateName] = useState("");
const [activateEmail, setActivateEmail] = useState("");
const [activatePassword, setActivatePassword] = useState("");
const [confirmPassword, setConfirmPassword] = useState("");  // not `confirm` — shadows window.confirm
const [termsActivate, setTermsActivate] = useState(false);
const [activateError, setActivateError] = useState("");
const [activateLoading, setActivateLoading] = useState(false);
const [activateSuccess, setActivateSuccess] = useState(false);
```

- [ ] **Step 2: Add the mount effect for mode detection**

After the state declarations, add:

```tsx
useEffect(() => {
  const hash = window.location.hash.slice(1);
  const params = new URLSearchParams(hash);
  const token = params.get("access_token");
  const type = params.get("type");

  if (token && (type === "invite" || type === "recovery")) {
    setActivateMode(true);
    setAccessToken(token);
    const decoded = decodeJwt(token);
    const meta = decoded.user_metadata ?? {};
    if (meta.name) setActivateName(meta.name);
    if (decoded.email) setActivateEmail(decoded.email);
  }
}, []);
```

- [ ] **Step 3: Add the Activate submit handler**

After the existing `handleRegister` function, add:

```tsx
const handleActivate = async (e: React.FormEvent) => {
  e.preventDefault();
  if (activatePassword !== confirmPassword) {
    setActivateError("Passwords do not match.");
    return;
  }
  if (activatePassword.length < 8) {
    setActivateError("Password must be at least 8 characters.");
    return;
  }

  setActivateError("");
  setActivateLoading(true);
  try {
    await setPassword(accessToken!, activatePassword);

    if (activateName.trim() && activateEmail) {
      try {
        await saveInviteProfile(accessToken!, activateName.trim(), activateEmail);
      } catch {
        // non-fatal — password already set
      }
    }

    setActivateSuccess(true);
    setTimeout(() => window.location.replace("/"), 2000);
  } catch (err: any) {
    setActivateError(
      err?.response?.data?.detail ?? "Failed to activate account. The link may have expired."
    );
  } finally {
    setActivateLoading(false);
  }
};
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/vrln/adizes-frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

#### 4b — Render invalid-token state

- [ ] **Step 5: Add the invalid-token early return**

In the `Register` JSX return, before the existing `return (...)`, add this early return for the case where the hash has a token-like structure but wrong type. Place it **after** all hooks (React rules):

```tsx
// Invalid invite link — token present but wrong type
// (accessToken null + no activate mode = normal register, handled by activateMode flag)
if (window.location.hash.includes("access_token") && !activateMode) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <div className="text-5xl mb-4">🔗</div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Invalid Invite Link</h1>
        <p className="text-sm text-gray-500">
          This invite link is invalid or has expired. Please ask your administrator to resend the invite.
        </p>
      </div>
    </div>
  );
}
```

Note: This guard only fires when `access_token` IS in the hash but `type` was wrong/missing. When the hash is empty, `activateMode` stays false and the normal Register form renders — correct.

#### 4c — Render Activate mode UI

- [ ] **Step 6: Add Activate mode branch in the JSX return**

In the existing return statement, wrap the content so that when `activateMode` is true, Activate mode renders instead. The full updated return:

```tsx
return (
  <div className="flex min-h-screen flex-col bg-gray-50 items-center justify-center p-4">
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-md"
    >
      <div className="flex items-center gap-3 mb-8 justify-center">
        <img
          src="/logo.png"
          alt="Adizes Institute"
          className="h-10 w-auto"
          referrerPolicy="no-referrer"
        />
      </div>

      {activateMode ? (
        /* ── ACTIVATE MODE ─────────────────────────────────────── */
        <Card className="shadow-lg border-t-4 border-t-primary">
          <CardHeader>
            <CardTitle className="text-2xl font-display">Activate Your Account</CardTitle>
            <CardDescription>Set your name and password to get started.</CardDescription>
          </CardHeader>
          <CardContent>
            {activateSuccess ? (
              <div className="text-center py-4">
                <div className="text-5xl mb-4">✅</div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Account Activated!</h2>
                <p className="text-sm text-gray-500">Your account is ready. Redirecting to login…</p>
              </div>
            ) : (
              <form onSubmit={handleActivate} className="space-y-5">
                {/* Email — read-only, shown only if decoded from token */}
                {activateEmail && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-900" htmlFor="activate-email">
                      Email address
                    </label>
                    <input
                      id="activate-email"
                      type="email"
                      readOnly
                      value={activateEmail}
                      className="flex h-11 w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
                    />
                  </div>
                )}

                {/* Full Name — editable, pre-filled from JWT user_metadata */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-900" htmlFor="activate-name">
                    Full Name
                  </label>
                  <input
                    id="activate-name"
                    type="text"
                    required
                    value={activateName}
                    onChange={(e) => setActivateName(e.target.value)}
                    className="flex h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    placeholder="Your full name"
                    autoFocus={!activateName}
                  />
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-900" htmlFor="activate-password">
                    Password
                  </label>
                  <input
                    id="activate-password"
                    type="password"
                    required
                    minLength={8}
                    value={activatePassword}
                    onChange={(e) => setActivatePassword(e.target.value)}
                    className="flex h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    placeholder="Min. 8 characters"
                    autoFocus={!!activateName}
                  />
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-900" htmlFor="activate-confirm">
                    Confirm Password
                  </label>
                  <input
                    id="activate-confirm"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="flex h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    placeholder="Repeat password"
                  />
                </div>

                {/* Terms */}
                <div className="flex items-start gap-3 pt-1">
                  <input
                    id="activate-terms"
                    type="checkbox"
                    required
                    checked={termsActivate}
                    onChange={(e) => setTermsActivate(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary flex-shrink-0"
                  />
                  <label htmlFor="activate-terms" className="text-sm text-gray-500 leading-relaxed">
                    I agree to the{" "}
                    <Link to="/terms" target="_blank" className="text-primary hover:underline font-medium">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link to="/privacy" target="_blank" className="text-primary hover:underline font-medium">
                      Privacy Policy
                    </Link>
                  </label>
                </div>

                {activateError && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                    {activateError}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={activateLoading || !termsActivate}
                  className="w-full h-11 text-base mt-2"
                >
                  {activateLoading ? "Activating…" : "Activate Account"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      ) : (
        /* ── NORMAL MODE (unchanged) ───────────────────────────── */
        <Card className="shadow-lg border-t-4 border-t-primary">
          <CardHeader>
            <CardTitle className="text-2xl font-display">Create an account</CardTitle>
            <CardDescription>
              Enter your details to register for the assessment.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900" htmlFor="name">
                  Full Name
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="flex h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  placeholder="John Doe"
                />
              </div>
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
                  className="flex h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  placeholder="name@company.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="flex h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  placeholder="••••••••"
                />
              </div>
              <div className="flex items-start gap-3 pt-1">
                <input
                  id="terms"
                  type="checkbox"
                  required
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary flex-shrink-0"
                />
                <label htmlFor="terms" className="text-sm text-gray-500 leading-relaxed">
                  I agree to the{" "}
                  <Link to="/terms" target="_blank" className="text-primary hover:underline font-medium">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link to="/privacy" target="_blank" className="text-primary hover:underline font-medium">
                    Privacy Policy
                  </Link>
                </label>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {error}
                </p>
              )}
              <Button type="submit" disabled={loading || !termsAccepted} className="w-full h-11 text-base mt-2">
                {loading ? "Creating account…" : "Register"}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-gray-500">
              Already have an account?{" "}
              <Link to="/" className="font-medium text-primary hover:text-primary-dark">
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>

    {/* Footer — only shown in Normal mode (not Activate mode) */}
    {!activateMode && (
      <div className="w-full mt-8">
        <Footer />
      </div>
    )}
  </div>
);
```

- [ ] **Step 7: Verify TypeScript compiles clean**

```bash
cd /Users/vrln/adizes-frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 8: Verify dev server starts without errors**

```bash
cd /Users/vrln/adizes-frontend && npm run dev
```

Expected: `Local: http://localhost:3000/` — no red build errors in terminal.

#### 4d — Browser verification

- [ ] **Step 9: Test Normal mode is unchanged**

Navigate to `http://localhost:3000/register`

Expected:
- Heading: "Create an account"
- Fields: Full Name, Email address, Password, Terms checkbox
- "Already have an account? Sign in" link visible at bottom
- No confirm-password field

- [ ] **Step 10: Test Invalid Invite Link state**

Navigate to: `http://localhost:3000/register#access_token=abc&type=unknown`

Expected:
- 🔗 icon + "Invalid Invite Link" card
- No form, no Footer

- [ ] **Step 11: Test Activate mode renders correctly**

Construct a fake base64url token. In DevTools console:

```js
// Build a fake JWT payload for testing UI rendering only
const payload = btoa(JSON.stringify({
  email: "invited@example.com",
  user_metadata: { name: "Test User" }
})).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
const fakeToken = `header.${payload}.sig`;
console.log(`/register#access_token=${fakeToken}&type=invite`);
```

Navigate to the printed URL.

Expected:
- Heading: "Activate Your Account"
- Subheading: "Set your name and password to get started."
- Email field: read-only, shows "invited@example.com"
- Full Name field: pre-filled "Test User", editable
- Password + Confirm Password fields
- Terms checkbox
- Button: "Activate Account"
- No "Already have an account?" link
- No Footer

- [ ] **Step 12: Test Activate mode validation**

With the fake token URL open:
1. Enter mismatched passwords → expect inline error "Passwords do not match."
2. Enter password < 8 chars → expect "Password must be at least 8 characters."
3. Uncheck terms → submit button should be disabled

- [ ] **Step 13: Test SetPassword redirect still works**

Navigate to: `http://localhost:3000/set-password#access_token=xyz&type=invite`

Expected: immediate redirect to `http://localhost:3000/register#access_token=xyz&type=invite` (Activate mode card, Invalid Invite Link since `xyz` is not a real token)

- [ ] **Step 14: Commit**

```bash
cd /Users/vrln/adizes-frontend
git add src/pages/Register.tsx
git commit -m "feat: add Activate mode to Register page for invite acceptance flow"
```

---

## Chunk 3: End-to-end verification with real invite token

### Task 5: Full flow test with real Supabase invite

This task requires the full local dev stack running (Supabase + backend + frontend).

- [ ] **Step 1: Ensure local stack is running**

```bash
# Supabase
cd /Users/vrln/adizes-backend && supabase status

# Backend
docker ps | grep adizes-backend

# Frontend
# npm run dev should be running at localhost:3000
```

If Supabase was recently restarted, re-apply the setup from CLAUDE.md (re-apply migrations, recreate test users, update .env keys, rebuild Docker).

- [ ] **Step 2: Send a real cohort member invite**

Log in as admin at `http://localhost:3000`, navigate to a cohort, and enroll a new test email (e.g. `newuser@test.com`). The backend will send an invite email via the configured SMTP.

If SMTP is not configured locally, you can generate the invite link directly:

```bash
# Get the invite link from backend logs or DB
docker logs adizes-backend 2>&1 | tail -50 | grep "invite"
```

Or use the Supabase Studio to find the invite link for the user at `http://127.0.0.1:54323`.

- [ ] **Step 3: Follow the invite link**

Click the invite link from the email. It should redirect to `/register#access_token=...&type=invite`.

Expected:
- Activate mode renders
- Email pre-filled with the invited address
- Name pre-filled (if set during invite)

- [ ] **Step 4: Complete activation**

Enter name (edit if needed), set password, confirm password, accept terms, click "Activate Account".

Expected:
- "Account Activated!" success panel appears
- After 2 seconds, redirect to `http://localhost:3000/` (login page)
- Browser URL has no `#access_token=...` hash (cleared by `window.location.replace`)

- [ ] **Step 5: Log in with activated account**

At the login page, log in with the invited email and the password just set.

Expected: successful login, redirect to `/dashboard`.

- [ ] **Step 6: Final commit + push**

```bash
cd /Users/vrln/adizes-frontend
git push origin adizes-frontend
```

---

## Quick Reference — Files Changed

| File | Type | What changed |
|------|------|--------------|
| `src/lib/jwt.ts` | New | `decodeJwt()` helper |
| `src/api/auth.ts` | Modified | Added `setPassword`, `saveInviteProfile` (raw axios) |
| `src/pages/SetPassword.tsx` | Replaced | Redirect shim to `/register` + hash |
| `src/pages/Register.tsx` | Modified | Activate mode detection, UI, and submit |

`src/App.tsx` — no change in this phase. Remove `/set-password` route later when shim is retired.
