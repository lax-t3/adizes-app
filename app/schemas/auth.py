from pydantic import BaseModel, EmailStr
from typing import Optional


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    name: str
    role: str


class ProfileResponse(BaseModel):
    user_id: str
    email: str
    name: str
    phone: Optional[str] = None


class UpdateProfileRequest(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class CohortAssessmentHistory(BaseModel):
    cohort_id: str
    cohort_name: str
    enrolled_at: Optional[str] = None
    status: str  # "pending" | "completed" | "expired"
    result_id: Optional[str] = None
    completed_at: Optional[str] = None
    dominant_style: Optional[str] = None

