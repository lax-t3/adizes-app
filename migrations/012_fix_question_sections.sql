-- ============================================================
-- Migration 012: Fix question section assignments
--
-- The original seed (002) assigned sections in three sequential
-- blocks: Q0-11 = is, Q12-23 = should, Q24-35 = want.
-- The correct assignments from PAEI_Questions_Turiyaskills_Format.xlsx
-- (Question Tag column) interleave Is / Should / Want throughout.
--
-- Correct distribution:
--   Is     (12): Q0, Q4, Q7, Q10, Q14, Q19, Q21, Q23, Q26, Q29, Q33, Q35
--   Should (12): Q2, Q5, Q6, Q9, Q12, Q13, Q18, Q20, Q24, Q27, Q31, Q34
--   Want   (12): Q1, Q3, Q8, Q11, Q15, Q16, Q17, Q22, Q25, Q28, Q30, Q32
--
-- Also fixes Q12 text: seed was missing the clause
--   "to complement the style of others in the team,"
-- ============================================================

UPDATE questions
SET section = 'is'
WHERE question_index IN (0, 4, 7, 10, 14, 19, 21, 23, 26, 29, 33, 35);

UPDATE questions
SET section = 'should'
WHERE question_index IN (2, 5, 6, 9, 12, 13, 18, 20, 24, 27, 31, 34);

UPDATE questions
SET section = 'want'
WHERE question_index IN (1, 3, 8, 11, 15, 16, 17, 22, 25, 28, 30, 32);

-- Fix Q12 question text (was truncated in original seed)
UPDATE questions
SET text = 'Looking at my position as part of a team, to complement the style of others in the team, the person holding my position should be:'
WHERE question_index = 12;
