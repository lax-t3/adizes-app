# adizes-backend

FastAPI backend for the **Adizes PAEI Management Style Assessment** platform.

## Tech Stack

| Layer | Tech |
|-------|------|
| Runtime | Python 3.11+ |
| Framework | FastAPI |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth (JWT — ES256 local / HS256 cloud) |
| PDF (primary) | AWS Lambda Docker + Puppeteer 22 + EJS + Chart.js → S3 |
| PDF (fallback) | WeasyPrint + Jinja2 (server-side, used for email attachments) |
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
docker exec -i $DB psql -U postgres -d postgres < migrations/003_add_user_name.sql
docker exec -i $DB psql -U postgres -d postgres < migrations/004_email_settings.sql
docker exec -i $DB psql -U postgres -d postgres < migrations/005_ranking_scoring.sql
docker exec -i $DB psql -U postgres -d postgres < migrations/006_cohort_scoped_assessments.sql
docker exec -i $DB psql -U postgres -d postgres < migrations/007_organizations.sql
docker exec -i $DB psql -U postgres -d postgres < migrations/008_employee_extended_fields.sql
docker exec -i $DB psql -U postgres -d postgres < migrations/009_employee_name_column.sql

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

# AWS Lambda PDF (optional — leave blank to skip Lambda trigger in local dev)
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
PDF_LAMBDA_FUNCTION_NAME=adizes-pdf-generator
```

> **Docker note**: When running inside Docker, use `http://host.docker.internal:54321` as `SUPABASE_URL` so the container can reach your local Supabase.

## Production Deployment (AWS App Runner via ECR)

AWS App Runner pulls the Docker image directly from ECR and manages scaling, TLS, and health
checks automatically — no EC2 or load balancer configuration needed.

### ECR Image URI

```
094492115510.dkr.ecr.ap-south-1.amazonaws.com/adizes-backend:latest
```

### Step 1 — Push a new image to ECR

Run this whenever you want to deploy a new version:

> **AWS Profile:** Use the `lax-t3-assumed` profile for all ECR operations.

```bash
# Authenticate Docker to ECR
AWS_PROFILE=lax-t3-assumed aws ecr get-login-password --region ap-south-1 | \
  docker login --username AWS --password-stdin \
  094492115510.dkr.ecr.ap-south-1.amazonaws.com

# Build for linux/amd64 and push  (--provenance=false required on Apple Silicon)
docker buildx build \
  --platform linux/amd64 \
  --provenance=false \
  -t 094492115510.dkr.ecr.ap-south-1.amazonaws.com/adizes-backend:latest \
  --push .
```

### Step 2 — Create the App Runner service (first time only)

1. Open **AWS Console → App Runner → Create service** (region: `ap-south-1`)
2. Source:
   - **Repository type:** Amazon ECR
   - **Container image URI:** `094492115510.dkr.ecr.ap-south-1.amazonaws.com/adizes-backend:latest`
   - **Deployment trigger:** Automatic (redeploys on every new image push)
3. Configure service:
   - **Port:** `8000`
   - **CPU:** 1 vCPU · **Memory:** 2 GB (minimum recommended)
4. Set environment variables (Add all of these under **Environment variables**):

```
SUPABASE_URL              = https://swiznkamzxyfzgckebqi.supabase.co
SUPABASE_ANON_KEY         = <anon key from Supabase dashboard>
SUPABASE_SERVICE_ROLE_KEY = <service role key from Supabase dashboard>
SUPABASE_JWT_SECRET       = <JWT secret from Supabase dashboard>
FRONTEND_URL              = https://your-netlify-app.netlify.app
AWS_REGION                = ap-south-1
AWS_ACCESS_KEY_ID         = <IAM user key for Lambda invocation>
AWS_SECRET_ACCESS_KEY     = <IAM user secret for Lambda invocation>
PDF_LAMBDA_FUNCTION_NAME  = adizes-pdf-generator
```

5. **Create & deploy** — App Runner provisions the service and gives you a URL like:
   `https://xxxxxxxxxxxx.ap-south-1.awsapprunner.com`

### Step 3 — Update Supabase CORS and frontend URL

In Supabase Dashboard → Project Settings → API → **Allowed CORS origins**, add your App Runner URL.

Update `FRONTEND_URL` on App Runner to point to your Netlify URL (so CORS headers are set correctly).

### Step 4 — Subsequent deploys

Just push a new image to ECR — App Runner auto-redeploys within ~1 minute:

