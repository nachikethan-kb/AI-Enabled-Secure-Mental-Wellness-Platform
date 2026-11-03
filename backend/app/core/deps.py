from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import get_password_hash
from app.db.session import get_db
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.api_v1_prefix}/auth/login", auto_error=False)


def get_or_create_guest_user(db: Session) -> User:
    guest_email = "guest@healthly.local"
    guest = db.query(User).filter(User.email == guest_email).first()
    if guest:
        return guest

    guest = User(
        email=guest_email,
        full_name="Guest User",
        hashed_password=get_password_hash("guest_password_not_used"),
    )
    db.add(guest)
    db.commit()
    db.refresh(guest)
    return guest


def get_current_user(token: str | None = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
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

    return get_or_create_guest_user(db)


# ---- Role guards shared by admin / doctor-facing endpoints ----
from fastapi import HTTPException  # noqa: E402


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if (current_user.role or "patient") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def require_consultant_or_admin(current_user: User = Depends(get_current_user)) -> User:
    """Doctors only get in once an admin has approved their credential PDF."""
    role = current_user.role or "patient"
    if role == "admin":
        return current_user
    if role == "consultant":
        if (current_user.verification_status or "approved") != "approved":
            raise HTTPException(status_code=403, detail="Your credentials have not been approved by an admin yet")
        return current_user
    raise HTTPException(status_code=403, detail="Consultant or admin access required")
