"""Tests for email template rendering."""


class TestPasswordResetTemplate:
    def test_renders_user_name(self):
        from app.services.email_service import _render, DEFAULT_TEMPLATES
        tmpl = DEFAULT_TEMPLATES["password_reset"]
        result = _render(tmpl["html_body"], {
            "user_name": "Jane Smith",
            "reset_link": "https://example.com/reset-password#token=abc",
            "platform_name": "Adizes India",
            "platform_url": "https://adizes-app.turiyaskills.co",
        })
        assert "Jane Smith" in result
        assert "Set New Password" in result
        assert "https://example.com/reset-password#token=abc" in result
        assert "1 hour" in result

    def test_org_welcome_contains_expiry_note(self):
        from app.services.email_service import DEFAULT_TEMPLATES
        html = DEFAULT_TEMPLATES["org_welcome"]["html_body"]
        assert "24 hours" in html
        assert "reset your password" in html.lower()
