-- Migration 010: Clean slate for new scoring engine
-- Rank points change (rank 1: 4 pts → 5 pts, total 120 → 132) makes all
-- existing scores incompatible. answers cascade via FK ON DELETE CASCADE.
DELETE FROM assessments;
