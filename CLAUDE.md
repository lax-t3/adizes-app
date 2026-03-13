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

## Production Architecture
```
┌─────────────────────────────────────────────────────┐
│                   PRODUCTION                        │
├─────────────────┬──────────────────┬────────────────┤
│   FRONTEND      │    BACKEND       │   DATABASE     │
│   Netlify       │  Render.com      │ Supabase Cloud │
│                 │  (or AWS EC2)    │                │
│ React + Vite    │  FastAPI Docker  │ PostgreSQL     │
│ adizes-frontend │  adizes-backend  │ Auth + Storage │
│ branch → Netlify│  branch → Render │ supabase.com   │
└─────────────────┴──────────────────┴────────────────┘
```

### Production Deploy Steps

#### Frontend → Netlify
1. Connect `lax-t3/adizes-app` repo to Netlify
2. Set branch: `adizes-frontend`
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Set env var: `VITE_API_URL=https://your-render-backend.onrender.com`

#### Backend → Render.com
1. New Web Service → connect `lax-t3/adizes-app`, branch `adizes-backend`
2. Docker runtime (uses `Dockerfile` automatically)
3. Set env vars (from Supabase Cloud dashboard):
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_JWT_SECRET`
   - `FRONTEND_URL=https://your-netlify-app.netlify.app`

#### Backend → AWS EC2 (alternative)
1. Launch EC2 instance (t3.small minimum, t3.medium recommended)
2. Install Docker: `sudo apt-get install docker.io`
3. Pull image from Docker Hub or build on instance
4. Run: `docker run -d -p 80:8000 --env-file .env adizes-backend`
5. Set up Nginx as reverse proxy + SSL (Let's Encrypt)

#### Database → Supabase Cloud
1. Create project at supabase.com
2. Run `migrations/001_initial_schema.sql` in SQL Editor
3. Run `migrations/002_seed_questions.sql` in SQL Editor
4. Copy Project URL, anon key, service role key, JWT secret to Render/EC2 env vars
5. Set admin role: `UPDATE auth.users SET app_metadata = '{"role":"admin"}' WHERE email = 'admin@yourorg.com'`

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
