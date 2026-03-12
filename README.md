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

1. Connect `lax-t3/adizes-app` repo to Netlify, branch: `main` (frontend branch)
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Set env var: `VITE_API_URL=https://your-backend.onrender.com`

## Project Structure

```
adizes-frontend/
  src/
    api/
      auth.ts          # login, register, setPassword (invite token), saveInviteProfile
      client.ts        # Axios instance with JWT interceptor + 401 redirect
      profile.ts       # getProfile, updateProfile, changePassword
      assessment.ts    # questions, submit
      results.ts       # getResult, getMyAssessments (downloadPdf removed — PDFs served from S3 via pdf_url)
      admin.ts         # cohort CRUD, member management, user management
      settings.ts      # SMTP + email template CRUD
    components/
      layout/          # AdminSidebar, Header, Footer
      ui/              # Button, Card, Badge, Spinner, Modal
    lib/
      jwt.ts           # decodeJwt() — base64url JWT payload decoder (no signature verify)
      utils.ts         # cn() Tailwind class merge helper
    pages/
      Login.tsx        # Login page
      Register.tsx     # Self-registration (Normal mode) + invite acceptance (Activate mode)
      SetPassword.tsx  # Redirect shim → /register (for old invite email links)
      Dashboard.tsx    # PAEI results tabs + My Assessments list
      Assessment.tsx   # 36-question assessment flow
      Results.tsx      # Full PAEI results + PDF download (S3 url state machine: null→"Generating…"+check-again, set→window.open)
      AdminDashboard.tsx
      AdminCohortList.tsx
      AdminCohortDetail.tsx   # Cohort members + resend invite
      AdminSettings.tsx       # SMTP config + email template editor
      PolicyPage.tsx
    store/
      authStore.ts     # Zustand auth state (JWT, user, role)
    types/
      api.ts           # Shared API types (AuthResponse, MyAssessmentItem, etc.)
```

## Pages & Routes

| Route | Component | Notes |
|-------|-----------|-------|
| `/` | `Login` | Email + password login |
| `/register` | `Register` | Self-registration **or** invite acceptance (auto-detected from URL hash) |
| `/set-password` | `SetPassword` | Redirect shim — forwards old email links to `/register` |
| `/dashboard` | `Dashboard` | PAEI results (inline) + My Assessments tab |
| `/assessment` | `Assessment` | 36-question flow |
| `/results/:id` | `Results` | Full results + PDF |
| `/admin` | `AdminDashboard` | Admin overview |
| `/admin/cohorts` | `AdminCohortList` | Cohort list |
| `/admin/cohorts/:id` | `AdminCohortDetail` | Members + resend invite |
| `/admin/settings` | `AdminSettings` | SMTP + email templates |

## Invite / Activate Account Flow

When an invited user clicks their email link, Supabase redirects to:
```
/register#access_token=<token>&type=invite
```

`Register.tsx` detects the hash on mount and switches to **Activate mode**:
- Email pre-filled from the JWT `email` claim (read-only)
- Full Name pre-filled from `user_metadata.name` (editable)
- Password + Confirm Password fields
- On submit: `POST /auth/set-password` then `PUT /auth/profile` (non-fatal)
- On success: 2-second delay → redirect to `/` (login), hash cleared from history

Old invite links pointing to `/set-password` still work — `SetPassword.tsx` is a redirect shim that forwards them to `/register` with the hash intact.

## Related

- Backend: [adizes-backend](../adizes-backend)
- Design specs: [docs/superpowers/specs/](docs/superpowers/specs/)
- Implementation plans: [docs/superpowers/plans/](docs/superpowers/plans/)
