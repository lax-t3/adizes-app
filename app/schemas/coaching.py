from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class CoachingLeadRequest(BaseModel):
    """Public lead-capture submission from the /leap-coaching form."""
    name: str
    email: EmailStr
    phone: Optional[str] = None
    organization: Optional[str] = None
    message: Optional[str] = None
    source: Optional[str] = "leap-coaching"


class CoachingLead(BaseModel):
    id: str
    name: str
    email: str
    phone: Optional[str] = None
    organization: Optional[str] = None
    message: Optional[str] = None
    source: str
    actioned: bool
    actioned_at: Optional[datetime] = None
    created_at: datetime


class UpdateLeadActionedRequest(BaseModel):
    actioned: bool
