from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.chat_message import ChatMessage
from app.models.phq9_assessment import PHQ9Assessment
from app.models.wifi_sensor import SensorReading
from app.models.user import User
from app.schemas.chat import (
    ChatHistoryItem,
    ChatHistoryResponse,
    ChatRequest,
    ChatResponse,
    CompanionStatusResponse,
)
from app.services.bluetooth import wifi_sensor_service
from app.services.chatbot import generate_cbt_response, get_companion_status

router = APIRouter()

# A sensor reading older than this is treated as "not currently connected" for the companion widget.
_SENSOR_FRESHNESS_HOURS = 48


def _latest_phq9_context(db: Session, user_id: int) -> dict | None:
    record = (
        db.query(PHQ9Assessment)
        .filter(PHQ9Assessment.user_id == user_id)
        .order_by(PHQ9Assessment.created_at.desc())
        .first()
    )
    if not record:
        return None
    return {"score": record.score, "risk_level": record.risk_level, "high_risk": record.high_risk}


def _latest_sensor_context(db: Session, user_id: int) -> dict | None:
    from datetime import datetime, timedelta, timezone

    live = wifi_sensor_service.is_connected_for(user_id)
    live_packet = (wifi_sensor_service.get_latest_packet() or {}).get("telemetry", {}) if live else {}

    reading = (
        db.query(SensorReading)
        .filter(SensorReading.user_id == user_id)
        .order_by(SensorReading.timestamp.desc())
        .first()
    )
    if not reading:
        if live:
            return {
                "connected": True,
                "steps": live_packet.get("steps"),
                "active_minutes": live_packet.get("exercise_minutes"),
                "sleep_hours": None,
            }
        return {"connected": False, "steps": None, "active_minutes": None, "sleep_hours": None}

    timestamp = reading.timestamp
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)
    is_fresh = (datetime.now(timezone.utc) - timestamp) <= timedelta(hours=_SENSOR_FRESHNESS_HOURS)

    return {
        "connected": is_fresh or live,
        "steps": live_packet.get("steps", reading.steps) if live else reading.steps,
        "active_minutes": live_packet.get("exercise_minutes", reading.active_minutes) if live else reading.active_minutes,
        "sleep_hours": reading.sleep_hours,
    }


@router.post("/message", response_model=ChatResponse)
def chat_message(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatResponse:
    phq9_context = _latest_phq9_context(db, current_user.id)
    sensor_context = _latest_sensor_context(db, current_user.id)

    result = generate_cbt_response(payload.message, phq9_context, sensor_context)
    response = ChatResponse(**result)

    message = ChatMessage(
        user_id=current_user.id,
        user_message=payload.message,
        bot_response=response.response,
        emotion=response.emotion,
        confidence=response.confidence,
        escalation_required=response.escalation_required,
    )
    db.add(message)
    db.commit()

    return response


@router.get("/companion-status", response_model=CompanionStatusResponse)
def companion_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CompanionStatusResponse:
    """Live wellbeing snapshot (latest PHQ-9 + latest sensor reading) for the companion widget,
    used before the user has sent any chat message in this session."""
    phq9_context = _latest_phq9_context(db, current_user.id)
    sensor_context = _latest_sensor_context(db, current_user.id)
    return CompanionStatusResponse(**get_companion_status(phq9_context, sensor_context))


@router.get("/history", response_model=ChatHistoryResponse)
def chat_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatHistoryResponse:
    records = (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == current_user.id)
        .order_by(ChatMessage.created_at.desc())
        .all()
    )

    return ChatHistoryResponse(
        items=[
            ChatHistoryItem(
                id=record.id,
                user_message=record.user_message,
                bot_response=record.bot_response,
                emotion=record.emotion,
                confidence=record.confidence,
                escalation_required=record.escalation_required,
                created_at=record.created_at.isoformat(),
            )
            for record in records
        ]
    )
