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
    external_gap: int
    internal_gap: int
    external_severity: str   # 'aligned' | 'watch' | 'tension'
    internal_severity: str
    external_message: str
    internal_message: str


class Interpretation(BaseModel):
    dominant_roles: List[str]
    style_label: str
    style_tagline: str
    strengths: str
    blind_spots: str
    working_with_others: str
    combined_description: Optional[str]
    mismanagement_risks: List[str]


class ResultResponse(BaseModel):
    result_id: str
    user_name: str
    completed_at: str
    profile: Dict[str, str]        # { is, should, want } → e.g. "paEI"
    scaled_scores: Dict            # { is, should, want } → { P,A,E,I }
    gaps: List[GapDetail]
    interpretation: Interpretation
