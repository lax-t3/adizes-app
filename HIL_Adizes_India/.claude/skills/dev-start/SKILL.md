---
name: dev-start
description: Boot the full LEAP local dev stack — Supabase → rotate env keys → 14 migrations → test users → Docker backend → npm dev frontend
---

Run these steps in order. Stop and report any failure before continuing.

## 1. Start Supabase
```bash
cd /Users/vrln/adizes-backend && supabase start 2>&1
```
This takes ~60s on first run. Wait for it to complete.

## 2. Rotate .env keys
Invoke the `/rotate-env` skill to patch the new ANON_KEY and SERVICE_ROLE_KEY into `.env`.

## 3. Apply all 14 migrations
```bash
cd /Users/vrln/adizes-backend
for f in \
  migrations/001_initial_schema.sql \
  migrations/002_seed_questions.sql \
  migrations/003_add_user_name.sql \
  migrations/004_email_settings.sql \
  migrations/005_ranking_scoring.sql \
  migrations/006_cohort_scoped_assessments.sql \
  migrations/007_organizations.sql \
  migrations/008_employee_extended_fields.sql \
  migrations/009_employee_name_column.sql \
  migrations/011_cohort_status.sql \
  migrations/012_fix_question_sections.sql \
  migrations/013_fix_q9_q26_sections.sql \
  migrations/014_update_question_texts.sql; do
  echo "Applying $f..."
  docker exec -i supabase_db_adizes-backend psql -U postgres -d postgres < $f
done
```

## 4. Create test users
Invoke the `/seed-local` skill.

## 5. Start Docker backend
```bash
cd /Users/vrln/adizes-backend && docker compose up --build -d
```
Wait ~15s, then verify: `curl -s http://localhost:8000/health`
If health check fails, run `docker logs adizes-backend --tail 30`.

## 6. Start frontend
```bash
cd /Users/vrln/adizes-frontend && npm run dev
```
Run in background. Frontend will be at http://localhost:3000.

## 7. Report status
Print a summary table:
| Service | URL | Status |
|---------|-----|--------|
| Frontend | http://localhost:3000 | ✓/✗ |
| Backend API | http://localhost:8000/docs | ✓/✗ |
| Supabase Studio | http://127.0.0.1:54323 | ✓/✗ |

Test credentials: admin@adizes.com / Admin@1234 · user@adizes.com / User@1234
