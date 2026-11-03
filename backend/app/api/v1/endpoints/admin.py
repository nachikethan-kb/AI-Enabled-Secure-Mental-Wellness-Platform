import json
from datetime import datetime, timezone
from typing import Literal, Optional

from cryptography.fernet import InvalidToken
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import require_admin, require_consultant_or_admin
from app.core.security import decrypt_bytes
from app.db.session import get_db
from app.models.assignment import DoctorPatientAssignment
from app.models.health_report import HealthReport
from app.models.phq9_assessment import PHQ9Assessment
from app.models.user import User, new_patient_code
from app.models.wifi_sensor import SensorReading
from app.services.bluetooth import wifi_sensor_service

router = APIRouter()


class RoleUpdateRequest(BaseModel):
    role: str


class VerifyRequest(BaseModel):
    status: Literal["approved", "rejected", "pending"]
    note: Optional[str] = Field(default=None, max_length=500)


class AssignmentCreate(BaseModel):
    patient_id: int
    doctor_id: int


def _assignment_for_patient(db: Session, patient_id: int):
    return db.query(DoctorPatientAssignment).filter(DoctorPatientAssignment.patient_id == patient_id).first()


def _assigned_patient_ids(db: Session, doctor_id: int) -> list[int]:
    return [r[0] for r in db.query(DoctorPatientAssignment.patient_id).filter(DoctorPatientAssignment.doctor_id == doctor_id).all()]


def _ensure_patient_code(db: Session, user: User) -> None:
    if (user.role or "patient") == "patient" and not user.patient_code:
        user.patient_code = new_patient_code(lambda c: db.query(User.id).filter(User.patient_code == c).first() is not None)


