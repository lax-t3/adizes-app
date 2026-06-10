from pydantic import BaseModel
from typing import Dict, List, Optional


class ScoreSet(BaseModel):
    P: int
    A: int
    E: int
    I: int


class ScaledScores(BaseModel):
    is_: ScoreSet
    should: ScoreSet
    want: ScoreSet

    class Config:
        populate_by_name = True
        fields = {"is_": "is"}


class GapDetail(BaseModel):
    role: str
    role_name: str
    is_score: int
    should_score: int
    want_score: int
    execution_gap: int
    execution_gap_signed: int
    execution_severity: str
    execution_narrative: str
    engagement_gap: int
    engagement_gap_signed: int
    engagement_severity: str
    engagement_narrative: str
    authenticity_gap: int
    authenticity_gap_signed: int
    authenticity_severity: str
    authenticity_narrative: str


class Interpretation(BaseModel):
    dominant_roles: List[str]
    identity_line: str
    style_label: str
    style_tagline: str
    strengths: str
    watchouts: str
    working_with_others: str
    combined_description: Optional[str]
    mismanagement_risks: List[str]
    at_your_best: str
    friction_shows_up: str
    early_warnings: List[str]
    executive_summary: Optional[str] = None
    daily_feel: Optional[Dict[str, Dict[str, str]]] = None
    reflection_questions: Optional[List[str]] = None


class ResultResponse(BaseModel):
    result_id: str
    user_name: str
    completed_at: str
    profile: Dict[str, str]        # { is, should, want } → e.g. "paEI"
    scaled_scores: Dict            # { is, should, want } → { P,A,E,I }
    gaps: List[GapDetail]
    interpretation: Interpretation
    pdf_url: Optional[str] = None
