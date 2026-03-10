# Adizes PAEI Assessment App — Design Document

**Date:** 2026-03-10
**Status:** Approved
**Repos:** `adizes-frontend` (React + Vite) · `adizes-backend` (FastAPI + Supabase)

---

## 1. Overview

A web application for administering the Adizes Management Style Indicator (AMSI) assessment. Users log in, complete the 36-question PAEI assessment, view their personal dashboard with radar chart and gap analysis, and download a full PDF report. Admins/coaches have a separate login and view aggregated cohort data with CSV export.

---

## 2. Architecture

**Pattern:** Two separate repos, REST API with JWT auth.

```
adizes-frontend  (React + Vite + Tailwind)
      │
      │  REST (JWT Bearer)
      ▼
adizes-backend   (FastAPI + Python)
      │
      ├── Supabase PostgreSQL  (data)
      ├── Supabase Auth        (JWT issuance + user management)
      └── Supabase Storage     (generated PDFs)
```

- Frontend deployed to **Vercel**
- Backend deployed to **Railway** or **Render**
- Supabase handles auth token issuance; FastAPI validates JWT on every request
- Frontend calls Supabase Auth SDK directly for login/register only
- All business logic (scoring, gap analysis, report generation) lives in FastAPI

---

## 3. User Roles

| Role | Entry Point | Capabilities |
|------|-------------|--------------|
| `user` | `/` | Take assessment, view own results, download PDF |
| `admin` | `/admin` | View all cohorts, invite users, view any respondent, export CSV |

Role stored as custom claim in Supabase JWT. React Router `AuthGuard` component enforces role-based redirects.

---

## 4. Assessment Structure

- **36 questions total** — 12 per dimension × 3 dimensions
- **Dimensions:** Is (current behaviour) · Should (job demands) · Want (inner preference)
- **Format:** Multiple choice, single answer, 4 options per question
- **PAEI mapping:** Each answer maps to one of the 4 roles (P / A / E / I)
- **Scoring:** Count of selections per role per dimension → score out of 12 (scaled to 50)
- **Dominant trait threshold:** Score > 30 = dominant (capital letter); ≤ 30 = non-dominant (lowercase)

---

## 5. Pages & Routes

### User-facing

| Route | Page | Description |
|-------|------|-------------|
| `/` | Landing / Login | Split-screen hero + auth form |
| `/register` | Register | Name + email + password |
| `/dashboard` | User Home | Assessment status + results preview |
| `/assessment` | Assessment Flow | Distraction-free 3-section questionnaire |
| `/results` | Results Dashboard | Radar chart + gap analysis + interpretation |
| `/report` | Report Download | PDF download trigger |

### Admin-facing

| Route | Page | Description |
|-------|------|-------------|
| `/admin` | Admin Login | Invite-only entry point |
| `/admin/dashboard` | Admin Home | Stats overview + recent activity |
| `/admin/cohorts` | Cohort List | All cohorts with completion rates |
| `/admin/cohorts/:id` | Cohort Detail | Team radar + respondents table + style distribution |
| `/admin/respondents/:id` | Respondent View | Read-only individual results |
| `/admin/export` | Export | Bulk CSV/Excel download |

---

## 6. Visual Identity & Design Tokens

### Brand
Based on Adizes Institute branding: bold red arrow logo, corporate professional aesthetic.

### Color System

```css
--color-primary:       #C8102E;   /* Adizes Red */
--color-primary-dark:  #A00D24;
--color-primary-light: #F9E5E8;
--color-black:         #1A1A1A;
--color-gray-700:      #374151;
--color-gray-400:      #9CA3AF;
--color-gray-100:      #F3F4F6;
--color-white:         #FFFFFF;

/* PAEI Role Colors */
--color-P:  #C8102E;   /* Producer — Red */
--color-A:  #1D3557;   /* Administrator — Deep Navy */
--color-E:  #E87722;   /* Entrepreneur — Amber */
--color-I:  #2A9D8F;   /* Integrator — Teal */
```

### Typography

```css
--font-display: 'Playfair Display', serif;   /* Headlines */
--font-body:    'Inter', sans-serif;          /* UI text */
```

### Spacing & Shape
- 4px base grid
- Border radius: sm=4px · md=8px · lg=12px · full=9999px
- Shadows: sm / md / lg

---

## 7. Navigation Model

- **Users:** Top navbar (logo · links · avatar)
- **Admins:** Fixed left sidebar (240px, collapsible)

---

## 8. Key Pages — Design Detail

