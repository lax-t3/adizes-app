"""Tests for the gap analysis service (v2: 3 gap types, 132-scale thresholds)."""

import pytest
from app.services.gap_analysis import compute_gaps, get_top_gaps, _severity


class TestSeverity:
    def test_low_below_6(self):
        assert _severity(0) == "low"
        assert _severity(5) == "low"

    def test_medium_6_to_15(self):
        assert _severity(6) == "medium"
        assert _severity(15) == "medium"

    def test_high_above_15(self):
        assert _severity(16) == "high"
        assert _severity(40) == "high"


class TestComputeGaps:
    def _raw(self, **overrides):
        base = {
            "is":     {"P": 33, "A": 33, "E": 33, "I": 33},
            "should": {"P": 33, "A": 33, "E": 33, "I": 33},
            "want":   {"P": 33, "A": 33, "E": 33, "I": 33},
        }
        base.update(overrides)
        return base

    def test_returns_4_roles(self):
        gaps = compute_gaps(self._raw())
        assert len(gaps) == 4
        assert {g["role"] for g in gaps} == {"P", "A", "E", "I"}

    def test_three_gap_types_per_role(self):
        gaps = compute_gaps(self._raw())
        for g in gaps:
            assert "execution_gap" in g
            assert "engagement_gap" in g
            assert "authenticity_gap" in g
            assert "execution_gap_signed" in g
            assert "engagement_gap_signed" in g
            assert "authenticity_gap_signed" in g
            assert "execution_severity" in g
            assert "engagement_severity" in g
            assert "authenticity_severity" in g

    def test_all_gaps_zero_when_equal(self):
        gaps = compute_gaps(self._raw())
        for g in gaps:
            assert g["execution_gap"] == 0
            assert g["engagement_gap"] == 0
            assert g["authenticity_gap"] == 0

    def test_execution_gap_is_should_minus_is(self):
        raw = self._raw(**{"should": {"P": 50, "A": 33, "E": 33, "I": 33}})
        gaps = compute_gaps(raw)
        p = next(g for g in gaps if g["role"] == "P")
        assert p["execution_gap"] == 17           # abs(50-33)
        assert p["execution_gap_signed"] == 17    # positive: role > current
        assert p["execution_severity"] == "high"

    def test_execution_gap_negative_signed(self):
        raw = self._raw(**{"is": {"P": 50, "A": 33, "E": 33, "I": 16}})
        gaps = compute_gaps(raw)
        p = next(g for g in gaps if g["role"] == "P")
        assert p["execution_gap_signed"] == -17   # IS > SHOULD

    def test_engagement_gap_is_should_minus_want(self):
        raw = self._raw(**{"want": {"P": 20, "A": 33, "E": 33, "I": 33}})
        gaps = compute_gaps(raw)
        p = next(g for g in gaps if g["role"] == "P")
        assert p["engagement_gap"] == 13          # abs(33-20)
        assert p["engagement_gap_signed"] == 13   # SHOULD > WANT
        assert p["engagement_severity"] == "medium"

    def test_authenticity_gap_is_is_minus_want(self):
        raw = self._raw(**{"want": {"P": 25, "A": 33, "E": 33, "I": 33}})
        gaps = compute_gaps(raw)
        p = next(g for g in gaps if g["role"] == "P")
        assert p["authenticity_gap"] == 8         # abs(33-25)
        assert p["authenticity_gap_signed"] == 8  # IS > WANT
        assert p["authenticity_severity"] == "medium"

    def test_scores_stored_in_gap_record(self):
        raw = self._raw()
        gaps = compute_gaps(raw)
        for g in gaps:
            assert "is_score" in g
            assert "should_score" in g
            assert "want_score" in g


class TestGetTopGaps:
    def _gaps_with_known_values(self):
        # Create gaps where E has highest execution (20), P has medium authenticity (10)
        raw = {
            "is":     {"P": 40, "A": 33, "E": 15, "I": 33},
            "should": {"P": 40, "A": 33, "E": 35, "I": 33},  # E execution = 20
            "want":   {"P": 30, "A": 33, "E": 33, "I": 33},  # P authenticity = 10
        }
        return compute_gaps(raw)

    def test_returns_top_3_by_default(self):
        gaps = self._gaps_with_known_values()
        top = get_top_gaps(gaps)
        assert len(top) == 3

    def test_sorted_by_absolute_magnitude(self):
        gaps = self._gaps_with_known_values()
        top = get_top_gaps(gaps)
        mags = [t["gap_abs"] for t in top]
        assert mags == sorted(mags, reverse=True)

    def test_each_item_has_required_fields(self):
        gaps = self._gaps_with_known_values()
        top = get_top_gaps(gaps)
        for t in top:
            assert "role" in t
            assert "gap_type" in t     # "execution" | "engagement" | "authenticity"
            assert "gap_abs" in t
            assert "gap_signed" in t
            assert "severity" in t

    def test_custom_n(self):
        gaps = self._gaps_with_known_values()
        assert len(get_top_gaps(gaps, n=1)) == 1
        assert len(get_top_gaps(gaps, n=5)) == 5

    def test_highest_gap_is_first(self):
        gaps = self._gaps_with_known_values()
        top = get_top_gaps(gaps, n=1)
        assert top[0]["role"] == "E"
        assert top[0]["gap_type"] == "execution"
        assert top[0]["gap_abs"] == 20
