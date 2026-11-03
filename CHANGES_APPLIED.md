# Changes applied in this update

1. **Server-side encryption** for sensitive text fields (chat messages, health report
   summaries/clinical notes, PHQ-9 emotion fields) using a dedicated `DATA_ENCRYPTION_KEY`
   (Fernet), independent from `SECRET_KEY`. A one-time migration script
   (`backend/migrate_encrypt_existing_data.py`) encrypts any existing plaintext rows —
   back up your database before running it.

2. **Doctor ↔ Patient one-to-one mapping, controlled by admin**
   - Every patient automatically gets an anonymised **Patient ID** (`PT-XXXXXX`).
   - Consultant registration now **requires** a credential PDF (`/auth/register-consultant`).
     The account stays `pending` until an admin approves it.
   - Admin dashboard has a new **"Doctor Verification & Patient Mapping"** panel: review/
     download each doctor's credential PDF, approve/reject them, and assign a patient to an
     approved doctor (one doctor ↔ one patient, enforced by `MAX_PATIENTS_PER_DOCTOR=1`).
   - Doctors only ever see the **Patient ID** of the patient assigned to them — never their
     name or email. The admin view still sees full identity + the current mapping.
   - The patient's video-call / doctor list only shows the doctor the admin assigned to them.

3. **Sensor "not connected" bug fixed.** The phone-push data (`/bluetooth/ingest`) is now
   persisted to the database against the paired patient, and the chatbot's connection check
   also looks at the live in-memory pairing — so once a phone is paired, the AI companion
   correctly reports it as connected instead of "not connected".

4. **WiFi Telemetry Console removed** from the patient sidebar/dashboard/routes
   (`/phone-data`). The Sensor Monitor page (phone pairing) is unchanged. Everything else in
   the doctor and admin dashboards is unchanged aside from the additions in (2).

## Setup notes
- `backend/.env` already has a freshly generated `DATA_ENCRYPTION_KEY` — keep it safe (losing
  it makes encrypted data unrecoverable). If you deploy this elsewhere, generate your own:
  `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`
- On first backend startup, `ensure_schema()` runs automatically and adds the new `users`
  columns + backfills Patient IDs for any existing patients — no manual migration needed for
  the schema itself.
- Run `python migrate_encrypt_existing_data.py` from `backend/` once, after backing up your DB,
  to encrypt any pre-existing plaintext chat/health-report/PHQ-9 rows.

## Consultant credential upload and approval fix (2026-10-15)
- Added a Professional Credential Verification panel to the existing Consultant Dashboard.
- Existing consultant accounts without a credential PDF can upload one without registering a second account.
- Upload uses the existing authenticated `/api/v1/auth/credential` endpoint, validates PDF selection in the UI, displays success/error feedback, and updates the profile status.
- Once the PDF is uploaded, the consultant remains pending and the existing Admin Dashboard Approve action becomes enabled after refreshing its consultant list.
- Kept the existing fresh consultant registration flow requiring a credential PDF; existing application features and routes were otherwise left unchanged.
