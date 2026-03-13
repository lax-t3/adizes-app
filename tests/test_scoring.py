"""Tests for the PAEI ranking-based scoring engine (v2: 12–48 scale)."""

import pytest
from app.services.scoring import score_answers, _build_profile_string, SCORING_KEY


def _all_rank_answers(rank_per_option: dict[str, int]) -> list[dict]:
    """Build 36 answers each with the same rank assignment for all options."""
    return [
        {"question_index": q, "ranks": dict(rank_per_option)}
        for q in range(36)
    ]


def _make_ranked_answers(
    overrides: dict[int, dict[str, int]],
    default_ranks: dict[str, int] | None = None,
) -> list[dict]:
    """Build 36 answers. overrides: {q_idx: {a:r, b:r, c:r, d:r}}. Others use default."""
    default = default_ranks or {"a": 1, "b": 2, "c": 3, "d": 4}
    return [
        {"question_index": q, "ranks": overrides.get(q, dict(default))}
        for q in range(36)
    ]


class TestBuildProfileString:
    def test_all_dominant(self):
        scores = {"P": 35, "A": 40, "E": 38, "I": 42}
        assert _build_profile_string(scores) == "PAEI"

    def test_none_dominant(self):
        # All below 30; use values in the valid 12–48 range
        scores = {"P": 14, "A": 16, "E": 20, "I": 25}
        assert _build_profile_string(scores) == "paei"

    def test_mixed(self):
        scores = {"P": 14, "A": 35, "E": 20, "I": 40}
        assert _build_profile_string(scores) == "pAeI"

    def test_boundary_at_30(self):
        # 30 is NOT dominant (must be > 30)
        scores = {"P": 30, "A": 31, "E": 30, "I": 31}
        assert _build_profile_string(scores) == "pAeI"


class TestScoreAnswers:
    def test_max_score_is_48(self):
        """Ranking P option first (rank 1) for all 12 Is-section questions → P(is) = 48."""
        # From SCORING_KEY, P option per question in Is section (q 0-11):
        p_options = {
            0: "b", 1: "a", 2: "b", 3: "c",
            4: "a", 5: "c", 6: "d", 7: "c",
            8: "b", 9: "a", 10: "d", 11: "c",
        }
        # Build answers: for each Is question, P option = rank 1, others = 2,3,4
        answers = []
        for q in range(36):
            if q < 12 and q in p_options:
                p_opt = p_options[q]
                non_p = [o for o in ["a", "b", "c", "d"] if o != p_opt]
                ranks = {p_opt: 1, non_p[0]: 2, non_p[1]: 3, non_p[2]: 4}
            else:
                ranks = {"a": 1, "b": 2, "c": 3, "d": 4}
            answers.append({"question_index": q, "ranks": ranks})

        result = score_answers(answers)
        assert result["scaled"]["is"]["P"] == 48

    def test_min_score_is_12(self):
        """Ranking P option last (rank 4) for all 12 Is questions → P(is) = 12."""
        p_options = {
            0: "b", 1: "a", 2: "b", 3: "c",
            4: "a", 5: "c", 6: "d", 7: "c",
            8: "b", 9: "a", 10: "d", 11: "c",
        }
        answers = []
        for q in range(36):
            if q < 12 and q in p_options:
                p_opt = p_options[q]
                non_p = [o for o in ["a", "b", "c", "d"] if o != p_opt]
                ranks = {non_p[0]: 1, non_p[1]: 2, non_p[2]: 3, p_opt: 4}
            else:
                ranks = {"a": 1, "b": 2, "c": 3, "d": 4}
            answers.append({"question_index": q, "ranks": ranks})

        result = score_answers(answers)
        assert result["scaled"]["is"]["P"] == 12

    def test_scores_sum_to_120_per_section(self):
        """Across all 4 roles, each section must sum to exactly 120 (10 pts × 12 questions)."""
        answers = _all_rank_answers({"a": 1, "b": 2, "c": 3, "d": 4})
        result = score_answers(answers)
        for section in ["is", "should", "want"]:
            total = sum(result["scaled"][section].values())
            assert total == 120, f"{section} total was {total}, expected 120"

    def test_profile_strings_present(self):
        answers = _all_rank_answers({"a": 1, "b": 2, "c": 3, "d": 4})
        result = score_answers(answers)
        assert set(result["profile"].keys()) == {"is", "should", "want"}

    def test_profile_string_length_is_4(self):
        answers = _all_rank_answers({"a": 1, "b": 2, "c": 3, "d": 4})
        result = score_answers(answers)
        for dim in ["is", "should", "want"]:
            assert len(result["profile"][dim]) == 4

    def test_invalid_question_index_ignored(self):
        answers = [{"question_index": 999, "ranks": {"a": 1, "b": 2, "c": 3, "d": 4}}]
        result = score_answers(answers)
        for dim in ["is", "should", "want"]:
            for role in ["P", "A", "E", "I"]:
                assert result["scaled"][dim][role] == 0

    def test_scoring_key_covers_all_36_questions(self):
        assert len(SCORING_KEY) == 36

    def test_each_question_has_all_4_roles(self):
        for q_idx, mapping in SCORING_KEY.items():
            roles = set(mapping.values())
            assert roles == {"P", "A", "E", "I"}, (
                f"Q{q_idx} does not cover all 4 roles: {mapping}"
            )

    def test_score_in_12_to_48_range(self):
        """All scores from a fully-answered assessment must fall in [12, 48]."""
        answers = _all_rank_answers({"a": 1, "b": 2, "c": 3, "d": 4})
        result = score_answers(answers)
        for section in ["is", "should", "want"]:
            for role in ["P", "A", "E", "I"]:
                score = result["scaled"][section][role]
                assert 12 <= score <= 48, f"{section}.{role} = {score} out of range"

    def test_dominant_threshold_at_30(self):
        """A role scoring exactly 30 is NOT dominant; 31 is dominant."""
        scores_30 = {"P": 30, "A": 31, "E": 14, "I": 45}
        profile = _build_profile_string(scores_30)
        assert profile[0] == "p"   # P=30, not dominant
        assert profile[1] == "A"   # A=31, dominant
