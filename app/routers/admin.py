from fastapi import APIRouter, Depends, HTTPException, status, UploadFile
from typing import Optional
from fastapi.responses import StreamingResponse
from app.auth import require_admin
from app.database import supabase_admin
from app.schemas.admin import (
    CreateCohortRequest, CohortSummary, CohortDetailResponse,
    RespondentSummary, TeamScores, EnrollUserRequest, BulkEnrollRequest,
    InviteAdminRequest, AdminStats, AdminUserSummary, ChangePasswordRequest,
)
from app.config import settings
from app.services.export_service import generate_cohort_csv
from app.services.email_service import send_template_email, smtp_configured
import uuid
import io
from app.schemas.org import (
    CreateOrgRequest, UpdateOrgRequest, OrgSummary, OrgDetail, OrgNode,
    CreateNodeRequest, UpdateNodeRequest,
    AddEmployeeRequest, OrgEmployeeSummary, BulkUploadResult,
    LinkOrgRequest, LinkedOrgSummary, LinkedCohortSummary,
    EnrollFromOrgRequest, EnrollFromOrgResult,
)
import csv, io as _io
import re
import logging
logger = logging.getLogger(__name__)

router = APIRouter()


def _get_auth_users_map() -> dict:
    """Fetch all auth users once and return {user_id: user_obj}."""
    try:
        users = supabase_admin.auth.admin.list_users()
        return {str(u.id): u for u in users}
    except Exception:
        return {}


@router.get("/stats", response_model=AdminStats)
def get_stats(admin: dict = Depends(require_admin)):
    cohorts_resp = supabase_admin.table("cohorts").select("id").execute()
    total_cohorts = len(cohorts_resp.data or [])

    assessments_resp = (
        supabase_admin.table("assessments")
        .select("user_id, user_name, completed_at, status")
        .execute()
    )
    all_assessments = assessments_resp.data or []
    total_assessments = len(all_assessments)
    completed = [a for a in all_assessments if a.get("status") == "completed"]
    completion_pct = round(len(completed) / total_assessments * 100) if total_assessments else 0

    recent_resp = (
        supabase_admin.table("assessments")
        .select("user_id, user_name, completed_at")
        .not_.is_("completed_at", "null")
        .order("completed_at", desc=True)
        .limit(5)
        .execute()
    )

    return AdminStats(
        total_cohorts=total_cohorts,
        total_assessments=total_assessments,
        completed_assessments=len(completed),
        completion_pct=completion_pct,
        recent_completions=recent_resp.data or [],
    )


@router.get("/cohorts", response_model=list[CohortSummary])
def list_cohorts(admin: dict = Depends(require_admin)):
    rows = (
        supabase_admin.table("cohorts")
        .select("id, name, description, created_at, cohort_members(user_id)")
        .order("created_at", desc=True)
        .execute()
    )

    results = []
    for c in rows.data:
        members = c.get("cohort_members", [])
        comp_rows = (
            supabase_admin.table("assessments")
            .select("user_id")
            .eq("cohort_id", c["id"])
            .eq("status", "completed")
            .execute()
        )
        completed = len(comp_rows.data or [])

        total = len(members)
        results.append(CohortSummary(
            id=c["id"],
            name=c["name"],
            description=c.get("description"),
            member_count=total,
            completed_count=completed,
            completion_pct=round(completed / total * 100, 1) if total else 0.0,
            created_at=c["created_at"],
        ))

    return results


@router.post("/cohorts", response_model=CohortSummary, status_code=status.HTTP_201_CREATED)
def create_cohort(body: CreateCohortRequest, admin: dict = Depends(require_admin)):
    row = supabase_admin.table("cohorts").insert({
        "id": str(uuid.uuid4()),
        "name": body.name,
        "description": body.description,
        "admin_id": admin["sub"],
    }).execute()

    c = row.data[0]
    return CohortSummary(
        id=c["id"],
        name=c["name"],
        description=c.get("description"),
        member_count=0,
        completed_count=0,
        completion_pct=0.0,
        created_at=c["created_at"],
    )


@router.get("/cohorts/{cohort_id}", response_model=CohortDetailResponse)
def get_cohort(cohort_id: str, admin: dict = Depends(require_admin)):
    cohort = (
        supabase_admin.table("cohorts")
        .select("id, name, description")
        .eq("id", cohort_id)
        .single()
        .execute()
    )
    if not cohort.data:
        raise HTTPException(status_code=404, detail="Cohort not found")

    members_rows = (
        supabase_admin.table("cohort_members")
        .select("user_id")
        .eq("cohort_id", cohort_id)
        .execute()
    )

    auth_users = _get_auth_users_map()
    respondents = []
    all_scaled = []

    for m in members_rows.data:
        uid = m["user_id"]
        auth_user = auth_users.get(uid)
        name, email = "", ""
        if auth_user:
            email = auth_user.email or ""
            meta = getattr(auth_user, "user_metadata", None) or {}
            name = meta.get("name", "")

        assessment = (
            supabase_admin.table("assessments")
            .select("id, completed_at, scaled_scores, interpretation, status")
            .eq("user_id", uid)
            .eq("cohort_id", cohort_id)
            .limit(1)
            .execute()
        )

        a = assessment.data[0] if assessment.data else None
        a_status = a.get("status", "pending") if a else "pending"
        dominant = None
        if a_status == "completed" and a and a.get("interpretation"):
            dominant = "".join(a["interpretation"].get("dominant_roles", []))
        if a_status == "completed" and a and a.get("scaled_scores"):
            all_scaled.append(a["scaled_scores"])

        respondents.append(RespondentSummary(
            user_id=uid,
            name=name,
            email=email,
            status=a_status,
            dominant_style=dominant,
            completed_at=a["completed_at"] if a else None,
        ))

    team_scores = _compute_team_scores(all_scaled) if all_scaled else None

    return CohortDetailResponse(
        id=cohort.data["id"],
        name=cohort.data["name"],
        description=cohort.data.get("description"),
        respondents=respondents,
        team_scores=team_scores,
    )


