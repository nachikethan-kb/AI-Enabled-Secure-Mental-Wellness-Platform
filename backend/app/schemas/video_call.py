from pydantic import BaseModel


class DoctorOut(BaseModel):
    id: int
    full_name: str
    email: str
    specialty: str
    avatar_color: str
    online: bool = True


class CallRequestCreate(BaseModel):
    doctor_id: int


class CallRequestOut(BaseModel):
    id: int
    room_id: str
    status: str
    patient_id: int
    doctor_id: int
    patient_name: str | None = None
    doctor_name: str | None = None
    created_at: str


class CallRequestListResponse(BaseModel):
    items: list[CallRequestOut]
