from datetime import datetime
from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, JSON, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base

class SensorReading(Base):
    __tablename__ = "sensor_readings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now(), nullable=False)
    
    # Activity
    steps: Mapped[int] = mapped_column(Integer, default=0)
    distance_meters: Mapped[float] = mapped_column(Float, default=0.0)
    calories: Mapped[float] = mapped_column(Float, default=0.0)
    active_minutes: Mapped[int] = mapped_column(Integer, default=0)
    
    # Screen
    is_screen_on: Mapped[bool] = mapped_column(Boolean, default=False)
    screen_time_minutes: Mapped[int] = mapped_column(Integer, default=0)
    screen_brightness: Mapped[int] = mapped_column(Integer, default=0)
    unlock_count: Mapped[int] = mapped_column(Integer, default=0)
    
    # Heart
    heart_rate: Mapped[int | None] = mapped_column(Integer, nullable=True)
    resting_heart_rate: Mapped[int | None] = mapped_column(Integer, nullable=True)
    hrv: Mapped[float | None] = mapped_column(Float, nullable=True)
    galvanic_skin_response: Mapped[float | None] = mapped_column(Float, nullable=True)
    stress_index: Mapped[float | None] = mapped_column(Float, nullable=True)
    
    # Sleep
    sleep_hours: Mapped[float] = mapped_column(Float, default=0.0)
    sleep_quality: Mapped[int] = mapped_column(Integer, default=0)
    bedtime: Mapped[str | None] = mapped_column(String(50), nullable=True)
    wake_time: Mapped[str | None] = mapped_column(String(50), nullable=True)
    
    # Battery
    battery_level: Mapped[int] = mapped_column(Integer, default=100)
    is_charging: Mapped[bool] = mapped_column(Boolean, default=False)
    battery_temperature: Mapped[float] = mapped_column(Float, default=25.0)
    
    # App usage
    current_app: Mapped[str] = mapped_column(String(255), default="")
    social_app_minutes: Mapped[int] = mapped_column(Integer, default=0)
    productivity_app_minutes: Mapped[int] = mapped_column(Integer, default=0)
    entertainment_app_minutes: Mapped[int] = mapped_column(Integer, default=0)
    
    # Network
    connection_type: Mapped[str] = mapped_column(String(50), default="none")
    wifi_ssid: Mapped[str | None] = mapped_column(String(255), nullable=True)
    
    # Notifications
    notification_count: Mapped[int] = mapped_column(Integer, default=0)
    social_notifications_count: Mapped[int] = mapped_column(Integer, default=0)
    
    # Location
    unique_locations: Mapped[int] = mapped_column(Integer, default=0)
    is_at_home: Mapped[bool] = mapped_column(Boolean, default=False)
    
    raw_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class DailyAggregate(Base):
    __tablename__ = "daily_aggregates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    date: Mapped[str] = mapped_column(String(10), nullable=False) # "YYYY-MM-DD"
    
    total_steps: Mapped[int] = mapped_column(Integer, default=0)
    avg_screen_time: Mapped[float] = mapped_column(Float, default=0.0)
    avg_heart_rate: Mapped[float] = mapped_column(Float, default=0.0)
    avg_sleep_hours: Mapped[float] = mapped_column(Float, default=0.0)
    
    risk_score: Mapped[float] = mapped_column(Float, default=0.0)
    risk_level: Mapped[str] = mapped_column(String(20), default="Low")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class RiskHistory(Base):
    __tablename__ = "risk_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now(), nullable=False)
    
    risk_score: Mapped[float] = mapped_column(Float, default=0.0)
    risk_level: Mapped[str] = mapped_column(String(20), default="Low")
    contributing_factors: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    
    phq9_component: Mapped[float] = mapped_column(Float, default=0.0)
    phone_component: Mapped[float] = mapped_column(Float, default=0.0)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
