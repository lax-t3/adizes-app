---
name: db-reset
description: Full local Supabase reset — stop, start, rotate keys, apply all 14 migrations, recreate test users. Use after supabase stop or when DB is in bad state.
---

This is a full teardown and rebuild of the local Supabase instance. All tables and users are wiped.

## 1. Stop Supabase (if running)
```bash
cd /Users/vrln/adizes-backend && supabase stop 2>&1
```

## 2. Start fresh
```bash
cd /Users/vrln/adizes-backend && supabase start 2>&1
```

## 3. Rotate env keys
Invoke `/rotate-env`.

## 4. Apply all 14 migrations
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
  echo "→ $f"
  docker exec -i supabase_db_adizes-backend psql -U postgres -d postgres < $f 2>&1 | tail -3
done
echo "All migrations applied."
```

## 5. Recreate test users
Invoke `/seed-local`.

## Done
Confirm by running: `curl -s http://localhost:8000/health` (requires Docker backend to be running).
If backend is not running yet, invoke `/dev-start` step 5 onwards.
