# CLAUDE.md — adizes-backend

## What This Is
FastAPI backend for the Adizes PAEI Management Style Assessment platform.
Provides REST API for auth, assessment, results, admin, and email functionality.

## Related Repos
- Frontend UI: `/Users/vrln/adizes-frontend` → branch `adizes-frontend`
- Source docs: `/Users/vrln/HIL_Adizes_India` → branch `main`
- GitHub: `https://github.com/lax-t3/adizes-app`

## Tech Stack
- Python 3.11+ / FastAPI
- Supabase PostgreSQL + Auth (JWT)
- WeasyPrint + Jinja2 (PDF generation)
- Python smtplib (email via SMTP)
- Docker (containerized deployment)

## Local Dev Quick Start

```bash
# 1. Start local Supabase
supabase start

# 2. Refresh .env with current Supabase keys (keys rotate on each start)
supabase status -o env   # copy ANON_KEY + SERVICE_ROLE_KEY into .env

# 3. Apply DB migrations
docker exec -i supabase_db_adizes-backend psql -U postgres -d postgres \
  < migrations/001_initial_schema.sql
docker exec -i supabase_db_adizes-backend psql -U postgres -d postgres \
  < migrations/002_seed_questions.sql

# 4. Build and start backend
docker compose up --build -d
```

API runs at: http://localhost:8000
Swagger docs: http://localhost:8000/docs

## Key Gotchas
- Supabase keys reset on every `supabase start` — always update `.env`
- DB and users reset on every `supabase start` — re-apply migrations + recreate users
- Python source files are baked into Docker image at build time — rebuild after every `.py` change
- `SUPABASE_URL` in `.env` uses `127.0.0.1`; `docker-compose.yml` overrides to `host.docker.internal`
