-- Add user_name column to assessments for display in results/PDF
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS user_name TEXT DEFAULT '';
