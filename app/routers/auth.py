from fastapi import APIRouter, HTTPException, status, Depends
from app.schemas.auth import (
    LoginRequest, RegisterRequest, AuthResponse,
    ProfileResponse, UpdateProfileRequest, ChangePasswordRequest,
    CohortAssessmentHistory,
    ForgotPasswordRequest, ForgotPasswordResponse,
)
from app.database import supabase, supabase_admin
from app.auth import get_current_user
from app.config import settings
from app.services.email_service import send_template_email, smtp_configured
from pydantic import BaseModel

router = APIRouter()


@router.post("/login", response_model=AuthResponse)
def login(body: LoginRequest):
    try:
        resp = supabase.auth.sign_in_with_password(
            {"email": body.email, "password": body.password}
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))

    user = resp.user
    session = resp.session
    meta = user.user_metadata or {}
    role = (user.app_metadata or {}).get("role", "user")

    return AuthResponse(
        access_token=session.access_token,
        user_id=str(user.id),
        email=user.email,
        name=meta.get("name", ""),
        role=role,
    )


@router.post("/register", response_model=AuthResponse)
def register(body: RegisterRequest):
    try:
        resp = supabase.auth.sign_up({
            "email": body.email,
            "password": body.password,
            "options": {"data": {"name": body.name}},
        })
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    user = resp.user
    session = resp.session

    if not session:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration succeeded but email confirmation may be required.",
        )

    return AuthResponse(
        access_token=session.access_token,
        user_id=str(user.id),
        email=user.email,
        name=body.name,
        role="user",
    )


class SetPasswordRequest(BaseModel):
    password: str


@router.post("/set-password", status_code=status.HTTP_200_OK)
def set_password(body: SetPasswordRequest, current_user: dict = Depends(get_current_user)):
    """Set a new password for the currently authenticated user (used during invite acceptance)."""
    user_id = current_user["sub"]
    try:
        supabase_admin.auth.admin.update_user_by_id(user_id, {"password": body.password})
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"message": "Password set successfully"}


# ─── Profile ──────────────────────────────────────────────────────────────────

@router.get("/profile", response_model=ProfileResponse)
def get_profile(current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    try:
        resp = supabase_admin.auth.admin.get_user_by_id(user_id)
        auth_user = resp.user
    except Exception:
        raise HTTPException(status_code=404, detail="User not found")

    meta = getattr(auth_user, "user_metadata", None) or {}
    return ProfileResponse(
        user_id=user_id,
        email=auth_user.email or "",
        name=meta.get("name", ""),
        phone=meta.get("phone", None),
    )


@router.put("/profile", response_model=ProfileResponse)
def update_profile(body: UpdateProfileRequest, current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]

    # Fetch existing metadata so we don't clobber other keys
    try:
        resp = supabase_admin.auth.admin.get_user_by_id(user_id)
        existing_meta = getattr(resp.user, "user_metadata", None) or {}
    except Exception:
        existing_meta = {}

    updated_meta = {**existing_meta, "name": body.name}
    if body.phone is not None:
        updated_meta["phone"] = body.phone

    updates: dict = {"user_metadata": updated_meta}
    if body.email != (resp.user.email if resp else ""):
        updates["email"] = str(body.email)

    try:
        updated = supabase_admin.auth.admin.update_user_by_id(user_id, updates)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    new_meta = getattr(updated.user, "user_metadata", None) or {}
    return ProfileResponse(
        user_id=user_id,
        email=updated.user.email or str(body.email),
        name=new_meta.get("name", body.name),
        phone=new_meta.get("phone", body.phone),
    )


@router.put("/password")
def change_password(body: ChangePasswordRequest, current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]

    # Verify current password by attempting a sign-in
    try:
        auth_user = supabase_admin.auth.admin.get_user_by_id(user_id).user
        email = auth_user.email
    except Exception:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        supabase.auth.sign_in_with_password({"email": email, "password": body.current_password})
    except Exception:
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")

    try:
        supabase_admin.auth.admin.update_user_by_id(user_id, {"password": body.new_password})
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {"message": "Password updated successfully"}


# ─── Forgot Password ──────────────────────────────────────────────────────────

@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(body: ForgotPasswordRequest):
    """
    Request a password reset link.
    Always returns 200 to avoid email enumeration.
    Returns status="not_activated" if the user exists but has not yet activated their account.
    Returns status="sent" for all other cases (activated user, unknown email).
    """
    if not smtp_configured():
        raise HTTPException(status_code=400, detail="SMTP is not configured")

    # supabase-py list_users() has no filter param — must iterate all users
    try:
        all_users = supabase_admin.auth.admin.list_users()
        target = next((u for u in all_users if u.email == body.email), None)
    except Exception:
        target = None

    # Unknown email — return "sent" silently to avoid email enumeration
    if target is None:
        return ForgotPasswordResponse(status="sent")

    # Not activated — tell them to use activation link instead
    if getattr(target, "email_confirmed_at", None) is None:
        return ForgotPasswordResponse(status="not_activated")

    # Activated — generate recovery link and send password reset email
    try:
        lr = supabase_admin.auth.admin.generate_link({
            "type": "recovery",
            "email": body.email,
            "options": {"redirect_to": f"{settings.frontend_url}/reset-password"},
        })
        user_name = (getattr(target, "user_metadata", None) or {}).get("name") or body.email
        send_template_email("password_reset", body.email, {
            "user_name": user_name,
            "reset_link": lr.properties.action_link,
            "platform_name": "Adizes India",
            "platform_url": settings.frontend_url,
        })
    except Exception:
        pass  # Return "sent" regardless to avoid enumeration

    return ForgotPasswordResponse(status="sent")


# ─── My Assessments ───────────────────────────────────────────────────────────

@router.get("/my-assessments", response_model=list[CohortAssessmentHistory])
def my_assessments(current_user: dict = Depends(get_current_user)):
    """Return all cohort enrollments for the current user with per-cohort assessment status."""
    user_id = current_user["sub"]

    members = (
        supabase_admin.table("cohort_members")
        .select("cohort_id, enrolled_at, cohorts(id, name)")
        .eq("user_id", user_id)
        .order("enrolled_at", desc=True)
        .execute()
    )

    result = []
    for m in (members.data or []):
        cohort = m.get("cohorts") or {}
        cohort_id = m["cohort_id"]

        # Fetch this user's assessment for this specific cohort
        assessment_resp = (
            supabase_admin.table("assessments")
            .select("id, completed_at, interpretation, status")
            .eq("user_id", user_id)
            .eq("cohort_id", cohort_id)
            .limit(1)
            .execute()
        )
        a = assessment_resp.data[0] if assessment_resp.data else None
        a_status = a.get("status", "pending") if a else "pending"

        dominant = None
        if a_status == "completed" and a and a.get("interpretation"):
            dominant = "".join(a["interpretation"].get("dominant_roles", []))

        result.append(CohortAssessmentHistory(
            cohort_id=cohort_id,
            cohort_name=cohort.get("name", ""),
            enrolled_at=m.get("enrolled_at"),
            status=a_status,
            result_id=a["id"] if a_status == "completed" and a else None,
            completed_at=a["completed_at"] if a_status == "completed" and a else None,
            dominant_style=dominant,
        ))

    return result