```bash
AWS_PROFILE=lax-t3-assumed aws ecr get-login-password --region ap-south-1 | \
  docker login --username AWS --password-stdin \
  094492115510.dkr.ecr.ap-south-1.amazonaws.com

docker buildx build \
  --platform linux/amd64 --provenance=false \
  -t 094492115510.dkr.ecr.ap-south-1.amazonaws.com/adizes-backend:latest \
  --push .
```

### Step 5 — Run new migrations on production Supabase

The project `swiznkamzxyfzgckebqi` is already linked in the Supabase CLI. After adding a new migration file under `supabase/migrations/`, apply it with:

```bash
supabase db push --linked        # dry-run first: add --dry-run
```

Production Supabase:
- **URL:** `https://swiznkamzxyfzgckebqi.supabase.co`
- **Project ID:** `swiznkamzxyfzgckebqi`
- **Publishable key:** `sb_publishable_WEHbUUR_iDtHlyAkNz8BRg_s-KGpVkV`

### IAM permissions required for App Runner

App Runner needs an **ECR access role** to pull images. When creating the service, select
**Create new service role** — AWS creates `AppRunnerECRAccessRole` automatically with the
required `ecr:GetDownloadUrlForLayer`, `ecr:BatchGetImage` and `ecr:GetAuthorizationToken`
permissions.

---

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
                               #   change password, forgot-password, GET /auth/my-assessments
      assessment.py            # GET /assessment/questions, POST /assessment/submit
                               #   (fires PDF completion email + triggers Lambda PDF as BackgroundTask)
      results.py               # GET /results/:id (includes pdf_url), GET /results/:id/pdf (WeasyPrint fallback)
      admin.py                 # Cohorts, members (enroll/bulk/resend-invite/remove),
                               #   respondents, CSV export, admin user management,
                               #   organisations + org nodes + org employees
      settings.py              # SMTP config CRUD, email template CRUD + reset
    services/
      scoring.py               # PAEI scoring engine (36-question key)
      gap_analysis.py          # Gap calculator + severity classification
      interpretation.py        # Dominant style + narrative text
      pdf_service.py           # WeasyPrint HTML→PDF
      export_service.py        # CSV generation for admin
      email_service.py         # smtplib SMTP sending; template rendering;
                               #   DEFAULT_TEMPLATES for 5 built-in email types
    schemas/
      auth.py                  # Login, register, profile, password, CohortAssessmentHistory,
                               #   ForgotPasswordRequest, ForgotPasswordResponse
      assessment.py            # Questions, submit (requires cohort_id), options
      results.py               # ResultResponse (includes pdf_url), GapDetail, Interpretation
      admin.py                 # Cohorts, members, bulk enroll, admin users, RespondentDetail,
                               #   Organisation, OrgNode, OrgEmployee schemas
      settings.py              # SmtpConfig, EmailTemplate CRUD
  migrations/
    001_initial_schema.sql              # Full DB schema + RLS policies
    002_seed_questions.sql              # All 36 PAEI questions with options
    003_add_user_name.sql               # user_name column on assessments
    004_email_settings.sql              # app_settings + email_templates tables
    005_ranking_scoring.sql             # Ranking-based scoring engine changes
    006_cohort_scoped_assessments.sql   # Adds cohort_id NOT NULL FK to assessments (clean-slate migration)
    007_organizations.sql               # organisations, org_nodes, org_employees, cohort_organizations tables
    008_employee_extended_fields.sql    # 9 new HR columns on org_employees (emp_status, last/middle name, gender, language, manager_email, DOB, emp_date, head_of_dept)
    009_employee_name_column.sql        # adds name (first name) column to org_employees (was missing from original schema)
  supabase/migrations/
    20260319000007_organizations.sql    # Supabase CLI-tracked copy of 007 (applied to cloud via supabase db push)
    20260320000008_employee_extended_fields.sql  # Supabase CLI-tracked copy of 008
    20260320000009_employee_name_column.sql      # Supabase CLI-tracked copy of 009
  tests/
    test_scoring.py
    test_gap_analysis.py
    test_api_assessment.py
    test_org_module.py                  # Organisation CRUD, node management, employee management
    test_employee_extended.py           # 23 tests: extended HR fields, PATCH partial update, bulk CSV parsing, date helpers
    test_forgot_password.py             # ForgotPasswordRequest/Response schema validation
    test_email_templates.py             # password_reset and org_welcome template rendering
  templates/
    report.html                # Jinja2 PDF report template
