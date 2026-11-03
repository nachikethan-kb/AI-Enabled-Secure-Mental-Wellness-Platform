from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1000)


class ChatResponse(BaseModel):
    response: str
    emotion: str
    confidence: float
    escalation_required: bool
    risk_probability: float | None = None
    # PHQ-9 severity + wellbeing widget
    risk_level: str | None = None
    wellness_percentage: int | None = None
    suggest_doctor: bool = False
    urgent_doctor: bool = False
    # Sensor / activity context
    sensor_connected: bool = False
    steps_today: int | None = None
    active_minutes_today: int | None = None
    activity_suggestion: str | None = None


class CompanionStatusResponse(BaseModel):
    risk_level: str | None = None
    wellness_percentage: int | None = None
    suggest_doctor: bool = False
    urgent_doctor: bool = False
    sensor_connected: bool = False
    steps_today: int | None = None
    active_minutes_today: int | None = None
    activity_suggestion: str | None = None


class ChatHistoryItem(BaseModel):
    id: int
    user_message: str
    bot_response: str
    emotion: str
    confidence: float
    escalation_required: bool
    created_at: str


class ChatHistoryResponse(BaseModel):
    items: list[ChatHistoryItem]
