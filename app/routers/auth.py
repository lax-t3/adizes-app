from fastapi import APIRouter, HTTPException, status
from app.schemas.auth import LoginRequest, RegisterRequest, AuthResponse
from app.database import supabase

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
