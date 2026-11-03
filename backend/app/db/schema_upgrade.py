"""Idempotent startup schema upgrade (create_all never alters existing tables)."""
import logging

from sqlalchemy import inspect, text

from app.db.session import SessionLocal, engine

logger = logging.getLogger(__name__)

_USER_COLUMNS = {
    "patient_code": "VARCHAR(20)",
    "verification_status": "VARCHAR(20) DEFAULT 'approved' NOT NULL",
    "verification_note": "VARCHAR(500)",
    "verified_at": "TIMESTAMP",
    "verified_by": "INTEGER",
    "credential_filename": "VARCHAR(255)",
    "credential_pdf": None,
    "credential_uploaded_at": "TIMESTAMP",
}


def ensure_schema() -> None:
    insp = inspect(engine)
    if "users" not in insp.get_table_names():
        return
    existing = {c["name"] for c in insp.get_columns("users")}
    binary_type = "BYTEA" if engine.dialect.name == "postgresql" else "BLOB"

    with engine.begin() as conn:
        for name, ddl in _USER_COLUMNS.items():
            if name not in existing:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {name} {ddl or binary_type}"))
                logger.info("schema_upgrade: added users.%s", name)
        try:
            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_patient_code ON users (patient_code)"))
        except Exception as exc:
            logger.warning("schema_upgrade: patient_code index: %s", exc)
        if engine.dialect.name == "postgresql" and "phq9_assessments" in insp.get_table_names():
            for col in ("emotion_rationale", "emotion_summary"):
                conn.execute(text(f"ALTER TABLE phq9_assessments ALTER COLUMN {col} TYPE TEXT"))

    from app.models.user import User, new_patient_code

    db = SessionLocal()
    try:
        exists = lambda c: db.query(User.id).filter(User.patient_code == c).first() is not None
        missing = db.query(User).filter(User.patient_code.is_(None)).filter(
            (User.role == "patient") | (User.role.is_(None))
        ).all()
        for u in missing:
            u.patient_code = new_patient_code(exists)
            db.flush()
        if missing:
            db.commit()
    finally:
        db.close()
