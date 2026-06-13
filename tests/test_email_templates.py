"""Tests for email template rendering."""
from app.services.email_service import _render, DEFAULT_TEMPLATES


class TestPasswordResetTemplate:
    def test_renders_variables(self):
        tmpl = DEFAULT_TEMPLATES["password_reset"]
        result = _render(tmpl["html_body"], {
            "user_name": "Jane Smith",
            "reset_link": "https://example.com/reset-password#token=abc",
            "platform_name": "Adizes India",
            "platform_url": "https://leap.turiyaskills.co",
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


class TestLeapBranding:
    def test_email_header_has_no_logo_images(self):
        from app.services.email_service import _EMAIL_WRAPPER_OPEN
        assert "logo.png" not in _EMAIL_WRAPPER_OPEN
        assert "hil_blue.png" not in _EMAIL_WRAPPER_OPEN

    def test_email_header_has_leap_identity(self):
        # Canonical email header (CLAUDE.md brand spec): navy band with LEAP™ +
        # the "Leadership Energy Alignment Profile" descriptor.
        from app.services.email_service import _EMAIL_WRAPPER_OPEN
        assert "LEAP" in _EMAIL_WRAPPER_OPEN
        assert "Leadership Energy Alignment Profile" in _EMAIL_WRAPPER_OPEN

    def test_email_footer_has_no_logo_images(self):
        from app.services.email_service import _EMAIL_WRAPPER_CLOSE
        assert "hil_blue.png" not in _EMAIL_WRAPPER_CLOSE

    def test_email_footer_has_hil_attribution(self):
        from app.services.email_service import _EMAIL_WRAPPER_CLOSE
        assert "Heartfulness Institute of Leadership" in _EMAIL_WRAPPER_CLOSE

    def test_enrolled_html_uses_leap_branding(self):
        from app.services.email_service import _enrolled_html
        html = _enrolled_html()
        assert "LEAP" in html
        assert "Leadership Energy Alignment Profile" in html
        assert "Adizes Management Style Assessment" not in html
        assert "AMSI" not in html

    def test_enrolled_html_has_dimension_pills(self):
        from app.services.email_service import _enrolled_html
        html = _enrolled_html()
        assert "Current State (IS)" in html
        assert "Role Expectations (SHOULD)" in html
        assert "Intrinsic Preference (WANT)" in html

    def test_enrolled_html_cta_label_unchanged(self):
        from app.services.email_service import _enrolled_html
        html = _enrolled_html()
        assert "Accept Invitation" in html

    def test_cohort_enrollment_existing_cta_is_begin_leap(self):
        from app.services.email_service import _cohort_enrollment_existing_html
        html = _cohort_enrollment_existing_html()
        assert "Begin My LEAP" in html
        assert "Go to Dashboard" not in html

    def test_cohort_enrollment_existing_has_dimension_pills(self):
        from app.services.email_service import _cohort_enrollment_existing_html
        html = _cohort_enrollment_existing_html()
        assert "Current State (IS)" in html
        assert "Role Expectations (SHOULD)" in html
        assert "Intrinsic Preference (WANT)" in html

    def test_cohort_enrollment_existing_uses_leap_branding(self):
        from app.services.email_service import _cohort_enrollment_existing_html
        html = _cohort_enrollment_existing_html()
        assert "LEAP" in html
        assert "Adizes Management Style Assessment" not in html

    def test_org_welcome_uses_leap_platform_name(self):
        from app.services.email_service import _org_welcome_html
        html = _org_welcome_html()
        assert "LEAP" in html
        assert "Adizes PAEI Assessment Platform" not in html

    def test_assessment_complete_uses_leap_branding(self):
        from app.services.email_service import _assessment_complete_html
        html = _assessment_complete_html()
        assert "LEAP" in html
        assert "Adizes Management Style Assessment" not in html

    def test_enrolled_subject_is_leap_branded(self):
        from app.services.email_service import DEFAULT_TEMPLATES
        assert "LEAP" in DEFAULT_TEMPLATES["user_enrolled"]["subject"]
        assert "Ready for your LEAP" in DEFAULT_TEMPLATES["user_enrolled"]["subject"]

    def test_cohort_enrollment_existing_subject_is_leap_branded(self):
        from app.services.email_service import DEFAULT_TEMPLATES
        assert "Ready for your LEAP" in DEFAULT_TEMPLATES["cohort_enrollment_existing"]["subject"]

    def test_assessment_complete_subject_is_leap_branded(self):
        from app.services.email_service import DEFAULT_TEMPLATES
        assert "LEAP" in DEFAULT_TEMPLATES["assessment_complete"]["subject"]
        assert "AMSI" not in DEFAULT_TEMPLATES["assessment_complete"]["subject"]

    def test_org_welcome_subject_is_leap_branded(self):
        from app.services.email_service import DEFAULT_TEMPLATES
        assert "LEAP" in DEFAULT_TEMPLATES["org_welcome"]["subject"]
        assert "Adizes PAEI Platform" not in DEFAULT_TEMPLATES["org_welcome"]["subject"]

    def test_smtp_config_default_from_name(self):
        from app.schemas.settings import SmtpConfig
        cfg = SmtpConfig(from_name="Leap Invitation", from_email="x@x.com", host="smtp.example.com")
        assert cfg.from_name == "Leap Invitation"

    def test_smtp_config_schema_default_is_leap_invitation(self):
        from app.schemas.settings import SmtpConfig
        cfg = SmtpConfig(from_email="x@x.com", host="smtp.example.com")
        assert cfg.from_name == "Leap Invitation"
