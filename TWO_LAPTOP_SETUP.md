# Healthly: two-laptop patient/doctor call test (LAN)

## What the current code supports
- The project already contains patient call requests, doctor pending-call polling, accept/reject endpoints, and WebRTC signaling/chat in a shared room.
- Both laptops must use the SAME running backend and the SAME PostgreSQL database. Do not run two independent databases if you expect the patient request to appear on the doctor's screen.
- This package is configured for a local-network demo where the host laptop runs frontend + backend and both laptops open the host laptop's frontend URL.

## 1. Prepare the host laptop
1. Extract this folder and install Node.js (LTS), Python, and PostgreSQL.
2. Create/restore the Healthly PostgreSQL database and configure `backend/.env` using `backend/.env.example`. Keep secrets private; do not send `.env` to other people.
3. In `backend/.env`, set `DATABASE_URL` to the PostgreSQL database running on this host, and set a strong `SECRET_KEY`. The database does not need to be exposed to the other laptop; only the backend connects to it.
4. Set `CORS_ORIGINS` to include the frontend origin, for example `http://192.168.1.10:5173` (replace with the host laptop's LAN IPv4 address).
5. Backend terminal:
   - `cd backend`
   - `python -m venv .venv`
   - Windows PowerShell: `.venv\Scripts\Activate.ps1`
   - `pip install -r requirements.txt`
   - `uvicorn app.main:app --host 0.0.0.0 --port 8000`
6. Frontend terminal:
   - `cd frontend`
   - `npm install`
   - `npm run dev -- --host 0.0.0.0`

## 2. Find the host laptop's LAN IP
On Windows, run `ipconfig` and note the Wi-Fi/Ethernet IPv4 address, e.g. `192.168.1.10`. Do not use `127.0.0.1` for the second laptop: that always means the second laptop itself.

## 3. Open the app on both laptops
- Host laptop: `http://localhost:5173` or `http://HOST_LAN_IP:5173`
- Second laptop: `http://HOST_LAN_IP:5173`
- Both devices should be on the same Wi-Fi/LAN. Allow Node/Python through Windows Firewall on a trusted private network if prompted.
- Use two different accounts: patient on one laptop and approved consultant/doctor on the other. The patient must be assigned to that doctor in the admin assignment page/database; otherwise the doctor list is intentionally empty.
- Doctor dashboard polls incoming requests every 4 seconds. Doctor accepts, then both users join the same call room.

## 4. Video call requirements / limitations
- Allow camera and microphone permissions in each browser.
- This build uses Google's public STUN server only. Same-network calls often work, but some NAT/firewall combinations need a TURN server for reliable internet-wide calling.
- For testing across different networks or for a real deployment, deploy the frontend and backend with HTTPS/WSS and configure a TURN server. Browser camera/microphone access generally requires HTTPS outside localhost.
- This LAN setup is for a demo, not production medical data. Do not expose PostgreSQL's port to the internet. Never share database passwords, JWT secrets, encryption keys, or real patient records.

## 5. Important
- `.env` files containing secrets were intentionally not included in this updated ZIP. Copy the `.env.example` files to `.env` and fill in your own values.
- If your PostgreSQL SQL dump/schema is separate, share the schema or a sanitized SQL file without passwords, real patient data, or credentials so its compatibility can be checked.
