# CLAUDE.md — HIL Adizes India Project

## What This Is
Assessment platform for the **Adizes PAEI Management Style Indicator (AMSI)**.
Users take a 36-question assessment across 3 dimensions (Is / Should / Want),
view a PAEI dashboard, and download a full PDF report.

## Repo Map
| Repo | Path | Branch | Purpose |
|------|------|--------|---------|
| `adizes-backend` | `/Users/vrln/adizes-backend` | `adizes-backend` | FastAPI + Supabase — all business logic |
| `adizes-frontend` | `/Users/vrln/adizes-frontend` | `adizes-frontend` | React + Vite — UI |
| `HIL_Adizes_India` | `/Users/vrln/HIL_Adizes_India` | `main` | Source docs, design specs, data files |

All branches live at: **https://github.com/lax-t3/adizes-app**

## Design Spec
Full approved design: `docs/plans/2026-03-10-adizes-paei-app-design.md`
Implementation plan: `docs/plans/2026-03-10-adizes-backend-implementation.md`

## PAEI Framework Quick Reference
| Role | Code | Focus | Strength | Mismanagement extreme |
|------|------|-------|----------|----------------------|
| Producer | P | Results, short-term | Decisive, action-oriented | Lone Ranger |
| Administrator | A | Process, systems | Reliable, thorough | Bureaucrat |
| Entrepreneur | E | Change, vision | Innovative, creative | Arsonist |
| Integrator | I | People, consensus | Nurturing, team builder | Super-Follower |

## Assessment Structure
- **36 questions** = 12 per dimension × 3 dimensions (Is / Should / Want)
- Each option maps to one PAEI role (P / A / E / I)
- Score per role per dimension = count of selections (max 12), scaled 0–50
- Dominant trait: scaled score > 30 → capital letter (P vs p)
- Gaps ≥ 7 points between dimensions indicate meaningful tension

## Source Files
- `PAEI-Questions.xlsx` — all 36 questions + 4 options each
- `AMSI for Jack Allen.pdf` — sample full report (reference for PDF layout)
- `AMSI for Peter Fianu.pdf` — second sample report
- `Management Style Assessment Worksheet 010221.xlsx` — behavioral checklist (different tool)
- `PAEI_Questions_Turiyaskills_Format.xlsx` — questions converted to Turiyaskills format

## Tech Stack
| Layer | Tech |
|-------|------|
| Frontend | React 19 + Vite + TypeScript + Tailwind CSS v4 |
| State | Zustand v5 |
| Charts | Recharts v3 |
| HTTP client | Axios (JWT Bearer auto-attach) |
| Backend | FastAPI (Python 3.11+) |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth (JWT — ES256 local / HS256 cloud) |
| Storage | Supabase Storage (PDFs) |
| PDF gen | WeasyPrint + Jinja2 |
| Containerization | Docker (backend) |

## Brand Colors
```
Primary Red:   #C8102E
Dark/Black:    #1A1A1A
P role:        #C8102E  (red)
A role:        #1D3557  (navy)
E role:        #E87722  (amber)
I role:        #2A9D8F  (teal)
```

## Local Development URLs
| Service | URL | Notes |
|---------|-----|-------|
| Frontend | http://localhost:3000 | `npm run dev` in adizes-frontend |
| Backend API | http://localhost:8000 | Docker container `adizes-backend` |
| Backend Docs | http://localhost:8000/docs | FastAPI auto-docs (Swagger) |
| Supabase Studio | http://127.0.0.1:54323 | Local Supabase dashboard |
| Supabase API | http://127.0.0.1:54321 | Local Supabase REST/Auth |
| Supabase DB | postgresql://postgres:postgres@127.0.0.1:54322/postgres | Direct DB access |

## Local Dev Quick Start

