"""
Creates a handful of demo "consultant" (doctor) accounts so the patient-facing
video call feature has real doctors to show and actually connect to.

Run once from the backend/ folder:
    python seed_doctors.py

Each doctor can then log in on the normal Login page with:
    email:    <as printed below>
    password: Doctor@123
"""
from app.core.security import get_password_hash
from app.db.session import Base, SessionLocal, engine
from app.models.user import User

Base.metadata.create_all(bind=engine)

DEMO_DOCTORS = [
    {"email": "dr.aisha.rahman@healthly.local", "full_name": "Dr. Aisha Rahman"},
    {"email": "dr.james.walker@healthly.local", "full_name": "Dr. James Walker"},
    {"email": "dr.meera.iyer@healthly.local", "full_name": "Dr. Meera Iyer"},
    {"email": "dr.daniel.osei@healthly.local", "full_name": "Dr. Daniel Osei"},
]

DEMO_PASSWORD = "Doctor@123"


def main():
    db = SessionLocal()
    try:
        for doc in DEMO_DOCTORS:
            existing = db.query(User).filter(User.email == doc["email"]).first()
            if existing:
                if existing.role != "consultant":
                    existing.role = "consultant"
                    db.commit()
                print(f"already exists: {doc['email']}")
                continue

            user = User(
                email=doc["email"],
                full_name=doc["full_name"],
                hashed_password=get_password_hash(DEMO_PASSWORD),
                role="consultant",
            )
            db.add(user)
            db.commit()
            print(f"created: {doc['email']} / {DEMO_PASSWORD}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
