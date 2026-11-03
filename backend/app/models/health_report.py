from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.encrypted_type import EncryptedText
from app.db.session import Base


class HealthReport(Base):
    __tablename__ = "health_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    filename: Mapped[str] = mapped_column(String(100), nullable=False)
    summary: Mapped[str | None] = mapped_column(EncryptedText, nullable=True)
    diagnoses: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    medications: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    clinical_notes: Mapped[str | None] = mapped_column(EncryptedText, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
