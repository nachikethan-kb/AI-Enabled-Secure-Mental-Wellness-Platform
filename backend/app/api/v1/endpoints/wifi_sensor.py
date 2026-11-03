import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set

from fastapi import APIRouter, Depends, Header, HTTPException, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.session import get_db
from app.models.user import User
from app.models.wifi_sensor import SensorReading, DailyAggregate, RiskHistory
from app.models.phq9_assessment import PHQ9Assessment
from app.services.risk_calculator import calculate_mental_health_risk
from app.core.deps import get_current_user
from app.core.security import get_password_hash
import secrets

logger = logging.getLogger(__name__)

router = APIRouter()

# --- PYDANTIC SCHEMAS ---

class ActivityData(BaseModel):
    steps: int
    distance_meters: float
    calories: float
    active_minutes: int

class ScreenData(BaseModel):
    is_screen_on: bool
    screen_time_today_minutes: int
    brightness_level: int
    unlock_count: int

class HeartData(BaseModel):
    heart_rate_bpm: Optional[int] = None
    resting_heart_rate: Optional[int] = None
    hrv_ms: Optional[float] = None

class SleepData(BaseModel):
    last_sleep_duration_hours: float
    last_sleep_quality_percent: int
    bedtime: Optional[str] = None
    wake_time: Optional[str] = None

class BatteryData(BaseModel):
    level_percent: int
    is_charging: bool
    temperature: float

class AppUsageData(BaseModel):
    current_app: str
    social_app_minutes_today: int
    productivity_app_minutes_today: int
    entertainment_app_minutes_today: int

class NetworkData(BaseModel):
    connection_type: str
    wifi_ssid: Optional[str] = None

class NotificationsData(BaseModel):
    count_last_hour: int
    social_notifications_count: int

class LocationData(BaseModel):
    unique_locations_today: Optional[int] = None
    is_at_home: Optional[bool] = None

class SensorDataPayload(BaseModel):
    user_id: str = Field(..., description="Unique device/user identifier (anonymized)")
    timestamp: str
    activity: ActivityData
    screen: ScreenData
    heart: HeartData
    sleep: SleepData
    battery: BatteryData
    app_usage: AppUsageData
    network: NetworkData
    notifications: NotificationsData
    location: LocationData
    consent_given: bool = True

class PHQ9Submission(BaseModel):
    user_id: str
    answers: List[int] = Field(..., min_items=9, max_items=9, description="9 answers, each 0-3")


class DeviceRegisterRequest(BaseModel):
    device_id: str


# --- WEBSOCKET CONNECTION MANAGER & SECURE WRAPPERS ---
import secrets
from jose import JWTError, jwt
from app.core.config import settings
from app.core.security import get_password_hash, verify_password

# Global dictionary for sliding window rate limiting
LAST_MESSAGE_TIMESTAMP: Dict[str, datetime] = {}

def check_rate_limit(device_id: str) -> bool:
    """Returns True if rate limited (i.e. message sent within last 3 seconds), False otherwise."""
    now = datetime.utcnow()
    last_time = LAST_MESSAGE_TIMESTAMP.get(device_id)
    if last_time and (now - last_time).total_seconds() < 3.0:
        return True
    LAST_MESSAGE_TIMESTAMP[device_id] = now
    return False

def get_websocket_user(token: Optional[str], db: Session) -> Optional[User]:
    if token:
        try:
            payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
            subject = payload.get("sub")
            if subject:
                user = db.query(User).filter(User.email == subject).first()
                if user:
                    return user
        except JWTError:
            pass
    from app.core.deps import get_or_create_guest_user
    return get_or_create_guest_user(db)

