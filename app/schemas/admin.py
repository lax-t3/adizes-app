from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class CreateCohortRequest(BaseModel):
    name: str
    description: Optional[str] = None


class CohortSummary(BaseModel):
    id: str
    name: str
    description: Optional[str]
    member_count: int
    completed_count: int
    completion_pct: float
    created_at: str


class RespondentSummary(BaseModel):
    user_id: str
    name: str
    email: str
    status: str           # 'pending' | 'in_progress' | 'completed'
    dominant_style: Optional[str]
    completed_at: Optional[str]


class TeamScores(BaseModel):
    average_scaled: dict   # { is, should, want } → { P,A,E,I } averages
    style_distribution: dict   # { P: n, A: n, E: n, I: n }


class CohortDetailResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    respondents: List[RespondentSummary]
    team_scores: Optional[TeamScores]
