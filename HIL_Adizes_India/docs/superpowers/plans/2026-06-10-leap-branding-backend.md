# LEAP™ Branding — Backend Email Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand all outbound email templates in `adizes-backend` — replace the dual-logo header with a text-only LEAP™ identity block, update enrollment email body copy and CTA labels, add a three-dimension pill graphic to enrollment emails, update subjects, and update sender name defaults.

**Architecture:** All changes are in `app/services/email_service.py` and `app/schemas/settings.py`. The HTML is assembled from Python string constants and functions — no templating engine, no external files. Tests live in `tests/test_email_templates.py` alongside existing tests. Deploy: `docker compose up --build -d` (templates are baked into the image at build time).

**Tech Stack:** Python 3.11, FastAPI, SMTP via `email_service.py`, pytest. Docker + ECR + AWS App Runner.

---

## File Map

| File | Change type | Summary |
|------|-------------|---------|
| `app/services/email_service.py` | Modify | Header block, footer block, dimension pills constant, all five body functions, DEFAULT_TEMPLATES subjects |
| `app/schemas/settings.py` | Modify | `SmtpConfig.from_name` default |
| `app/routers/settings.py` | Modify | Test-email `from_name` fallback |
| `tests/test_email_templates.py` | Modify | New test class for LEAP branding assertions |

---

### Task 1: Write failing tests

These tests verify all the changes in Tasks 2–6. Write them first; they will fail until the implementation is complete.

**Files:**
- Modify: `tests/test_email_templates.py`

- [ ] **Step 1: Add the new test class**

Open `tests/test_email_templates.py` and append the following class at the end of the file:

```python
class TestLeapBranding:
    def test_email_header_has_no_logo_images(self):
        from app.services.email_service import _EMAIL_WRAPPER_OPEN
        assert "logo.png" not in _EMAIL_WRAPPER_OPEN
        assert "hil_blue.png" not in _EMAIL_WRAPPER_OPEN

    def test_email_header_has_leap_identity(self):
        from app.services.email_service import _EMAIL_WRAPPER_OPEN
        assert "LEAP" in _EMAIL_WRAPPER_OPEN
        assert "Leadership Energy Alignment Profile" in _EMAIL_WRAPPER_OPEN
        assert "How you lead today" in _EMAIL_WRAPPER_OPEN

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
        cfg = SmtpConfig(from_name="Leap Invitation", from_email="x@x.com")
        assert cfg.from_name == "Leap Invitation"

    def test_smtp_config_schema_default_is_leap_invitation(self):
        from app.schemas.settings import SmtpConfig
        # Default value baked into the schema
        cfg = SmtpConfig(from_email="x@x.com")
        assert cfg.from_name == "Leap Invitation"
```

- [ ] **Step 2: Run tests — verify they all fail**

```bash
cd /Users/vrln/adizes-backend
python -m pytest tests/test_email_templates.py::TestLeapBranding -v
```
Expected: all new tests `FAILED`. If any pass already, double-check the test logic.

---

### Task 2: Update sender name defaults

**Files:**
- Modify: `app/schemas/settings.py`
- Modify: `app/services/email_service.py`
- Modify: `app/routers/settings.py`

- [ ] **Step 1: Update SmtpConfig default in schemas/settings.py**

Find:
```python
    from_name: str = "Adizes Platform"
```
Replace with:
```python
    from_name: str = "Leap Invitation"
```

- [ ] **Step 2: Update send_email() fallback in email_service.py**

Find:
```python
    msg["From"] = f"{cfg.get('from_name', 'Adizes')} <{cfg['from_email']}>"
```
Replace with:
```python
    msg["From"] = f"{cfg.get('from_name', 'Leap Invitation')} <{cfg['from_email']}>"
```

- [ ] **Step 3: Update test-email fallback in routers/settings.py**

Find (it appears in the test-email send call):
```python
        from_name=cfg.get("from_name", "Adizes Platform"),
```
Replace with:
```python
        from_name=cfg.get("from_name", "Leap Invitation"),
```

- [ ] **Step 4: Run the schema tests**

