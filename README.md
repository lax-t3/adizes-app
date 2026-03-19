# adizes-frontend

React frontend for the **Adizes PAEI Management Style Assessment** platform.

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | React 19 + Vite + TypeScript |
| Styling | Tailwind CSS v4 |
| State | Zustand v5 |
| HTTP | Axios (JWT Bearer auto-attach via interceptor) |
| Charts | Recharts v3 |
| Animation | Framer Motion (`motion/react`) |
| Routing | React Router v6 |

## Local Development

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:3000)
npm run dev
```

Requires the backend running at `http://localhost:8000` (see [adizes-backend](../adizes-backend)).

### Environment Variables

Create `.env.local`:

```bash
VITE_API_URL=http://localhost:8000
```

Defaults to `http://localhost:8000` if unset.

## Production Deployment (Netlify)

### Prerequisites
- Backend deployed to AWS App Runner (see [adizes-backend](../adizes-backend))
- App Runner service URL: `https://h9uxjpkp8h.ap-south-1.awsapprunner.com`

### Steps

1. Connect `lax-t3/adizes-app` repo to Netlify
2. Set **branch**: `adizes-frontend`
3. **Build command**: `npm run build`
4. **Publish directory**: `dist`
5. Add environment variable:

```
VITE_API_URL=https://h9uxjpkp8h.ap-south-1.awsapprunner.com
```

> **Important:** Use `VITE_API_URL` exactly — not `VITE_API_BASE_URL` or any other name.
> The variable must have no trailing slash.

6. Deploy. Once Netlify gives you a URL (e.g. `https://adizes-app.netlify.app`):
   - Go to **AWS App Runner → your service → Configuration → Environment variables**
   - Update `FRONTEND_URL` to your Netlify URL — this enables CORS on the backend

### SPA Routing

`public/_redirects` is already configured to serve `index.html` for all routes:
```
/*    /index.html    200
```
This ensures direct navigation to `/dashboard`, `/results/:id`, `/admin/*` etc. works
on Netlify instead of returning 404.

## Project Structure

```
adizes-frontend/
  src/
    api/
      auth.ts          # login, register, setPassword (invite token), saveInviteProfile, forgotPassword
      client.ts        # Axios instance with JWT interceptor + 401 redirect
      profile.ts       # getProfile, updateProfile, changePassword
      assessment.ts    # getQuestions; submitAssessment(cohort_id, answers) — cohort_id required
      results.ts       # getResult, getMyAssessments → CohortAssessmentHistory[] (downloadPdf removed — PDFs served from S3 via pdf_url)
      admin.ts         # cohort CRUD, member management, user management; getRespondent(userId, cohortId);
                       #   organisation CRUD, org node management, org employee management, cohort↔org linking
      settings.ts      # SMTP + email template CRUD
    components/
      layout/          # AdminSidebar (includes Organizations link), Header, Footer
      ui/              # Button, Card, Badge, Spinner, Modal
    lib/
      jwt.ts           # decodeJwt() — base64url JWT payload decoder (no signature verify)
      utils.ts         # cn() Tailwind class merge helper
    pages/
      Landing.tsx             # Login page; "Forgot password?" links to /forgot-password;
                              #   shows green banner on ?message=password-updated redirect
      Register.tsx            # Self-registration (Normal mode) + invite acceptance (Activate mode)
      SetPassword.tsx         # Redirect shim → /register (for old invite email links)
      ForgotPassword.tsx      # Forgot-password flow: email input → sent/not_activated/error states
      ResetPassword.tsx       # Reset-password flow: reads recovery token from URL hash → set new password
      Dashboard.tsx           # PAEI results tabs + My Assessments list; all "Begin Assessment" CTAs pass ?cohort_id=
      Assessment.tsx          # 36-question flow; reads cohort_id from query param; redirects to /dashboard if missing
      Results.tsx             # Full PAEI results + PDF download (S3 url state machine: null→"Generating…"+check-again, set→window.open)
      AdminDashboard.tsx
      AdminCohortList.tsx
      AdminCohortDetail.tsx   # Cohort members + resend invite; linked organisations panel; enrol from org modal
      AdminOrganizations.tsx  # Organisation list + create org
      AdminOrgDetail.tsx      # Org tree (nodes), employee management per node, link to cohorts
      AdminRespondent.tsx     # Respondent detail; reads cohort_id from ?cohort_id= query param; shows pending state if no result
      AdminSettings.tsx       # SMTP config + email template editor
      AdminHelp.tsx           # Admin FAQ including Employee Activation & Password Reset section
      PolicyPage.tsx
    store/
      authStore.ts       # Zustand auth state (JWT, user, role)
      assessmentStore.ts # Assessment session state including cohortId (set from ?cohort_id= query param)
    types/
      api.ts             # Shared API types (AuthResponse, CohortAssessmentHistory, Organisation, OrgNode, etc.)
```

