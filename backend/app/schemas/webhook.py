from pydantic import BaseModel, EmailStr, Field


class RiskAlertWebhookRequest(BaseModel):
    user_id: int
    email: EmailStr
    full_name: str
    phq9_score: int
    risk_level: str
    recommended_action: str


class NewUserWebhookRequest(BaseModel):
    user_id: int
    email: EmailStr
    full_name: str


class WebhookResponse(BaseModel):
    success: bool
    message: str
    workflow_id: str | None = None