```bash
python -m pytest tests/test_email_templates.py::TestLeapBranding::test_smtp_config_schema_default_is_leap_invitation -v
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/schemas/settings.py app/services/email_service.py app/routers/settings.py
git commit -m "feat: update email sender default from_name to 'Leap Invitation'"
```

---

### Task 3: Update email subjects in DEFAULT_TEMPLATES

**Files:**
- Modify: `app/services/email_service.py`

- [ ] **Step 1: Update user_enrolled subject**

Find:
```python
        "subject": "You've been enrolled in {{cohort_name}} — {{platform_name}}",
        "html_body": _enrolled_html(),
```
Replace the subject line with:
```python
        "subject": "Ready for your LEAP™ Assessment? — {{cohort_name}}",
        "html_body": _enrolled_html(),
```

- [ ] **Step 2: Update assessment_complete subject**

Find:
```python
        "subject": "Your AMSI results are ready — {{platform_name}}",
```
Replace with:
```python
        "subject": "Your LEAP™ results are ready — {{platform_name}}",
```

- [ ] **Step 3: Update cohort_enrollment_existing subject**

Find the `cohort_enrollment_existing` entry in `DEFAULT_TEMPLATES`:
```python
        "subject": "You've been enrolled in {{cohort_name}} — {{platform_name}}",
        "html_body": _cohort_enrollment_existing_html(),
```
Replace the subject line with:
```python
        "subject": "Ready for your LEAP™ Assessment? — {{cohort_name}}",
        "html_body": _cohort_enrollment_existing_html(),
```

- [ ] **Step 4: Update org_welcome subject**

Find:
```python
        "subject": "You've been added to {{org_name}} on the Adizes PAEI Platform",
```
Replace with:
```python
        "subject": "You've been added to {{org_name}} on the LEAP™ Platform",
```

- [ ] **Step 5: Run subject tests**

```bash
python -m pytest tests/test_email_templates.py::TestLeapBranding::test_enrolled_subject_is_leap_branded tests/test_email_templates.py::TestLeapBranding::test_cohort_enrollment_existing_subject_is_leap_branded tests/test_email_templates.py::TestLeapBranding::test_assessment_complete_subject_is_leap_branded tests/test_email_templates.py::TestLeapBranding::test_org_welcome_subject_is_leap_branded -v
```
Expected: all 4 PASS.

- [ ] **Step 6: Commit**

```bash
git add app/services/email_service.py
git commit -m "feat: update email subjects to LEAP branding"
```

---

### Task 4: Replace email header block in _EMAIL_WRAPPER_OPEN

**Files:**
- Modify: `app/services/email_service.py`

- [ ] **Step 1: Replace the Logo header `<tr>` block**

In `_EMAIL_WRAPPER_OPEN`, find the entire `<!-- Logo header -->` `<tr>` block:

```python
  <!-- Logo header -->
  <tr>
    <td align="center" style="padding:32px 48px 28px;border-bottom:1px solid #e8e8e8;" bgcolor="#ffffff">
      <img src="{{platform_url}}/logo.png" alt="Adizes Institute" width="150" height="auto" style="display:block;margin:0 auto 14px;border:0;max-width:150px;" />
      <img src="{{platform_url}}/hil_blue.png" alt="Heartfulness Institute of Leadership" width="110" height="auto" style="display:block;margin:0 auto;border:0;max-width:110px;" />
    </td>
  </tr>"""
```

Replace it with (note the `"""` closing delimiter must be preserved at the end):

```python
  <!-- LEAP identity header — text only, works in all email clients -->
  <tr>
    <td align="center" style="padding:32px 48px 28px;border-bottom:1px solid #e8e8e8;background-color:#ffffff;" bgcolor="#ffffff">
      <p style="margin:0 0 4px;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:700;color:#C8102E;letter-spacing:1px;">LEAP&#8482;</p>
      <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#1D3557;letter-spacing:1px;text-transform:uppercase;">Leadership Energy Alignment Profile</p>
      <table role="presentation" width="260" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 12px;border-top:1px solid #e8e8e8;">
        <tr><td style="padding:12px 0 0;">
          <p style="margin:0 0 5px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#555555;">Understand the gap between:</p>
          <p style="margin:0 0 3px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#333333;">&#10003; How you lead today</p>
          <p style="margin:0 0 3px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#333333;">&#10003; What your role requires</p>
          <p style="margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#333333;">&#10003; What naturally energizes you</p>
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#999999;">15 minutes &nbsp;&middot;&nbsp; Personalized report &nbsp;&middot;&nbsp; Immediate insights</p>
        </td></tr>
      </table>
    </td>
  </tr>"""
```

