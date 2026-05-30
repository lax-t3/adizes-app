---
name: apply-migration
description: Apply a migration file to the local Supabase instance and print the reminder to also apply to production. Usage: /apply-migration <filename>
---

The user will specify a migration filename (e.g. `015_add_cohort_tags.sql`).

## Step 1: Confirm the file exists
```bash
ls /Users/vrln/adizes-backend/migrations/<filename>
```

## Step 2: Apply locally
```bash
docker exec -i supabase_db_adizes-backend psql -U postgres -d postgres \
  < /Users/vrln/adizes-backend/migrations/<filename>
```

Show the output. If there are errors (e.g. "column already exists"), assess whether this is safe to ignore or needs the migration file fixed.

## Step 3: Verify (optional)
If the migration creates or alters a table, run a quick check:
```bash
docker exec -i supabase_db_adizes-backend psql -U postgres -d postgres \
  -c "\d <table_name>" 2>&1
```

## Step 4: Print production reminder
```
✓ Applied locally.

PRODUCTION: This migration must be applied manually.
  Option A — Supabase MCP: use execute_sql tool on project swiznkamzxyfzgckebqi
  Option B — Dashboard: https://supabase.com/dashboard/project/swiznkamzxyfzgckebqi → SQL Editor

IMPORTANT: supabase db push only tracks files in supabase/migrations/, NOT migrations/.
```
