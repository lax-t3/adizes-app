"""
SMTP email service.
Reads config from app_settings.key='smtp' in Supabase.
Reads templates from email_templates table.
Falls back gracefully if SMTP not configured.
"""
import smtplib, ssl, re
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from app.database import supabase_admin


_EMAIL_WRAPPER_OPEN = """\
<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<title>{{platform_name}}</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f0f0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f0f0;">
<tr><td align="center" style="padding:40px 16px 40px;">
<!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;">
  <!-- Red accent bar -->
  <tr><td style="background-color:#C8102E;height:5px;font-size:1px;line-height:1px;" bgcolor="#C8102E">&nbsp;</td></tr>
  <!-- Logo header -->
  <tr>
    <td align="center" style="padding:32px 48px 28px;border-bottom:1px solid #e8e8e8;" bgcolor="#ffffff">
      <img src="{{platform_url}}/logo.png" alt="Adizes Institute" width="150" height="auto" style="display:block;margin:0 auto 14px;border:0;max-width:150px;" />
      <img src="{{platform_url}}/hil_blue.png" alt="Heartfulness Institute of Leadership" width="110" height="auto" style="display:block;margin:0 auto;border:0;max-width:110px;" />
    </td>
  </tr>"""

_EMAIL_WRAPPER_CLOSE = """\
  <!-- Footer -->
  <tr>
    <td style="padding:0;background-color:#f8f8f8;border-top:1px solid #e8e8e8;" bgcolor="#f8f8f8">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td align="center" style="padding:20px 48px 12px;">
          <img src="{{platform_url}}/hil_blue.png" alt="Heartfulness Institute of Leadership" width="80" height="auto" style="display:block;margin:0 auto;border:0;max-width:80px;" />
        </td></tr>
        <tr><td align="center" style="padding:0 48px 24px;">
          <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#aaaaaa;line-height:1.6;">This email was sent to {{recipient_email}}</p>
          <p style="margin:4px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#aaaaaa;">&copy; {{platform_name}} &middot; Powered by Turiyaskills</p>
        </td></tr>
      </table>
    </td>
  </tr>
  <!-- Bottom red accent -->
  <tr><td style="background-color:#C8102E;height:3px;font-size:1px;line-height:1px;" bgcolor="#C8102E">&nbsp;</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>"""

_CTA_BUTTON = """\
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
  <tr>
    <td align="center" bgcolor="#C8102E" style="background-color:#C8102E;border-radius:3px;">
      <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{url}" style="height:50px;v-text-anchor:middle;width:240px;" arcsize="5%%" stroke="f" fillcolor="#C8102E"><w:anchorlock/><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:600;">{label}</center></v:roundrect><![endif]-->
      <!--[if !mso]><!--><a href="{url}" style="display:inline-block;padding:15px 40px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:3px;mso-hide:all;">{label}</a><!--<![endif]-->
    </td>
  </tr>
</table>"""


def _cta(url_var: str, label: str) -> str:
    return _CTA_BUTTON.format(url=url_var, label=label)


def _build_template(recipient_var: str, body_rows: str) -> str:
    """Assemble a full email HTML string, substituting the recipient email variable."""
    wrapper_close = _EMAIL_WRAPPER_CLOSE.replace("{{recipient_email}}", f"{{{{{recipient_var}}}}}")
    return _EMAIL_WRAPPER_OPEN + body_rows + wrapper_close


def _enrolled_html() -> str:
    cta = _cta("{{invite_link}}", "Accept Invitation &amp; Set Password")
    body = f"""
  <!-- Body -->
  <tr>
    <td style="padding:40px 48px 36px;" bgcolor="#ffffff">
      <p style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#1a1a1a;font-weight:400;line-height:1.35;">Hello {{{{user_name}}}},</p>
      <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.75;">You have been enrolled in the <strong style="color:#1a1a1a;">{{{{cohort_name}}}}</strong> cohort for the <strong style="color:#1a1a1a;">Adizes Management Style Assessment (AMSI)</strong>.</p>
      <p style="margin:0 0 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.75;">Please click the button below to activate your account and set your password. This link is valid for <strong>1 hour</strong>.</p>
      {cta}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0 24px;"><tr><td style="border-top:1px solid #e8e8e8;font-size:1px;line-height:1px;">&nbsp;</td></tr></table>
      <p style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#666666;line-height:1.7;">Already have an account? Sign in at <a href="{{{{platform_url}}}}" style="color:#C8102E;text-decoration:none;">{{{{platform_url}}}}</a></p>
      <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#999999;line-height:1.6;">If the button above does not work, copy and paste this link into your browser:</p>
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#bbbbbb;word-break:break-all;">{{{{invite_link}}}}</p>
    </td>
  </tr>"""
    return _build_template("user_email", body)