- [ ] **Step 2: Run header tests**

```bash
python -m pytest tests/test_email_templates.py::TestLeapBranding::test_email_header_has_no_logo_images tests/test_email_templates.py::TestLeapBranding::test_email_header_has_leap_identity -v
```
Expected: both PASS.

- [ ] **Step 3: Commit**

```bash
git add app/services/email_service.py
git commit -m "feat: replace email logo header with text-only LEAP identity block"
```

---

### Task 5: Add _DIMENSION_PILLS constant and update enrollment email functions

**Files:**
- Modify: `app/services/email_service.py`

- [ ] **Step 1: Add the _DIMENSION_PILLS module-level constant**

Add the following constant immediately after the `_CTA_BUTTON` constant (around line 50 in the file, after the `"""` closing the CTA template):

```python
_DIMENSION_PILLS = """\
  <!-- Three-dimension pills -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center" style="padding:8px 10px;background-color:#C8102E;border-radius:4px;">
              <span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:600;color:#ffffff;white-space:nowrap;">Current State (IS)</span>
            </td>
            <td style="width:8px;"></td>
            <td align="center" style="padding:8px 10px;background-color:#1D3557;border-radius:4px;">
              <span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:600;color:#ffffff;white-space:nowrap;">Role Expectations (SHOULD)</span>
            </td>
            <td style="width:8px;"></td>
            <td align="center" style="padding:8px 10px;background-color:#2A9D8F;border-radius:4px;">
              <span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:600;color:#ffffff;white-space:nowrap;">Intrinsic Preference (WANT)</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>"""
```

- [ ] **Step 2: Update _enrolled_html() — body copy and add pills**

Replace the entire `_enrolled_html()` function with:

```python
def _enrolled_html() -> str:
    cta = _cta("{{invite_link}}", "Accept Invitation &amp; Set Password")
    body = f"""
  <!-- Body -->
  <tr>
    <td style="padding:40px 48px 36px;" bgcolor="#ffffff">
      <p style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#1a1a1a;font-weight:400;line-height:1.35;">Hello {{{{user_name}}}},</p>
      <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.75;">You have been enrolled in the <strong style="color:#1a1a1a;">{{{{cohort_name}}}}</strong> cohort for <strong style="color:#1a1a1a;">LEAP&#8482; &#8212; Leadership Energy Alignment Profile</strong>.</p>
      <p style="margin:0 0 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.75;">Please click the button below to activate your account and set your password. This link is valid for <strong>1 hour</strong>.</p>
      {cta}
      {_DIMENSION_PILLS}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0 24px;"><tr><td style="border-top:1px solid #e8e8e8;font-size:1px;line-height:1px;">&nbsp;</td></tr></table>
      <p style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#666666;line-height:1.7;">Already have an account? Sign in at <a href="{{{{platform_url}}}}" style="color:#C8102E;text-decoration:none;">{{{{platform_url}}}}</a></p>
      <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#999999;line-height:1.6;">If the button above does not work, copy and paste this link into your browser:</p>
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#bbbbbb;word-break:break-all;">{{{{invite_link}}}}</p>
    </td>
  </tr>"""
    return _build_template("user_email", body)
```

- [ ] **Step 3: Update _cohort_enrollment_existing_html() — CTA label, body copy, add pills**

Replace the entire `_cohort_enrollment_existing_html()` function with:

