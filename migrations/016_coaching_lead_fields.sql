-- 016_coaching_lead_fields.sql
-- Add designation + country to coaching_leads (lead form gained these fields).
-- Apply: local via psql, production via Supabase MCP apply_migration.

alter table coaching_leads add column if not exists designation text;
alter table coaching_leads add column if not exists country     text;
