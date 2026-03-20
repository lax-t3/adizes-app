-- Migration 009: add name column to org_employees
-- The name (first name) entered when adding an employee was previously
-- only stored in Supabase auth user_metadata. This column stores it
-- directly in org_employees so it is reliably available for display.

ALTER TABLE org_employees
  ADD COLUMN IF NOT EXISTS name text;
