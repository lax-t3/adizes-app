"""Tests for cohort-scoped assessment schemas and logic."""
import pytest
from pydantic import ValidationError
from app.schemas.assessment import SubmitRequest, AnswerInput


def _make_answer(q: int) -> dict:
    return {"question_index": q, "ranks": {"a": 1, "b": 2, "c": 3, "d": 4}}


class TestSubmitRequestCohortId:
    def test_submit_request_requires_cohort_id(self):
        with pytest.raises(ValidationError):
            SubmitRequest(answers=[AnswerInput(**_make_answer(i)) for i in range(36)])

    def test_submit_request_accepts_cohort_id(self):
        req = SubmitRequest(
            cohort_id="00000000-0000-0000-0000-000000000001",
            answers=[AnswerInput(**_make_answer(i)) for i in range(36)],
        )
        assert req.cohort_id == "00000000-0000-0000-0000-000000000001"

    def test_submit_request_rejects_empty_cohort_id(self):
        with pytest.raises(ValidationError):
            SubmitRequest(
                cohort_id="",
                answers=[AnswerInput(**_make_answer(i)) for i in range(36)],
            )
