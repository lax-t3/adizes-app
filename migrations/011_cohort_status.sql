-- 011_cohort_status.sql
-- Add cohort lifecycle status: active (default) | completed | archived

ALTER TABLE cohorts
  ADD COLUMN IF NOT EXISTS cohort_status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (cohort_status IN ('active', 'completed', 'archived'));
