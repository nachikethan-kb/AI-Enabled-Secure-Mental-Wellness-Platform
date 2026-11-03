"""One-time migration: encrypts existing plaintext rows. Safe to re-run. BACK UP YOUR DB FIRST.
Run from backend/:  python migrate_encrypt_existing_data.py"""
from sqlalchemy import text

from app.core.security import encrypt_data, is_encrypted
from app.db.session import engine

TARGETS = {
    "chat_messages": ["user_message", "bot_response"],
    "health_reports": ["summary", "clinical_notes"],
    "phq9_assessments": ["emotion_rationale", "emotion_summary"],
}

def main() -> None:
    total = 0
    with engine.begin() as conn:
        for table, cols in TARGETS.items():
            for col in cols:
                rows = conn.execute(text(f"SELECT id, {col} FROM {table} WHERE {col} IS NOT NULL")).fetchall()
                converted = 0
                for rid, value in rows:
                    if is_encrypted(value):
                        continue
                    conn.execute(text(f"UPDATE {table} SET {col} = :v WHERE id = :i"), {"v": encrypt_data(value), "i": rid})
                    converted += 1
                total += converted
                print(f"{table}.{col}: {converted} converted, {len(rows) - converted} already encrypted")
    print(f"Done. {total} values encrypted.")

if __name__ == "__main__":
    main()
