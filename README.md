# adizes-backend

FastAPI backend for the **Adizes PAEI Management Style Assessment** platform.

## Tech Stack

| Layer | Tech |
|-------|------|
| Runtime | Python 3.11+ |
| Framework | FastAPI |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth (JWT — ES256 local / HS256 cloud) |
| Storage | Supabase Storage (generated PDFs) |
| PDF | WeasyPrint + Jinja2 |
| Email | Python smtplib (AWS SES / Gmail / Resend / Custom SMTP) |
| Container | Docker |

## Local Development

### Prerequisites
- Docker Desktop
- Supabase CLI (`brew install supabase/tap/supabase`)
- Local Supabase running (`supabase start` in this directory)

### Quick Start

```bash
# 1. Start local Supabase (first time: supabase init)
supabase start

# 2. Apply migrations in order
DB=$(docker ps -q -f name=supabase_db)
docker exec -i $DB psql -U postgres -d postgres < migrations/001_initial_schema.sql
docker exec -i $DB psql -U postgres -d postgres < migrations/002_seed_questions.sql
docker exec -i $DB psql -U postgres -d postgres < migrations/003_admin_schema.sql
docker exec -i $DB psql -U postgres -d postgres < migrations/004_email_settings.sql

# 3. Copy and edit env (use http://127.0.0.1:54321 for local Supabase)
cp .env.example .env

# 4. Build and run via Docker
docker compose up --build
```

Backend runs at: **http://localhost:8000**
Swagger docs: **http://localhost:8000/docs**

### Local Service URLs

| Service | URL |
|---------|-----|
| Backend API | http://localhost:8000 |
| Supabase API | http://127.0.0.1:54321 |
| Supabase Studio | http://127.0.0.1:54323 |
| Supabase Inbucket | http://127.0.0.1:54324 |

### Environment Variables

```bash
# Local Supabase
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<from: supabase status>
SUPABASE_SERVICE_ROLE_KEY=<from: supabase status>
SUPABASE_JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long
FRONTEND_URL=http://localhost:3000
```

> **Docker note**: When running inside Docker, use `http://host.docker.internal:54321` as `SUPABASE_URL` so the container can reach your local Supabase.

## Production Deployment (Render.com)

1. Create a new **Web Service** on Render.com, connect to the `adizes-backend` branch
2. Set **Dockerfile** as the build type
3. Set environment variables (Render dashboard → Environment):

```bash
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-production-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-production-service-role-key
SUPABASE_JWT_SECRET=your-production-jwt-secret
FRONTEND_URL=https://your-app.netlify.app
```

4. Run migrations against Supabase Cloud via Supabase Dashboard SQL editor or:

```bash
supabase db push --db-url postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
```

## Production Architecture

```
User Browser
    │
    ├── Frontend (Netlify CDN)
    │       React + Vite → https://your-app.netlify.app
    │
    ├── Backend API (Render.com)
    │       FastAPI + Docker → https://adizes-backend.onrender.com
    │       ↕ validates Supabase JWT
    │
    └── Supabase Cloud
            PostgreSQL + Auth + Storage → https://your-project.supabase.co
```

## Project Structure

```
adizes-backend/
  main.py                      # FastAPI app, CORS, router registration
  app/
    config.py                  # Settings (pydantic-settings)
    database.py                # Supabase client singleton
    auth.py                    # JWT validation dependency
    routers/
      auth.py                  # Login, register, set-password, profile CRUD,
                               #   change password, GET /auth/my-assessments
      assessment.py            # GET /assessment/questions, POST /assessment/submit
                               #   (fires PDF completion email on submit)
      results.py               # GET /results/:id, GET /results/:id/pdf
      admin.py                 # Cohorts, members (enroll/bulk/resend-invite/remove),
                               #   respondents, CSV export, admin user management
      settings.py              # SMTP config CRUD, email template CRUD + reset
    services/
      scoring.py               # PAEI scoring engine (36-question key)
      gap_analysis.py          # Gap calculator + severity classification
      interpretation.py        # Dominant style + narrative text
      pdf_service.py           # WeasyPrint HTML→PDF
      export_service.py        # CSV generation for admin
      email_service.py         # smtplib SMTP sending; template rendering;
                               #   DEFAULT_TEMPLATES for 3 built-in email types
    schemas/
      auth.py                  # Login, register, profile, password, MyAssessmentItem
      assessment.py            # Questions, submit, options
      results.py               # ResultResponse, GapDetail, Interpretation
      admin.py                 # Cohorts, members, bulk enroll, admin users
      settings.py              # SmtpConfig, EmailTemplate CRUD
  migrations/
    001_initial_schema.sql     # Full DB schema + RLS policies
    002_seed_questions.sql     # All 36 PAEI questions with options
    003_admin_schema.sql       # Cohorts + cohort_members tables
    004_email_settings.sql     # app_settings + email_templates tables
  tests/
    test_scoring.py
    test_gap_analysis.py
    test_api_assessment.py
  templates/
    report.html                # Jinja2 PDF report template
```

