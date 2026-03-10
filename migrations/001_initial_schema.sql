-- ============================================================
-- Adizes PAEI Assessment Platform — Initial Schema
-- Run in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension (already enabled in Supabase by default)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── questions ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS questions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_index  INTEGER NOT NULL UNIQUE,  -- 0-based, 0–35
    text            TEXT NOT NULL,
    section         TEXT NOT NULL CHECK (section IN ('is', 'should', 'want')),
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- ── options ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS options (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id  UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    option_key   CHAR(1) NOT NULL CHECK (option_key IN ('a','b','c','d')),
    text         TEXT NOT NULL,
    paei_role    CHAR(1) NOT NULL CHECK (paei_role IN ('P','A','E','I')),
    UNIQUE (question_id, option_key)
);

-- ── cohorts ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cohorts (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         TEXT NOT NULL,
    description  TEXT,
    admin_id     UUID NOT NULL,   -- references auth.users
    created_at   TIMESTAMPTZ DEFAULT now()
);

-- ── cohort_members ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cohort_members (
    cohort_id   UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL,   -- references auth.users
    joined_at   TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (cohort_id, user_id)
);

-- ── assessments ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assessments (
    id              UUID PRIMARY KEY,
    user_id         UUID NOT NULL,   -- references auth.users
    started_at      TIMESTAMPTZ DEFAULT now(),
    completed_at    TIMESTAMPTZ,
    raw_scores      JSONB,           -- { is:{P,A,E,I}, should:{...}, want:{...} }
    scaled_scores   JSONB,           -- same structure, 0–50 scale
    profile         JSONB,           -- { is:"paEI", should:"Paei", want:"paEI" }
    gaps            JSONB,           -- array of gap objects
    interpretation  JSONB,           -- interpretation object
    pdf_url         TEXT             -- Supabase Storage URL (populated after PDF gen)
);

-- ── answers ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS answers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id   UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    question_index  INTEGER NOT NULL,
    option_key      CHAR(1) NOT NULL,
    UNIQUE (assessment_id, question_index)
);

-- ── Indexes ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_assessments_user_id  ON assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_answers_assessment   ON answers(assessment_id);
CREATE INDEX IF NOT EXISTS idx_cohort_members_user  ON cohort_members(user_id);

-- ── Row Level Security ─────────────────────────────────────
ALTER TABLE assessments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohorts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohort_members ENABLE ROW LEVEL SECURITY;

-- Users can only see their own assessments
CREATE POLICY "Users see own assessments"
    ON assessments FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users insert own assessments"
    ON assessments FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can only see their own answers
CREATE POLICY "Users see own answers"
    ON answers FOR SELECT
    USING (
        assessment_id IN (
            SELECT id FROM assessments WHERE user_id = auth.uid()
        )
    );

-- Service role bypasses RLS (FastAPI uses service role key for admin ops)
-- No additional admin policies needed — service role is unrestricted.
