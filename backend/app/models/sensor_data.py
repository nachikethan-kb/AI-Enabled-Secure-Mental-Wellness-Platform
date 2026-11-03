from datetime import datetime
from sqlalchemy import DateTime, Float, ForeignKey, Integer, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class SensorData(Base):
    """DEPRECATED: Use SensorReading in wifi_sensor.py instead.
    This table is kept for historical purposes only. New telemetry must not be written here.
    """
    __tablename__ = "sensor_data"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    heart_rate_variability: Mapped[float] = mapped_column(Float, nullable=False) # HRV (ms)
    galvanic_skin_response: Mapped[float] = mapped_column(Float, nullable=False) # GSR (uS)
    sleep_duration_hours: Mapped[float] = mapped_column(Float, nullable=False)
    stress_index: Mapped[float] = mapped_column(Float, nullable=False) # 0.0 to 1.0 stress level
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
