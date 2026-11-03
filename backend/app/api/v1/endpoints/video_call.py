"""
Doctor <-> Patient video consultation feature.

REST endpoints (mounted under /api/v1/video-call):
    GET  /doctors               list consultants a patient can call
    POST /request                patient creates a call request to a doctor
    GET  /pending                doctor polls for pending incoming call requests
    GET  /mine                   patient polls the status of their own requests
    GET  /room/{room_id}         fetch call info (used to authorize joining a room)
    POST /{call_id}/accept       doctor accepts a call
    POST /{call_id}/reject       doctor rejects a call
    POST /{call_id}/end          either party ends the call

WebSocket (mounted at root, NOT under /api/v1, same convention as wifi_sensor.py):
    /ws/video-call/{room_id}?token=...
        Relays WebRTC signaling (offer/answer/ice-candidate), plus private
        in-call chat messages and reactions between exactly the two
        participants (patient + doctor) of that room.
"""
import logging
import uuid
from datetime import datetime
from typing import Dict

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user
from app.db.session import get_db, SessionLocal
from app.models.assignment import DoctorPatientAssignment
from app.models.user import User
from app.models.video_call import CallRequest
from app.schemas.video_call import (
    CallRequestCreate,
    CallRequestListResponse,
    CallRequestOut,
    DoctorOut,
)

logger = logging.getLogger(__name__)

router = APIRouter()          # REST routes -> included under /api/v1/video-call
ws_router = APIRouter()       # WebSocket route -> included at app root, like wifi_router

# Dummy specialties cycled over real "consultant" accounts so the patient-facing
# doctor list looks populated even with a handful of seeded users.
_SPECIALTIES = [
    "Clinical Psychologist",
    "Psychiatrist",
    "Counselling Therapist",
    "Behavioral Health Specialist",
    "Child & Adolescent Psychiatrist",
]
_AVATAR_COLORS = ["#7C3AED", "#0EA5E9", "#10B981", "#F59E0B", "#F43F5E"]


def _serialize_call(call: CallRequest, db: Session) -> CallRequestOut:
    patient = db.query(User).filter(User.id == call.patient_id).first()
    doctor = db.query(User).filter(User.id == call.doctor_id).first()
    return CallRequestOut(
        id=call.id,
        room_id=call.room_id,
        status=call.status,
        patient_id=call.patient_id,
        doctor_id=call.doctor_id,
        # Doctors never see the patient's real name: show the anonymised Patient ID
        patient_name=(patient.patient_code or "Patient") if patient else None,
        doctor_name=doctor.full_name if doctor else None,
        created_at=call.created_at.isoformat(),
    )


