"""Tests for email template rendering."""
from app.services.email_service import _render, DEFAULT_TEMPLATES


class TestPasswordResetTemplate:
    def test_renders_variables(self):
        tmpl = DEFAULT_TEMPLATES["password_reset"]
        result = _render(tmpl["html_body"], {
            "user_name": "Jane Smith",
            "reset_link": "https://example.com/reset-password#token=abc",
            "platform_name": "Adizes India",
            "platform_url": "https://adizes-app.turiyaskills.co",
        })
        # Variable substitution confirmed
        assert "Jane Smith" in result
        assert "Adizes India" in result
        assert "https://example.com/reset-password#token=abc" in result
        # Placeholder NOT literally present (substitution happened)
        assert "{{reset_link}}" not in result
        assert "{{user_name}}" not in result
        # Required content
        assert "Set New Password" in result
        assert "1 hour" in result

    def test_password_reset_in_default_templates(self):
        assert "password_reset" in DEFAULT_TEMPLATES
        tmpl = DEFAULT_TEMPLATES["password_reset"]
        assert tmpl["id"] == "password_reset"
        assert "platform_name" in tmpl["subject"]


class TestOrgWelcomeTemplate:
    def test_contains_expiry_note(self):
        html = DEFAULT_TEMPLATES["org_welcome"]["html_body"]
        assert "24 hours" in html
        assert "reset your password" in html.lower()
        # Confirm not a placeholder
        assert "{24 hours}" not in html
