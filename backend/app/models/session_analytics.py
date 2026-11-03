from datetime import datetime
from sqlalchemy import DateTime, Float, ForeignKey, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class SessionAnalytics(Base):
    __tablename__ = "session_analytics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    session_type: Mapped[str] = mapped_column(String(20), nullable=False) # "chat" or "video"
    dominant_expression: Mapped[str] = mapped_column(String(50), nullable=False) # e.g. "neutral", "sadness", "anxiety"
    key_transcript_words: Mapped[list[str]] = mapped_column(JSON, nullable=False) # List of flagged keywords
    sentiment_score: Mapped[float] = mapped_column(Float, nullable=False) # -1.0 to 1.0
    facial_arousal: Mapped[float] = mapped_column(Float, nullable=False) # 0.0 to 1.0 (arousal level)
    facial_valence: Mapped[float] = mapped_column(Float, nullable=False) # -1.0 to 1.0 (valence score)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
