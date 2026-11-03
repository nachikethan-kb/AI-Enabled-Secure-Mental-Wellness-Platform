from pydantic import BaseModel, Field, field_validator


class PHQ9Request(BaseModel):
    answers: list[int] = Field(min_length=9, max_length=9)

    @field_validator("answers")
    @classmethod
    def validate_answers(cls, values: list[int]) -> list[int]:
        if any(value < 0 or value > 3 for value in values):
            raise ValueError("PHQ-9 answers must be between 0 and 3")
        return values


class PHQ9Response(BaseModel):
    score: int
    risk_level: str
    high_risk: bool
    recommended_action: str
    risk_probability: float | None = None
    dominant_emotion: str | None = None
    emotion_confidence: float | None = None
    secondary_emotions: list[str] | None = None
    concern_areas: list[str] | None = None
    emotion_rationale: str | None = None
    emotion_summary: str | None = None
    needs_human_review: bool | None = None
    risk_flags: list[str] | None = None
    agent_version: str | None = None
    mental_state_label: str | None = None
    mental_state_confidence: float | None = None
    emotional_score: int | None = None
    cognitive_score: int | None = None
    physical_score: int | None = None
    functional_score: int | None = None


class PHQ9HistoryItem(BaseModel):
    id: int
    score: int
    risk_level: str
    high_risk: bool
    recommended_action: str
    created_at: str
    # Emotion analysis fields
    dominant_emotion: str | None = None
    emotion_confidence: float | None = None
    secondary_emotions: list[str] | None = None
    concern_areas: list[str] | None = None
    emotion_rationale: str | None = None
    emotion_summary: str | None = None
    needs_human_review: bool | None = None
    risk_flags: list[str] | None = None
    agent_version: str | None = None
    mental_state_label: str | None = None
    mental_state_confidence: float | None = None
    # Breakdown scores
    emotional_score: int | None = None
    cognitive_score: int | None = None
    physical_score: int | None = None
    functional_score: int | None = None


class PHQ9HistoryResponse(BaseModel):
    items: list[PHQ9HistoryItem]