```

## API Endpoints

### Auth (`/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/login` | — | Login → JWT |
| POST | `/auth/register` | — | Register new user |
| POST | `/auth/set-password` | Invite JWT | Accept invite, set password (frontend: invite links land on `/register`, not `/set-password`) |
| GET | `/auth/profile` | JWT | Get current user profile |
| PUT | `/auth/profile` | JWT | Update name, email, phone |
| PUT | `/auth/password` | JWT | Change password (verifies current) |
| POST | `/auth/forgot-password` | — | Request password reset link. Returns `{status: "sent"}` or `{status: "not_activated"}`. Always 200 (anti-enumeration). Requires SMTP configured. |
| GET | `/auth/my-assessments` | JWT | List user's cohort enrollments + statuses |

### Assessment (`/assessment`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/assessment/questions` | JWT | All 36 questions in 3 sections |
| POST | `/assessment/submit` | JWT | Submit answers (`cohort_id` required in body) → result_id + sends completion email + triggers Lambda PDF (fire-and-forget). Returns 403 if user not enrolled in the cohort. |

### Results (`/results`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/results/{result_id}` | JWT | Scores + gaps + interpretation + `pdf_url` (null until Lambda completes) |
| GET | `/results/{result_id}/pdf` | JWT | Stream WeasyPrint PDF (server-side fallback) |

### Admin — Cohorts (`/admin`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/admin/stats` | Admin | Platform-wide stats |
| GET | `/admin/cohorts` | Admin | List all cohorts |
| POST | `/admin/cohorts` | Admin | Create cohort |
| DELETE | `/admin/cohorts/{id}` | Admin | Delete cohort — only if it has 0 enrolled members; returns 400 otherwise |
| GET | `/admin/cohorts/{id}` | Admin | Cohort detail + team scores |
| POST | `/admin/cohorts/{id}/members` | Admin | Enroll user by email (auto-invites new users) |
| POST | `/admin/cohorts/{id}/members/bulk` | Admin | Bulk enroll from list |
| POST | `/admin/cohorts/{id}/members/{uid}/resend-invite` | Admin | Resend enrollment email |
| DELETE | `/admin/cohorts/{id}/members/{uid}` | Admin | Remove member |
| GET | `/admin/respondents/{uid}?cohort_id=<uuid>` | Admin | Respondent results for a specific cohort. `cohort_id` query param required (400 if missing). Returns `result: null` if user hasn't submitted yet. |
| GET | `/admin/export/{cohort_id}` | Admin | CSV export |

### Admin — Organisations (`/admin`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/admin/organizations` | Admin | List all organisations |
| POST | `/admin/organizations` | Admin | Create organisation |
| GET | `/admin/organizations/{id}` | Admin | Organisation detail (with root node) |
| PUT | `/admin/organizations/{id}` | Admin | Update organisation name/description |
| DELETE | `/admin/organizations/{id}` | Admin | Delete organisation |
| GET | `/admin/organizations/{id}/nodes` | Admin | List all nodes in tree order |
| POST | `/admin/organizations/{id}/nodes` | Admin | Create node (specify `parent_node_id` for non-root) |
| PUT | `/admin/organizations/{id}/nodes/{nid}` | Admin | Rename node |
| DELETE | `/admin/organizations/{id}/nodes/{nid}` | Admin | Delete node (cascades employees) |
| GET | `/admin/organizations/{id}/nodes/{nid}/employees` | Admin | List employees in a node |
| POST | `/admin/organizations/{id}/nodes/{nid}/employees` | Admin | Add employee to node (sends org_welcome email with activation link). Accepts 9 extended HR fields: `emp_status`, `last_name`, `middle_name`, `gender`, `default_language`, `manager_email`, `dob` (DD/MM/YYYY), `emp_date` (DD/MM/YYYY), `head_of_dept`. Employee `name` is stored in `org_employees.name` and written to `user_metadata` via `generate_link options.data` so the profile page pre-populates the name field. |
| PATCH | `/admin/organizations/{id}/employees/{eid}` | Admin | Partial update employee HR fields. All fields optional; send `""` to clear nullable fields. `emp_status` and `default_language` cannot be cleared. |
| DELETE | `/admin/organizations/{id}/nodes/{nid}/employees/{uid}` | Admin | Remove employee from node |
| POST | `/admin/organizations/{id}/nodes/{nid}/employees/{uid}/resend-welcome` | Admin | Resend welcome activation email |
| GET | `/admin/cohorts/{id}/organizations` | Admin | List orgs linked to a cohort |
| POST | `/admin/cohorts/{id}/organizations` | Admin | Link org to cohort |
| DELETE | `/admin/cohorts/{id}/organizations/{oid}` | Admin | Unlink org from cohort |
| POST | `/admin/cohorts/{id}/enroll-from-org` | Admin | Enrol org employees into cohort (by scope or individual list) |

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

