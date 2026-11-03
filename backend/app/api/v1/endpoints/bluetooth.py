import asyncio
import json
import logging
from typing import Any, Optional

from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends, Header, HTTPException, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel, Field

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.wifi_sensor import SensorReading
from app.models.user import User
from app.services.bluetooth import wifi_sensor_service

logger = logging.getLogger(__name__)

router = APIRouter()


# --- Schemas ---------------------------------------------------------------

class PairingResponse(BaseModel):
    pairing_code: str
    server_ip: str
    server_port: int
    expires_in: int


class ActivityPayload(BaseModel):
    steps: int = 0
    distance_meters: float = 0.0
    speed_avg_mps: float = 0.0
    active_calories: float = 0.0
    total_calories: float = 0.0
    exercise_sessions_count: int = 0
    exercise_minutes: int = 0


class BodyPayload(BaseModel):
    bmr_kcal: Optional[float] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None


class IngestPayload(BaseModel):
    device_id: str = Field(..., description="Stable per-install identifier from the phone")
    activity: ActivityPayload
    body: BodyPayload = BodyPayload()


class ConnectionStatusResponse(BaseModel):
    connected: bool
    device: Optional[dict] = None
    is_mocked: bool
    battery_level: Optional[int] = None
    real_ble_supported: bool
    pairing_code: Optional[str] = None
    server_ip: Optional[str] = None


# --- Heuristic activity -> wellness scoring ---------------------------------

def _compute_analysis(activity: ActivityPayload, body: BodyPayload) -> tuple[dict, dict, dict]:
    """Derives an activity-based wellness/risk snapshot from Health Connect
    data. This is a simple heuristic (not a clinical model) since we no
    longer have heart-rate/HRV/GSR from a real biometric wearable."""

    steps_score = min(activity.steps / 10000, 1.0)
    exercise_score = min(activity.exercise_minutes / 30, 1.0)
    activity_score = round(0.6 * steps_score + 0.4 * exercise_score, 3)
    sedentary_index = round(1 - activity_score, 3)

    if activity_score >= 0.6:
        risk_classification = "Low"
        stress_pattern = "Activity levels indicate a well-paced, active day."
    elif activity_score >= 0.3:
        risk_classification = "Medium"
        stress_pattern = "Activity is below target - a short walk could help."
    else:
        risk_classification = "High"
        stress_pattern = "Very low movement detected today. Consider some light activity."

    anomaly_flags = []
    if activity.steps < 1000:
        anomaly_flags.append("Low step count detected")
    if activity.exercise_sessions_count == 0 and activity.steps < 3000:
        anomaly_flags.append("No exercise sessions recorded today")

    telemetry = {
        "steps": activity.steps,
        "distance_meters": round(activity.distance_meters, 1),
        "speed_avg_mps": round(activity.speed_avg_mps, 2),
        "active_calories": round(activity.active_calories, 1),
        "total_calories": round(activity.total_calories, 1),
        "exercise_sessions_count": activity.exercise_sessions_count,
        "exercise_minutes": activity.exercise_minutes,
        "activity_level": "Active" if activity_score >= 0.5 else ("Light" if activity_score >= 0.2 else "Sedentary"),
        "bmr_kcal": body.bmr_kcal,
        "height_cm": body.height_cm,
        "weight_kg": body.weight_kg,
    }

    ai_analysis = {
        "stress_index": sedentary_index,
        "risk_classification": risk_classification,
        "stress_pattern": stress_pattern,
        "anomaly_flags": anomaly_flags,
        "confidence_score": 0.75,
    }

    fusion = {
        "sensor_weight": 0.30,
        "sensor_contribution": "positive_influence" if activity_score >= 0.5 else "negative_influence",
    }

    return telemetry, ai_analysis, fusion


