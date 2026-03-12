from fastapi import APIRouter, Depends, HTTPException, status
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
        .select("user_id, user_name, completed_at")
        .execute()
    )
    all_assessments = assessments_resp.data or []
    total_assessments = len(all_assessments)
    completed = [a for a in all_assessments if a.get("completed_at")]
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
        member_ids = [m["user_id"] for m in members]
        completed = 0
        if member_ids:
            comp_rows = (
                supabase_admin.table("assessments")
                .select("user_id")
                .in_("user_id", member_ids)
                .not_.is_("completed_at", "null")
                .execute()
            )
            completed = len(comp_rows.data)

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
            .select("id, completed_at, scaled_scores, interpretation")
            .eq("user_id", uid)
            .order("completed_at", desc=True)
            .limit(1)
            .execute()
        )

        a = assessment.data[0] if assessment.data else None
        dominant = None
        if a and a.get("interpretation"):
            dominant = "".join(a["interpretation"].get("dominant_roles", []))
        if a and a.get("scaled_scores"):
            all_scaled.append(a["scaled_scores"])

        respondents.append(RespondentSummary(
            user_id=uid,
            name=name,
            email=email,
            status="completed" if (a and a.get("completed_at")) else "pending",
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

    supabase_admin.table("cohort_members").insert({
        "cohort_id": cohort_id,
        "user_id": str(target.id),
    }).execute()

    # For existing users who haven't confirmed yet, generate a recovery link
    if not invited_new and not getattr(target, "email_confirmed_at", None):
        try:
            lr = supabase_admin.auth.admin.generate_link({
                "type": "recovery",
                "email": body.email,
                "options": {"redirect_to": f"{settings.frontend_url}/register"},
            })
            invite_link_val = lr.properties.action_link
        except Exception:
            pass

    # Fire-and-forget enrollment email
    try:
        cohort_name_val = (
            supabase_admin.table("cohorts").select("name").eq("id", cohort_id).single().execute()
        ).data.get("name", "") if cohort.data else ""
        meta = getattr(target, "user_metadata", None) or {}
        user_name_val = meta.get("name", "") or body.email
        send_template_email("user_enrolled", body.email, {
            "user_name": user_name_val,
            "user_email": body.email,
            "cohort_name": cohort_name_val,
            "invite_link": invite_link_val,
            "platform_name": "Adizes India",
            "platform_url": settings.frontend_url,
        })
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

            # For existing users who haven't confirmed yet, generate a recovery link
            if not invited_new and not getattr(user, "email_confirmed_at", None):
                try:
                    lr = supabase_admin.auth.admin.generate_link({
                        "type": "recovery",
                        "email": email,
                        "options": {"redirect_to": f"{settings.frontend_url}/register"},
                    })
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
                cohort_resp = supabase_admin.table("cohorts").select("name").eq("id", cohort_id).single().execute()
                cohort_name_val = cohort_resp.data.get("name", "") if cohort_resp.data else ""
                meta = getattr(user, "user_metadata", None) or {}
                user_name_val = (entry.name or meta.get("name", "")) or email
                send_template_email("user_enrolled", email, {
                    "user_name": user_name_val,
                    "user_email": email,
                    "cohort_name": cohort_name_val,
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

    # Determine if user has confirmed their email (i.e. set a password via invite)
    email_confirmed = getattr(auth_user, "email_confirmed_at", None)
    invite_link_val = settings.frontend_url
    if not email_confirmed:
        # type=invite fails for already-registered users; use type=recovery instead
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
def get_respondent(user_id: str, admin: dict = Depends(require_admin)):
    assessment = (
        supabase_admin.table("assessments")
        .select("*")
        .eq("user_id", user_id)
        .order("completed_at", desc=True)
        .limit(1)
        .execute()
    )
    if not assessment.data:
        raise HTTPException(status_code=404, detail="No completed assessment found")

    try:
        auth_resp = supabase_admin.auth.admin.get_user_by_id(user_id)
        auth_user = auth_resp.user
        email = auth_user.email or ""
        meta = getattr(auth_user, "user_metadata", None) or {}
        name = meta.get("name", "")
    except Exception:
        email = ""
        name = assessment.data[0].get("user_name", "")

    return {
        "user": {"id": user_id, "email": email, "name": name},
        "result": assessment.data[0],
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