class ConnectionManager:
    def __init__(self):
        # Map device_id (string) -> dict with websocket, last_pong_time, status, last_seen
        self.phone_connections: Dict[str, Dict[str, Any]] = {}
        # Map device_id (string) -> set of dashboard client WebSockets
        self.dashboard_connections: Dict[str, Set[WebSocket]] = {}
        # Set of WebSockets for the admin/global view
        self.active_admin_connections: Set[WebSocket] = set()

    def register_phone(self, device_id: str, websocket: WebSocket):
        self.phone_connections[device_id] = {
            "websocket": websocket,
            "last_pong_time": datetime.utcnow(),
            "status": "online",
            "last_seen": datetime.utcnow()
        }
        logger.info(f"Phone {device_id} successfully registered.")

    def disconnect_phone(self, device_id: str):
        if device_id in self.phone_connections:
            self.phone_connections[device_id]["status"] = "offline"
            self.phone_connections[device_id]["last_seen"] = datetime.utcnow()
            logger.info(f"Phone {device_id} marked offline.")

    async def connect_dashboard(self, device_id: str, websocket: WebSocket):
        await websocket.accept()
        if device_id not in self.dashboard_connections:
            self.dashboard_connections[device_id] = set()
        self.dashboard_connections[device_id].add(websocket)
        logger.info(f"Dashboard client connected for device {device_id}")

    def disconnect_dashboard(self, device_id: str, websocket: WebSocket):
        if device_id in self.dashboard_connections:
            self.dashboard_connections[device_id].discard(websocket)
            if not self.dashboard_connections[device_id]:
                del self.dashboard_connections[device_id]
        logger.info(f"Dashboard client disconnected for device {device_id}")

    async def connect_admin(self, websocket: WebSocket):
        await websocket.accept()
        self.active_admin_connections.add(websocket)
        logger.info("Admin dashboard connected.")

    def disconnect_admin(self, websocket: WebSocket):
        self.active_admin_connections.discard(websocket)
        logger.info("Admin dashboard disconnected.")

    async def broadcast_to_dashboards(self, device_id: str, data: dict):
        # Send to specific dashboard clients
        if device_id in self.dashboard_connections:
            for ws in list(self.dashboard_connections[device_id]):
                try:
                    await ws.send_json(data)
                except Exception as e:
                    logger.warning(f"Error sending to dashboard client for {device_id}: {e}")
                    self.disconnect_dashboard(device_id, ws)

        # Send to admin clients
        for ws in list(self.active_admin_connections):
            try:
                await ws.send_json(data)
            except Exception as e:
                logger.warning(f"Error sending to admin dashboard: {e}")
                self.disconnect_admin(ws)

    async def broadcast_to_user(self, device_id: str, data: dict):
        """Maintain backward compatibility for existing code calling broadcast_to_user."""
        await self.broadcast_to_dashboards(device_id, data)

    def get_status(self, device_id: str) -> str:
        if device_id in self.phone_connections:
            return self.phone_connections[device_id]["status"]
        return "offline"

manager = ConnectionManager()


# --- HELPER SECURITY VERIFICATION ---
# API Key authentication for phone client
API_KEY_EXPECTED = "healthly_wifi_secret"

def verify_api_key(x_api_key: Optional[str] = Header(None)) -> None:
    if x_api_key and x_api_key != API_KEY_EXPECTED:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API Key"
        )


# --- REST ENDPOINTS ---

