"""Tests for the gap analysis service."""

import pytest
from app.services.gap_analysis import compute_gaps, _severity


class TestSeverity:
    def test_aligned(self):
        assert _severity(0) == "aligned"
        assert _severity(4) == "aligned"

    def test_watch(self):
        assert _severity(5) == "watch"
        assert _severity(6) == "watch"

    def test_tension(self):
        assert _severity(7) == "tension"
        assert _severity(20) == "tension"


class TestComputeGaps:
    def _scaled(self, **overrides):
        base = {
            "is":     {"P": 20, "A": 20, "E": 20, "I": 20},
            "should": {"P": 20, "A": 20, "E": 20, "I": 20},
            "want":   {"P": 20, "A": 20, "E": 20, "I": 20},
        }
        base.update(overrides)
        return base

    def test_returns_4_roles(self):
        gaps = compute_gaps(self._scaled())
        assert len(gaps) == 4
        roles = {g["role"] for g in gaps}
        assert roles == {"P", "A", "E", "I"}

    def test_all_aligned_when_equal(self):
        gaps = compute_gaps(self._scaled())
        for g in gaps:
            assert g["external_gap"] == 0
            assert g["internal_gap"] == 0
            assert g["external_severity"] == "aligned"
            assert g["internal_severity"] == "aligned"

    def test_external_gap_calculation(self):
        scaled = self._scaled(
            **{"should": {"P": 35, "A": 20, "E": 20, "I": 20}}
        )
        gaps = compute_gaps(scaled)
        p_gap = next(g for g in gaps if g["role"] == "P")
        assert p_gap["external_gap"] == 15
        assert p_gap["external_severity"] == "tension"

    def test_internal_gap_calculation(self):
        scaled = self._scaled(
            **{"want": {"P": 20, "A": 20, "E": 30, "I": 20}}
        )
        gaps = compute_gaps(scaled)
        e_gap = next(g for g in gaps if g["role"] == "E")
        assert e_gap["internal_gap"] == 10
        assert e_gap["internal_severity"] == "tension"

    def test_gap_message_present_for_tension(self):
        scaled = self._scaled(
            **{"should": {"P": 40, "A": 20, "E": 20, "I": 20}}
        )
        gaps = compute_gaps(scaled)
        p_gap = next(g for g in gaps if g["role"] == "P")
        assert len(p_gap["external_message"]) > 0

    def test_aligned_message_is_short(self):
        gaps = compute_gaps(self._scaled())
        for g in gaps:
            assert "aligned" in g["external_message"].lower() or \
                   g["external_message"] == "Well aligned — no significant gap."
