"""Unit tests for forgot-password schema validation."""
import pytest
from pydantic import ValidationError
from app.schemas.auth import ForgotPasswordRequest, ForgotPasswordResponse


class TestForgotPasswordSchemas:
    def test_valid_request(self):
        req = ForgotPasswordRequest(email="user@example.com")
        assert req.email == "user@example.com"

    def test_invalid_email_raises(self):
        with pytest.raises(ValidationError):
            ForgotPasswordRequest(email="not-an-email")

    def test_response_sent(self):
        resp = ForgotPasswordResponse(status="sent")
        assert resp.status == "sent"

    def test_response_not_activated(self):
        resp = ForgotPasswordResponse(status="not_activated")
        assert resp.status == "not_activated"
