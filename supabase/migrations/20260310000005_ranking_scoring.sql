-- migrations/005_ranking_scoring.sql
-- Ranking-based scoring redesign
-- Run order: this file after 001 and 002

-- 1. Add ranks JSONB to answers table
--    One row per question per assessment (UNIQUE constraint unchanged).
--    ranks = {"a": 1, "b": 3, "c": 4, "d": 2}  -- value = rank (1=most preferred)
ALTER TABLE answers ADD COLUMN IF NOT EXISTS ranks JSONB;
CREATE INDEX IF NOT EXISTS idx_answers_ranks ON answers USING gin(ranks);

-- 2. Add status column to assessments
--    assessments previously had no status column; status was derived from completed_at.
ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'in_progress', 'completed', 'expired'));

-- 3. Derive initial status from existing timestamps (preserves audit trail)
UPDATE assessments SET status = 'completed' WHERE completed_at IS NOT NULL;
UPDATE assessments SET status = 'in_progress'
  WHERE completed_at IS NULL AND started_at IS NOT NULL;
-- rows with neither timestamp remain 'pending'

-- 4. Mark ALL existing assessments expired (clean slate — full re-take)
UPDATE assessments SET status = 'expired';
