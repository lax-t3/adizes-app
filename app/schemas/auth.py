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
