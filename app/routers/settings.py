from fastapi import APIRouter, Depends, HTTPException
from app.auth import require_admin
from app.database import supabase_admin
from app.schemas.settings import (
    SmtpConfig, SmtpConfigResponse, EmailTemplate,
    UpdateTemplateRequest, TestEmailRequest,
)
from app.services.email_service import (
    send_email, DEFAULT_TEMPLATES, _get_template,
)

router = APIRouter()

TEMPLATE_IDS = ["user_enrolled", "admin_invite", "assessment_complete"]

TEMPLATE_VARIABLES = {
    "user_enrolled": ["user_name", "user_email", "cohort_name", "invite_link", "platform_name", "platform_url"],
    "admin_invite": ["admin_name", "admin_email", "invite_link", "platform_name"],
    "assessment_complete": ["user_name", "user_email", "cohort_name", "dominant_style", "platform_name", "platform_url"],
}


# ─── SMTP ────────────────────────────────────────────────────────────────────

@router.get("/smtp", response_model=SmtpConfigResponse)
def get_smtp(admin: dict = Depends(require_admin)):
    try:
        resp = (
            supabase_admin.table("app_settings")
            .select("value")
            .eq("key", "smtp")
            .single()
            .execute()
        )
        cfg = resp.data["value"] if resp.data else {}
    except Exception:
        cfg = {}

    return SmtpConfigResponse(
        provider=cfg.get("provider", "custom"),
        host=cfg.get("host", ""),
        port=int(cfg.get("port", 587)),
        username=cfg.get("username", ""),
        password_set=bool(cfg.get("password")),
        from_email=cfg.get("from_email", ""),
        from_name=cfg.get("from_name", "Adizes Platform"),
        use_ssl=bool(cfg.get("use_ssl", False)),
    )


@router.put("/smtp")
def save_smtp(body: SmtpConfig, admin: dict = Depends(require_admin)):
    # If password is empty string, preserve existing saved password
    existing_password = ""
    try:
        resp = (
            supabase_admin.table("app_settings")
            .select("value")
            .eq("key", "smtp")
            .single()
            .execute()
        )
        if resp.data:
            existing_password = resp.data["value"].get("password", "")
    except Exception:
        pass

    value = body.model_dump()
    if not value["password"] and existing_password:
        value["password"] = existing_password

    supabase_admin.table("app_settings").upsert({
        "key": "smtp",
        "value": value,
    }).execute()
    return {"message": "SMTP settings saved"}


@router.post("/smtp/test")
def test_smtp(body: TestEmailRequest, admin: dict = Depends(require_admin)):
    ok = send_email(
        to_email=str(body.to_email),
        subject="Test email from Adizes Platform",
        html_body=(
            "<p>This is a test email from your Adizes India.</p>"
            "<p>If you received this, your SMTP settings are working correctly.</p>"
        ),
    )
    if not ok:
        raise HTTPException(status_code=400, detail="Failed to send test email. Check SMTP settings.")
    return {"message": f"Test email sent to {body.to_email}"}


# ─── Templates ───────────────────────────────────────────────────────────────

@router.get("/templates")
def list_templates(admin: dict = Depends(require_admin)):
    result = []
    for tid in TEMPLATE_IDS:
        tmpl = _get_template(tid)
        if tmpl:
            result.append({
                "id": tmpl["id"],
                "name": tmpl["name"],
                "subject": tmpl["subject"],
                "variables": TEMPLATE_VARIABLES.get(tid, []),
            })
    return result


@router.get("/templates/{template_id}")
def get_template_detail(template_id: str, admin: dict = Depends(require_admin)):
    if template_id not in TEMPLATE_IDS:
        raise HTTPException(status_code=404, detail="Template not found")
    tmpl = _get_template(template_id)
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    return {
        **tmpl,
        "variables": TEMPLATE_VARIABLES.get(template_id, []),
    }


@router.put("/templates/{template_id}")
def update_template(
    template_id: str,
    body: UpdateTemplateRequest,
    admin: dict = Depends(require_admin),
):
    if template_id not in TEMPLATE_IDS:
        raise HTTPException(status_code=404, detail="Template not found")

    # Get defaults for name
    default = DEFAULT_TEMPLATES.get(template_id, {})
    name = default.get("name", template_id)

    supabase_admin.table("email_templates").upsert({
        "id": template_id,
        "name": name,
        "subject": body.subject,
        "html_body": body.html_body,
    }).execute()
    return {"message": "Template saved"}


@router.post("/templates/{template_id}/reset")
def reset_template(template_id: str, admin: dict = Depends(require_admin)):
    """Reset a template to the built-in default."""
    if template_id not in TEMPLATE_IDS:
        raise HTTPException(status_code=404, detail="Template not found")
    default = DEFAULT_TEMPLATES.get(template_id)
    if not default:
        raise HTTPException(status_code=404, detail="No default for this template")
    supabase_admin.table("email_templates").upsert({
        "id": template_id,
        "name": default["name"],
        "subject": default["subject"],
        "html_body": default["html_body"],
    }).execute()
    return {"message": "Template reset to default"}
