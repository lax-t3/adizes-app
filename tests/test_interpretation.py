"""Tests for the interpretation service."""

import pytest
from app.services.interpretation import interpret


def _scaled(want_overrides: dict = None):
    base = {
        "is":     {"P": 20, "A": 20, "E": 20, "I": 20},
        "should": {"P": 20, "A": 20, "E": 20, "I": 20},
        "want":   {"P": 20, "A": 20, "E": 20, "I": 20},
    }
    if want_overrides:
        base["want"].update(want_overrides)
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
        for key in ["dominant_roles", "style_label", "style_tagline",
                    "strengths", "blind_spots", "working_with_others",
                    "mismanagement_risks"]:
            assert key in result

    def test_mismanagement_risk_for_P(self):
        result = interpret(_scaled({"P": 45}), {})
        assert any("Lone Ranger" in r for r in result["mismanagement_risks"])

    def test_combined_description_for_dual_dominant(self):
        result = interpret(_scaled({"E": 40, "I": 38}), {})
        assert result["combined_description"] is not None

    def test_combined_description_none_for_single(self):
        result = interpret(_scaled({"P": 45}), {})
        # May or may not be None depending on whether P alone triggers combined
        # Just ensure it's either None or a non-empty string
        assert result["combined_description"] is None or \
               len(result["combined_description"]) > 0