```python
def _cohort_enrollment_existing_html() -> str:
    cta = _cta("{{platform_url}}", "Begin My LEAP&#8482; Assessment")
    body = f"""
  <!-- Body -->
  <tr>
    <td style="padding:40px 48px 36px;" bgcolor="#ffffff">
      <p style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#1a1a1a;font-weight:400;line-height:1.35;">Hello {{{{user_name}}}},</p>
      <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.75;">You have been enrolled in the <strong style="color:#1a1a1a;">{{{{cohort_name}}}}</strong> cohort for <strong style="color:#1a1a1a;">LEAP&#8482; &#8212; Leadership Energy Alignment Profile</strong>.</p>
      <p style="margin:0 0 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.75;">Log in to your dashboard to begin the assessment for this cohort. It takes approximately 15 minutes to complete.</p>
      {cta}
      {_DIMENSION_PILLS}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0 24px;"><tr><td style="border-top:1px solid #e8e8e8;font-size:1px;line-height:1px;">&nbsp;</td></tr></table>
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#666666;line-height:1.75;">Sign in at <a href="{{{{platform_url}}}}" style="color:#C8102E;text-decoration:none;">{{{{platform_url}}}}</a></p>
    </td>
  </tr>"""
    return _build_template("user_email", body)
```

- [ ] **Step 4: Run enrollment tests**

```bash
python -m pytest tests/test_email_templates.py::TestLeapBranding::test_enrolled_html_uses_leap_branding tests/test_email_templates.py::TestLeapBranding::test_enrolled_html_has_dimension_pills tests/test_email_templates.py::TestLeapBranding::test_enrolled_html_cta_label_unchanged tests/test_email_templates.py::TestLeapBranding::test_cohort_enrollment_existing_cta_is_begin_leap tests/test_email_templates.py::TestLeapBranding::test_cohort_enrollment_existing_has_dimension_pills tests/test_email_templates.py::TestLeapBranding::test_cohort_enrollment_existing_uses_leap_branding -v
```
Expected: all 6 PASS.

- [ ] **Step 5: Commit**

```bash
git add app/services/email_service.py
git commit -m "feat: enrollment emails — LEAP branding, Begin My LEAP CTA, dimension pills"
```

---

### Task 6: Update remaining email body functions

**Files:**
- Modify: `app/services/email_service.py`

- [ ] **Step 1: Update _org_welcome_html()**

In `_org_welcome_html()`, find:
```python
      <p style="..."><strong style="color:#1a1a1a;">{{{{org_name}}}}</strong> has registered you on the <strong style="color:#1a1a1a;">Adizes PAEI Assessment Platform</strong>.</p>
```
Replace the strong text:
```python
      <p style="..."><strong style="color:#1a1a1a;">{{{{org_name}}}}</strong> has registered you on the <strong style="color:#1a1a1a;">LEAP&#8482; Platform</strong>.</p>
```

- [ ] **Step 2: Update _assessment_complete_html()**

In `_assessment_complete_html()`, find:
```python
      <p style="...">You have successfully completed the <strong style="color:#1a1a1a;">Adizes Management Style Assessment (AMSI)</strong> for the <strong ...>
```
Replace the first strong text:
```python
      <p style="...">You have successfully completed the <strong style="color:#1a1a1a;">LEAP&#8482; &#8212; Leadership Energy Alignment Profile</strong> for the <strong ...>
```

Also in `_assessment_complete_html()`, find the footer paragraph:
```python
      <p style="...">Thank you for your participation. Your results contribute to a richer collective picture of your team's management style.</p>
```
Replace with:
```python
      <p style="...">Thank you for your participation. Your LEAP™ profile is a practical tool for understanding your leadership alignment and development priorities.</p>
```

- [ ] **Step 3: Run remaining body tests**

```bash
python -m pytest tests/test_email_templates.py::TestLeapBranding::test_org_welcome_uses_leap_platform_name tests/test_email_templates.py::TestLeapBranding::test_assessment_complete_uses_leap_branding -v
```
Expected: both PASS.

- [ ] **Step 4: Commit**

```bash
git add app/services/email_service.py
git commit -m "feat: update org_welcome and assessment_complete emails to LEAP branding"
```

---

### Task 7: Update email footer in _EMAIL_WRAPPER_CLOSE