def _enroll_single_user(cohort_id: str, user_id: str, email: str,
                        name: str | None, email_confirmed_at) -> None:
    """Insert cohort_members row and send appropriate enrolment email."""
    supabase_admin.table("cohort_members").insert(
        {"cohort_id": cohort_id, "user_id": user_id}
    ).execute()

    cohort = supabase_admin.table("cohorts").select("name").eq("id", cohort_id).single().execute().data
    cohort_name = cohort["name"]
    display_name = name or email

    if not smtp_configured():
        return

    if email_confirmed_at is None:
        try:
            lr = supabase_admin.auth.admin.generate_link({"type": "recovery", "email": email})
            invite_link = lr.properties.action_link
        except Exception:
            invite_link = settings.frontend_url
        send_template_email("user_enrolled", email, {
            "user_name": display_name, "cohort_name": cohort_name,
            "platform_name": "Adizes India", "platform_url": settings.frontend_url,
            "invite_link": invite_link,
        })
    else:
        send_template_email("cohort_enrollment_existing", email, {
            "user_name": display_name, "cohort_name": cohort_name,
            "platform_name": "Adizes India", "platform_url": settings.frontend_url,
        })


@router.post("/cohorts/{cohort_id}/members", status_code=status.HTTP_201_CREATED)
def enroll_user(cohort_id: str, body: EnrollUserRequest, admin: dict = Depends(require_admin)):
    """Enroll a user into a cohort by email. If they have no account, invite them first."""
    cohort = (
        supabase_admin.table("cohorts")
        .select("id")
        .eq("id", cohort_id)
        .single()
        .execute()
    )
    if not cohort.data:
        raise HTTPException(status_code=404, detail="Cohort not found")

    all_users = supabase_admin.auth.admin.list_users()
    target = next((u for u in all_users if u.email == body.email), None)
    invited_new = False

    invite_link_val = settings.frontend_url

    if not target:
        # User doesn't exist — use generate_link which creates the user AND returns the invite link
        try:
            lr = supabase_admin.auth.admin.generate_link({
                "type": "invite",
                "email": body.email,
                "options": {"redirect_to": f"{settings.frontend_url}/register"},
            })
            target = lr.user
            invite_link_val = lr.properties.action_link
            invited_new = True
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Could not invite user: {e}")

    existing = (
        supabase_admin.table("cohort_members")
        .select("user_id")
        .eq("cohort_id", cohort_id)
        .eq("user_id", str(target.id))
        .execute()
    )
    if existing.data:
        raise HTTPException(status_code=409, detail="User is already a member of this cohort")

    # Determine email_confirmed_at for new vs existing users
    if invited_new:
        email_confirmed_at = None
    else:
        try:
            fetched = supabase_admin.auth.admin.get_user_by_id(str(target.id)).user
            email_confirmed_at = getattr(fetched, "email_confirmed_at", None)
        except Exception:
            email_confirmed_at = None

    meta = getattr(target, "user_metadata", None) or {}
    user_name_val = meta.get("name", "") or None

    try:
        _enroll_single_user(
            cohort_id=cohort_id, user_id=str(target.id),
            email=body.email, name=user_name_val,
            email_confirmed_at=email_confirmed_at,
        )
    except Exception:
        pass  # Non-fatal — enrollment succeeded regardless

    msg = (
        f"{body.email} enrolled and invite email sent — they must set a password before logging in."
        if invited_new
        else f"{body.email} enrolled successfully"
    )
    return {"message": msg, "user_id": str(target.id), "invited": invited_new}


