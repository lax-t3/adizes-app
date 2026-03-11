from pydantic import BaseModel, EmailStr
from typing import Optional


class SmtpConfig(BaseModel):
    provider: str = "custom"          # ses | gmail | resend | custom
    host: str
    port: int = 587
    username: str = ""
    password: str = ""
    from_email: str
    from_name: str = "Adizes Platform"
    use_ssl: bool = False


class SmtpConfigResponse(BaseModel):
    """Same as SmtpConfig but password is masked."""
    provider: str
    host: str
    port: int
    username: str
    password_set: bool                 # True if a password is saved
    from_email: str
    from_name: str
    use_ssl: bool


class EmailTemplate(BaseModel):
    id: str
    name: str
    subject: str
    html_body: str


class UpdateTemplateRequest(BaseModel):
    subject: str
    html_body: str


class TestEmailRequest(BaseModel):
    to_email: EmailStr
