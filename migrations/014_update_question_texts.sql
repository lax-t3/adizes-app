-- ============================================================
-- Migration 014: Update question texts (12 questions) and fix
--                section assignments for Q9 and Q26.
--
-- Source: "Updated ISWANTSHOULD questions.xls" (2026-05-28)
-- Changes:
--   Text updates (question stems and/or options):
--     idx  3  Q4  Want   stem + all 4 options reworded
--     idx  6  Q7  Should stem + all 4 options reworded
--     idx  9  Q10 Should options only (stem unchanged)
--     idx 10  Q11 Is     stem only
--     idx 11  Q12 Want   stem only
--     idx 20  Q21 Should stem + all 4 options reworded
--     idx 23  Q24 Is     stem only
--     idx 30  Q31 Want   stem only
--     idx 31  Q32 Should stem + all 4 options reworded
--     idx 32  Q33 Want   stem + all 4 options reworded
--     idx 34  Q35 Should stem only
--   Section fixes (reverting migration 013 error):
--     idx  9  Q10: 'is'     → 'should'
--     idx 26  Q27: 'should' → 'is'
--
-- No PAEI role (option.paei_role) assignments change.
-- Existing assessment scores are preserved as-is.
-- ============================================================

-- ── idx 3 (Q4, Want) ─────────────────────────────────────────────────────────
UPDATE questions
   SET text = 'When evaluating a new opportunity, I am most drawn to:'
 WHERE question_index = 3;

UPDATE options SET text = 'New challenges.'
 WHERE option_key = 'a'
   AND question_id = (SELECT id FROM questions WHERE question_index = 3);
UPDATE options SET text = 'Stability and job security.'
 WHERE option_key = 'b'
   AND question_id = (SELECT id FROM questions WHERE question_index = 3);
UPDATE options SET text = 'Demands on the individual to perform.'
 WHERE option_key = 'c'
   AND question_id = (SELECT id FROM questions WHERE question_index = 3);
UPDATE options SET text = 'A good working environment.'
 WHERE option_key = 'd'
   AND question_id = (SELECT id FROM questions WHERE question_index = 3);

-- ── idx 6 (Q7, Should) ───────────────────────────────────────────────────────
UPDATE questions
   SET text = 'In our organization, people are most successful when they:'
 WHERE question_index = 6;

UPDATE options SET text = 'Build strong collaboration across teams and departments.'
 WHERE option_key = 'a'
   AND question_id = (SELECT id FROM questions WHERE question_index = 6);
UPDATE options SET text = 'Challenge existing approaches and explore new possibilities.'
 WHERE option_key = 'b'
   AND question_id = (SELECT id FROM questions WHERE question_index = 6);
UPDATE options SET text = 'Create structure, consistency, and reliable ways of working.'
 WHERE option_key = 'c'
   AND question_id = (SELECT id FROM questions WHERE question_index = 6);
UPDATE options SET text = 'Stay closely connected to customer needs and practical results.'
 WHERE option_key = 'd'
   AND question_id = (SELECT id FROM questions WHERE question_index = 6);

-- ── idx 9 (Q10, Should) — section fix + option texts ─────────────────────────
UPDATE questions SET section = 'should' WHERE question_index = 9;

UPDATE options SET text = 'Structured and repetitive operational responsibilities.'
 WHERE option_key = 'a'
   AND question_id = (SELECT id FROM questions WHERE question_index = 9);
UPDATE options SET text = 'Leading, coordinating, and supporting people.'
 WHERE option_key = 'b'
   AND question_id = (SELECT id FROM questions WHERE question_index = 9);
UPDATE options SET text = 'Monitoring progress, quality, and follow-through.'
 WHERE option_key = 'c'
   AND question_id = (SELECT id FROM questions WHERE question_index = 9);
UPDATE options SET text = 'Constant change, variety, and new challenges.'
 WHERE option_key = 'd'
   AND question_id = (SELECT id FROM questions WHERE question_index = 9);

