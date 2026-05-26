-- ============================================================
-- Migration 013: Correct section assignments for Q9 and Q26
--
-- Migration 012 had two errors:
--   Q9  was set to 'should' — correct is 'is'
--   Q26 was set to 'is'     — correct is 'should'
-- ============================================================

UPDATE questions SET section = 'is'     WHERE question_index = 9;
UPDATE questions SET section = 'should' WHERE question_index = 26;