## Pages & Routes

| Route | Component | Auth | Notes |
|-------|-----------|------|-------|
| `/` | `Landing` | Public | Login form; "Forgot password?" link; `?message=password-updated` success banner |
| `/register` | `Register` | Public | Self-registration **or** invite acceptance (auto-detected from URL hash) |
| `/set-password` | `SetPassword` | Public | Redirect shim — forwards old email links to `/register` |
| `/forgot-password` | `ForgotPassword` | Public | Email input → `POST /auth/forgot-password` → sent/not_activated/error states |
| `/reset-password` | `ResetPassword` | Public | Reads `#access_token=...&type=recovery` from hash; set new password |
| `/dashboard` | `Dashboard` | JWT | PAEI results (inline) + My Assessments tab |
| `/assessment?cohort_id=<uuid>` | `Assessment` | JWT | 36-question flow. `cohort_id` query param required — redirects to `/dashboard` if missing. |
| `/results/:id` | `Results` | JWT | Full results + PDF |
| `/admin` | `AdminDashboard` | Admin | Admin overview |
| `/admin/cohorts` | `AdminCohortList` | Admin | Cohort list |
| `/admin/cohorts/:id` | `AdminCohortDetail` | Admin | Members + resend invite; linked orgs panel; enrol from org |
| `/admin/organizations` | `AdminOrganizations` | Admin | Organisation list + create |
| `/admin/organizations/:id` | `AdminOrgDetail` | Admin | Org tree, node management, employee management |
| `/admin/settings` | `AdminSettings` | Admin | SMTP + email templates |
| `/admin/help` | `AdminHelp` | Admin | Admin FAQ including Employee Activation & Password Reset |

## Invite / Activate Account Flow

Two independent activation paths both land on `/register`:

**Cohort direct enrolment** — admin enrolls user into a cohort:
```
/register#access_token=<token>&type=invite
```

**Org employee activation** — admin adds employee to an org node:
```
/register#access_token=<token>&type=invite   (new user)
/register#access_token=<token>&type=recovery  (previously invited, not activated)
```

`Register.tsx` detects the hash on mount and switches to **Activate mode**:
- Email pre-filled from the JWT `email` claim (read-only)
- Full Name pre-filled from `user_metadata.name` (editable)
- Password + Confirm Password fields
- On submit: `POST /auth/set-password` then `PUT /auth/profile` (non-fatal)
- On success: 2-second delay → redirect to `/` (login), hash cleared from history

Old invite links pointing to `/set-password` still work — `SetPassword.tsx` is a redirect shim that forwards them to `/register` with the hash intact.

## Forgot Password / Reset Password Flow

1. User clicks **"Forgot password?"** on login page → `/forgot-password`
2. Enters email → `POST /auth/forgot-password`
   - Not activated → amber "activate your account first" message (no email sent)
   - Activated / unknown → green "check your inbox" message
3. Email contains a Supabase recovery link → redirects to `/reset-password#access_token=...&type=recovery`
4. `ResetPassword.tsx` reads the token from the hash, validates `type === "recovery"`
   - Invalid / missing token → shows "Link expired" error with link back to `/forgot-password`
5. User sets new password → `POST /auth/set-password` (Bearer: recovery token)
6. On success → `navigate('/?message=password-updated', { replace: true })`
7. Landing.tsx shows green "Your password has been updated" banner; URL param cleared immediately

## Organisation Onboarding Flow

Admins manage organisations from `/admin/organizations`:

1. Create an organisation → creates a root node automatically
2. Add child nodes to build the org tree (department, region, team, etc.)
3. Add employees to any node → employee receives `org_welcome` email with 24-hour activation link → redirects to `/register`
4. Link the organisation to a cohort from `/admin/cohorts/:id` → **Enrol from Org** modal
5. Enrol employees by scope (whole org / specific node + descendants) or by individual selection

## Related

- Backend: [adizes-backend](../adizes-backend)
- Design specs: [docs/superpowers/specs/](docs/superpowers/specs/)
- Implementation plans: [docs/superpowers/plans/](docs/superpowers/plans/)