@router.get("/doctors", response_model=list[DoctorOut])
def list_doctors(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # A patient only sees the doctor the admin assigned (and approved) for them
    assignment = db.query(DoctorPatientAssignment).filter(DoctorPatientAssignment.patient_id == current_user.id).first()
    if not assignment:
        return []
    doctors = (
        db.query(User)
        .filter(User.id == assignment.doctor_id, User.role == "consultant", User.verification_status == "approved")
        .all()
    )
    return [
        DoctorOut(
            id=doc.id,
            full_name=doc.full_name,
            email=doc.email,
            specialty=_SPECIALTIES[idx % len(_SPECIALTIES)],
            avatar_color=_AVATAR_COLORS[idx % len(_AVATAR_COLORS)],
            online=True,
        )
        for idx, doc in enumerate(doctors)
    ]


@router.post("/request", response_model=CallRequestOut, status_code=status.HTTP_201_CREATED)
def request_call(
    payload: CallRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doctor = db.query(User).filter(User.id == payload.doctor_id, User.role == "consultant").first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    assignment = db.query(DoctorPatientAssignment).filter(
        DoctorPatientAssignment.patient_id == current_user.id,
        DoctorPatientAssignment.doctor_id == doctor.id,
    ).first()
    if not assignment:
        raise HTTPException(status_code=403, detail="You can only contact the doctor assigned to you by the admin")

    # Reuse an existing pending/accepted request between this patient & doctor instead of stacking dupes
    existing = (
        db.query(CallRequest)
        .filter(
            CallRequest.patient_id == current_user.id,
            CallRequest.doctor_id == doctor.id,
            CallRequest.status.in_(["pending", "accepted"]),
        )
        .order_by(CallRequest.created_at.desc())
        .first()
    )
    if existing:
        return _serialize_call(existing, db)

    call = CallRequest(
        room_id=uuid.uuid4().hex,
        patient_id=current_user.id,
        doctor_id=doctor.id,
        status="pending",
    )
    db.add(call)
    db.commit()
    db.refresh(call)
    return _serialize_call(call, db)


@router.get("/pending", response_model=CallRequestListResponse)
def pending_calls(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "consultant":
        raise HTTPException(status_code=403, detail="Only doctors can view pending calls")
    if (current_user.verification_status or "approved") != "approved":
        return CallRequestListResponse(items=[])

    calls = (
        db.query(CallRequest)
        .filter(CallRequest.doctor_id == current_user.id, CallRequest.status == "pending")
        .order_by(CallRequest.created_at.desc())
        .all()
    )
    return CallRequestListResponse(items=[_serialize_call(c, db) for c in calls])


@router.get("/mine", response_model=CallRequestListResponse)
def my_calls(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    calls = (
        db.query(CallRequest)
        .filter(
            CallRequest.patient_id == current_user.id,
            CallRequest.status.in_(["pending", "accepted"]),
        )
        .order_by(CallRequest.created_at.desc())
        .all()
    )
    return CallRequestListResponse(items=[_serialize_call(c, db) for c in calls])


@router.get("/room/{room_id}", response_model=CallRequestOut)
def get_room(room_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    call = db.query(CallRequest).filter(CallRequest.room_id == room_id).first()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    if current_user.id not in (call.patient_id, call.doctor_id):
        raise HTTPException(status_code=403, detail="Not a participant of this call")
    return _serialize_call(call, db)


@router.post("/{call_id}/accept", response_model=CallRequestOut)
def accept_call(call_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    call = db.query(CallRequest).filter(CallRequest.id == call_id).first()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    if call.doctor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your call to accept")
    call.status = "accepted"
    db.commit()
    db.refresh(call)
    return _serialize_call(call, db)


@router.post("/{call_id}/reject", response_model=CallRequestOut)
def reject_call(call_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    call = db.query(CallRequest).filter(CallRequest.id == call_id).first()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    if call.doctor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your call to reject")
    call.status = "rejected"
    db.commit()
    db.refresh(call)
    return _serialize_call(call, db)


@router.post("/{call_id}/end", response_model=CallRequestOut)
def end_call(call_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    call = db.query(CallRequest).filter(CallRequest.id == call_id).first()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    if current_user.id not in (call.patient_id, call.doctor_id):
        raise HTTPException(status_code=403, detail="Not a participant of this call")
    call.status = "ended"
    db.commit()
    db.refresh(call)
    return _serialize_call(call, db)


# ---------------------------------------------------------------------------
# WebSocket signaling: relays WebRTC handshake + private chat/reactions
# between the two participants of a call room.
# ---------------------------------------------------------------------------

def _get_ws_user(token: str | None, db: Session) -> User | None:
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        subject = payload.get("sub")
        if subject:
            return db.query(User).filter(User.email == subject).first()
    except JWTError:
        return None
    return None


class CallConnectionManager:
    def __init__(self):
        # room_id -> { user_id: WebSocket }
        self.rooms: Dict[str, Dict[int, WebSocket]] = {}

    async def connect(self, room_id: str, user_id: int, websocket: WebSocket):
        await websocket.accept()
        self.rooms.setdefault(room_id, {})[user_id] = websocket

    def disconnect(self, room_id: str, user_id: int):
        if room_id in self.rooms:
            self.rooms[room_id].pop(user_id, None)
            if not self.rooms[room_id]:
                del self.rooms[room_id]

    async def relay_to_peer(self, room_id: str, sender_id: int, message: dict):
        peers = self.rooms.get(room_id, {})
        for uid, ws in list(peers.items()):
            if uid != sender_id:
                try:
                    await ws.send_json(message)
                except Exception:
                    pass

    def peer_count(self, room_id: str) -> int:
        return len(self.rooms.get(room_id, {}))


manager = CallConnectionManager()


@ws_router.websocket("/ws/video-call/{room_id}")
async def video_call_socket(websocket: WebSocket, room_id: str, token: str | None = None):
    db = SessionLocal()
    try:
        user = _get_ws_user(token, db)
        call = db.query(CallRequest).filter(CallRequest.room_id == room_id).first()

        if not user or not call or user.id not in (call.patient_id, call.doctor_id):
            await websocket.close(code=4403, reason="Unauthorized")
            return

        role = "doctor" if user.id == call.doctor_id else "patient"

        await manager.connect(room_id, user.id, websocket)

        # Let the newly-joined peer know if the other side is already present,
        # and tell the existing peer that someone joined.
        await manager.relay_to_peer(
            room_id, user.id, {"type": "peer-joined", "role": role, "at": datetime.utcnow().isoformat()}
        )
        if manager.peer_count(room_id) > 1:
            await websocket.send_json({"type": "peer-ready"})

        try:
            while True:
                data = await websocket.receive_json()
                # Whitelist of relayed message types (WebRTC signaling + in-call UX)
                msg_type = data.get("type")
                if msg_type in (
                    "offer",
                    "answer",
                    "ice-candidate",
                    "chat",
                    "reaction",
                    "screen-share",
                    "hangup",
                ):
                    data["from_role"] = role
                    await manager.relay_to_peer(room_id, user.id, data)
        except WebSocketDisconnect:
            pass
        finally:
            manager.disconnect(room_id, user.id)
            await manager.relay_to_peer(room_id, user.id, {"type": "peer-left"})
    finally:
        db.close()
