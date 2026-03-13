-- ============================================================
-- Migration 006: Cohort-Scoped Assessments
-- Add cohort_id to assessments table
-- Clean slate: delete all existing assessment data
-- ============================================================

-- Delete all existing assessment data
-- (PDFs have been manually deleted from Supabase Storage by administrator)
DELETE FROM answers;
DELETE FROM assessments;

-- Add cohort_id column: every assessment is now scoped to a (user_id, cohort_id) pair
ALTER TABLE assessments
  ADD COLUMN cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE;

-- Index for fast per-(user, cohort) lookups
CREATE INDEX idx_assessments_user_cohort ON assessments(user_id, cohort_id);
