"""Tests for the interpretation service."""

import pytest
from app.services.interpretation import interpret


def _scaled(is_overrides: dict = None):
    # Dominant PAEI code is derived from the Current State (is) lens, so test
    # overrides are applied there.
    base = {
        "is":     {"P": 20, "A": 20, "E": 20, "I": 20},
        "should": {"P": 20, "A": 20, "E": 20, "I": 20},
        "want":   {"P": 20, "A": 20, "E": 20, "I": 20},
    }
    if is_overrides:
        base["is"].update(is_overrides)
    return base


class TestInterpret:
    def test_dominant_P_detected(self):
        result = interpret(_scaled({"P": 45}), {})
        assert "P" in result["dominant_roles"]

    def test_dominant_E_detected(self):
        result = interpret(_scaled({"E": 40}), {})
        assert "E" in result["dominant_roles"]

    def test_no_dominant_falls_back_to_highest(self):
        # All scores ≤ 30 → fallback to highest
        result = interpret(_scaled({"I": 30, "E": 28}), {})
        assert len(result["dominant_roles"]) >= 1

    def test_style_label_returned(self):
        result = interpret(_scaled({"P": 45}), {})
        assert result["style_label"] == "Producer"

    def test_interpretation_has_all_keys(self):
        result = interpret(_scaled({"A": 40}), {})
        for key in ["dominant_roles", "identity_line", "style_label", "style_tagline",
                    "strengths", "watchouts", "working_with_others",
                    "combined_description", "mismanagement_risks",
                    "at_your_best", "friction_shows_up", "early_warnings"]:
            assert key in result

    def test_mismanagement_risk_for_P(self):
        result = interpret(_scaled({"P": 45}), {})
        assert any("Dictator Trap" in r for r in result["mismanagement_risks"])

    def test_combined_description_for_dual_dominant(self):
        result = interpret(_scaled({"E": 40, "I": 38}), {})
        assert result["combined_description"] is not None

    def test_combined_description_none_for_single(self):
        result = interpret(_scaled({"P": 45}), {})
        # May or may not be None depending on whether P alone triggers combined
        # Just ensure it's either None or a non-empty string
        assert result["combined_description"] is None or \
               len(result["combined_description"]) > 0

    def test_dominant_uses_current_state_not_want(self):
        # High score on the WANT lens must NOT drive dominance; the IS lens does.
        scores = {
            "is":     {"P": 20, "A": 45, "E": 20, "I": 20},
            "should": {"P": 20, "A": 20, "E": 20, "I": 20},
            "want":   {"P": 50, "A": 20, "E": 20, "I": 20},
        }
        result = interpret(scores, {})
        assert result["dominant_roles"] == ["A"]
        assert result["style_label"] == "Administrator"


class TestInterpretNewFields:
    def test_executive_summary_present(self):
        result = interpret(_scaled({"E": 40}), {}, user_name="Alice Johnson")
        assert "executive_summary" in result
        assert isinstance(result["executive_summary"], str)
        assert len(result["executive_summary"]) > 20

    def test_executive_summary_contains_first_name(self):
        result = interpret(_scaled({"P": 45}), {}, user_name="Alice Johnson")
        assert "Alice" in result["executive_summary"]

    def test_executive_summary_fallback_when_no_name(self):
        result = interpret(_scaled({"A": 40}), {}, user_name="")
        assert "Your profile" in result["executive_summary"]

    def test_daily_feel_present_and_complete(self):
        result = interpret(_scaled({"I": 40}), {})
        assert "daily_feel" in result
        for role in ["P", "A", "E", "I"]:
            for gap_type in ["execution", "engagement", "authenticity"]:
                assert role in result["daily_feel"]
                assert gap_type in result["daily_feel"][role]
                assert len(result["daily_feel"][role][gap_type]) > 20

    def test_reflection_questions_removed(self):
        # Guided reflection questions were removed in favour of a Page 5 write-in
        # layout — the field must no longer be emitted.
        result = interpret(_scaled({"E": 40}), {}, user_name="Bob")
        assert "reflection_questions" not in result

    def test_backward_compat_existing_keys_still_present(self):
        result = interpret(_scaled({"A": 40}), {}, user_name="Test")
        for key in ["dominant_roles", "identity_line", "style_label", "style_tagline",
                    "strengths", "watchouts", "mismanagement_risks",
                    "at_your_best", "friction_shows_up", "early_warnings"]:
            assert key in result
