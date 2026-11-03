from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.encrypted_type import EncryptedString
from app.db.session import Base


class PHQ9Assessment(Base):
    __tablename__ = "phq9_assessments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    answers: Mapped[list[int]] = mapped_column(JSON, nullable=False)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    risk_level: Mapped[str] = mapped_column(String(40), nullable=False)
    high_risk: Mapped[bool] = mapped_column(Boolean, nullable=False)
    recommended_action: Mapped[str] = mapped_column(String(300), nullable=False)
    # Emotion analysis fields
    dominant_emotion: Mapped[str | None] = mapped_column(String(50), nullable=True)
    emotion_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    secondary_emotions: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    concern_areas: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    emotion_rationale: Mapped[str | None] = mapped_column(EncryptedString(500), nullable=True)
    emotion_summary: Mapped[str | None] = mapped_column(EncryptedString(500), nullable=True)
    needs_human_review: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    risk_flags: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    agent_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    mental_state_label: Mapped[str | None] = mapped_column(String(50), nullable=True)
    mental_state_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Breakdown scores
    emotional_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cognitive_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    physical_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    functional_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