def _persist_reading(db: Session, user_id: Optional[int], payload: IngestPayload, telemetry: dict, ai_analysis: dict) -> None:
    """Save the pushed snapshot as a SensorReading for the paired user so the chatbot, doctor view
    and dashboards can read it. Snapshots within 60s update the latest row."""
    if not user_id:
        return
    try:
        from datetime import datetime, timedelta, timezone

        now = datetime.now(timezone.utc)
        last = (
            db.query(SensorReading)
            .filter(SensorReading.user_id == user_id)
            .order_by(SensorReading.timestamp.desc())
            .first()
        )
        fresh = False
        if last is not None:
            ts = last.timestamp if last.timestamp.tzinfo else last.timestamp.replace(tzinfo=timezone.utc)
            fresh = (now - ts) < timedelta(seconds=60)
        row = last if fresh else SensorReading(user_id=user_id)
        row.timestamp = now
        row.steps = telemetry.get("steps", 0)
        row.distance_meters = telemetry.get("distance_meters", 0.0)
        row.calories = telemetry.get("total_calories", 0.0)
        row.active_minutes = telemetry.get("exercise_minutes", 0)
        row.stress_index = ai_analysis.get("stress_index")
        row.raw_json = json.dumps({"device_id": payload.device_id, "telemetry": telemetry})
        if not fresh:
            db.add(row)
        db.commit()
    except Exception as e:  # never break the phone push over a DB hiccup
        db.rollback()
        logger.error(f"Failed to persist sensor reading: {e}")


# --- REST endpoints ----------------------------------------------------------

@router.post("/connect", response_model=PairingResponse)
async def start_pairing(current_user: User = Depends(get_current_user)) -> dict:
    """Generates a pairing code + this server's LAN address so the user can
    enter them into the SensorApp on their phone (same WiFi network)."""
    try:
        return wifi_sensor_service.start_pairing(user_id=current_user.id)
    except Exception as e:
        logger.error(f"Failed to start WiFi pairing: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate pairing code: {str(e)}"
        )


@router.post("/disconnect")
async def disconnect_device(current_user: User = Depends(get_current_user)) -> dict:
    """Disconnects the currently paired phone."""
    try:
        return wifi_sensor_service.disconnect()
    except Exception as e:
        logger.error(f"Disconnect endpoint error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Disconnection failed: {str(e)}"
        )


@router.get("/status", response_model=ConnectionStatusResponse)
def get_device_status(current_user: User = Depends(get_current_user)) -> dict:
    """Checks current phone pairing/connection status."""
    try:
        status_data = wifi_sensor_service.get_status()
        owner = wifi_sensor_service.paired_user_id
        if owner is not None and owner != current_user.id:
            status_data = {**status_data, "connected": False, "device": None, "pairing_code": None}
        return status_data
    except Exception as e:
        logger.error(f"Status endpoint error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch status: {str(e)}"
        )


@router.post("/ingest")
async def ingest_sensor_data(
    payload: IngestPayload,
    x_pairing_code: Optional[str] = Header(None, alias="X-Pairing-Code"),
    db: Session = Depends(get_db),
) -> dict:
    """Receives a Health Connect snapshot pushed from the phone over WiFi."""
    if not x_pairing_code or not wifi_sensor_service.verify_pairing_code(x_pairing_code):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired pairing code. Re-pair from the Sensor Monitor page."
        )

    telemetry, ai_analysis, fusion = _compute_analysis(payload.activity, payload.body)
    packet = wifi_sensor_service.ingest(payload.device_id, 0.0, telemetry, ai_analysis, fusion)
    _persist_reading(db, wifi_sensor_service.paired_user_id, payload, telemetry, ai_analysis)
    return {"status": "success", **packet}


@router.websocket("/stream")
async def websocket_telemetry_stream(websocket: WebSocket, token: Optional[str] = None):
    """1Hz-ish WebSocket stream pushing the latest phone telemetry snapshot
    to the dashboard as it arrives."""
    await websocket.accept()
    logger.info("WebSocket telemetry stream client connected.")

    last_sent: Any = None
    try:
        while True:
            packet = wifi_sensor_service.get_latest_packet()
            if packet is not None and packet != last_sent:
                await websocket.send_json(packet)
                last_sent = packet
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        logger.info("WebSocket telemetry stream client disconnected.")
    except Exception as e:
        logger.error(f"WebSocket stream loop encountered error: {e}")