@router.post("/cohorts/{cohort_id}/members/bulk")
def bulk_enroll(cohort_id: str, body: BulkEnrollRequest, admin: dict = Depends(require_admin)):
    """Bulk enroll users by email. New users are auto-invited."""
    cohort = (
        supabase_admin.table("cohorts")
        .select("id")
        .eq("id", cohort_id)
        .single()
        .execute()
    )
    if not cohort.data:
        raise HTTPException(status_code=404, detail="Cohort not found")

    cohort_name_row = supabase_admin.table("cohorts").select("name").eq("id", cohort_id).single().execute()
    cohort_name_for_bulk = cohort_name_row.data.get("name", "") if cohort_name_row.data else ""

    # Build email→user map from existing auth users
    all_users = supabase_admin.auth.admin.list_users()
    email_to_user = {u.email: u for u in all_users if u.email}

    # Fetch existing cohort members to detect duplicates
    existing_rows = (
        supabase_admin.table("cohort_members")
        .select("user_id")
        .eq("cohort_id", cohort_id)
        .execute()
    )
    existing_ids = {r["user_id"] for r in (existing_rows.data or [])}

    enrolled, already_member, failed = [], [], []

    for entry in body.users:
        email = entry.email
        try:
            user = email_to_user.get(email)
            invited_new = False

            invite_link_val = settings.frontend_url

            if not user:
                # Use generate_link: creates the user AND returns the invite link in one call
                try:
                    link_data: dict = {
                        "type": "invite",
                        "email": email,
                        "options": {"redirect_to": f"{settings.frontend_url}/register"},
                    }
                    if entry.name:
                        link_data["options"]["data"] = {"name": entry.name}
                    lr = supabase_admin.auth.admin.generate_link(link_data)
                    user = lr.user
                    invite_link_val = lr.properties.action_link
                    email_to_user[email] = user   # cache so duplicates in the sheet are caught
                    invited_new = True
                except Exception as e:
                    failed.append({"email": email, "reason": f"Could not invite user: {e}"})
                    continue

            # Determine activation state for existing users
            is_activated = False
            if not invited_new:
                try:
                    fetched = supabase_admin.auth.admin.get_user_by_id(str(user.id)).user
                    is_activated = getattr(fetched, "email_confirmed_at", None) is not None
                except Exception:
                    pass

                if not is_activated:
                    try:
                        link_data = {
                            "type": "recovery",
                            "email": email,
                            "options": {"redirect_to": f"{settings.frontend_url}/register"},
                        }
                        lr = supabase_admin.auth.admin.generate_link(link_data)
                        invite_link_val = lr.properties.action_link
                    except Exception:
                        pass

            uid = str(user.id)
            if uid in existing_ids:
                already_member.append({"email": email, "reason": "Already a member"})
                continue

            supabase_admin.table("cohort_members").insert({
                "cohort_id": cohort_id,
                "user_id": uid,
            }).execute()
            existing_ids.add(uid)
            enrolled.append({"email": email, "invited": invited_new})

            # Fire-and-forget enrollment email
            try:
                meta = getattr(user, "user_metadata", None) or {}
                user_name_val = (entry.name or meta.get("name", "")) or email

                if is_activated:
                    send_template_email("cohort_enrollment_existing", email, {
                        "user_name": user_name_val,
                        "user_email": email,
                        "cohort_name": cohort_name_for_bulk,
                        "platform_name": "Adizes India",
                        "platform_url": settings.frontend_url,
                    })
                else:
                    send_template_email("user_enrolled", email, {
                        "user_name": user_name_val,
                        "user_email": email,
                        "cohort_name": cohort_name_for_bulk,
                        "invite_link": invite_link_val,
                        "platform_name": "Adizes India",
                        "platform_url": settings.frontend_url,
                    })
            except Exception:
                pass  # Non-fatal

        except Exception as e:
            failed.append({"email": email, "reason": str(e)})

    return {"enrolled": enrolled, "already_member": already_member, "failed": failed}