@router.post("/api/sensor-data")
async def receive_sensor_data(
    payload: SensorDataPayload,
    db: Session = Depends(get_db),
    api_key_check: None = Depends(verify_api_key)
):
    """
    Accepts sensor telemetry from phone over WiFi.
    Stores raw metrics, calculates risk, and broadcasts to dashboard WebSockets.
    """
    if not payload.consent_given:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User consent is required for data collection."
        )

    if check_rate_limit(payload.user_id):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Max 1 message per 3 seconds."
        )


    # 1. Auto-discover or link User by device_id
    user = db.query(User).filter(User.device_id == payload.user_id).first()
    if not user:
        logger.info(f"Auto-registering user for device_id: {payload.user_id}")
        user = User(
            email=f"{payload.user_id[:16]}@healthly.local",
            full_name=f"Device {payload.user_id[:8]}",
            device_id=payload.user_id,
            hashed_password="auto_generated_not_used",
            role="patient"
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    # 2. Parse and save SensorReading
    reading = SensorReading(
        user_id=user.id,
        steps=payload.activity.steps,
        distance_meters=payload.activity.distance_meters,
        calories=payload.activity.calories,
        active_minutes=payload.activity.active_minutes,
        
        is_screen_on=payload.screen.is_screen_on,
        screen_time_minutes=payload.screen.screen_time_today_minutes,
        screen_brightness=payload.screen.brightness_level,
        unlock_count=payload.screen.unlock_count,
        
        heart_rate=payload.heart.heart_rate_bpm,
        resting_heart_rate=payload.heart.resting_heart_rate,
        hrv=payload.heart.hrv_ms,
        
        sleep_hours=payload.sleep.last_sleep_duration_hours,
        sleep_quality=payload.sleep.last_sleep_quality_percent,
        bedtime=payload.sleep.bedtime,
        wake_time=payload.sleep.wake_time,
        
        battery_level=payload.battery.level_percent,
        is_charging=payload.battery.is_charging,
        battery_temperature=payload.battery.temperature,
        
        current_app=payload.app_usage.current_app,
        social_app_minutes=payload.app_usage.social_app_minutes_today,
        productivity_app_minutes=payload.app_usage.productivity_app_minutes_today,
        entertainment_app_minutes=payload.app_usage.entertainment_app_minutes_today,
        
        connection_type=payload.network.connection_type,
        wifi_ssid=payload.network.wifi_ssid,
        
        notification_count=payload.notifications.count_last_hour,
        social_notifications_count=payload.notifications.social_notifications_count,
        
        unique_locations=payload.location.unique_locations_today or 0,
        is_at_home=payload.location.is_at_home or False,
        
        raw_json=payload.model_dump_json()
    )
    db.add(reading)
    db.commit()
    db.refresh(reading)

    # 3. Retrieve latest PHQ-9 assessment for risk cross-validation
    latest_phq9 = db.query(PHQ9Assessment).filter(PHQ9Assessment.user_id == user.id).order_by(PHQ9Assessment.created_at.desc()).first()
    phq9_score = latest_phq9.score if latest_phq9 else None

    # 4. Recalculate Risk Score
    risk = calculate_mental_health_risk(
        steps=payload.activity.steps,
        screen_time_minutes=payload.screen.screen_time_today_minutes,
        sleep_hours=payload.sleep.last_sleep_duration_hours,
        sleep_quality_percent=payload.sleep.last_sleep_quality_percent,
        heart_rate_bpm=payload.heart.heart_rate_bpm,
        hrv_ms=payload.heart.hrv_ms,
        social_app_minutes=payload.app_usage.social_app_minutes_today,
        notification_count=payload.notifications.count_last_hour,
        phq9_score=phq9_score
    )

    # 5. Store in RiskHistory
    risk_history = RiskHistory(
        user_id=user.id,
        risk_score=risk["risk_score"],
        risk_level=risk["risk_level"],
        contributing_factors=risk["contributing_factors"],
        phq9_component=risk["phq9_component"],
        phone_component=risk["phone_component"],
        confidence=risk["confidence"]
    )
    db.add(risk_history)
    db.commit()
    db.refresh(risk_history)

    # 6. Broadcast payload + assessment over WebSocket
    ws_packet = {
        "event": "sensor_update",
        "user_id": payload.user_id,
        "database_user_id": user.id,
        "timestamp": datetime.utcnow().isoformat(),
        "latest_telemetry": {
            "steps": reading.steps,
            "screen_time_minutes": reading.screen_time_minutes,
            "heart_rate": reading.heart_rate,
            "hrv": reading.hrv,
            "battery_level": reading.battery_level,
            "sleep_hours": reading.sleep_hours,
            "sleep_quality": reading.sleep_quality,
            "social_app_minutes": reading.social_app_minutes,
            "notification_count": reading.notification_count,
            "current_app": reading.current_app
        },
        "risk_assessment": {
            "risk_score": risk["risk_score"],
            "risk_level": risk["risk_level"],
            "confidence": risk["confidence"],
            "contributing_factors": risk["contributing_factors"]
        }
    }
    await manager.broadcast_to_user(payload.user_id, ws_packet)

    return {
        "status": "success",
        "device_id": payload.user_id,
        "user_id": user.id,
        "risk_level": risk["risk_level"],
        "risk_score": risk["risk_score"]
    }


@router.get("/api/users")
def list_registered_users(db: Session = Depends(get_db)):
    """Lists all registered users/devices that have sent telemetry."""
    users = db.query(User).filter(User.device_id.isnot(None)).all()
    return [{
        "id": u.id,
        "device_id": u.device_id,
        "name": u.full_name,
        "email": u.email,
        "created_at": u.created_at.isoformat()
    } for u in users]


@router.get("/api/users/{user_id}/latest")
def get_latest_sensor_reading(user_id: str, db: Session = Depends(get_db)):
    """Gets the latest sensor reading snapshot for a device/user."""
    user = db.query(User).filter(User.device_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    reading = db.query(SensorReading).filter(SensorReading.user_id == user.id).order_by(SensorReading.timestamp.desc()).first()
    if not reading:
        raise HTTPException(status_code=404, detail="No readings found for this user")
        
    return {
        "user_id": user_id,
        "timestamp": reading.timestamp.isoformat(),
        "steps": reading.steps,
        "screen_time_minutes": reading.screen_time_minutes,
        "heart_rate": reading.heart_rate,
        "hrv": reading.hrv,
        "battery_level": reading.battery_level,
        "sleep_hours": reading.sleep_hours,
        "sleep_quality": reading.sleep_quality,
        "social_app_minutes": reading.social_app_minutes,
        "notification_count": reading.notification_count,
        "current_app": reading.current_app,
        "wifi_ssid": reading.wifi_ssid
    }


@router.get("/api/users/{user_id}/history")
def get_sensor_history(
    user_id: str,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Gets historical sensor readings for a device/user."""
    user = db.query(User).filter(User.device_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    readings = db.query(SensorReading).filter(SensorReading.user_id == user.id).order_by(SensorReading.timestamp.desc()).limit(limit).all()
    return [{
        "timestamp": r.timestamp.isoformat(),
        "steps": r.steps,
        "screen_time_minutes": r.screen_time_minutes,
        "heart_rate": r.heart_rate,
        "hrv": r.hrv,
        "battery_level": r.battery_level,
        "sleep_hours": r.sleep_hours,
        "sleep_quality": r.sleep_quality,
        "social_app_minutes": r.social_app_minutes,
        "notification_count": r.notification_count,
        "current_app": r.current_app
    } for r in reversed(readings)]


@router.get("/api/users/{user_id}/risk")
def get_current_risk_assessment(user_id: str, db: Session = Depends(get_db)):
    """Gets the latest calculated risk assessment for a user."""
    user = db.query(User).filter(User.device_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    risk = db.query(RiskHistory).filter(RiskHistory.user_id == user.id).order_by(RiskHistory.timestamp.desc()).first()
    if not risk:
        raise HTTPException(status_code=404, detail="No risk history found for this user")
        
    return {
        "user_id": user_id,
        "timestamp": risk.timestamp.isoformat(),
        "risk_score": risk.risk_score,
        "risk_level": risk.risk_level,
        "contributing_factors": risk.contributing_factors,
        "phq9_component": risk.phq9_component,
        "phone_component": risk.phone_component,
        "confidence": risk.confidence
    }


@router.post("/api/phq9-assessment")
async def submit_phq9_assessment(payload: PHQ9Submission, db: Session = Depends(get_db)):
    """
    Submits a PHQ-9 self-assessment.
    Computes severity and score, updates risk history, and broadcasts to dashboard.
    """
    user = db.query(User).filter(User.device_id == payload.user_id).first()
    if not user:
        # Create user if not exists
        user = User(
            email=f"{payload.user_id[:16]}@healthly.local",
            full_name=f"Device {payload.user_id[:8]}",
            device_id=payload.user_id,
            hashed_password="auto_generated_not_used",
            role="patient"
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    total_score = sum(payload.answers)
    
    # Severity classification
    if total_score < 5:
        severity = "Minimal depression"
    elif total_score < 10:
        severity = "Mild depression"
    elif total_score < 15:
        severity = "Moderate depression"
    elif total_score < 20:
        severity = "Moderately severe depression"
    else:
        severity = "Severe depression"

    # Store in database
    assessment = PHQ9Assessment(
        user_id=user.id,
        answers=payload.answers,
        score=total_score,
        risk_level=severity,
        high_risk=(total_score >= 15),
        recommended_action=f"Suggested action level based on clinical protocols for PHQ-9 score {total_score}."
    )
    db.add(assessment)
    db.commit()
    db.refresh(assessment)

    # Get latest reading to update risk score
    latest_reading = db.query(SensorReading).filter(SensorReading.user_id == user.id).order_by(SensorReading.timestamp.desc()).first()
    if latest_reading:
        risk = calculate_mental_health_risk(
            steps=latest_reading.steps,
            screen_time_minutes=latest_reading.screen_time_minutes,
            sleep_hours=latest_reading.sleep_hours,
            sleep_quality_percent=latest_reading.sleep_quality,
            heart_rate_bpm=latest_reading.heart_rate,
            hrv_ms=latest_reading.hrv,
            social_app_minutes=latest_reading.social_app_minutes,
            notification_count=latest_reading.notification_count,
            phq9_score=total_score
        )
    else:
        # No sensor readings, evaluate risk based on PHQ-9 only
        phq9_risk = total_score / 27.0
        risk = {
            "risk_score": round(phq9_risk, 2),
            "risk_level": "High" if total_score >= 15 else ("Medium" if total_score >= 10 else "Low"),
            "confidence": 0.90,
            "contributing_factors": {"high_phq9_score": "PHQ-9 self-assessment score is elevated."},
            "phone_component": 0.0,
            "phq9_component": round(phq9_risk, 2)
        }

    # Store new risk in history
    risk_history = RiskHistory(
        user_id=user.id,
        risk_score=risk["risk_score"],
        risk_level=risk["risk_level"],
        contributing_factors=risk["contributing_factors"],
        phq9_component=risk["phq9_component"],
        phone_component=risk["phone_component"],
        confidence=risk["confidence"]
    )
    db.add(risk_history)
    db.commit()

    # Broadcast updated state
    ws_packet = {
        "event": "phq9_update",
        "user_id": payload.user_id,
        "phq9_score": total_score,
        "severity": severity,
        "risk_assessment": {
            "risk_score": risk["risk_score"],
            "risk_level": risk["risk_level"],
            "confidence": risk["confidence"],
            "contributing_factors": risk["contributing_factors"]
        }
    }
    await manager.broadcast_to_user(payload.user_id, ws_packet)

    return {
        "status": "success",
        "score": total_score,
        "severity": severity,
        "risk_level": risk["risk_level"],
        "risk_score": risk["risk_score"]
    }


@router.get("/api/users/{user_id}/trends")
def get_trends(user_id: str, db: Session = Depends(get_db)):
    """Gets trend data including steps, sleep, and screen time."""
    user = db.query(User).filter(User.device_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Get aggregates from database
    aggregates = db.query(DailyAggregate).filter(DailyAggregate.user_id == user.id).order_by(DailyAggregate.date.desc()).limit(30).all()
    
    if not aggregates:
        # Fallback: construct synthetic trend data or use raw readings from last few days
        logger.info(f"No daily aggregates found for user {user_id}, computing from recent raw readings")
        readings = db.query(SensorReading).filter(SensorReading.user_id == user.id).order_by(SensorReading.timestamp.desc()).limit(100).all()
        
        # Group by date
        by_date = {}
        for r in readings:
            date_str = r.timestamp.strftime("%Y-%m-%d")
            if date_str not in by_date:
                by_date[date_str] = []
            by_date[date_str].append(r)
            
        trends = []
        for d, rs in sorted(by_date.items()):
            steps_val = max(r.steps for r in rs) if rs else 0
            screen_val = max(r.screen_time_minutes for r in rs) if rs else 0
            sleep_val = max(r.sleep_hours for r in rs) if rs else 0
            hr_val = sum(r.heart_rate for r in rs if r.heart_rate) / len([r for r in rs if r.heart_rate]) if [r for r in rs if r.heart_rate] else 72
            trends.append({
                "date": d,
                "total_steps": steps_val,
                "avg_screen_time": round(screen_val, 1),
                "avg_sleep_hours": round(sleep_val, 1),
                "avg_heart_rate": round(hr_val, 1),
                "risk_score": 0.25 # baseline fallback
            })
        return trends

    return [{
        "date": agg.date,
        "total_steps": agg.total_steps,
        "avg_screen_time": agg.avg_screen_time,
        "avg_heart_rate": agg.avg_heart_rate,
        "avg_sleep_hours": agg.avg_sleep_hours,
        "risk_score": agg.risk_score,
        "risk_level": agg.risk_level
    } for agg in reversed(aggregates)]


@router.get("/api/users/{user_id}/recommendations")
def get_recommendations(user_id: str, db: Session = Depends(get_db)):
    """Provides personalized tips based on the user's latest risk profile."""
    user = db.query(User).filter(User.device_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    risk = db.query(RiskHistory).filter(RiskHistory.user_id == user.id).order_by(RiskHistory.timestamp.desc()).first()
    if not risk or not risk.contributing_factors:
        return [
            {"id": "rec_steps", "type": "activity", "title": "Maintain Physical Activity", "message": "Aim for at least 7,000 steps daily to promote psychological and physical wellness."},
            {"id": "rec_screen", "type": "screen", "title": "Monitor Digital Well-being", "message": "Keep screen time under 4 hours to prevent digital fatigue and strain."},
            {"id": "rec_sleep", "type": "sleep", "title": "Regularize Sleep Patterns", "message": "Consistent sleep schedules improve baseline emotional resilience."}
        ]

    recs = []
    factors = risk.contributing_factors
    
    if "extremely_low_activity" in factors or "low_activity" in factors:
        recs.append({
            "id": "rec_activity",
            "type": "activity",
            "title": "Low Physical Movement Detected",
            "message": "Physical inactivity strongly correlates with low mood. Try starting with a short 10-minute walk."
        })
    if "excessive_screen_time" in factors:
        recs.append({
            "id": "rec_screen_time",
            "type": "screen",
            "title": "Reduce Screentime Burden",
            "message": "High screen hours increase fatigue. Try set a 'no-screen' boundary 1 hour before bedtime."
        })
    if "irregular_sleep_duration" in factors or "poor_sleep_quality" in factors:
        recs.append({
            "id": "rec_sleep",
            "type": "sleep",
            "title": "Optimize Sleep Hygiene",
            "message": "Disrupted sleep impairs emotional regulation. Avoid caffeine after 2 PM and limit screens in bed."
        })
    if "excessive_social_media" in factors or "elevated_social_media" in factors:
        recs.append({
            "id": "rec_social",
            "type": "social",
            "title": "Digital Detox Recommendation",
            "message": "Heavy social media use can fuel comparison anxiety. Consider blocking social apps after 8 PM."
        })
    if "low_heart_rate_variability" in factors or "elevated_resting_heart_rate" in factors:
        recs.append({
            "id": "rec_stress",
            "type": "stress",
            "title": "Physiological Stress Indicator",
            "message": "Your heart metrics suggest elevated stress. Try practicing box-breathing (inhale 4s, hold 4s, exhale 4s, hold 4s) for 2 minutes."
        })
    if "high_phq9_severity" in factors:
        recs.append({
            "id": "rec_consult",
            "type": "clinical",
            "title": "Consult Professional Support",
            "message": "Your self-reported questionnaire shows high distress levels. We strongly advise reaching out to a therapist or using our counselor booking page."
        })
        
    # Append default if list is empty
    if not recs:
        recs.append({
            "id": "rec_good",
            "type": "wellness",
            "title": "Keep up the healthy habits!",
            "message": "Your telemetry indicators are within standard parameters. Continue maintaining your balanced lifestyle."
        })
        
    return recs


# --- WEBSOCKET ENDPOINTS ---

@router.websocket("/ws/phone/{device_id}")
async def websocket_phone(websocket: WebSocket, device_id: str, db: Session = Depends(get_db)):
    """WebSocket for direct phone telemetry streaming."""
    # 1. Accept websocket connection
    await websocket.accept()
    
    # 2. Wait for registration message
    try:
        register_msg_text = await websocket.receive_text()
        register_msg = json.loads(register_msg_text)
        if (
            register_msg.get("type") != "register" or 
            register_msg.get("device_id") != device_id or 
            not register_msg.get("token")
        ):
            await websocket.close(code=4001, reason="Invalid registration message format or mismatched device_id")
            return
        
        # 3. Authenticate token
        token = register_msg.get("token")
        user = db.query(User).filter(User.device_id == device_id).first()
        if not user or not user.device_token_hash:
            await websocket.close(code=4001, reason="Device not registered or paired")
            return
        
        if not verify_password(token, user.device_token_hash):
            await websocket.close(code=4001, reason="Invalid device token")
            return
            
        # 4. Register in connection manager
        if device_id in manager.phone_connections:
            try:
                await manager.phone_connections[device_id]["websocket"].close(code=4000, reason="Replaced by new connection")
            except Exception:
                pass
        
        manager.register_phone(device_id, websocket)
        
        # Send update to dashboard clients that device is online
        await manager.broadcast_to_dashboards(device_id, {
            "type": "update",
            "device_id": device_id,
            "device_status": "online"
        })
        
        # Respond with acknowledgement
        await websocket.send_json({"type": "ack", "received_at": datetime.utcnow().isoformat()})
        
        # 5. Message loop
        while True:
            data_text = await websocket.receive_text()
            data = json.loads(data_text)
            
            if data.get("type") == "pong":
                if device_id in manager.phone_connections:
                    manager.phone_connections[device_id]["last_pong_time"] = datetime.utcnow()
                    manager.phone_connections[device_id]["status"] = "online"
                    manager.phone_connections[device_id]["last_seen"] = datetime.utcnow()
                
            elif data.get("type") == "sensor_data":
                if check_rate_limit(device_id):
                    await websocket.send_json({"type": "error", "message": "Rate limit exceeded. Max 1 message per 3s."})
                    continue
                
                if device_id in manager.phone_connections:
                    manager.phone_connections[device_id]["last_message_time"] = datetime.utcnow()
                    manager.phone_connections[device_id]["last_pong_time"] = datetime.utcnow()
                    manager.phone_connections[device_id]["status"] = "online"
                    manager.phone_connections[device_id]["last_seen"] = datetime.utcnow()
                
                payload_dict = data.get("payload")
                if not payload_dict:
                    continue
                
                try:
                    payload = SensorDataPayload(**payload_dict)
                    
                    reading = SensorReading(
                        user_id=user.id,
                        steps=payload.activity.steps,
                        distance_meters=payload.activity.distance_meters,
                        calories=payload.activity.calories,
                        active_minutes=payload.activity.active_minutes,
                        
                        is_screen_on=payload.screen.is_screen_on,
                        screen_time_minutes=payload.screen.screen_time_today_minutes,
                        screen_brightness=payload.screen.brightness_level,
                        unlock_count=payload.screen.unlock_count,
                        
                        heart_rate=payload.heart.heart_rate_bpm,
                        resting_heart_rate=payload.heart.resting_heart_rate,
                        hrv=payload.heart.hrv_ms,
                        
                        sleep_hours=payload.sleep.last_sleep_duration_hours,
                        sleep_quality=payload.sleep.last_sleep_quality_percent,
                        bedtime=payload.sleep.bedtime,
                        wake_time=payload.sleep.wake_time,
                        
                        battery_level=payload.battery.level_percent,
                        is_charging=payload.battery.is_charging,
                        battery_temperature=payload.battery.temperature,
                        
                        current_app=payload.app_usage.current_app,
                        social_app_minutes=payload.app_usage.social_app_minutes_today,
                        productivity_app_minutes=payload.app_usage.productivity_app_minutes_today,
                        entertainment_app_minutes=payload.app_usage.entertainment_app_minutes_today,
                        
                        connection_type=payload.network.connection_type,
                        wifi_ssid=payload.network.wifi_ssid,
                        
                        notification_count=payload.notifications.count_last_hour,
                        social_notifications_count=payload.notifications.social_notifications_count,
                        
                        unique_locations=payload.location.unique_locations_today or 0,
                        is_at_home=payload.location.is_at_home or False,
                        
                        raw_json=payload.model_dump_json()
                    )
                    db.add(reading)
                    db.commit()
                    db.refresh(reading)
                    
                    latest_phq9 = db.query(PHQ9Assessment).filter(PHQ9Assessment.user_id == user.id).order_by(PHQ9Assessment.created_at.desc()).first()
                    phq9_score = latest_phq9.score if latest_phq9 else None
                    
                    risk = calculate_mental_health_risk(
                        steps=payload.activity.steps,
                        screen_time_minutes=payload.screen.screen_time_today_minutes,
                        sleep_hours=payload.sleep.last_sleep_duration_hours,
                        sleep_quality_percent=payload.sleep.last_sleep_quality_percent,
                        heart_rate_bpm=payload.heart.heart_rate_bpm,
                        hrv_ms=payload.heart.hrv_ms,
                        social_app_minutes=payload.app_usage.social_app_minutes_today,
                        notification_count=payload.notifications.count_last_hour,
                        phq9_score=phq9_score
                    )
                    
                    risk_history = RiskHistory(
                        user_id=user.id,
                        risk_score=risk["risk_score"],
                        risk_level=risk["risk_level"],
                        contributing_factors=risk["contributing_factors"],
                        phq9_component=risk["phq9_component"],
                        phone_component=risk["phone_component"],
                        confidence=risk["confidence"]
                    )
                    db.add(risk_history)
                    db.commit()
                    db.refresh(risk_history)
                    
                    await websocket.send_json({"type": "ack", "received_at": datetime.utcnow().isoformat()})
                    
                    ws_packet = {
                        "type": "update",
                        "device_id": device_id,
                        "device_status": "online",
                        "risk_score": risk["risk_score"],
                        "latest_reading": {
                            "steps": reading.steps,
                            "screen_time_minutes": reading.screen_time_minutes,
                            "heart_rate": reading.heart_rate,
                            "hrv": reading.hrv,
                            "battery_level": reading.battery_level,
                            "sleep_hours": reading.sleep_hours,
                            "sleep_quality": reading.sleep_quality,
                            "social_app_minutes": reading.social_app_minutes,
                            "notification_count": reading.notification_count,
                            "current_app": reading.current_app
                        }
                    }
                    await manager.broadcast_to_dashboards(device_id, ws_packet)
                    
                except Exception as db_err:
                    logger.error(f"Error inserting sensor reading via WebSocket: {db_err}")
                    await websocket.send_json({"type": "error", "message": str(db_err)})
                    
    except WebSocketDisconnect:
        manager.disconnect_phone(device_id)
        await manager.broadcast_to_dashboards(device_id, {
            "type": "update",
            "device_id": device_id,
            "device_status": "offline"
        })
    except Exception as e:
        logger.error(f"WebSocket phone error: {e}")
        manager.disconnect_phone(device_id)
        await manager.broadcast_to_dashboards(device_id, {
            "type": "update",
            "device_id": device_id,
            "device_status": "offline"
        })


@router.websocket("/ws/dashboard/all")
async def websocket_dashboard_all(websocket: WebSocket):
    """WebSocket for monitoring all users (Admin dashboard view)."""
    await manager.connect_admin(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_json({"event": "heartbeat", "timestamp": datetime.utcnow().isoformat()})
    except WebSocketDisconnect:
        manager.disconnect_admin(websocket)
    except Exception as e:
        logger.error(f"WebSocket admin error: {e}")
        manager.disconnect_admin(websocket)


@router.websocket("/ws/dashboard/{device_id}")
async def websocket_dashboard_user(
    websocket: WebSocket, 
    device_id: str, 
    token: Optional[str] = None, 
    db: Session = Depends(get_db)
):
    """WebSocket for monitoring a single user device dashboard."""
    user = get_websocket_user(token, db)
    if not user:
        await websocket.accept()
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Unauthorized: Invalid JWT token")
        return
        
    await manager.connect_dashboard(device_id, websocket)
    
    # Send current device status upon connection
    status_str = manager.get_status(device_id)
    latest_reading = None
    risk_score = 0.0
    
    device_user = db.query(User).filter(User.device_id == device_id).first()
    if device_user:
        reading = db.query(SensorReading).filter(SensorReading.user_id == device_user.id).order_by(SensorReading.timestamp.desc()).first()
        if reading:
            latest_reading = {
                "steps": reading.steps,
                "screen_time_minutes": reading.screen_time_minutes,
                "heart_rate": reading.heart_rate,
                "hrv": reading.hrv,
                "battery_level": reading.battery_level,
                "sleep_hours": reading.sleep_hours,
                "sleep_quality": reading.sleep_quality,
                "social_app_minutes": reading.social_app_minutes,
                "notification_count": reading.notification_count,
                "current_app": reading.current_app
            }
        risk = db.query(RiskHistory).filter(RiskHistory.user_id == device_user.id).order_by(RiskHistory.timestamp.desc()).first()
        if risk:
            risk_score = risk.risk_score
            
    await websocket.send_json({
        "type": "update",
        "device_id": device_id,
        "device_status": status_str,
        "risk_score": risk_score,
        "latest_reading": latest_reading
    })
    
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_json({"event": "heartbeat", "device_id": device_id, "timestamp": datetime.utcnow().isoformat()})
    except WebSocketDisconnect:
        manager.disconnect_dashboard(device_id, websocket)
    except Exception as e:
        logger.error(f"WebSocket dashboard error for {device_id}: {e}")
        manager.disconnect_dashboard(device_id, websocket)


@router.post("/api/v1/devices/register")
def register_device(
    payload: DeviceRegisterRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generates a unique API token per device, stores the hashed version in the user's table,
    and returns the plain token to the caller.
    """
    token = f"healthly_device_{secrets.token_hex(16)}"
    hashed_token = get_password_hash(token)
    
    current_user.device_id = payload.device_id
    current_user.device_token_hash = hashed_token
    db.commit()
    db.refresh(current_user)
    
    return {
        "status": "success",
        "device_id": payload.device_id,
        "device_token": token
    }


async def websocket_heartbeat_monitor():
    """Background heartbeat checker running every 15s to detect stale sockets."""
    while True:
        try:
            await asyncio.sleep(15)
            now = datetime.utcnow()
            for device_id, conn in list(manager.phone_connections.items()):
                if conn["status"] == "online":
                    if now - conn["last_pong_time"] > timedelta(seconds=60):
                        conn["status"] = "offline"
                        conn["last_seen"] = now
                        logger.warning(f"Device {device_id} marked offline due to staleness (no pong in 60s).")
                        
                        ws_packet = {
                            "type": "update",
                            "device_id": device_id,
                            "device_status": "offline"
                        }
                        await manager.broadcast_to_dashboards(device_id, ws_packet)
                        
                    elif now - conn.get("last_ping_time", datetime.min) >= timedelta(seconds=30):
                        try:
                            await conn["websocket"].send_json({"type": "ping"})
                            conn["last_ping_time"] = now
                        except Exception as e:
                            logger.warning(f"Failed to send ping to {device_id}: {e}")
                            conn["status"] = "offline"
                            conn["last_seen"] = now
                            await manager.broadcast_to_dashboards(device_id, {
                                "type": "update",
                                "device_id": device_id,
                                "device_status": "offline"
                            })
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Error in websocket_heartbeat_monitor: {e}")



# --- BACKGROUND JOBS (Executed inline via endpoints or started externally) ---

async def run_daily_aggregations(db: Session):
    """
    Computes daily averages for steps, screen time, sleep, and heart rate for all users.
    Saves results into daily_aggregates table.
    """
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    yesterday = datetime.utcnow() - timedelta(days=1)
    yesterday_start = datetime(yesterday.year, yesterday.month, yesterday.day, 0, 0, 0)
    yesterday_end = datetime(yesterday.year, yesterday.month, yesterday.day, 23, 59, 59)
    yesterday_str = yesterday.strftime("%Y-%m-%d")

    # Find all active users
    users = db.query(User).filter(User.device_id.isnot(None)).all()
    for u in users:
        # Check if already aggregated for yesterday
        existing = db.query(DailyAggregate).filter(
            DailyAggregate.user_id == u.id,
            DailyAggregate.date == yesterday_str
        ).first()
        if existing:
            continue

        # Fetch all readings for yesterday
        readings = db.query(SensorReading).filter(
            SensorReading.user_id == u.id,
            SensorReading.timestamp >= yesterday_start,
            SensorReading.timestamp <= yesterday_end
        ).all()

        if not readings:
            continue

        # Compute metrics
        total_steps = max(r.steps for r in readings) if readings else 0
        avg_screen = sum(r.screen_time_minutes for r in readings) / len(readings) if readings else 0.0
        hrs = [r.heart_rate for r in readings if r.heart_rate is not None]
        avg_hr = sum(hrs) / len(hrs) if hrs else 72.0
        avg_sleep = max(r.sleep_hours for r in readings) if readings else 7.0

        # Retrieve risk history to get average/latest risk score
        latest_risk = db.query(RiskHistory).filter(RiskHistory.user_id == u.id).order_by(RiskHistory.timestamp.desc()).first()
        risk_score = latest_risk.risk_score if latest_risk else 0.0
        risk_level = latest_risk.risk_level if latest_risk else "Low"

        aggregate = DailyAggregate(
            user_id=u.id,
            date=yesterday_str,
            total_steps=total_steps,
            avg_screen_time=round(avg_screen, 1),
            avg_heart_rate=round(avg_hr, 1),
            avg_sleep_hours=round(avg_sleep, 1),
            risk_score=risk_score,
            risk_level=risk_level
        )
        db.add(aggregate)
    db.commit()
    logger.info("Daily aggregation job completed successfully.")