### Landing / Login (`/`)
- Full-screen split: left 55% dark-overlay hero photo, right 45% white auth form
- Left: Adizes logo (white) · headline · tagline · trust badges (36Q · 15min · Instant Results)
- Right: Sign In / Register tab toggle · Email + Password · Red CTA button
- Footer link: "Administrator? Sign in here →" → `/admin`

### Assessment Flow (`/assessment`)
- No navbar — distraction-free
- 3-segment progress bar at top (Is · Should · Want)
- Section intro card before each group of 12
- Question card: centered 680px max-width · display font question · 4 stacked option cards
- Option states: idle (white/gray) → hover (light red bg) → selected (red bg, white text, checkmark)
- Next button activates on selection · Back button always available
- Completion screen → auto-redirect to `/results`

### Results Dashboard (`/results`)
- Header band: charcoal bg · Name · Date · Dominant style badge (e.g. `pAeI`)
- **Section A — Radar Chart:** 3 overlapping polygons (Is/Should/Want) · score table below
- **Section B — Gap Analysis:** Horizontal bar pairs per role · gap badges (green ≤4 · amber 5-6 · red ≥7)
- **Section C — Style Interpretation:** Dominant style name · Strengths · Blind Spots · Working with others
- Sticky bottom bar: "Download Full Report (PDF)"

### Admin Cohort Detail (`/admin/cohorts/:id`)
- Team aggregate radar chart
- Respondents table (Name · Email · Status · Dominant Style · Date)
- Style distribution stacked bar
- Export CSV button

---

## 9. Component Architecture

```
/src/components
  /ui
    Button.tsx          # primary | ghost | outline | danger
    Card.tsx
    Badge.tsx           # PAEI role badges with role colors
    ProgressBar.tsx
    GapBadge.tsx        # green/amber/red
    Avatar.tsx
    Modal.tsx
  /charts
    PAEIRadarChart.tsx  # Recharts RadarChart, 3 polygons
    GapBarChart.tsx     # horizontal bar pairs
    StyleDistBar.tsx    # team distribution
  /assessment
    QuestionCard.tsx
    SectionIntro.tsx
    CompletionScreen.tsx
  /layout
    Navbar.tsx
    AdminSidebar.tsx
    AuthGuard.tsx       # role-based route protection
```

### State Management: Zustand

```ts
// authStore (persisted)
{ user, role, token, login(), logout() }

// assessmentStore (in-memory)
{
  currentSection: 0 | 1 | 2,
  currentQuestion: number,
  answers: Record<string, string>,
  saveAnswer(), nextQuestion(), nextSection()
}
```

---

## 10. API Contract (Frontend → FastAPI)

```
Auth
  POST  /auth/login               → { access_token, user, role }
  POST  /auth/register            → { user }

Assessment
  GET   /assessment/questions     → { sections: [{ name, questions[] }] }
  POST  /assessment/submit        → { answers[] } → { result_id }

Results
  GET   /results/:result_id       → { scores, gaps, interpretation }
  GET   /results/:result_id/pdf   → binary PDF stream

Admin
  GET   /admin/cohorts            → { cohorts[] }
  POST  /admin/cohorts            → create cohort
  GET   /admin/cohorts/:id        → { cohort, respondents[], team_scores }
  GET   /admin/respondents/:id    → { user, result }
  GET   /admin/export/:cohort_id  → CSV binary stream
```

---

## 11. Tech Stack Summary

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS (tokens as config) |
| Charts | Recharts |
| Icons | Lucide React |
| State | Zustand |
| HTTP client | Axios |
| Auth (client) | Supabase JS SDK |
| Backend | FastAPI (Python) |
| Database | Supabase PostgreSQL |
| Auth (server) | Supabase Auth + JWT validation |
| File storage | Supabase Storage (PDFs) |
| PDF generation | WeasyPrint or ReportLab (Python) |
| Frontend deploy | Vercel |
| Backend deploy | Railway or Render |

---

## 12. Supabase Database Schema (outline)

```sql
users           -- managed by Supabase Auth + metadata (role, name, org)
cohorts         -- id, name, admin_id, created_at
cohort_members  -- cohort_id, user_id
questions       -- id, section (is|should|want), order, text
options         -- id, question_id, text, paei_role (P|A|E|I)
assessments     -- id, user_id, started_at, completed_at
answers         -- id, assessment_id, question_id, option_id
results         -- id, assessment_id, scores JSONB, gaps JSONB, pdf_url
```

---

## 13. Out of Scope (v1)

- Google OAuth
- Email notifications / invitations via email
- Multi-language support
- Mobile native app
- Retake / versioning of assessments
