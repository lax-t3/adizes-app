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


DEFAULT_TEMPLATES = {
    "user_enrolled": {
        "id": "user_enrolled",
        "name": "User Enrollment Confirmation",
        "subject": "You've been enrolled in {{cohort_name}} — {{platform_name}}",
        "html_body": """<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body{font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:0}
  .wrap{max-width:600px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)}
  .header{background:#C8102E;padding:32px 40px;text-align:center}
  .header h1{color:#fff;margin:0;font-size:22px;font-weight:700}
  .body{padding:36px 40px;color:#333;font-size:15px;line-height:1.6}
  .body h2{color:#1a1a1a;font-size:20px;margin-top:0}
  .btn{display:inline-block;margin:24px 0;padding:14px 32px;background:#C8102E;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:15px}
  .footer{padding:20px 40px;background:#f9f9f9;border-top:1px solid #eee;color:#888;font-size:12px;text-align:center}
</style></head>
<body>
<div class="wrap">
  <div class="header"><h1>{{platform_name}}</h1></div>
  <div class="body">
    <h2>Hello {{user_name}},</h2>
    <p>You have been enrolled in the <strong>{{cohort_name}}</strong> cohort for the Adizes Management Style Assessment.</p>
    <p>Please click the button below to set your password and access the platform:</p>
    <a href="{{invite_link}}" class="btn">Accept Invitation &amp; Set Password</a>
    <p>If you already have an account, you can log in directly at <a href="{{platform_url}}">{{platform_url}}</a>.</p>
    <p>If the button doesn't work, copy and paste this link into your browser:<br><small>{{invite_link}}</small></p>
  </div>
  <div class="footer">{{platform_name}} · This email was sent to {{user_email}}</div>
</div>
</body>
</html>""",
    },
    "admin_invite": {
        "id": "admin_invite",
        "name": "Administrator Invite",
        "subject": "You've been invited to administer {{platform_name}}",
        "html_body": """<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body{font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:0}
  .wrap{max-width:600px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)}
  .header{background:#1D3557;padding:32px 40px;text-align:center}
  .header h1{color:#fff;margin:0;font-size:22px;font-weight:700}
  .body{padding:36px 40px;color:#333;font-size:15px;line-height:1.6}
  .body h2{color:#1a1a1a;font-size:20px;margin-top:0}
  .btn{display:inline-block;margin:24px 0;padding:14px 32px;background:#1D3557;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:15px}
  .footer{padding:20px 40px;background:#f9f9f9;border-top:1px solid #eee;color:#888;font-size:12px;text-align:center}
</style></head>
<body>
<div class="wrap">
  <div class="header"><h1>{{platform_name}} Admin</h1></div>
  <div class="body">
    <h2>Hello {{admin_name}},</h2>
    <p>You have been invited to administer <strong>{{platform_name}}</strong>.</p>
    <p>Click the button below to set your password and access the admin panel:</p>
    <a href="{{invite_link}}" class="btn">Set Password &amp; Sign In</a>
    <p>If the button doesn't work, copy and paste this link into your browser:<br><small>{{invite_link}}</small></p>
  </div>
  <div class="footer">{{platform_name}} · This email was sent to {{admin_email}}</div>
</div>
</body>
</html>""",
    },
    "assessment_complete": {
        "id": "assessment_complete",
        "name": "Assessment Completion — Thank You",
        "subject": "Thank you for completing your PAEI assessment — {{platform_name}}",
        "html_body": """<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body{font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:0}
  .wrap{max-width:600px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)}
  .header{background:#C8102E;padding:32px 40px;text-align:center}
  .header h1{color:#fff;margin:0;font-size:22px;font-weight:700}
  .body{padding:36px 40px;color:#333;font-size:15px;line-height:1.6}
  .body h2{color:#1a1a1a;font-size:20px;margin-top:0}
  .result-box{background:#f9f9f9;border-left:4px solid #C8102E;padding:16px 20px;border-radius:0 6px 6px 0;margin:20px 0}
  .btn{display:inline-block;margin:24px 0;padding:14px 32px;background:#C8102E;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:15px}
  .footer{padding:20px 40px;background:#f9f9f9;border-top:1px solid #eee;color:#888;font-size:12px;text-align:center}
</style></head>
<body>
<div class="wrap">
  <div class="header"><h1>{{platform_name}}</h1></div>
  <div class="body">
    <h2>Congratulations, {{user_name}}!</h2>
    <p>You have successfully completed the <strong>Adizes PAEI Management Style Assessment</strong> for the <strong>{{cohort_name}}</strong> cohort.</p>
    <div class="result-box">
      <p style="margin:0"><strong>Your dominant style: {{dominant_style}}</strong></p>
    </div>
    <p>Your full personalised report is attached to this email as a PDF. You can also view your results by logging in to the platform.</p>
    <a href="{{platform_url}}" class="btn">View My Results</a>
    <p>Thank you for participating. Your results will help build a richer picture of your team's collective management style.</p>
  </div>
  <div class="footer">{{platform_name}} · This email was sent to {{user_email}}</div>
</div>
</body>
</html>""",
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
