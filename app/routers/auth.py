from fastapi import APIRouter, HTTPException, status, Depends
from app.schemas.auth import (
    LoginRequest, RegisterRequest, AuthResponse,
    ProfileResponse, UpdateProfileRequest, ChangePasswordRequest,
)
from app.database import supabase, supabase_admin
from app.auth import get_current_user
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
