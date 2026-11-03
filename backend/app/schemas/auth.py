from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


class RegisterRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=120)
    password: str = Field(min_length=8, max_length=128)
    role: Optional[str] = Field(default="patient")

    @field_validator("role")
    @classmethod
    def validate_role(cls, v):
        allowed = {"patient", "consultant", "admin"}
        if v and v not in allowed:
            raise ValueError(f"Role must be one of: {', '.join(allowed)}")
        return v or "patient"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_email: EmailStr
    full_name: str
    role: str = "patient"
    user_id: Optional[int] = None
    patient_code: Optional[str] = None
    verification_status: str = "approved"


class UserProfileResponse(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    role: str = "patient"
    patient_code: Optional[str] = None
    verification_status: str = "approved"
    verification_note: Optional[str] = None
    has_credential: bool = False