def _admin_invite_html() -> str:
    cta = _cta("{{invite_link}}", "Set Password &amp; Access Admin Panel")
    body = f"""
  <!-- Body -->
  <tr>
    <td style="padding:40px 48px 36px;" bgcolor="#ffffff">
      <p style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#1a1a1a;font-weight:400;line-height:1.35;">Hello {{{{admin_name}}}},</p>
      <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.75;">You have been invited to join <strong style="color:#1a1a1a;">{{{{platform_name}}}}</strong> as an <strong style="color:#1a1a1a;">Administrator</strong>.</p>
      <p style="margin:0 0 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.75;">Click the button below to activate your administrator account and set your password. This link is valid for <strong>1 hour</strong>.</p>
      {cta}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0 24px;"><tr><td style="border-top:1px solid #e8e8e8;font-size:1px;line-height:1px;">&nbsp;</td></tr></table>
      <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#999999;line-height:1.6;">If the button above does not work, copy and paste this link into your browser:</p>
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#bbbbbb;word-break:break-all;">{{{{invite_link}}}}</p>
    </td>
  </tr>"""
    return _build_template("admin_email", body)


def _assessment_complete_html() -> str:
    cta = _cta("{{results_url}}", "View My Results &amp; Download PDF")
    body = f"""
  <!-- Body -->
  <tr>
    <td style="padding:40px 48px 36px;" bgcolor="#ffffff">
      <p style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#1a1a1a;font-weight:400;line-height:1.35;">Congratulations, {{{{user_name}}}}.</p>
      <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.75;">You have successfully completed the <strong style="color:#1a1a1a;">Adizes Management Style Assessment (AMSI)</strong> for the <strong style="color:#1a1a1a;">{{{{cohort_name}}}}</strong> cohort.</p>
      <!-- Result highlight box -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
        <tr>
          <td style="padding:18px 20px;background-color:#fdf5f5;border-left:4px solid #C8102E;">
            <p style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:600;color:#C8102E;text-transform:uppercase;letter-spacing:1px;">Your Dominant Style</p>
            <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:20px;color:#1a1a1a;font-weight:400;">{{{{dominant_style}}}}</p>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.75;">Your full personalised PDF report is being generated and will be available on your results page within a few minutes. Click the button below to view your interactive dashboard and download your report.</p>
      {cta}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0 24px;"><tr><td style="border-top:1px solid #e8e8e8;font-size:1px;line-height:1px;">&nbsp;</td></tr></table>
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#666666;line-height:1.75;">Thank you for your participation. Your results contribute to a richer collective picture of your team's management style.</p>
    </td>
  </tr>"""
    return _build_template("user_email", body)


def _cohort_enrollment_existing_html() -> str:
    cta = _cta("{{platform_url}}", "Go to Dashboard &amp; Begin Assessment")
    body = f"""
  <!-- Body -->
  <tr>
    <td style="padding:40px 48px 36px;" bgcolor="#ffffff">
      <p style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#1a1a1a;font-weight:400;line-height:1.35;">Hello {{{{user_name}}}},</p>
      <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.75;">You have been enrolled in the <strong style="color:#1a1a1a;">{{{{cohort_name}}}}</strong> cohort for the <strong style="color:#1a1a1a;">Adizes Management Style Assessment (AMSI)</strong>.</p>
      <p style="margin:0 0 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.75;">Log in to your dashboard to begin the assessment for this cohort.</p>
      {cta}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0 24px;"><tr><td style="border-top:1px solid #e8e8e8;font-size:1px;line-height:1px;">&nbsp;</td></tr></table>
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#666666;line-height:1.75;">Sign in at <a href="{{{{platform_url}}}}" style="color:#C8102E;text-decoration:none;">{{{{platform_url}}}}</a></p>
    </td>
  </tr>"""
    return _build_template("user_email", body)