Five built-in templates (stored in `app_settings` / `email_templates` tables, editable via admin UI):

| Template ID | Trigger | Variables |
|-------------|---------|-----------|
| `user_enrolled` | New or not-yet-activated user enrolled into a cohort | `user_name`, `user_email`, `cohort_name`, `invite_link`, `platform_name`, `platform_url` |
| `cohort_enrollment_existing` | Already-activated user enrolled into a cohort (dashboard link only) | `user_name`, `user_email`, `cohort_name`, `platform_name`, `platform_url` |
| `admin_invite` | New admin account invited | `admin_name`, `admin_email`, `invite_link`, `platform_name`, `platform_url` |
| `assessment_complete` | User submits assessment | `user_name`, `user_email`, `cohort_name`, `dominant_style`, `platform_name`, `platform_url` (+ PDF attachment) |
| `org_welcome` | Employee added to an org node | `user_name`, `org_name`, `activation_link`, `platform_name`, `platform_url` |
| `password_reset` | Employee requests password reset via `/forgot-password` | `user_name`, `reset_link`, `platform_name`, `platform_url` |

### Enrollment email three-case logic

All three cohort enrollment endpoints (`enroll_user`, `bulk_enroll`, `resend_enrollment_invite`) apply the same branching:

| Case | Condition | Email sent |
|------|-----------|-----------|
| New user | No account existed | `user_enrolled` with `type=invite` link → redirects to `/register` |
| Invited, not activated | Account exists, `email_confirmed_at is None` | `user_enrolled` with `type=recovery` link → redirects to `/register` |
| Already activated | Account exists, `email_confirmed_at` set | `cohort_enrollment_existing` (dashboard link only) |

### Org employee activation flow

When an admin adds an employee to an org node, `_add_employee_to_node` sends `org_welcome` with a `generate_link(type="invite" or "recovery", redirect_to=/register)` activation link. After the employee sets their password, they are fully activated (`email_confirmed_at` set) and can use self-service password reset.

### Password reset flow

`POST /auth/forgot-password` (public, no JWT):
1. SMTP must be configured — returns 400 otherwise
2. Searches all users linearly for the email (supabase-py has no filter on `list_users()`)
3. Unknown email → `{"status": "sent"}` (silent, anti-enumeration)
4. Found, not activated → `{"status": "not_activated"}` (no email sent)
5. Found, activated → `generate_link(type="recovery", redirect_to=/reset-password)` → sends `password_reset` email → `{"status": "sent"}`

## Running Tests

```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
pytest tests/ -v
```

## Lambda PDF Generator

The primary PDF report is generated asynchronously by a Docker Lambda function.

```
POST /assessment/submit
  └── BackgroundTask: boto3.invoke(Lambda, InvocationType="Event")

Lambda (lambda/pdf-generator/):
  EJS render → inline assets → Puppeteer → Chart.js charts
  → page.pdf() → S3 PutObject (public-read)
  → Supabase PATCH assessments.pdf_url
```

### Deploy Lambda

```bash
# Set required env vars first
export SUPABASE_URL=https://...
export SUPABASE_SERVICE_ROLE_KEY=...
export S3_BUCKET_NAME=adizes-pdf-reports

cd lambda/pdf-generator
./deploy.sh
```

### AWS Pre-requisites (one-time)

```bash
# IAM role with S3 PutObject + CloudWatch logs
aws iam create-role --role-name adizes-pdf-lambda-role ...

# S3 bucket with Block Public Access disabled
aws s3api create-bucket --bucket adizes-pdf-reports --region ap-south-1 ...

# IAM user for FastAPI with lambda:InvokeFunction
aws iam create-user --user-name adizes-backend-lambda-invoker
```

See `lambda/pdf-generator/deploy.sh` for full AWS CLI commands.

## Related

- Frontend: [adizes-frontend](../adizes-frontend)
- Design spec: [HIL_Adizes_India/docs/plans](../HIL_Adizes_India/docs/plans/)