```bash
# 1. Start Supabase (from adizes-backend dir)
cd /Users/vrln/adizes-backend && supabase start

# 2. Refresh .env with current Supabase keys (REQUIRED after every supabase start)
#    Keys rotate each time Supabase starts — copy ANON_KEY and SERVICE_ROLE_KEY:
supabase status -o env   # copy ANON_KEY + SERVICE_ROLE_KEY into .env

# 3. Apply DB migrations (REQUIRED after every supabase start — DB resets)
docker exec -i supabase_db_adizes-backend psql -U postgres -d postgres < migrations/001_initial_schema.sql
docker exec -i supabase_db_adizes-backend psql -U postgres -d postgres < migrations/002_seed_questions.sql
docker exec -i supabase_db_adizes-backend psql -U postgres -d postgres < migrations/003_add_user_name.sql
docker exec -i supabase_db_adizes-backend psql -U postgres -d postgres < migrations/004_email_settings.sql
docker exec -i supabase_db_adizes-backend psql -U postgres -d postgres < migrations/005_ranking_scoring.sql
docker exec -i supabase_db_adizes-backend psql -U postgres -d postgres < migrations/006_cohort_scoped_assessments.sql
docker exec -i supabase_db_adizes-backend psql -U postgres -d postgres < migrations/007_organizations.sql
docker exec -i supabase_db_adizes-backend psql -U postgres -d postgres < migrations/008_employee_extended_fields.sql

# 4. Create test users (REQUIRED after every supabase start — users reset)
SK="<SUPABASE_SERVICE_ROLE_KEY from .env>"
curl -s -X POST "http://127.0.0.1:54321/auth/v1/admin/users" \
  -H "apikey: $SK" -H "Authorization: Bearer $SK" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@adizes.com","password":"Admin@1234","email_confirm":true,"app_metadata":{"role":"admin"}}'
curl -s -X POST "http://127.0.0.1:54321/auth/v1/admin/users" \
  -H "apikey: $SK" -H "Authorization: Bearer $SK" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@adizes.com","password":"User@1234","email_confirm":true}'

# 5. Build and start backend (rebuild if any Python file changed)
cd /Users/vrln/adizes-backend && docker compose up --build -d

# 6. Start frontend
cd /Users/vrln/adizes-frontend && npm run dev
```

## Test Credentials (local only)
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@adizes.com | Admin@1234 |
| User | user@adizes.com | User@1234 |

> These must be recreated after every `supabase start` (local DB resets).

## Production Services

| Service | Details |
|---------|---------|
| Supabase Cloud | Project: `t3-adizes-db` · URL: `https://swiznkamzxyfzgckebqi.supabase.co` · Project ID: `swiznkamzxyfzgckebqi` · Publishable key: `sb_publishable_WEHbUUR_iDtHlyAkNz8BRg_s-KGpVkV` |
| AWS ECR | `094492115510.dkr.ecr.ap-south-1.amazonaws.com/adizes-backend:latest` |
| AWS Profile | Use `lax-t3-assumed` for all ECR operations (`AWS_PROFILE=lax-t3-assumed`) |

### Migrations → Production Supabase
The project is already linked in the Supabase CLI. Run pending migrations with:
```bash
cd /Users/vrln/adizes-backend
supabase db push --linked
```
Dry-run first with `--dry-run` to confirm which migrations will be applied.

## Production Architecture
```
┌──────────────────────────────────────────────────────────────┐
│                        PRODUCTION                            │
├─────────────────┬──────────────────┬────────────────────────┤
│   FRONTEND      │    BACKEND       │   DATABASE / STORAGE   │
│   Netlify       │  AWS App Runner  │ Supabase Cloud         │
│                 │  ← ECR image     │                        │
│ React + Vite    │  FastAPI Docker  │ PostgreSQL             │
│ adizes-frontend │  adizes-backend  │ Auth + Storage         │
│ branch → Netlify│  ECR push →      │ supabase.com           │
│                 │  App Runner      ├────────────────────────┤
│                 │                  │   PDF STORAGE          │
│                 │  PDF Lambda      │ S3 (adizes-pdf-reports)│
│                 │  ← ECR image     │ Lambda writes PDF here │
└─────────────────┴──────────────────┴────────────────────────┘
```

### Production Deploy Steps

#### Frontend → Netlify
1. Connect `lax-t3/adizes-app` repo to Netlify
2. Set branch: `adizes-frontend`
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Set env var: `VITE_API_URL=https://<app-runner-url>`

#### Backend → AWS App Runner (via ECR)
App Runner pulls the Docker image from ECR. **Git push alone does NOT redeploy** — you must
push a new image to ECR, then App Runner auto-deploys (if auto-deploy is enabled on the service).

```bash
# From adizes-backend directory
AWS_ACCOUNT_ID=<your-account-id>
AWS_REGION=ap-south-1
ECR_REPO=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/adizes-backend

# Authenticate Docker to ECR  (use lax-t3-assumed profile)
AWS_PROFILE=lax-t3-assumed aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Build for linux/amd64 (required if building on Apple Silicon)
docker buildx build --platform linux/amd64 --provenance=false -t $ECR_REPO:latest .

# Push — App Runner auto-deploys on new image push
docker push $ECR_REPO:latest
```

