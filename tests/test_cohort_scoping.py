"""Tests for cohort-scoped assessment schemas and logic."""
import pytest
from pydantic import ValidationError
from app.schemas.assessment import SubmitRequest, AnswerInput
from app.services.email_service import DEFAULT_TEMPLATES, _render


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


class TestCohortEnrollmentExistingTemplate:
    def test_template_exists(self):
        assert "cohort_enrollment_existing" in DEFAULT_TEMPLATES

    def test_template_has_required_fields(self):
        tmpl = DEFAULT_TEMPLATES["cohort_enrollment_existing"]
        assert "subject" in tmpl
        assert "html_body" in tmpl

    def test_template_subject_renders(self):
        tmpl = DEFAULT_TEMPLATES["cohort_enrollment_existing"]
        rendered = _render(tmpl["subject"], {
            "cohort_name": "Batch 2026",
            "platform_name": "Adizes India",
        })
        assert "Batch 2026" in rendered
        assert "Adizes India" in rendered

    def test_template_body_has_no_invite_link_placeholder(self):
        tmpl = DEFAULT_TEMPLATES["cohort_enrollment_existing"]
        # This template should NOT include {{invite_link}} — no activation needed
        assert "{{invite_link}}" not in tmpl["html_body"]

    def test_template_body_has_platform_url_cta(self):
        tmpl = DEFAULT_TEMPLATES["cohort_enrollment_existing"]
        assert "{{platform_url}}" in tmpl["html_body"]