## API Endpoints

### Auth (`/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/login` | — | Login → JWT |
| POST | `/auth/register` | — | Register new user |
| POST | `/auth/set-password` | Invite JWT | Accept invite, set password |
| GET | `/auth/profile` | JWT | Get current user profile |
| PUT | `/auth/profile` | JWT | Update name, email, phone |
| PUT | `/auth/password` | JWT | Change password (verifies current) |
| GET | `/auth/my-assessments` | JWT | List user's cohort enrollments + statuses |

### Assessment (`/assessment`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/assessment/questions` | JWT | All 36 questions in 3 sections |
| POST | `/assessment/submit` | JWT | Submit answers → result_id + sends completion email with PDF |

### Results (`/results`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/results/{result_id}` | JWT | Scores + gaps + interpretation |
| GET | `/results/{result_id}/pdf` | JWT | Stream PDF report |

### Admin — Cohorts (`/admin`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/admin/stats` | Admin | Platform-wide stats |
| GET | `/admin/cohorts` | Admin | List all cohorts |
| POST | `/admin/cohorts` | Admin | Create cohort |
| GET | `/admin/cohorts/{id}` | Admin | Cohort detail + team scores |
| POST | `/admin/cohorts/{id}/members` | Admin | Enroll user by email (auto-invites new users) |
| POST | `/admin/cohorts/{id}/members/bulk` | Admin | Bulk enroll from list |
| POST | `/admin/cohorts/{id}/members/{uid}/resend-invite` | Admin | Resend enrollment email |
| DELETE | `/admin/cohorts/{id}/members/{uid}` | Admin | Remove member |
| GET | `/admin/respondents/{uid}` | Admin | Individual respondent results |
| GET | `/admin/export/{cohort_id}` | Admin | CSV export |

### Admin — Users (`/admin`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/admin/users` | Admin | List all administrator accounts |
| POST | `/admin/users/invite` | Admin | Invite new administrator (sends email) |
| POST | `/admin/users/{id}/resend-invite` | Admin | Resend admin invite email |
| PUT | `/admin/users/{id}/password` | Admin | Set administrator password |
| DELETE | `/admin/users/{id}` | Admin | Delete administrator account |

### Admin — Settings (`/admin/settings`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/admin/settings/smtp` | Admin | Get SMTP configuration (password masked) |
| PUT | `/admin/settings/smtp` | Admin | Save SMTP configuration |
| POST | `/admin/settings/smtp/test` | Admin | Send a test email |
| GET | `/admin/settings/templates` | Admin | List email templates |
| GET | `/admin/settings/templates/{id}` | Admin | Get template (falls back to built-in default) |
| PUT | `/admin/settings/templates/{id}` | Admin | Update template subject + HTML body |
| POST | `/admin/settings/templates/{id}/reset` | Admin | Reset template to built-in default |

## Email Templates

Three built-in templates (stored in `app_settings` / `email_templates` tables, editable via admin UI):

| Template ID | Trigger | Variables |
|-------------|---------|-----------|
| `user_enrolled` | User enrolled into a cohort | `user_name`, `user_email`, `cohort_name`, `invite_link`, `platform_name`, `platform_url` |
| `admin_invite` | New admin account invited | `admin_name`, `admin_email`, `invite_link`, `platform_name`, `platform_url` |
| `assessment_complete` | User submits assessment | `user_name`, `user_email`, `cohort_name`, `dominant_style`, `platform_name`, `platform_url` (+ PDF attachment) |

## Running Tests

```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
pytest tests/ -v
```

## Related

- Frontend: [adizes-frontend](../adizes-frontend)
- Design spec: [HIL_Adizes_India/docs/plans](../HIL_Adizes_India/docs/plans/)