App Runner env vars (set in AWS Console → App Runner service → Configuration):
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `FRONTEND_URL=https://<netlify-app>.netlify.app`
- `AWS_ACCESS_KEY_ID` (IAM user key to invoke PDF Lambda)
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION=ap-south-1`
- `PDF_LAMBDA_FUNCTION_NAME=adizes-pdf-generator`

#### PDF Lambda → AWS Lambda (via ECR)
```bash
cd lambda/pdf-generator
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
export S3_BUCKET_NAME=adizes-pdf-reports
./deploy.sh
```

#### Database → Supabase Cloud
1. Create project at supabase.com
2. Run all migrations in SQL Editor (001 through 007)
3. Copy Project URL, anon key, service role key, JWT secret to App Runner env vars
4. Set admin role: `UPDATE auth.users SET app_metadata = '{"role":"admin"}' WHERE email = 'admin@yourorg.com'`

## Key Decisions
- Frontend calls FastAPI for ALL API calls (auth, assessment, results, admin)
- FastAPI validates Supabase JWT on every protected endpoint
- Local Supabase uses ES256 JWT; cloud Supabase uses HS256 — auth.py handles both
- PDF generated server-side via WeasyPrint, streamed directly (no Storage in v1)
- Admin role set via Supabase custom JWT claim `app_metadata.role: admin`
- `docker-compose.yml` overrides `SUPABASE_URL` to `http://host.docker.internal:54321`
  so the container can reach local Supabase (127.0.0.1 in .env is host-only)
- **Cohort-scoped assessments** (migration 006): every assessment row has a `cohort_id NOT NULL FK`.
  Assessments are keyed on `(user_id, cohort_id)` — one per enrollment. All backend queries
  scope to this pair. Frontend passes `?cohort_id=<uuid>` on `/assessment` and the assessment
  store carries `cohortId` through to `submitAssessment(cohort_id, answers)`.
- **Enrollment email — three cases**: `enroll_user` / `bulk_enroll` / `resend_enrollment_invite`
  check `email_confirmed_at`: new/unactivated users get `user_enrolled` (invite/recovery link);
  already-activated users get `cohort_enrollment_existing` (dashboard link only).
- **Organisation module** (migration 007): four tables — `organizations`, `org_nodes`, `org_employees`,
  `cohort_organizations`. Orgs are independent of cohorts until explicitly linked. Employees are added
  to org nodes and receive `org_welcome` emails with activation links (`redirect_to=/register`). After
  linking an org to a cohort, admins can enrol employees into that cohort by scope or individually.
- **Org employee activation redirect**: `_add_employee_to_node` in `admin.py` calls
  `generate_link(type="invite"/"recovery", options={"redirect_to": f"{settings.frontend_url}/register"})`.
  The `redirect_to` option controls where Supabase redirects after token verification — it does NOT
  change the magic link URL in the email itself (`lr.properties.action_link`).
- **Forgot-password flow**: `POST /auth/forgot-password` (public, no JWT). Requires SMTP configured.
  Uses `supabase_admin.auth.admin.list_users()` (no filter param — linear search). Returns
  `{"status": "sent"}` for unknown emails (anti-enumeration). Returns `{"status": "not_activated"}`
  if user exists but `email_confirmed_at is None`. For activated users: generates recovery link with
  `redirect_to=/reset-password`, sends `password_reset` email. Frontend: `/forgot-password` page +
  `/reset-password` page (reads `access_token` + `type=recovery` from URL hash, passes token as Bearer
  header to `POST /auth/set-password`).

## Known Gotchas (Local Dev)

### Supabase keys reset on every restart
`supabase start` regenerates `ANON_KEY` and `SERVICE_ROLE_KEY` each time.
Always run `supabase status -o env` after starting and update `.env`.
Symptom: backend returns `{"detail": "[Errno 111] Connection refused"}` on login.

### DB and users reset on every restart
Local Supabase is ephemeral. After `supabase stop` + `supabase start`:
- All tables are dropped → re-apply both migrations
- All auth users are deleted → recreate via admin API (see Quick Start above)

### Docker image must be rebuilt after code changes
`docker-compose.yml` only mounts `./templates`. All Python source files are
baked in at build time. After editing any `.py` file:
```bash
docker compose up --build -d
```
Symptom: code fix works in isolation but API still returns old behavior.

### JWT algorithm: python-jose JWKError ≠ JWTError
Local Supabase signs tokens with ES256. `python-jose` raises `JWKError` (not
`JWTError`) when you try to verify ES256 with an HS256 secret. These are
separate exception classes — `JWKError` does NOT inherit from `JWTError`.
`auth.py` uses a nested try/except to fall back to `verify_signature=False`.

### Supabase CLI new key formats (v2.72+)
`supabase status` now shows both:
- `sb_publishable_*` / `sb_secret_*` — new SDK keys (use for admin API calls)
- JWT-format `ANON_KEY` / `SERVICE_ROLE_KEY` — still needed for `.env`
Both key formats work for the admin API (`/auth/v1/admin/users`).
