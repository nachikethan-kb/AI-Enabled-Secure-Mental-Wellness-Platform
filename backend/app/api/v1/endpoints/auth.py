from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import EmailStr, TypeAdapter, ValidationError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user
from app.core.security import create_access_token, encrypt_bytes, get_password_hash, verify_password
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserProfileResponse

router = APIRouter()
_email_adapter = TypeAdapter(EmailStr)


def _token_response(user: User) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(subject=user.email),
        user_email=user.email,
        full_name=user.full_name,
        role=user.role or "patient",
        user_id=user.id,
        patient_code=user.patient_code,
        verification_status=user.verification_status or "approved",
    )


def _profile(user: User) -> UserProfileResponse:
    return UserProfileResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role or "patient",
        patient_code=user.patient_code,
        verification_status=user.verification_status or "approved",
        verification_note=user.verification_note,
        has_credential=bool(user.credential_pdf),
    )


async def _read_credential_pdf(upload: UploadFile) -> tuple[str, bytes]:
    if upload is None or not upload.filename:
        raise HTTPException(status_code=400, detail="A credential PDF is required for consultant registration")
    data = await upload.read(settings.max_credential_pdf_bytes + 1)
    if not data:
        raise HTTPException(status_code=400, detail="The uploaded PDF is empty")
    if len(data) > settings.max_credential_pdf_bytes:
        raise HTTPException(status_code=413, detail=f"PDF is too large (max {settings.max_credential_pdf_bytes // (1024 * 1024)} MB)")
    if data.lstrip()[:5] != b"%PDF-":
        raise HTTPException(status_code=400, detail="Only valid PDF files are accepted")
    filename = upload.filename.replace("\\", "/").split("/")[-1][:255]
    return filename, data


def _store_credential(user: User, filename: str, data: bytes) -> None:
    user.credential_filename = filename
    user.credential_pdf = encrypt_bytes(data)
    user.credential_uploaded_at = datetime.now(timezone.utc)
    user.verification_status = "pending"
    user.verification_note = None
    user.verified_at = None
    user.verified_by = None


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> TokenResponse:
    if payload.role == "consultant":
        raise HTTPException(status_code=400, detail="Doctors must register with a credential PDF (use /auth/register-consultant)")
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=get_password_hash(payload.password),
        role=payload.role or "patient",
    )  # Patient ID auto-generated on insert
    db.add(user)
    db.commit()
    db.refresh(user)
    return _token_response(user)


@router.post("/register-consultant", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register_consultant(
    email: str = Form(...),
    full_name: str = Form(..., min_length=2, max_length=120),
    password: str = Form(..., min_length=8, max_length=128),
    credential: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> TokenResponse:
    """Doctor sign-up. Credential PDF is compulsory; account stays `pending` until an admin approves it."""
    try:
        email = str(_email_adapter.validate_python(email))
    except ValidationError:
        raise HTTPException(status_code=422, detail="Enter a valid email address")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    filename, data = await _read_credential_pdf(credential)
    user = User(email=email, full_name=full_name, hashed_password=get_password_hash(password), role="consultant")
    _store_credential(user, filename, data)
    db.add(user)
    db.commit()
    db.refresh(user)
    return _token_response(user)


@router.post("/credential", response_model=UserProfileResponse)
async def upload_credential(
    credential: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserProfileResponse:
    """A doctor (re)submits a credential PDF, e.g. after rejection. Resets status to pending."""
    if (current_user.role or "patient") != "consultant":
        raise HTTPException(status_code=403, detail="Only doctors can upload credentials")
    filename, data = await _read_credential_pdf(credential)
    _store_credential(current_user, filename, data)
    db.commit()
    db.refresh(current_user)
    return _profile(current_user)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return _token_response(user)


@router.get("/me", response_model=UserProfileResponse)
def me(current_user: User = Depends(get_current_user)) -> UserProfileResponse:
    return _profile(current_user)