@router.delete("/cohorts/{cohort_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(cohort_id: str, user_id: str, admin: dict = Depends(require_admin)):
    """Remove a user from a cohort."""
    supabase_admin.table("cohort_members").delete() \
        .eq("cohort_id", cohort_id).eq("user_id", user_id).execute()


@router.post("/cohorts/{cohort_id}/members/{user_id}/resend-invite")
def resend_enrollment_invite(cohort_id: str, user_id: str, admin: dict = Depends(require_admin)):
    """Resend enrollment invite email to a pending cohort member."""
    # Verify membership
    member = (
        supabase_admin.table("cohort_members")
        .select("user_id")
        .eq("cohort_id", cohort_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not member.data:
        raise HTTPException(status_code=404, detail="Member not found in this cohort")

    cohort_row = (
        supabase_admin.table("cohorts")
        .select("name")
        .eq("id", cohort_id)
        .single()
        .execute()
    )
    cohort_name_val = cohort_row.data.get("name", "") if cohort_row.data else ""

    try:
        auth_user = supabase_admin.auth.admin.get_user_by_id(user_id).user
    except Exception:
        raise HTTPException(status_code=404, detail="User not found")

    email = auth_user.email or ""
    meta = getattr(auth_user, "user_metadata", None) or {}
    user_name_val = meta.get("name", "") or email

    is_activated = getattr(auth_user, "email_confirmed_at", None) is not None

    invite_link_val = settings.frontend_url
    if not is_activated:
        try:
            lr = supabase_admin.auth.admin.generate_link({
                "type": "recovery",
                "email": email,
                "options": {"redirect_to": f"{settings.frontend_url}/register"},
            })
            invite_link_val = lr.properties.action_link
        except Exception:
            pass

    if not smtp_configured():
        raise HTTPException(status_code=400, detail="SMTP is not configured. Please set up SMTP in Settings first.")

    try:
        if is_activated:
            send_template_email("cohort_enrollment_existing", email, {
                "user_name": user_name_val,
                "user_email": email,
                "cohort_name": cohort_name_val,
                "platform_name": "Adizes India",
                "platform_url": settings.frontend_url,
            })
        else:
            send_template_email("user_enrolled", email, {
                "user_name": user_name_val,
                "user_email": email,
                "cohort_name": cohort_name_val,
                "invite_link": invite_link_val,
                "platform_name": "Adizes India",
                "platform_url": settings.frontend_url,
            })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {e}")

    return {"message": f"Enrollment invite resent to {email}"}


@router.get("/users", response_model=list[AdminUserSummary])
def list_admin_users(admin: dict = Depends(require_admin)):
    """List all administrator accounts."""
    try:
        all_users = supabase_admin.auth.admin.list_users()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    admins = []
    for u in all_users:
        app_meta = getattr(u, "app_metadata", None) or {}
        if app_meta.get("role") != "admin":
            continue
        meta = getattr(u, "user_metadata", None) or {}
        last_sign_in = getattr(u, "last_sign_in_at", None)
        # Determine status: if user has never signed in, treat as invited
        status_label = "invited" if not last_sign_in else "active"
        admins.append(AdminUserSummary(
            id=str(u.id),
            name=meta.get("name", ""),
            email=u.email or "",
            status=status_label,
            last_sign_in=str(last_sign_in) if last_sign_in else None,
            created_at=str(u.created_at),
        ))

    return admins


@router.post("/users/invite", status_code=status.HTTP_201_CREATED)
def invite_admin(body: InviteAdminRequest, admin: dict = Depends(require_admin)):
    """Send an email invite to a new administrator."""
    # generate_link(type=invite) creates the user AND returns the invite link in one call.
    # invite_user_by_email sends Supabase's own email but gives us no link for our custom email.
    try:
        lr = supabase_admin.auth.admin.generate_link({
            "type": "invite",
            "email": body.email,
            "options": {
                "data": {"name": body.name},
                "redirect_to": f"{settings.frontend_url}/register",
            },
        })
        invite_link_val = lr.properties.action_link
        user_id = str(lr.user.id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Set admin role on the newly-invited user
    try:
        supabase_admin.auth.admin.update_user_by_id(
            user_id, {"app_metadata": {"role": "admin"}}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Invite created but could not set admin role: {e}")

    # Fire-and-forget admin invite email via SMTP
    try:
        send_template_email("admin_invite", body.email, {
            "admin_name": body.name or body.email,
            "admin_email": body.email,
            "invite_link": invite_link_val,
            "platform_name": "Adizes India",
            "platform_url": settings.frontend_url,
        })
    except Exception:
        pass  # Non-fatal — link is still valid even if SMTP fails

    return {
        "message": f"Invite email sent to {body.email}",
        "user_id": user_id,
    }


@router.post("/users/{user_id}/resend-invite", status_code=status.HTTP_200_OK)
def resend_invite(user_id: str, admin: dict = Depends(require_admin)):
    """Resend the invite email for a pending administrator."""
    try:
        auth_user = supabase_admin.auth.admin.get_user_by_id(user_id).user
    except Exception:
        raise HTTPException(status_code=404, detail="User not found")

    email = auth_user.email or ""
    meta = getattr(auth_user, "user_metadata", None) or {}
    admin_name = meta.get("name", "") or email

    # For existing invited users, type=invite fails ("already registered").
    # type=recovery works for any existing user and redirects to /register.
    invite_link_val = settings.frontend_url
    try:
        lr = supabase_admin.auth.admin.generate_link({
            "type": "recovery",
            "email": email,
            "options": {"redirect_to": f"{settings.frontend_url}/register"},
        })
        invite_link_val = lr.properties.action_link
    except Exception:
        pass  # Fall back to platform URL

    if not smtp_configured():
        raise HTTPException(
            status_code=400,
            detail="SMTP is not configured. Please set up SMTP in Settings to resend invites.",
        )

    try:
        send_template_email("admin_invite", email, {
            "admin_name": admin_name,
            "admin_email": email,
            "invite_link": invite_link_val,
            "platform_name": "Adizes India",
            "platform_url": settings.frontend_url,
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {e}")

    return {"message": f"Invite resent to {email}"}


@router.put("/users/{user_id}/password", status_code=status.HTTP_200_OK)
def change_admin_password(user_id: str, body: ChangePasswordRequest, admin: dict = Depends(require_admin)):
    """Set a new password for an administrator account."""
    try:
        supabase_admin.auth.admin.update_user_by_id(
            user_id, {"password": body.password}
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"message": "Password updated successfully"}


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_admin_user(user_id: str, admin: dict = Depends(require_admin)):
    """Remove an administrator account."""
    # Prevent self-deletion
    if user_id == admin["sub"]:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    try:
        supabase_admin.auth.admin.delete_user(user_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/respondents/{user_id}")
def get_respondent(
    user_id: str,
    cohort_id: Optional[str] = None,
    admin: dict = Depends(require_admin),
):
    if not cohort_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="cohort_id query parameter is required",
        )

    try:
        auth_resp = supabase_admin.auth.admin.get_user_by_id(user_id)
        auth_user = auth_resp.user
        email = auth_user.email or ""
        meta = getattr(auth_user, "user_metadata", None) or {}
        name = meta.get("name", "")
    except Exception:
        raise HTTPException(status_code=404, detail="User not found")

    assessment = (
        supabase_admin.table("assessments")
        .select("*")
        .eq("user_id", user_id)
        .eq("cohort_id", cohort_id)
        .limit(1)
        .execute()
    )

    result_data = assessment.data[0] if assessment.data else None

    return {
        "user": {"id": user_id, "email": email, "name": name},
        "result": result_data,
        "cohort_id": cohort_id,
    }


@router.get("/export/{cohort_id}")
def export_cohort_csv(cohort_id: str, admin: dict = Depends(require_admin)):
    cohort_detail = get_cohort(cohort_id, admin)
    respondents_data = [r.model_dump() for r in cohort_detail.respondents]
    csv_bytes = generate_cohort_csv(respondents_data)
    return StreamingResponse(
        io.BytesIO(csv_bytes),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="cohort_{cohort_id[:8]}_export.csv"'},
    )


def _compute_team_scores(all_scaled: list) -> TeamScores:
    n = len(all_scaled)
    roles = ["P", "A", "E", "I"]
    dims = ["is", "should", "want"]

    avg = {
        d: {r: round(sum(s[d][r] for s in all_scaled) / n) for r in roles}
        for d in dims
    }

    dist = {r: 0 for r in roles}
    for s in all_scaled:
        want = s.get("want", {})
        for r in roles:
            if want.get(r, 0) > 30:
                dist[r] += 1

    return TeamScores(average_scaled=avg, style_distribution=dist)


# ─────────────────────────────────────────────────────────────
# Org module helpers
# ─────────────────────────────────────────────────────────────

def _parse_dmy_date(value: str | None) -> str | None:
    """Parse DD/MM/YYYY → YYYY-MM-DD. Returns None for None/empty. Raises ValueError on bad format."""
    if not value:
        return None
    from datetime import datetime
    try:
        return datetime.strptime(value.strip(), "%d/%m/%Y").strftime("%Y-%m-%d")
    except ValueError:
        raise ValueError(f"Invalid date '{value}' — expected DD/MM/YYYY")


def _build_org_tree(flat_nodes: list[dict], employee_counts: dict) -> list[dict]:
    """Convert flat node list into nested tree. Returns list with single root element."""
    node_map = {}
    for n in flat_nodes:
        node_map[n["id"]] = {**n, "employee_count": employee_counts.get(n["id"], 0), "children": []}

    roots = []
    for n in flat_nodes:
        entry = node_map[n["id"]]
        if n["parent_id"] is None:
            roots.append(entry)
        else:
            parent = node_map.get(n["parent_id"])
            if parent:
                parent["children"].append(entry)

    # Sort children by display_order
    def _sort(node):
        node["children"].sort(key=lambda x: x["display_order"])
        for child in node["children"]:
            _sort(child)
    for r in roots:
        _sort(r)
    return roots


def _resolve_node_path(node_path: str, flat_nodes: list[dict]) -> str | None:
    """
    Resolve a "/"-separated name chain to a node id.
    e.g. "North India Division/Sales" -> "dep-uuid"
    Matching is case-insensitive and trimmed. Root node is excluded from the path.
    Returns None if not found or path is empty.
    """
    if not node_path or not node_path.strip():
        return None
    parts = [p.strip().lower() for p in node_path.strip("/").split("/")]
    # Build parent→children map
    children_map: dict[str | None, list[dict]] = {}
    for n in flat_nodes:
        children_map.setdefault(n["parent_id"], []).append(n)

    # Root's children are the first level
    root = next((n for n in flat_nodes if n["is_root"]), None)
    if not root:
        return None

    current_candidates = children_map.get(root["id"], [])
    current_id = None
    for part in parts:
        match = next(
            (n for n in sorted(current_candidates, key=lambda x: x["display_order"])
             if n["name"].strip().lower() == part),
            None,
        )
        if not match:
            return None
        current_id = match["id"]
        current_candidates = children_map.get(current_id, [])
    return current_id


# ─────────────────────────────────────────────────────────────
# Organization CRUD
# ─────────────────────────────────────────────────────────────

@router.get("/organizations", response_model=list[OrgSummary])
def list_organizations(admin: dict = Depends(require_admin)):
    orgs = supabase_admin.table("organizations").select("*").order("created_at", desc=True).execute()
    result = []
    for org in (orgs.data or []):
        node_count = len(
            supabase_admin.table("org_nodes").select("id").eq("org_id", org["id"]).execute().data or []
        )
        emp_count = len(
            supabase_admin.table("org_employees").select("id").eq("org_id", org["id"]).execute().data or []
        )
        result.append(OrgSummary(
            id=org["id"], name=org["name"], description=org.get("description"),
            node_count=node_count, employee_count=emp_count, created_at=org["created_at"],
        ))
    return result


@router.post("/organizations", response_model=OrgDetail, status_code=201)
def create_organization(body: CreateOrgRequest, admin: dict = Depends(require_admin)):
    org = supabase_admin.table("organizations").insert(
        {"name": body.name, "description": body.description}
    ).execute().data[0]

    org_id = org["id"]
    root_id = str(uuid.uuid4())
    root_path = f"{org_id}/{root_id}"
    supabase_admin.table("org_nodes").insert({
        "id": root_id, "org_id": org_id, "parent_id": None,
        "is_root": True, "path": root_path,
        "name": body.name, "node_type": "company", "display_order": 0,
    }).execute()

    return _get_org_detail(org_id)


@router.get("/organizations/{org_id}", response_model=OrgDetail)
def get_organization(org_id: str, admin: dict = Depends(require_admin)):
    org = supabase_admin.table("organizations").select("*").eq("id", org_id).maybe_single().execute()
    if not org.data:
        raise HTTPException(status_code=404, detail="Organisation not found")
    return _get_org_detail(org_id)


@router.put("/organizations/{org_id}", response_model=OrgDetail)
def update_organization(org_id: str, body: UpdateOrgRequest, admin: dict = Depends(require_admin)):
    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Nothing to update")
    supabase_admin.table("organizations").update(update_data).eq("id", org_id).execute()
    return _get_org_detail(org_id)


@router.delete("/organizations/{org_id}", status_code=204)
def delete_organization(org_id: str, admin: dict = Depends(require_admin)):
    emp_check = supabase_admin.table("org_employees").select("id").eq("org_id", org_id).limit(1).execute()
    if emp_check.data:
        raise HTTPException(status_code=400, detail="Remove all employees before deleting this organisation")
    supabase_admin.table("organizations").delete().eq("id", org_id).execute()


# NOTE: _get_org_detail is called by create_organization (above) and the GET/PUT endpoints.
# Python resolves module-level names at call time — forward references are fine as long as
# all these functions are in the same file.
def _get_org_detail(org_id: str) -> OrgDetail:
    """Shared helper: fetch org + full tree + linked cohort count."""
    org = supabase_admin.table("organizations").select("*").eq("id", org_id).single().execute().data
    flat_nodes = (
        supabase_admin.table("org_nodes").select("*")
        .eq("org_id", org_id).order("display_order").execute().data or []
    )
    emp_rows = (
        supabase_admin.table("org_employees").select("id, node_id")
        .eq("org_id", org_id).execute().data or []
    )
    emp_counts: dict[str, int] = {}
    for e in emp_rows:
        emp_counts[e["node_id"]] = emp_counts.get(e["node_id"], 0) + 1

    cohort_count = len(
        supabase_admin.table("cohort_organizations").select("cohort_id")
        .eq("org_id", org_id).execute().data or []
    )
    tree = _build_org_tree(flat_nodes, emp_counts)
    return OrgDetail(
        id=org["id"], name=org["name"], description=org.get("description"),
        created_at=org["created_at"], linked_cohort_count=cohort_count, tree=tree,
    )


# ─────────────────────────────────────────────────────────────
# Node Management
# ─────────────────────────────────────────────────────────────

@router.post("/organizations/{org_id}/nodes", status_code=201)
def create_node(org_id: str, body: CreateNodeRequest, admin: dict = Depends(require_admin)):
    parent = (
        supabase_admin.table("org_nodes").select("*")
        .eq("id", body.parent_id).eq("org_id", org_id).maybe_single().execute()
    )
    if not parent.data:
        raise HTTPException(status_code=404, detail="Parent node not found in this organisation")
    new_id = str(uuid.uuid4())
    new_path = f"{parent.data['path']}/{new_id}"
    supabase_admin.table("org_nodes").insert({
        "id": new_id, "org_id": org_id, "parent_id": body.parent_id,
        "is_root": False, "path": new_path, "name": body.name,
        "node_type": body.node_type, "display_order": body.display_order,
    }).execute()
    return {"id": new_id, "path": new_path}


@router.put("/organizations/{org_id}/nodes/{node_id}")
def update_node(org_id: str, node_id: str, body: UpdateNodeRequest, admin: dict = Depends(require_admin)):
    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Nothing to update")
    supabase_admin.table("org_nodes").update(update_data).eq("id", node_id).eq("org_id", org_id).execute()
    return {"updated": True}


@router.delete("/organizations/{org_id}/nodes/{node_id}", status_code=204)
def delete_node(org_id: str, node_id: str, admin: dict = Depends(require_admin)):
    node = (
        supabase_admin.table("org_nodes").select("*")
        .eq("id", node_id).eq("org_id", org_id).maybe_single().execute()
    )
    if not node.data:
        raise HTTPException(status_code=404, detail="Node not found")
    if node.data["is_root"]:
        raise HTTPException(status_code=400, detail="Cannot delete the root node of an organisation")

    # Check this node and all descendants for employees
    node_path = node.data["path"]
    subtree_ids = [
        n["id"] for n in (
            supabase_admin.table("org_nodes").select("id")
            .eq("org_id", org_id)
            .or_(f"id.eq.{node_id},path.like.{node_path}/%")
            .execute().data or []
        )
    ]
    emp_check = (
        supabase_admin.table("org_employees").select("id")
        .in_("node_id", subtree_ids).limit(1).execute()
    )
    if emp_check.data:
        raise HTTPException(status_code=400, detail="Node or sub-nodes contain employees — remove them first")
    supabase_admin.table("org_nodes").delete().eq("id", node_id).execute()


# ─────────────────────────────────────────────────────────────
# Employee Management
# ─────────────────────────────────────────────────────────────

@router.get("/organizations/{org_id}/nodes/{node_id}/employees",
            response_model=list[OrgEmployeeSummary])
def list_node_employees(
    org_id: str, node_id: str,
    include_descendants: bool = False,
    admin: dict = Depends(require_admin),
):
    if include_descendants:
        node = (
            supabase_admin.table("org_nodes").select("path")
            .eq("id", node_id).eq("org_id", org_id).single().execute()
        )
        node_path = node.data["path"]
        subtree_ids = [
            n["id"] for n in (
                supabase_admin.table("org_nodes").select("id")
                .eq("org_id", org_id)
                .or_(f"id.eq.{node_id},path.like.{node_path}/%")
                .execute().data or []
            )
        ]
        emp_rows = (
            supabase_admin.table("org_employees").select("*")
            .in_("node_id", subtree_ids).execute().data or []
        )
    else:
        emp_rows = (
            supabase_admin.table("org_employees").select("*")
            .eq("node_id", node_id).execute().data or []
        )

    auth_users = _get_auth_users_map()
    result = []
    for e in emp_rows:
        u = auth_users.get(e["user_id"])
        name = (u.user_metadata or {}).get("name", "") if u else ""
        email = u.email if u else ""
        status_str = "active" if (u and u.email_confirmed_at) else "pending"
        result.append(OrgEmployeeSummary(
            id=e["id"], user_id=e["user_id"], name=name, email=email,
            last_name=e.get("last_name"), middle_name=e.get("middle_name"),
            title=e.get("title"), employee_id=e.get("employee_id"),
            emp_status=e.get("emp_status") or "Active",
            gender=e.get("gender"),
            default_language=e.get("default_language") or "English",
            manager_email=e.get("manager_email"),
            dob=str(e["dob"]) if e.get("dob") else None,
            emp_date=str(e["emp_date"]) if e.get("emp_date") else None,
            head_of_dept=bool(e.get("head_of_dept", False)),
            status=status_str, node_id=e["node_id"], joined_at=str(e["joined_at"]),
        ))
    return result


@router.post("/organizations/{org_id}/nodes/{node_id}/employees", status_code=201)
def add_employee(
    org_id: str, node_id: str, body: AddEmployeeRequest,
    admin: dict = Depends(require_admin),
):
    # Verify node belongs to org
    node = (
        supabase_admin.table("org_nodes").select("id")
        .eq("id", node_id).eq("org_id", org_id).limit(1).execute()
    )
    if not node.data:
        raise HTTPException(status_code=404, detail="Node not found in this organisation")

    org = supabase_admin.table("organizations").select("name").eq("id", org_id).single().execute().data
    org_name = org["name"]

    return _add_employee_to_node(
        org_id=org_id, org_name=org_name, node_id=node_id,
        email=str(body.email), name=body.name,
        title=body.title, employee_id=body.employee_id,
        last_name=body.last_name, middle_name=body.middle_name,
        emp_status=body.emp_status, gender=body.gender,
        default_language=body.default_language,
        manager_email=str(body.manager_email) if body.manager_email else None,
        dob=body.dob, emp_date=body.emp_date,
        head_of_dept=body.head_of_dept,
    )


def _add_employee_to_node(
    org_id: str, org_name: str, node_id: str,
    email: str, name: str,
    title: str | None = None,
    employee_id: str | None = None,
    last_name: str | None = None,
    middle_name: str | None = None,
    emp_status: str = 'Active',
    gender: str | None = None,
    default_language: str = 'English',
    manager_email: str | None = None,
    dob: str | None = None,       # DD/MM/YYYY — parsed to ISO before insert
    emp_date: str | None = None,  # DD/MM/YYYY — parsed to ISO before insert
    head_of_dept: bool = False,
) -> dict:
    """
    3-case logic:
      1. New user    → generate_link(invite) → insert org_employees → send org_welcome
      2. Unactivated → generate_link(recovery) → insert org_employees → send org_welcome
      3. Active      → insert org_employees only, no email
    Returns {"user_id": ..., "created": bool, "emailed": bool}
    """
    # Check if already in this org
    try:
        existing_users = supabase_admin.auth.admin.list_users()
        target = next((u for u in existing_users if u.email == email), None)
    except Exception:
        target = None

    activation_url = settings.frontend_url
    is_new = target is None
    is_unactivated = target is not None and target.email_confirmed_at is None

    if is_new:
        try:
            lr = supabase_admin.auth.admin.generate_link({
                "type": "invite",
                "email": email,
                "data": {"name": name},
                "options": {"redirect_to": f"{settings.frontend_url}/register"},
            })
            activation_url = lr.properties.action_link
            target = supabase_admin.auth.admin.get_user_by_id(lr.user.id).user
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Could not create user: {e}")

    elif is_unactivated:
        try:
            lr = supabase_admin.auth.admin.generate_link({
                "type": "recovery",
                "email": email,
                "options": {"redirect_to": f"{settings.frontend_url}/register"},
            })
            activation_url = lr.properties.action_link
        except Exception:
            activation_url = settings.frontend_url

    user_id = str(target.id)

    # Check not already in this org
    dup = (
        supabase_admin.table("org_employees").select("id")
        .eq("org_id", org_id).eq("user_id", user_id).limit(1).execute()
    )
    if dup.data:
        raise HTTPException(status_code=409, detail="Employee already in this organisation")

    from app.schemas.org import EMP_STATUS_VALUES
    if emp_status not in EMP_STATUS_VALUES:
        raise HTTPException(status_code=422, detail=f"Invalid emp_status '{emp_status}'")

    try:
        dob_iso = _parse_dmy_date(dob)
        emp_date_iso = _parse_dmy_date(emp_date)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    supabase_admin.table("org_employees").insert({
        "org_id": org_id, "node_id": node_id, "user_id": user_id,
        "employee_id": employee_id, "title": title,
        "last_name": last_name, "middle_name": middle_name,
        "emp_status": emp_status, "gender": gender,
        "default_language": default_language, "manager_email": manager_email,
        "dob": dob_iso, "emp_date": emp_date_iso, "head_of_dept": head_of_dept,
    }).execute()

    emailed = False
    if (is_new or is_unactivated) and smtp_configured():
        try:
            send_template_email("org_welcome", email, {
                "user_name": name,
                "org_name": org_name,
                "platform_name": "Adizes India",
                "platform_url": settings.frontend_url,
                "activation_url": activation_url,
            })
            emailed = True
        except Exception as exc:
            logger.error(f"[org] Welcome email failed for {email}: {exc}")

    return {"user_id": user_id, "created": is_new, "emailed": emailed}


@router.post("/organizations/{org_id}/nodes/{node_id}/employees/bulk")
async def bulk_upload_employees(
    org_id: str, node_id: str,
    file: UploadFile,
    admin: dict = Depends(require_admin),
):
    node = (
        supabase_admin.table("org_nodes").select("id")
        .eq("id", node_id).eq("org_id", org_id).limit(1).execute()
    )
    if not node.data:
        raise HTTPException(status_code=404, detail="Node not found")

    org = supabase_admin.table("organizations").select("name").eq("id", org_id).single().execute().data
    org_name = org["name"]

    flat_nodes = (
        supabase_admin.table("org_nodes").select("*").eq("org_id", org_id).execute().data or []
    )

    contents = await file.read()
    reader = csv.DictReader(_io.StringIO(contents.decode("utf-8-sig")))

    created = skipped = 0
    errors = []

    seen_emails = set()
    for row_idx, row in enumerate(reader, start=2):  # row 1 = header
        email = (row.get("email") or "").strip()
        name = (row.get("name") or "").strip()
        title = (row.get("title") or "").strip() or None
        ext_id = (row.get("employee_id") or "").strip() or None
        node_path_val = (row.get("node_path") or "").strip() or None

        # Validate email
        if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
            errors.append({"row": row_idx, "email": email, "reason": "invalid email"})
            continue

        # Duplicate in file
        if email.lower() in seen_emails:
            errors.append({"row": row_idx, "email": email, "reason": "duplicate in file"})
            continue
        seen_emails.add(email.lower())

        # Resolve target node
        target_node_id = node_id
        if node_path_val:
            resolved = _resolve_node_path(node_path_val, flat_nodes)
            if resolved is None:
                errors.append({"row": row_idx, "email": email, "reason": f"node_path not found: {node_path_val}"})
                continue
            target_node_id = resolved

        try:
            _add_employee_to_node(
                org_id=org_id, org_name=org_name, node_id=target_node_id,
                email=email, name=name, title=title, employee_id=ext_id,
            )
            created += 1
        except HTTPException as he:
            if he.status_code == 409:
                skipped += 1
            else:
                errors.append({"row": row_idx, "email": email, "reason": he.detail})
        except Exception as e:
            errors.append({"row": row_idx, "email": email, "reason": str(e)})

    return BulkUploadResult(created=created, skipped=skipped, errors=errors)


@router.delete("/organizations/{org_id}/employees/{org_employee_id}", status_code=204)
def remove_employee(org_id: str, org_employee_id: str, admin: dict = Depends(require_admin)):
    """Remove employee from org. Does NOT delete auth user or cohort memberships."""
    supabase_admin.table("org_employees").delete()\
        .eq("id", org_employee_id).eq("org_id", org_id).execute()


# ─────────────────────────────────────────────────────────────
# Cohort ↔ Organisation linking
# ─────────────────────────────────────────────────────────────

@router.get("/cohorts/{cohort_id}/organizations", response_model=list[LinkedOrgSummary])
def list_cohort_orgs(cohort_id: str, admin: dict = Depends(require_admin)):
    rows = (
        supabase_admin.table("cohort_organizations").select("org_id, linked_at")
        .eq("cohort_id", cohort_id).execute().data or []
    )
    result = []
    for r in rows:
        org = supabase_admin.table("organizations").select("name").eq("id", r["org_id"]).single().execute().data
        emp_count = len(
            supabase_admin.table("org_employees").select("id").eq("org_id", r["org_id"]).execute().data or []
        )
        result.append(LinkedOrgSummary(
            org_id=r["org_id"], name=org["name"],
            employee_count=emp_count, linked_at=str(r["linked_at"]),
        ))
    return result


@router.post("/cohorts/{cohort_id}/organizations", status_code=201)
def link_org_to_cohort(cohort_id: str, body: LinkOrgRequest, admin: dict = Depends(require_admin)):
    try:
        supabase_admin.table("cohort_organizations").insert(
            {"cohort_id": cohort_id, "org_id": body.org_id}
        ).execute()
    except Exception as e:
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            raise HTTPException(status_code=409, detail="Organisation already linked to this cohort")
        raise HTTPException(status_code=400, detail=str(e))
    return {"linked": True}


@router.delete("/cohorts/{cohort_id}/organizations/{org_id}", status_code=204)
def unlink_org_from_cohort(cohort_id: str, org_id: str, admin: dict = Depends(require_admin)):
    supabase_admin.table("cohort_organizations").delete()\
        .eq("cohort_id", cohort_id).eq("org_id", org_id).execute()


@router.get("/organizations/{org_id}/cohorts", response_model=list[LinkedCohortSummary])
def list_org_cohorts(org_id: str, admin: dict = Depends(require_admin)):
    rows = (
        supabase_admin.table("cohort_organizations").select("cohort_id, linked_at")
        .eq("org_id", org_id).execute().data or []
    )
    result = []
    for r in rows:
        cohort = supabase_admin.table("cohorts").select("name").eq("id", r["cohort_id"]).single().execute().data
        result.append(LinkedCohortSummary(
            cohort_id=r["cohort_id"], name=cohort["name"], linked_at=str(r["linked_at"]),
        ))
    return result


# ─────────────────────────────────────────────────────────────
# Enrol from Org
# ─────────────────────────────────────────────────────────────

@router.post("/cohorts/{cohort_id}/enroll-from-org", response_model=EnrollFromOrgResult)
def enroll_from_org(cohort_id: str, body: EnrollFromOrgRequest, admin: dict = Depends(require_admin)):
    # Resolve which user_ids to enrol
    if body.user_ids:
        target_user_ids = body.user_ids
    else:
        # Resolve by scope
        if body.node_id and body.include_descendants:
            node = (
                supabase_admin.table("org_nodes").select("path")
                .eq("id", body.node_id).single().execute()
            )
            node_path = node.data["path"]
            subtree_ids = [
                n["id"] for n in (
                    supabase_admin.table("org_nodes").select("id")
                    .eq("org_id", body.org_id)
                    .or_(f"id.eq.{body.node_id},path.like.{node_path}/%")
                    .execute().data or []
                )
            ]
            emp_rows = (
                supabase_admin.table("org_employees").select("user_id")
                .in_("node_id", subtree_ids).execute().data or []
            )
        elif body.node_id and not body.include_descendants:
            emp_rows = (
                supabase_admin.table("org_employees").select("user_id")
                .eq("node_id", body.node_id).execute().data or []
            )
        else:
            # Entire org
            emp_rows = (
                supabase_admin.table("org_employees").select("user_id")
                .eq("org_id", body.org_id).execute().data or []
            )
        target_user_ids = [e["user_id"] for e in emp_rows]

    if not target_user_ids:
        return EnrollFromOrgResult(enrolled=0, skipped=0)

    # Check existing cohort members
    existing = {
        m["user_id"] for m in (
            supabase_admin.table("cohort_members").select("user_id")
            .eq("cohort_id", cohort_id).in_("user_id", target_user_ids).execute().data or []
        )
    }

    to_enrol = [uid for uid in target_user_ids if uid not in existing]
    skipped = len(target_user_ids) - len(to_enrol)
    enrolled = 0

    for user_id in to_enrol:
        try:
            u = supabase_admin.auth.admin.get_user_by_id(user_id).user
            if not u:
                continue
            _enroll_single_user(cohort_id=cohort_id, user_id=user_id,
                                email=u.email, name=None,
                                email_confirmed_at=u.email_confirmed_at)
            enrolled += 1
        except Exception as e:
            logger.error(f"[enroll-from-org] Failed for user {user_id}: {e}")

    return EnrollFromOrgResult(enrolled=enrolled, skipped=skipped)
