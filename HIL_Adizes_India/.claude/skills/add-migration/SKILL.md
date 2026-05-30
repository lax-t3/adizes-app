---
name: add-migration
description: Create the next numbered migration file for adizes-backend. Auto-determines the next sequence number, creates the file with a header, and reminds about the two-step apply process.
---

## Step 1: Determine next migration number
```bash
ls /Users/vrln/adizes-backend/migrations/*.sql | sort | tail -5
```
The last file is `014_update_question_texts.sql`, so the next number is `015`.
Auto-increment from whatever the current max is.

## Step 2: Ask the user
Prompt: "Migration name? (e.g. `add_cohort_tags` → file will be `015_add_cohort_tags.sql`)"

## Step 3: Create the migration file
Create `/Users/vrln/adizes-backend/migrations/0NN_<name>.sql` with this header:
```sql
-- Migration 0NN: <description>
-- Applied: local via docker exec psql, production via Supabase MCP execute_sql
-- Date: YYYY-MM-DD

BEGIN;

-- TODO: your SQL here

COMMIT;
```

## Step 4: Remind about apply process
Print this reminder:
```
Migration created: migrations/0NN_<name>.sql

To apply LOCALLY:
  docker exec -i supabase_db_adizes-backend psql -U postgres -d postgres < migrations/0NN_<name>.sql

To apply to PRODUCTION:
  Use the Supabase MCP execute_sql tool (project: swiznkamzxyfzgckebqi)
  OR paste into Supabase Dashboard → SQL Editor

NOTE: supabase/migrations/ (tracked by Supabase CLI) is separate from migrations/ (manual).
New files in migrations/ are NOT auto-applied by `supabase db push`.
```

Also update the CLAUDE.md quick-start migration list to include the new file.
