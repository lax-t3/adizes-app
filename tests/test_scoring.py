"""Tests for the PAEI ranking-based scoring engine (v3: 132-point scale)."""

import pytest
from app.services.scoring import score_answers, _build_profile_string, SCORING_KEY, RANK_POINTS, DOMINANT_THRESHOLD


def _all_rank_answers(rank_per_option: dict) -> list:
    """Build 36 answers each with the same rank assignment for all options."""
    return [
        {"question_index": q, "ranks": dict(rank_per_option)}
        for q in range(36)
    ]


class TestConstants:
    def test_rank_points_mapping(self):
        assert RANK_POINTS == {1: 5, 2: 3, 3: 2, 4: 1}

    def test_dominant_threshold_is_33(self):
        assert DOMINANT_THRESHOLD == 33

    def test_scoring_key_covers_all_36_questions(self):
        assert len(SCORING_KEY) == 36

    def test_each_question_has_all_4_roles(self):
        for q_idx, mapping in SCORING_KEY.items():
            roles = set(mapping.values())
            assert roles == {"P", "A", "E", "I"}, f"Q{q_idx}: {mapping}"


class TestBuildProfileString:
    def test_all_dominant(self):
        scores = {"P": 40, "A": 40, "E": 35, "I": 34}
        assert _build_profile_string(scores) == "PAEI"

    def test_none_dominant(self):
        scores = {"P": 20, "A": 25, "E": 30, "I": 33}
        # 33 is NOT dominant (must be > 33)
        assert _build_profile_string(scores) == "paei"

    def test_boundary_at_33(self):
        scores = {"P": 33, "A": 34, "E": 33, "I": 34}
        assert _build_profile_string(scores) == "pAeI"

    def test_mixed(self):
        scores = {"P": 20, "A": 40, "E": 25, "I": 50}
        assert _build_profile_string(scores) == "pAeI"


class TestScoreAnswers:
    def test_returns_raw_display_profile_keys(self):
        answers = _all_rank_answers({"a": 1, "b": 2, "c": 3, "d": 4})
        result = score_answers(answers)
        assert set(result.keys()) == {"raw", "display", "profile"}

    def test_raw_sums_to_132_per_section(self):
        """P+A+E+I must equal 132 per section (11 pts × 12 questions)."""
        answers = _all_rank_answers({"a": 1, "b": 2, "c": 3, "d": 4})
        result = score_answers(answers)
        for section in ["is", "should", "want"]:
            total = sum(result["raw"][section].values())
            assert total == 132, f"{section} total was {total}"

    def test_display_sums_to_100_per_section(self):
        """Display% values (rounded) must sum to approximately 100 per section."""
        answers = _all_rank_answers({"a": 1, "b": 2, "c": 3, "d": 4})
        result = score_answers(answers)
        for section in ["is", "should", "want"]:
            total = sum(result["display"][section].values())
            # Rounding may cause off-by-1
            assert 98 <= total <= 102, f"{section} display total was {total}"

    def test_max_raw_score_when_role_always_rank1(self):
        """Ranking P option rank 1 in all 12 Is questions → raw P(is) >= 60 (before possible boost)."""
        # P option per Is question (from SCORING_KEY):
        p_opts = {0:"b",1:"a",2:"b",3:"c",4:"a",5:"c",6:"d",7:"c",8:"b",9:"a",10:"d",11:"c"}
        answers = []
        for q in range(36):
            if q < 12:
                p_opt = p_opts[q]
                non_p = [o for o in "abcd" if o != p_opt]
                answers.append({"question_index": q, "ranks": {p_opt:1, non_p[0]:2, non_p[1]:3, non_p[2]:4}})
            else:
                answers.append({"question_index": q, "ranks": {"a":1,"b":2,"c":3,"d":4}})
        result = score_answers(answers)
        assert result["raw"]["is"]["P"] >= 60

    def test_min_raw_score_when_role_always_rank4(self):
        """Ranking P option rank 4 in all 12 Is questions → P(is) = 12."""
        p_opts = {0:"b",1:"a",2:"b",3:"c",4:"a",5:"c",6:"d",7:"c",8:"b",9:"a",10:"d",11:"c"}
        answers = []
        for q in range(36):
            if q < 12:
                p_opt = p_opts[q]
                non_p = [o for o in "abcd" if o != p_opt]
                answers.append({"question_index": q, "ranks": {non_p[0]:1, non_p[1]:2, non_p[2]:3, p_opt:4}})
            else:
                answers.append({"question_index": q, "ranks": {"a":1,"b":2,"c":3,"d":4}})
        result = score_answers(answers)
        assert result["raw"]["is"]["P"] == 12

    def test_display_is_percentage_of_raw(self):
        """display[section][role] ≈ round(raw[section][role] / 132 * 100)."""
        answers = _all_rank_answers({"a": 1, "b": 2, "c": 3, "d": 4})
        result = score_answers(answers)
        for section in ["is", "should", "want"]:
            for role in ["P", "A", "E", "I"]:
                expected = round(result["raw"][section][role] / 132 * 100)
                assert result["display"][section][role] == expected

    def test_profile_strings_present_for_all_sections(self):
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
                assert result["raw"][dim][role] == 0