def _org_welcome_html() -> str:
    cta = _cta("{{activation_url}}", "Activate Your Account")
    body = f"""
  <!-- Body -->
  <tr>
    <td style="padding:40px 48px 36px;" bgcolor="#ffffff">
      <p style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#1a1a1a;font-weight:400;line-height:1.35;">Welcome, {{{{user_name}}}}.</p>
      <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.75;"><strong style="color:#1a1a1a;">{{{{org_name}}}}</strong> has registered you on the <strong style="color:#1a1a1a;">Adizes PAEI Assessment Platform</strong>.</p>
      <p style="margin:0 0 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.75;">Click the button below to activate your account and set your password. Your administrator will invite you to an assessment cohort separately.</p>
      {cta}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0 24px;"><tr><td style="border-top:1px solid #e8e8e8;font-size:1px;line-height:1px;">&nbsp;</td></tr></table>
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#666666;line-height:1.75;">If you did not expect this email, you can safely ignore it.</p>
    </td>
  </tr>"""
    return _build_template("user_email", body)


DEFAULT_TEMPLATES = {
    "user_enrolled": {
        "id": "user_enrolled",
        "name": "User Enrollment Confirmation",
        "subject": "You've been enrolled in {{cohort_name}} — {{platform_name}}",
        "html_body": _enrolled_html(),
    },
    "admin_invite": {
        "id": "admin_invite",
        "name": "Administrator Invite",
        "subject": "You've been invited to administer {{platform_name}}",
        "html_body": _admin_invite_html(),
    },
    "assessment_complete": {
        "id": "assessment_complete",
        "name": "Assessment Completion — Thank You",
        "subject": "Your AMSI results are ready — {{platform_name}}",
        "html_body": _assessment_complete_html(),
    },
    "cohort_enrollment_existing": {
        "id": "cohort_enrollment_existing",
        "name": "Cohort Enrollment — Existing User",
        "subject": "You've been enrolled in {{cohort_name}} — {{platform_name}}",
        "html_body": _cohort_enrollment_existing_html(),
    },
    "org_welcome": {
        "id": "org_welcome",
        "subject": "You've been added to {{org_name}} on the Adizes PAEI Platform",
        "html_body": _org_welcome_html(),
    },
}


def _get_smtp_settings() -> dict | None:
    try:
        resp = (
            supabase_admin.table("app_settings")
            .select("value")
            .eq("key", "smtp")
            .single()
            .execute()
        )
        return resp.data["value"] if resp.data else None
    except Exception:
        return None


def _get_template(template_id: str) -> dict:
    try:
        resp = (
            supabase_admin.table("email_templates")
            .select("*")
            .eq("id", template_id)
            .single()
            .execute()
        )
        if resp.data:
            return resp.data
    except Exception:
        pass
    return DEFAULT_TEMPLATES.get(template_id, {})


def _render(text: str, variables: dict) -> str:
    for key, value in variables.items():
        text = text.replace(f"{{{{{key}}}}}", str(value) if value is not None else "")
    return text


def send_email(
    to_email: str,
    subject: str,
    html_body: str,
    attachments: list | None = None,
) -> bool:
    """Send an email via configured SMTP. Returns True on success, False otherwise."""
    cfg = _get_smtp_settings()
    if not cfg or not cfg.get("host") or not cfg.get("from_email"):
        return False

    msg = MIMEMultipart("mixed")
    msg["From"] = f"{cfg.get('from_name', 'Adizes')} <{cfg['from_email']}>"
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    for att in (attachments or []):
        part = MIMEBase("application", "octet-stream")
        part.set_payload(att["data"])
        encoders.encode_base64(part)
        part.add_header(
            "Content-Disposition",
            f'attachment; filename="{att["filename"]}"',
        )
        msg.attach(part)

    host = cfg["host"]
    port = int(cfg.get("port", 587))
    username = cfg.get("username", "")
    password = cfg.get("password", "")
    use_ssl = bool(cfg.get("use_ssl", False))

    context = ssl.create_default_context()
    if use_ssl:
        with smtplib.SMTP_SSL(host, port, context=context) as server:
            if username:
                server.login(username, password)
            server.sendmail(cfg["from_email"], to_email, msg.as_bytes())
    else:
        with smtplib.SMTP(host, port, timeout=10) as server:
            server.ehlo()
            server.starttls(context=context)
            server.ehlo()
            if username:
                server.login(username, password)
            server.sendmail(cfg["from_email"], to_email, msg.as_bytes())
    return True


def send_template_email(
    template_id: str,
    to_email: str,
    variables: dict,
    attachments: list | None = None,
) -> bool:
    """Render a template and send via SMTP."""
    tmpl = _get_template(template_id)
    if not tmpl:
        return False
    subject = _render(tmpl.get("subject", ""), variables)
    html_body = _render(tmpl.get("html_body", ""), variables)
    return send_email(to_email, subject, html_body, attachments)


def smtp_configured() -> bool:
    cfg = _get_smtp_settings()
    return bool(cfg and cfg.get("host") and cfg.get("from_email"))