def _serialize_assignment(db: Session, a: DoctorPatientAssignment) -> dict:
    p = db.query(User).filter(User.id == a.patient_id).first()
    d = db.query(User).filter(User.id == a.doctor_id).first()
    return {
        "id": a.id,
        "patient": {"id": p.id, "patient_code": p.patient_code, "full_name": p.full_name, "email": p.email} if p else None,
        "doctor": {"id": d.id, "full_name": d.full_name, "email": d.email} if d else None,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


def _telemetry_from_reading(r: SensorReading) -> dict:
    """The phone's full Health Connect snapshot (speed, exercise sessions, BMR, height, weight ...)
    is stored in SensorReading.raw_json by /bluetooth/ingest. Unpack it for the doctor's view."""
    try:
        t = (json.loads(r.raw_json or "{}") or {}).get("telemetry") or {}
    except (ValueError, TypeError):
        t = {}
    return t if isinstance(t, dict) else {}


def _reading_time(r: SensorReading):
    return r.timestamp or r.created_at


def _last_assessment(db: Session, patient_id: int):
    return (
        db.query(PHQ9Assessment)
        .filter(PHQ9Assessment.user_id == patient_id)
        .order_by(PHQ9Assessment.created_at.desc())
        .first()
    )


@router.get("/users")
def list_users(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return {
        "users": [
            {
                "id": u.id,
                "email": u.email,
                "full_name": u.full_name,
                "role": u.role or "patient",
                "patient_code": u.patient_code,
                "verification_status": u.verification_status or "approved",
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ]
    }


@router.put("/users/{user_id}/role")
def update_user_role(user_id: int, payload: RoleUpdateRequest, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    allowed = {"patient", "consultant", "admin"}
    if payload.role not in allowed:
        raise HTTPException(status_code=400, detail=f"Role must be one of: {', '.join(sorted(allowed))}")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    old_role = user.role or "patient"
    user.role = payload.role
    if payload.role == "patient":
        _ensure_patient_code(db, user)
    if payload.role == "consultant" and old_role != "consultant" and not user.credential_pdf:
        user.verification_status = "pending"
    if old_role != payload.role:
        db.query(DoctorPatientAssignment).filter(
            (DoctorPatientAssignment.patient_id == user.id) | (DoctorPatientAssignment.doctor_id == user.id)
        ).delete(synchronize_session=False)
    db.commit()
    db.refresh(user)
    return {"id": user.id, "email": user.email, "role": user.role}


@router.get("/stats")
def platform_stats(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    count = lambda *f: db.query(func.count(User.id)).filter(*f).scalar() or 0
    total_patients = count(User.role == "patient")
    total_assignments = db.query(func.count(DoctorPatientAssignment.id)).scalar() or 0
    return {
        "total_users": db.query(func.count(User.id)).scalar() or 0,
        "patients": total_patients,
        "consultants": count(User.role == "consultant"),
        "admins": count(User.role == "admin"),
        "total_assessments": db.query(func.count(PHQ9Assessment.id)).scalar() or 0,
        "total_sensor_records": db.query(func.count(SensorReading.id)).scalar() or 0,
        "total_health_reports": db.query(func.count(HealthReport.id)).scalar() or 0,
        "pending_verifications": count(User.role == "consultant", User.verification_status == "pending"),
        "approved_doctors": count(User.role == "consultant", User.verification_status == "approved"),
        "total_assignments": total_assignments,
        "unassigned_patients": max(total_patients - total_assignments, 0),
    }


@router.get("/consultants")
def list_consultants(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    doctors = db.query(User).filter(User.role == "consultant").order_by(User.created_at.desc()).all()
    result = []
    for d in doctors:
        rows = db.query(DoctorPatientAssignment).filter(DoctorPatientAssignment.doctor_id == d.id).all()
        patients = []
        for a in rows:
            p = db.query(User).filter(User.id == a.patient_id).first()
            if p:
                patients.append({"id": p.id, "patient_code": p.patient_code, "assignment_id": a.id})
        result.append({
            "id": d.id,
            "full_name": d.full_name,
            "email": d.email,
            "verification_status": d.verification_status or "approved",
            "verification_note": d.verification_note,
            "verified_at": d.verified_at.isoformat() if d.verified_at else None,
            "has_credential": bool(d.credential_pdf),
            "credential_filename": d.credential_filename,
            "credential_uploaded_at": d.credential_uploaded_at.isoformat() if d.credential_uploaded_at else None,
            "created_at": d.created_at.isoformat() if d.created_at else None,
            "assigned_patients": patients,
            "capacity": settings.max_patients_per_doctor,
        })
    return {"consultants": result}


@router.get("/consultants/{doctor_id}/credential")
def view_credential(doctor_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    doctor = db.query(User).filter(User.id == doctor_id, User.role == "consultant").first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    if not doctor.credential_pdf:
        raise HTTPException(status_code=404, detail="This doctor has not uploaded a credential PDF")
    try:
        pdf_bytes = decrypt_bytes(bytes(doctor.credential_pdf))
    except InvalidToken:
        raise HTTPException(status_code=500, detail="Stored credential could not be decrypted (check DATA_ENCRYPTION_KEY)")
    safe_name = (doctor.credential_filename or "credential.pdf").replace('"', "")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{safe_name}"',
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.post("/consultants/{doctor_id}/verify")
def verify_consultant(doctor_id: int, payload: VerifyRequest, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    doctor = db.query(User).filter(User.id == doctor_id, User.role == "consultant").first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    if payload.status == "approved" and not doctor.credential_pdf:
        raise HTTPException(status_code=400, detail="Cannot approve a doctor who has not uploaded a credential PDF")
    doctor.verification_status = payload.status
    doctor.verification_note = (payload.note or "").strip() or None
    doctor.verified_at = datetime.now(timezone.utc) if payload.status != "pending" else None
    doctor.verified_by = current_user.id if payload.status != "pending" else None
    if payload.status != "approved":
        db.query(DoctorPatientAssignment).filter(DoctorPatientAssignment.doctor_id == doctor.id).delete(synchronize_session=False)
    db.commit()
    return {"id": doctor.id, "verification_status": doctor.verification_status, "verification_note": doctor.verification_note}


@router.get("/assignments")
def list_assignments(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    rows = db.query(DoctorPatientAssignment).order_by(DoctorPatientAssignment.created_at.desc()).all()
    return {"assignments": [_serialize_assignment(db, a) for a in rows], "capacity": settings.max_patients_per_doctor}


@router.post("/assignments", status_code=201)
def create_assignment(payload: AssignmentCreate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    patient = db.query(User).filter(User.id == payload.patient_id, User.role == "patient").first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    doctor = db.query(User).filter(User.id == payload.doctor_id, User.role == "consultant").first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    if (doctor.verification_status or "approved") != "approved":
        raise HTTPException(status_code=400, detail="This doctor's credentials have not been approved yet")
    if _assignment_for_patient(db, patient.id):
        raise HTTPException(status_code=409, detail="This patient is already assigned to a doctor. Remove that mapping first.")
    load = db.query(func.count(DoctorPatientAssignment.id)).filter(DoctorPatientAssignment.doctor_id == doctor.id).scalar() or 0
    if load >= settings.max_patients_per_doctor:
        raise HTTPException(status_code=409, detail="This doctor already has a patient (one-to-one mapping). Remove that mapping first.")
    _ensure_patient_code(db, patient)
    a = DoctorPatientAssignment(patient_id=patient.id, doctor_id=doctor.id, assigned_by=current_user.id)
    db.add(a)
    db.commit()
    db.refresh(a)
    return _serialize_assignment(db, a)


@router.delete("/assignments/{assignment_id}")
def delete_assignment(assignment_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    a = db.query(DoctorPatientAssignment).filter(DoctorPatientAssignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    db.delete(a)
    db.commit()
    return {"status": "removed", "id": assignment_id}


@router.get("/patients")
def list_patients(db: Session = Depends(get_db), current_user: User = Depends(require_consultant_or_admin)):
    """Admin: every patient with identity + mapped doctor. Doctor: ONLY assigned patient(s), by Patient ID (no name/email)."""
    is_admin = (current_user.role or "patient") == "admin"
    query = db.query(User).filter(User.role == "patient")
    if not is_admin:
        ids = _assigned_patient_ids(db, current_user.id)
        query = query.filter(User.id.in_(ids)) if ids else query.filter(User.id == -1)
    result = []
    for p in query.order_by(User.patient_code).all():
        last = _last_assessment(db, p.id)
        item = {
            "id": p.id,
            "patient_code": p.patient_code,
            "last_assessment": {
                "score": last.score,
                "risk_level": last.risk_level,
                "created_at": last.created_at.isoformat(),
            } if last else None,
            "sensor_records": db.query(func.count(SensorReading.id)).filter(SensorReading.user_id == p.id).scalar() or 0,
            "sensor_connected": wifi_sensor_service.live_info_for(p.id)["connected"],
        }
        if is_admin:
            a = _assignment_for_patient(db, p.id)
            d = db.query(User).filter(User.id == a.doctor_id).first() if a else None
            item.update({
                "email": p.email,
                "full_name": p.full_name,
                "created_at": p.created_at.isoformat() if p.created_at else None,
                "assignment_id": a.id if a else None,
                "doctor": {"id": d.id, "full_name": d.full_name, "email": d.email} if d else None,
            })
        result.append(item)
    return {"patients": result}


@router.get("/patients/{patient_id}/sensor-data")
def get_patient_sensor_data(patient_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_consultant_or_admin)):
    is_admin = (current_user.role or "patient") == "admin"
    patient = db.query(User).filter(User.id == patient_id, User.role == "patient").first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if not is_admin:
        a = _assignment_for_patient(db, patient_id)
        if not a or a.doctor_id != current_user.id:
            raise HTTPException(status_code=403, detail="This patient is not assigned to you")
    records = (
        db.query(SensorReading)
        .filter(SensorReading.user_id == patient_id)
        .order_by(SensorReading.timestamp.desc(), SensorReading.id.desc())
        .limit(20)
        .all()
    )
    last = _last_assessment(db, patient_id)
    patient_info = {"id": patient.id, "patient_code": patient.patient_code}
    if is_admin:
        patient_info.update({"full_name": patient.full_name, "email": patient.email})

    def _record(r: SensorReading) -> dict:
        t = _telemetry_from_reading(r)
        when = _reading_time(r)
        return {
            "id": r.id,
            "heart_rate_variability": r.hrv if r.hrv is not None else 0.0,
            "galvanic_skin_response": r.galvanic_skin_response if r.galvanic_skin_response is not None else 0.0,
            "sleep_duration_hours": r.sleep_hours or 0.0,
            "stress_index": r.stress_index if r.stress_index is not None else 0.0,
            "steps": r.steps,
            "active_minutes": r.active_minutes,
            "distance_meters": r.distance_meters,
            "calories": r.calories,
            "heart_rate": r.heart_rate,
            # ---- Health Connect fields sent by the updated SensorApp ----
            "speed_avg_mps": t.get("speed_avg_mps"),
            "total_calories": t.get("total_calories", r.calories),
            "exercise_sessions_count": t.get("exercise_sessions_count"),
            "exercise_minutes": t.get("exercise_minutes", r.active_minutes),
            "activity_level": t.get("activity_level"),
            "bmr_kcal": t.get("bmr_kcal"),
            "height_cm": t.get("height_cm"),
            "weight_kg": t.get("weight_kg"),
            "data_source": "health_connect" if t else None,
            "created_at": when.isoformat() if when else None,
        }

    return {
        "patient": patient_info,
        "live": wifi_sensor_service.live_info_for(patient_id),
        "sensor_records": [_record(r) for r in records],
        "last_assessment": {
            "score": last.score,
            "risk_level": last.risk_level,
            "dominant_emotion": last.dominant_emotion,
            "mental_state_label": last.mental_state_label,
            "created_at": last.created_at.isoformat(),
        } if last else None,
    }
