from datetime import datetime

import secrets

from sqlalchemy import DateTime, Integer, LargeBinary, String, event, func, select
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="patient", server_default="patient", nullable=True)
    device_id: Mapped[str | None] = mapped_column(String(255), unique=True, index=True, nullable=True)
    device_token_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Anonymised ID shown to doctors instead of the patient's name
    patient_code: Mapped[str | None] = mapped_column(String(20), unique=True, index=True, nullable=True)

    # Doctor verification: pending -> approved | rejected (non-doctors are always "approved")
    verification_status: Mapped[str] = mapped_column(String(20), default="approved", server_default="approved", nullable=False)
    verification_note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    verified_by: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Credential PDF uploaded at doctor registration (Fernet-encrypted)
    credential_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    credential_pdf: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    credential_uploaded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def new_patient_code(exists) -> str:
    for _ in range(50):
        code = "PT-" + "".join(secrets.choice(_CODE_ALPHABET) for _ in range(6))
        if not exists(code):
            return code
    raise RuntimeError("Could not allocate a unique patient code")


@event.listens_for(User, "before_insert")
def _assign_patient_code(mapper, connection, target):
    if (target.role or "patient") == "patient" and not target.patient_code:
        target.patient_code = new_patient_code(
            lambda c: connection.execute(select(User.id).where(User.patient_code == c)).first() is not None
        )
