"""
SMTP email service.
Reads config from app_settings.key='smtp' in Supabase.
Reads templates from email_templates table.
Falls back gracefully if SMTP not configured.
"""
import smtplib, ssl, re, logging, base64
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from app.database import supabase_admin

logger = logging.getLogger(__name__)


def make_activate_url(action_link: str, label: str) -> str:
    """Wrap a Supabase one-time action link in the /activate relay page.

    Email security scanners (Microsoft Defender, Proofpoint, etc.) pre-fetch
    URLs in emails. Pointing them at our /activate page returns HTML — no OTP
    consumed. The user's browser then clicks the button, JS runs, and the
    request goes to Supabase's /verify endpoint to exchange the token.
    """
    from app.config import settings
    encoded = base64.urlsafe_b64encode(action_link.encode()).decode().rstrip("=")
    return f"{settings.frontend_url}/activate?link={encoded}&label={label}"


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
  <!-- Header band: navy + HIL isotope + LEAP(tm) — matches PDF/app header identity -->
  <tr>
    <td bgcolor="#1D3557" style="background-color:#1D3557;padding:0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <!-- HIL isotope in semi-transparent circle -->
          <td width="72" bgcolor="#1D3557" style="background-color:#1D3557;padding:14px 0 14px 18px;vertical-align:middle;" valign="middle">
            <!--[if !mso]><!-->
            <div style="width:44px;height:44px;border-radius:22px;background-color:#2A4A6B;display:inline-block;text-align:center;line-height:0;vertical-align:middle;mso-hide:all;">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 40 40" style="display:block;margin:8px auto 0;">
                <g fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20,24 C14,20 13,12 20,7 C27,12 26,20 20,24Z"/>
                  <path d="M20,24 C14,20 13,12 20,7 C27,12 26,20 20,24Z" transform="rotate(120 20 24)"/>
                  <path d="M20,24 C14,20 13,12 20,7 C27,12 26,20 20,24Z" transform="rotate(240 20 24)"/>
                </g>
              </svg>
            </div>
            <!--<![endif]-->
            <!--[if mso]><table cellpadding="0" cellspacing="0" border="0"><tr><td width="44" height="44" bgcolor="#2A4A6B" style="background-color:#2A4A6B;">&nbsp;</td></tr></table><![endif]-->
          </td>
          <!-- LEAP name -->
          <td bgcolor="#1D3557" style="background-color:#1D3557;padding:14px 0 14px 12px;vertical-align:middle;" valign="middle">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">LEAP&#8482;</p>
          </td>
          <!-- Descriptor right-aligned -->
          <td bgcolor="#1D3557" style="background-color:#1D3557;padding:14px 20px 14px 0;vertical-align:middle;text-align:right;" valign="middle" align="right">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#a0b4c8;letter-spacing:0.3px;">Leadership Energy Alignment Profile</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <!-- Red accent stripe -->
  <tr><td style="background-color:#C8102E;height:3px;font-size:1px;line-height:1px;" bgcolor="#C8102E">&nbsp;</td></tr>"""

_EMAIL_WRAPPER_CLOSE = """\
  <!-- Footer -->
  <tr>
    <td style="padding:0;background-color:#f8f8f8;border-top:1px solid #e8e8e8;" bgcolor="#f8f8f8">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td align="center" style="padding:20px 48px 4px;">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#888888;">&copy; 2026 Heartfulness Institute of Leadership</p>
        </td></tr>
        <tr><td align="center" style="padding:0 48px 24px;">
          <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#aaaaaa;line-height:1.6;">This email was sent to {{recipient_email}}</p>
          <p style="margin:4px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#aaaaaa;">Powered by the Adizes PAEI Framework &amp; Turiyaskills</p>
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
              <span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:600;color:#ffffff;white-space:nowrap;">My Natural Preference (WANT)</span>
            </td>
          </tr>
        </table>
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
      <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.75;">You have been enrolled in the <strong style="color:#1a1a1a;">{{{{cohort_name}}}}</strong> cohort for <strong style="color:#1a1a1a;">LEAP&#8482; &#8212; Leadership Energy Alignment Profile</strong>.</p>
      <p style="margin:0 0 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.75;">Please click the button below to activate your account and set your password. This link is valid for <strong>24 hours</strong>.</p>
      {cta}
      {_DIMENSION_PILLS}
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
      <p style="margin:0 0 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.75;">Click the button below to activate your administrator account and set your password. This link is valid for <strong>24 hours</strong>.</p>
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
      <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.75;">You have successfully completed the <strong style="color:#1a1a1a;">LEAP&#8482; &#8212; Leadership Energy Alignment Profile</strong> for the <strong style="color:#1a1a1a;">{{{{cohort_name}}}}</strong> cohort.</p>
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
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#666666;line-height:1.75;">Your LEAP™ profile is a practical tool for understanding your leadership alignment and development priorities.</p>
    </td>
  </tr>"""
    return _build_template("user_email", body)


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


def _org_welcome_html() -> str:
    cta = _cta("{{activation_url}}", "Activate Your Account")
    body = f"""
  <!-- Body -->
  <tr>
    <td style="padding:40px 48px 36px;" bgcolor="#ffffff">
      <p style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#1a1a1a;font-weight:400;line-height:1.35;">Welcome, {{{{user_name}}}}.</p>
      <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.75;"><strong style="color:#1a1a1a;">{{{{org_name}}}}</strong> has registered you on the <strong style="color:#1a1a1a;">LEAP&#8482; Platform</strong>.</p>
      <p style="margin:0 0 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.75;">Click the button below to activate your account and set your password. Your administrator will invite you to an assessment cohort separately.</p>
      {cta}
      <p style="margin:32px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#666666;line-height:1.75;">This activation link expires in <strong>24 hours</strong>. If it has expired, please contact your administrator and ask them to resend your welcome email from the platform. Once your account is activated, you can reset your password at any time from the login page.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0 24px;"><tr><td style="border-top:1px solid #e8e8e8;font-size:1px;line-height:1px;">&nbsp;</td></tr></table>
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#666666;line-height:1.75;">If you did not expect this email, you can safely ignore it.</p>
    </td>
  </tr>"""
    return _build_template("user_email", body)


def _password_reset_html() -> str:
    cta = _cta("{{reset_link}}", "Set New Password")
    body = f"""
  <!-- Body -->
  <tr>
    <td style="padding:40px 48px 36px;" bgcolor="#ffffff">
      <p style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#1a1a1a;font-weight:400;line-height:1.35;">Hello {{{{user_name}}}},</p>
      <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.75;">We received a request to reset the password for your account on <strong style="color:#1a1a1a;">{{{{platform_name}}}}</strong>.</p>
      <p style="margin:0 0 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.75;">Click the button below to set a new password. This link is valid for <strong>24 hours</strong>.</p>
      {cta}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0 24px;"><tr><td style="border-top:1px solid #e8e8e8;font-size:1px;line-height:1px;">&nbsp;</td></tr></table>
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#666666;line-height:1.75;">If you did not request a password reset, you can safely ignore this email. Your password will not be changed.</p>
    </td>
  </tr>"""
    return _build_template("user_email", body)


def _coaching_lead_html() -> str:
    """Internal notification to hello@hileadership.org when a coaching lead is captured."""
    body = f"""
  <!-- Body -->
  <tr>
    <td style="padding:40px 48px 36px;" bgcolor="#ffffff">
      <p style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#1a1a1a;font-weight:400;line-height:1.35;">New LEAP&#8482; Coaching Lead</p>
      <p style="margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#444444;line-height:1.75;">A visitor requested a coaching conversation via the LEAP&#8482; Coaching page. Details below.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;border:1px solid #e8e8e8;border-radius:6px;">
        <tr><td style="padding:12px 16px;background-color:#f8fafc;border-bottom:1px solid #e8e8e8;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;color:#1D3557;width:140px;">Name</td><td style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e8e8e8;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1a1a;">{{{{lead_name}}}}</td></tr>
        <tr><td style="padding:12px 16px;background-color:#f8fafc;border-bottom:1px solid #e8e8e8;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;color:#1D3557;">Email</td><td style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e8e8e8;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1a1a;"><a href="mailto:{{{{lead_email}}}}" style="color:#C8102E;text-decoration:none;">{{{{lead_email}}}}</a></td></tr>
        <tr><td style="padding:12px 16px;background-color:#f8fafc;border-bottom:1px solid #e8e8e8;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;color:#1D3557;">Organization</td><td style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e8e8e8;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1a1a;">{{{{lead_organization}}}}</td></tr>
        <tr><td style="padding:12px 16px;background-color:#f8fafc;border-bottom:1px solid #e8e8e8;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;color:#1D3557;">Designation</td><td style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e8e8e8;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1a1a;">{{{{lead_designation}}}}</td></tr>
        <tr><td style="padding:12px 16px;background-color:#f8fafc;border-bottom:1px solid #e8e8e8;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;color:#1D3557;">Country</td><td style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e8e8e8;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1a1a;">{{{{lead_country}}}}</td></tr>
        <tr><td style="padding:12px 16px;background-color:#f8fafc;border-bottom:1px solid #e8e8e8;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;color:#1D3557;">Phone</td><td style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e8e8e8;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1a1a;">{{{{lead_phone}}}}</td></tr>
        <tr><td style="padding:12px 16px;background-color:#f8fafc;border-bottom:1px solid #e8e8e8;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;color:#1D3557;vertical-align:top;">Message</td><td style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e8e8e8;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.6;">{{{{lead_message}}}}</td></tr>
        <tr><td style="padding:12px 16px;background-color:#f8fafc;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;color:#1D3557;">Captured</td><td style="padding:12px 16px;background-color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1a1a;">{{{{captured_at}}}}</td></tr>
      </table>
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#666666;line-height:1.7;">This lead has been saved to the LEAP&#8482; admin panel under <strong>Coaching Leads</strong>.</p>
    </td>
  </tr>"""
    return _build_template("recipient_email", body)


DEFAULT_TEMPLATES = {
    "coaching_lead": {
        "id": "coaching_lead",
        "name": "Coaching Lead Notification",
        "subject": "New LEAP™ Coaching Lead — {{lead_name}}",
        "html_body": _coaching_lead_html(),
    },
    "user_enrolled": {
        "id": "user_enrolled",
        "name": "User Enrollment Confirmation",
        "subject": "Ready for your LEAP™ Assessment? — {{cohort_name}}",
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
        "subject": "Your LEAP™ results are ready — {{platform_name}}",
        "html_body": _assessment_complete_html(),
    },
    "cohort_enrollment_existing": {
        "id": "cohort_enrollment_existing",
        "name": "Cohort Enrollment — Existing User",
        "subject": "Ready for your LEAP™ Assessment? — {{cohort_name}}",
        "html_body": _cohort_enrollment_existing_html(),
    },
    "org_welcome": {
        "id": "org_welcome",
        "name": "Org Employee Welcome",
        "subject": "You've been added to {{org_name}} on the LEAP™ Platform",
        "html_body": _org_welcome_html(),
    },
    "password_reset": {
        "id": "password_reset",
        "name": "Password Reset",
        "subject": "Reset your {{platform_name}} password",
        "html_body": _password_reset_html(),
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
    """Send an email via configured SMTP. Returns True on success, False otherwise.

    Never raises — SMTP failures are logged and reported via the return value so
    callers can surface the real send status instead of assuming success.
    """
    cfg = _get_smtp_settings()
    if not cfg or not cfg.get("host") or not cfg.get("from_email"):
        logger.error(f"[email] SMTP not configured — cannot send '{subject}' to {to_email}")
        return False

    msg = MIMEMultipart("mixed")
    msg["From"] = f"{cfg.get('from_name', 'Leap Invitation')} <{cfg['from_email']}>"
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
    try:
        if use_ssl:
            with smtplib.SMTP_SSL(host, port, context=context, timeout=10) as server:
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
    except Exception as e:
        logger.error(f"[email] SMTP send failed for '{subject}' to {to_email}: {e}")
        return False

    logger.info(f"[email] Sent '{subject}' to {to_email}")
    return True


def send_template_email(
    template_id: str,
    to_email: str,
    variables: dict,
    attachments: list | None = None,
) -> bool:
    """Render a template and send via SMTP. Returns True on success, False otherwise."""
    tmpl = _get_template(template_id)
    if not tmpl:
        logger.error(f"[email] Template '{template_id}' not found — cannot send to {to_email}")
        return False
    subject = _render(tmpl.get("subject", ""), variables)
    html_body = _render(tmpl.get("html_body", ""), variables)
    ok = send_email(to_email, subject, html_body, attachments)
    if not ok:
        logger.error(f"[email] Template '{template_id}' failed to send to {to_email}")
    return ok


def smtp_configured() -> bool:
    cfg = _get_smtp_settings()
    return bool(cfg and cfg.get("host") and cfg.get("from_email"))