-- ── idx 10 (Q11, Is) — stem only ─────────────────────────────────────────────
UPDATE questions
   SET text = 'My closest colleagues would describe me as someone who is:'
 WHERE question_index = 10;

-- ── idx 11 (Q12, Want) — stem only ───────────────────────────────────────────
UPDATE questions
   SET text = 'My ideal work environment would allow me to:'
 WHERE question_index = 11;

-- ── idx 20 (Q21, Should) ─────────────────────────────────────────────────────
UPDATE questions
   SET text = 'My role is most effective when I:'
 WHERE question_index = 20;

UPDATE options SET text = 'Create structure and systems that improve efficiency and reliability.'
 WHERE option_key = 'a'
   AND question_id = (SELECT id FROM questions WHERE question_index = 20);
UPDATE options SET text = 'Maintain focus on delivering consistent day-to-day results.'
 WHERE option_key = 'b'
   AND question_id = (SELECT id FROM questions WHERE question_index = 20);
UPDATE options SET text = 'Drive improvement, adaptation, and forward development.'
 WHERE option_key = 'c'
   AND question_id = (SELECT id FROM questions WHERE question_index = 20);
UPDATE options SET text = 'Build commitment, trust, and motivation across people and teams.'
 WHERE option_key = 'd'
   AND question_id = (SELECT id FROM questions WHERE question_index = 20);

-- ── idx 23 (Q24, Is) — stem only ─────────────────────────────────────────────
UPDATE questions
   SET text = 'I am most likely to delay an important decision when:'
 WHERE question_index = 23;

-- ── idx 26 (Q27, Is) — section fix only ──────────────────────────────────────
UPDATE questions SET section = 'is' WHERE question_index = 26;

-- ── idx 30 (Q31, Want) — stem only ───────────────────────────────────────────
UPDATE questions
   SET text = 'The type of work that gives me the energy and fulfillment is:'
 WHERE question_index = 30;

-- ── idx 31 (Q32, Should) ─────────────────────────────────────────────────────
UPDATE questions
   SET text = 'Managers in our organization are praised for their:'
 WHERE question_index = 31;

UPDATE options SET text = 'Drive, responsiveness, and ability to deliver results under pressure.'
 WHERE option_key = 'a'
   AND question_id = (SELECT id FROM questions WHERE question_index = 31);
UPDATE options SET text = 'Vision, adaptability, and ability to anticipate future opportunities.'
 WHERE option_key = 'b'
   AND question_id = (SELECT id FROM questions WHERE question_index = 31);
UPDATE options SET text = 'Discipline, consistency, and attention to operational quality.'
 WHERE option_key = 'c'
   AND question_id = (SELECT id FROM questions WHERE question_index = 31);
UPDATE options SET text = 'Ability to build trust, alignment, and cohesion across people and teams.'
 WHERE option_key = 'd'
   AND question_id = (SELECT id FROM questions WHERE question_index = 31);

-- ── idx 32 (Q33, Want) ───────────────────────────────────────────────────────
UPDATE questions
   SET text = 'I want to be thought of as someone who is good at:'
 WHERE question_index = 32;

UPDATE options SET text = 'Getting tomorrow''s work done.'
 WHERE option_key = 'a'
   AND question_id = (SELECT id FROM questions WHERE question_index = 32);
UPDATE options SET text = 'Getting the day-to-day work done.'
 WHERE option_key = 'b'
   AND question_id = (SELECT id FROM questions WHERE question_index = 32);
UPDATE options SET text = 'Creating good working relationships.'
 WHERE option_key = 'c'
   AND question_id = (SELECT id FROM questions WHERE question_index = 32);
UPDATE options SET text = 'Ensuring quality in our procedures.'
 WHERE option_key = 'd'
   AND question_id = (SELECT id FROM questions WHERE question_index = 32);

-- ── idx 34 (Q35, Should) — stem only ─────────────────────────────────────────
UPDATE questions
   SET text = 'People rely on me most for my ability to:'
 WHERE question_index = 34;
