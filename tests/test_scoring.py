"""Tests for the PAEI scoring engine."""

import pytest
from app.services.scoring import score_answers, _build_profile_string, SCORING_KEY


def _make_answers(selections: list[tuple[int, str]]) -> list[dict]:
    """Build answer list from (question_index, option_key) tuples."""
    return [{"question_index": q, "option_key": opt} for q, opt in selections]


class TestBuildProfileString:
    def test_all_dominant(self):
        scores = {"P": 35, "A": 40, "E": 38, "I": 42}
        assert _build_profile_string(scores) == "PAEI"

    def test_none_dominant(self):
        scores = {"P": 10, "A": 15, "E": 20, "I": 25}
        assert _build_profile_string(scores) == "paei"

    def test_mixed(self):
        scores = {"P": 10, "A": 35, "E": 20, "I": 40}
        assert _build_profile_string(scores) == "pAeI"

    def test_boundary_at_30(self):
        # 30 is NOT dominant (must be > 30)
        scores = {"P": 30, "A": 31, "E": 30, "I": 31}
        assert _build_profile_string(scores) == "pApI"


class TestScoreAnswers:
    def test_all_P_answers(self):
        """Selecting the P option for all 12 Is-section questions gives P=12."""
        # From SCORING_KEY, P options per question 0–11:
        p_selections = [
            (0, 'b'), (1, 'a'), (2, 'b'), (3, 'c'),
            (4, 'a'), (5, 'c'), (6, 'd'), (7, 'c'),
            (8, 'b'), (9, 'a'), (10, 'd'), (11, 'c'),
        ]
        # Fill remaining 24 questions with 'a' (any valid option)
        remaining = [(i, 'a') for i in range(12, 36)]
        answers = _make_answers(p_selections + remaining)
        result = score_answers(answers)
        assert result["raw"]["is"]["P"] == 12

    def test_scaled_max_is_50(self):
        """12 correct P answers in Is section → scaled P(Is) = 50."""
        p_selections = [
            (0, 'b'), (1, 'a'), (2, 'b'), (3, 'c'),
            (4, 'a'), (5, 'c'), (6, 'd'), (7, 'c'),
            (8, 'b'), (9, 'a'), (10, 'd'), (11, 'c'),
        ]
        remaining = [(i, 'a') for i in range(12, 36)]
        answers = _make_answers(p_selections + remaining)
        result = score_answers(answers)
        assert result["scaled"]["is"]["P"] == 50

    def test_profile_strings_present(self):
        answers = _make_answers([(i, 'a') for i in range(36)])
        result = score_answers(answers)
        assert "is" in result["profile"]
        assert "should" in result["profile"]
        assert "want" in result["profile"]

    def test_profile_string_length_is_4(self):
        answers = _make_answers([(i, 'a') for i in range(36)])
        result = score_answers(answers)
        for dim in ["is", "should", "want"]:
            assert len(result["profile"][dim]) == 4

    def test_wrong_answer_count_still_scores(self):
        """Partial answers score only what's provided."""
        answers = _make_answers([(0, 'b')])  # just one answer
        result = score_answers(answers)
        assert result["raw"]["is"]["P"] == 1

    def test_invalid_question_index_ignored(self):
        answers = [{"question_index": 999, "option_key": "a"}]
        result = score_answers(answers)
        for dim in ["is", "should", "want"]:
            for role in ["P", "A", "E", "I"]:
                assert result["raw"][dim][role] == 0

    def test_scoring_key_covers_all_36_questions(self):
        assert len(SCORING_KEY) == 36

    def test_each_question_has_all_4_roles(self):
        for q_idx, mapping in SCORING_KEY.items():
            roles = set(mapping.values())
            assert roles == {"P", "A", "E", "I"}, (
                f"Q{q_idx} does not cover all 4 roles: {mapping}"
            )