**Files:**
- Modify: `app/services/email_service.py`

- [ ] **Step 1: Replace the logo img row in the footer**

In `_EMAIL_WRAPPER_CLOSE`, find the `<tr>` that contains the `hil_blue.png` image:

```python
        <tr><td align="center" style="padding:20px 48px 12px;">
          <img src="{{platform_url}}/hil_blue.png" alt="Heartfulness Institute of Leadership" width="80" height="auto" style="display:block;margin:0 auto;border:0;max-width:80px;" />
        </td></tr>
```

Replace with:

```python
        <tr><td align="center" style="padding:20px 48px 4px;">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#888888;">Developed by Heartfulness Institute of Leadership</p>
        </td></tr>
```

- [ ] **Step 2: Run footer tests**

```bash
python -m pytest tests/test_email_templates.py::TestLeapBranding::test_email_footer_has_no_logo_images tests/test_email_templates.py::TestLeapBranding::test_email_footer_has_hil_attribution -v
```
Expected: both PASS.

- [ ] **Step 3: Run the full TestLeapBranding suite**

```bash
python -m pytest tests/test_email_templates.py::TestLeapBranding -v
```
Expected: all tests PASS.

- [ ] **Step 4: Run the full test file to verify no regressions**

```bash
python -m pytest tests/test_email_templates.py -v
```
Expected: all tests (including existing `TestPasswordResetTemplate` and `TestOrgWelcomeTemplate`) PASS.

- [ ] **Step 5: Commit**

```bash
git add app/services/email_service.py tests/test_email_templates.py
git commit -m "feat: replace email logo footer with HIL text attribution — all LEAP branding complete"
```

---

### Task 8: Local Docker verification

- [ ] **Step 1: Rebuild and restart the backend container**

```bash
cd /Users/vrln/adizes-backend
docker compose up --build -d
```
Wait for the build to complete. Expected output ends with: `Container adizes-backend  Started`.

- [ ] **Step 2: Confirm the container is running**

```bash
docker ps | grep adizes-backend
```
Expected: one running container.

- [ ] **Step 3: Send a test email via the admin panel**

Open http://localhost:3000, log in as `admin@adizes.com` / `Admin@1234`. Navigate to **Admin → Settings → Email**. Click "Send test email".

Check the test email inbox. Verify:
- Header shows the LEAP™ text block (red "LEAP™" title, "Leadership Energy Alignment Profile" subtitle, three checkmark lines)
- No logo images in the header
- Footer shows "Developed by Heartfulness Institute of Leadership" (text only, no logo image)

- [ ] **Step 4: Trigger a test enrollment email (optional but recommended)**

In the admin panel, enroll a test user into a cohort using `user@adizes.com`. Check the email received. Verify:
- Subject: "Ready for your LEAP™ Assessment? — [cohort name]"
- Body references "LEAP™ — Leadership Energy Alignment Profile" (not "AMSI")
- Three coloured pill boxes appear below the CTA: Current State (red), Role Expectations (navy), Intrinsic Preference (teal)
- CTA button reads "Begin My LEAP™ Assessment" for existing users

---

## Deploy

### Admin config update (do this before the ECR push)

In the admin SMTP settings panel (http://localhost:3000 admin → Settings → Email), update:
- **From name**: `Leap Invitation`
- **From email**: `noreply@turiyaskills.co`

This change must also be applied in the **production admin panel** after the ECR deploy.

### ECR push

```bash
cd /Users/vrln/adizes-backend

AWS_ACCOUNT_ID=094492115510
AWS_REGION=ap-south-1
ECR_REPO=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/adizes-backend

# Authenticate
AWS_PROFILE=lax-t3-assumed aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Build for linux/amd64 (required on Apple Silicon)
docker buildx build --platform linux/amd64 --provenance=false -t $ECR_REPO:latest .

# Push — App Runner auto-deploys on new image
docker push $ECR_REPO:latest
```

App Runner auto-deploys on the new image push. After the deploy completes, update the production SMTP config via the production admin panel (From name: `Leap Invitation`, From email: `noreply@turiyaskills.co`).
