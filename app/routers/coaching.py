"""
LEAP™ Coaching lead-capture.

- Public:  POST /coaching/leads          — visitor submits the "Schedule a Conversation" form.
- Admin:   GET  /admin/coaching-leads     — list (with ?q= search)
           GET  /admin/coaching-leads/export   — .xlsx download
           GET  /admin/coaching-leads/{id}     — detail
           PATCH /admin/coaching-leads/{id}    — toggle actioned
"""
import io
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from app.auth import require_admin
from app.database import supabase_admin
from app.schemas.coaching import CoachingLeadRequest, UpdateLeadActionedRequest
from app.services.email_service import send_template_email, smtp_configured
from app.services.export_service import generate_coaching_leads_xlsx

logger = logging.getLogger(__name__)

# Where new-lead notifications are sent (HIL coaching inbox).
LEAD_NOTIFY_EMAIL = "hello@hileadership.org"

public_router = APIRouter()
admin_router = APIRouter()


# ─── Public: submit a lead ────────────────────────────────────────────────────

@public_router.post("/leads", status_code=status.HTTP_201_CREATED)
def submit_coaching_lead(body: CoachingLeadRequest):
    """Capture a coaching lead and notify the HIL inbox. No auth."""
    row = {
        "name": body.name.strip(),
        "email": str(body.email),
        "organization": (body.organization or "").strip() or None,
        "designation": (body.designation or "").strip() or None,
        "country": (body.country or "").strip() or None,
        "phone": (body.phone or "").strip() or None,
        "message": (body.message or "").strip() or None,
        "source": body.source or "leap-coaching",
    }
    try:
        inserted = supabase_admin.table("coaching_leads").insert(row).execute()
        lead = inserted.data[0]
    except Exception as e:
        logger.error(f"[coaching] Failed to save lead for {row['email']}: {e}")
        raise HTTPException(status_code=500, detail="Could not submit your request. Please try again.")

    # Notify the HIL inbox — best-effort (lead is already saved).
    if smtp_configured():
        sent = send_template_email("coaching_lead", LEAD_NOTIFY_EMAIL, {
            "recipient_email": LEAD_NOTIFY_EMAIL,
            "lead_name": row["name"],
            "lead_email": row["email"],
            "lead_organization": row["organization"] or "—",
            "lead_designation": row["designation"] or "—",
            "lead_country": row["country"] or "—",
            "lead_phone": row["phone"] or "—",
            "lead_message": row["message"] or "—",
            "captured_at": lead.get("created_at", ""),
            "platform_name": "LEAP™ Platform",
        })
        if not sent:
            logger.error(f"[coaching] Lead saved but notification email failed for {row['email']}")

    return {"status": "received"}


# ─── Admin: manage leads ──────────────────────────────────────────────────────

@admin_router.get("")
def list_coaching_leads(q: str = "", admin: dict = Depends(require_admin)):
    """List coaching leads (newest first), optionally filtered by ?q= across
    name/email/organization/message."""
    rows = (
        supabase_admin.table("coaching_leads")
        .select("*")
        .order("created_at", desc=True)
        .execute()
        .data
    ) or []
    if q:
        ql = q.lower()
        rows = [
            r for r in rows
            if ql in (r.get("name") or "").lower()
            or ql in (r.get("email") or "").lower()
            or ql in (r.get("organization") or "").lower()
            or ql in (r.get("message") or "").lower()
        ]
    return rows


@admin_router.get("/export")
def export_coaching_leads(admin: dict = Depends(require_admin)):
    """Download all coaching leads as an .xlsx file."""
    rows = (
        supabase_admin.table("coaching_leads")
        .select("*")
        .order("created_at", desc=True)
        .execute()
        .data
    ) or []
    xlsx = generate_coaching_leads_xlsx(rows)
    return StreamingResponse(
        io.BytesIO(xlsx),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="coaching_leads.xlsx"'},
    )


@admin_router.get("/count")
def coaching_leads_count(admin: dict = Depends(require_admin)):
    """Pending (not-yet-actioned) lead count — used for the sidebar badge."""
    rows = (
        supabase_admin.table("coaching_leads")
        .select("id", count="exact")
        .eq("actioned", False)
        .execute()
    )
    return {"pending": rows.count or 0}


@admin_router.get("/{lead_id}")
def get_coaching_lead(lead_id: str, admin: dict = Depends(require_admin)):
    resp = supabase_admin.table("coaching_leads").select("*").eq("id", lead_id).single().execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Lead not found")
    return resp.data


@admin_router.patch("/{lead_id}")
def update_coaching_lead(lead_id: str, body: UpdateLeadActionedRequest, admin: dict = Depends(require_admin)):
    """Mark a lead actioned / yet-to-action."""
    updates = {
        "actioned": body.actioned,
        "actioned_at": datetime.now(timezone.utc).isoformat() if body.actioned else None,
        "actioned_by": admin["sub"] if body.actioned else None,
    }
    resp = supabase_admin.table("coaching_leads").update(updates).eq("id", lead_id).execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Lead not found")
    return {"status": "updated", "actioned": body.actioned}
