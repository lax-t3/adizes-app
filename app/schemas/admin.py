from pydantic import BaseModel, EmailStr
from typing import List, Optional


class CreateCohortRequest(BaseModel):
    name: str
    description: Optional[str] = None


class EnrollUserRequest(BaseModel):
    email: EmailStr


class InviteAdminRequest(BaseModel):
    name: str
    email: EmailStr


class ChangePasswordRequest(BaseModel):
    password: str


class AdminUserSummary(BaseModel):
    id: str
    name: str
    email: str
    status: str           # 'active' | 'invited'
    last_sign_in: Optional[str] = None
    created_at: str


class AdminStats(BaseModel):
    total_cohorts: int
    total_assessments: int
    completed_assessments: int
    completion_pct: int
    recent_completions: List[dict]


class CohortSummary(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    member_count: int
    completed_count: int
    completion_pct: float
    created_at: str


class RespondentSummary(BaseModel):
    user_id: str
    name: str
    email: str
    status: str           # 'pending' | 'completed'
    dominant_style: Optional[str] = None
    completed_at: Optional[str] = None


class TeamScores(BaseModel):
    average_scaled: dict   # { is, should, want } → { P,A,E,I } averages
    style_distribution: dict   # { P: n, A: n, E: n, I: n }


class CohortDetailResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    respondents: List[RespondentSummary]
    team_scores: Optional[TeamScores] = None
