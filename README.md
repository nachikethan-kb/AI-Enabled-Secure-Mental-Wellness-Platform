# Healthly - AI-Enabled Mental Wellness Platform

A full-stack web application that helps users assess mental health, receive AI-based emotional support, interact with a community, and connect with certified mental health professionals via AI-orchestrated workflows using n8n.

This repository contains:
- **FastAPI backend** with modular architecture and webhook orchestration
- **React + Vite + Tailwind** frontend with protected routes
- **n8n workflow automation** for email alerts, onboarding, check-ins, and community moderation
- **PostgreSQL + Redis** for data persistence and caching
- **DistilBERT** for emotion analysis and risk classification
- **Docker Compose** for containerized full-stack deployment

---

## Quick Start: Docker Compose (Recommended)

The easiest way to run the entire stack (FastAPI, n8n, PostgreSQL, Redis) is with Docker Compose:

```bash
# Clone the repo
git clone <repo-url>
cd Healthly

# Copy and configure environment file
cp backend/.env.example backend/.env

# Update backend/.env with your values:
# - SECRET_KEY: Generate a secure random key
# - WEBHOOK_SECRET: Generate a webhook secret for n8n
# - Gmail credentials for email workflows (optional)

# Start all services
docker-compose up -d

# Check services are running
docker-compose ps
```

**Services will be available at:**
- **FastAPI Backend**: `http://localhost:8000`
- **n8n Workflow UI**: `http://localhost:5678`
- **PostgreSQL Database**: `localhost:5432`
- **Redis Cache**: `localhost:6379`
- **Frontend**: `http://localhost:5173` (run separately or add to compose)

---

## Local Development Setup (Without Docker)

### Backend

```bash
cd backend
python -m venv .venv

# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env

# Update .env with local database URL (SQLite or PostgreSQL)
# DATABASE_URL=sqlite:///./healthly.db (or PostgreSQL connection string)

uvicorn app.main:app --reload
```

Backend will run at `http://localhost:8000`.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env

# Update .env if backend is not at default localhost:8000
# VITE_API_BASE_URL=http://localhost:8000/api/v1

npm run dev
```

Frontend runs at `http://localhost:5173`.

---

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login user
- `GET /api/v1/auth/me` - Get current user profile (requires JWT)

### PHQ-9 Assessment
- `POST /api/v1/assessment/phq9` - Submit PHQ-9 answers, triggers n8n risk workflow if high-risk
- `GET /api/v1/assessment/phq9/history` - Get user's assessment history (requires JWT)

### Emotion Analysis
- `POST /api/v1/emotion/analyze` - Analyze text emotion (DistilBERT model)

### Dataset-Driven ML Models
- The backend can train a local BERT emotion model and an LSTM mental-state model from `mental_wellness_dataset_u.xlsx`.
- From the `backend/` folder, run `python -m app.ml.train_models --dataset ..\\mental_wellness_dataset_u.xlsx` to generate the local artifacts in `backend/app/ml/artifacts/`.
- When those artifacts exist, the live API prefers them over the fallback hosted emotion pipeline.

### AI Chat
- `POST /api/v1/chat/message` - Send message, get CBT-based response with emotion analysis
- `GET /api/v1/chat/history` - Get chat history (requires JWT)

### Community Forum
- `GET /api/v1/forum/posts` - List all forum posts (requires JWT)
- `POST /api/v1/forum/posts` - Create new forum post (requires JWT), triggers n8n moderation workflow

### Webhooks (for n8n integration)
- `POST /webhook/risk-alert` - Receives risk alerts from n8n (requires secret header)
- `POST /webhook/new-user` - New user onboarding confirmation from n8n
- `GET /api/user/last-score/{user_id}` - n8n queries user's last PHQ-9 score
- `POST /trigger-n8n/risk-alert/{user_id}` - Manually trigger risk workflow
- `POST /trigger-n8n/new-user` - Manually trigger onboarding workflow

---

## n8n Workflow Automation

n8n orchestrates critical workflows for mental health alerts, user onboarding, and community safety.

### Included Workflows

1. **Risk Alert Workflow** - Sends emails to user and consultant when PHQ-9 score ≥ 15, creates consultation booking, logs to Google Sheets

2. **New User Onboarding** - Sends welcome email, waits 24hrs, sends assessment reminder, logs to Sheets

3. **Weekly Check-in** - CRON-triggered every 7 days, sends reminders, escalates if scores worsen

4. **Google Form Ingestion** - Pulls responses from Google Form, analyzes emotion, stores results

5. **Community Moderation** - Checks new forum posts for toxicity/distress, flags for review or auto-publishes

### Setup n8n

See [N8N_SETUP_GUIDE.md](N8N_SETUP_GUIDE.md) for:
- Detailed workflow import instructions
- Credential configuration (Gmail, Google Sheets, etc.)
- Testing and troubleshooting
- Production deployment notes

---

## Project Structure

```
Healthly/
├── backend/
│   ├── app/
│   │   ├── api/v1/
│   │   │   ├── endpoints/
│   │   │   │   ├── auth.py         # Auth routes
│   │   │   │   ├── assessment.py   # PHQ-9 routes
│   │   │   │   ├── chat.py         # Chat routes
│   │   │   │   ├── emotion.py      # Emotion analysis
│   │   │   │   ├── forum.py        # Community forum
│   │   │   │   └── webhook.py      # n8n webhooks
│   │   │   └── router.py
│   │   ├── core/
│   │   │   ├── config.py           # Settings & env variables
│   │   │   ├── deps.py             # JWT dependency injection
│   │   │   └── security.py         # Password hashing, JWT
│   │   ├── db/
│   │   │   └── session.py          # Database session
│   │   ├── models/
│   │   │   ├── user.py
│   │   │   ├── phq9_assessment.py
│   │   │   ├── chat_message.py
│   │   │   └── forum_post.py
│   │   ├── schemas/                # Pydantic schemas
│   │   ├── services/               # Business logic
│   │   │   ├── phq9.py
│   │   │   ├── emotion_classifier.py
│   │   │   ├── chatbot.py
│   │   │   └── webhook_service.py  # n8n webhook calls
│   │   └── main.py                 # FastAPI app
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── AssessmentPage.jsx
│   │   │   ├── ChatPage.jsx
│   │   │   └── DashboardPage.jsx
│   │   ├── components/
│   │   │   └── ProtectedRoute.jsx
│   │   ├── lib/
│   │   │   └── api.js              # API client with JWT
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── .env.example
├── n8n-workflows/
│   ├── risk-alert-workflow.json
│   ├── new-user-onboarding-workflow.json
│   ├── weekly-checkin-workflow.json
│   ├── google-form-ingestion-workflow.json
│   └── community-moderation-workflow.json
├── docker-compose.yml
├── README.md
└── N8N_SETUP_GUIDE.md
```

---

## Key Features

✅ **User Authentication** - JWT tokens with hashed passwords (bcrypt)

✅ **PHQ-9 Assessments** - Standardized mental health questionnaire (0–27 scale)

✅ **AI Emotion Detection** - DistilBERT model for emotion classification

✅ **CBT Chatbot** - Evidence-based responses with distress escalation

✅ **Community Forum** - User-generated posts with AI-powered moderation

✅ **Risk Alerts** - Automatic n8n workflows for high-risk scores

✅ **History Tracking** - Persistent storage of assessments, chat, and interactions

✅ **Protected Routes** - Frontend routes require JWT token

✅ **Webhook Security** - Shared secret header validation for n8n

✅ **Docker Deployment** - Full-stack containerized setup

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| **Backend** | FastAPI, SQLAlchemy, Pydantic |
| **Frontend** | React, Vite, React Router, Tailwind CSS |
| **Database** | PostgreSQL (production), SQLite (dev) |
| **Cache** | Redis |
| **AI/ML** | DistilBERT, Transformers, scikit-learn |
| **Workflow** | n8n (self-hosted) |
| **Deployment** | Docker, Docker Compose |
| **Security** | JWT (PyJWT), bcrypt, HTTPS-ready |

---

## Environment Variables

### Backend `.env`

```env
PROJECT_NAME=Healthly API
API_V1_PREFIX=/api/v1
SECRET_KEY=<generate-secure-key>
ACCESS_TOKEN_EXPIRE_MINUTES=60
DATABASE_URL=postgresql://user:password@localhost:5432/healthly_db
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
WEBHOOK_SECRET=<generate-webhook-secret>
N8N_WEBHOOK_URL=http://localhost:5678
REDIS_URL=redis://localhost:6379/0
GOOGLE_SHEET_ID=<your-sheet-id>
GOOGLE_FORM_SHEET_ID=<your-form-sheet-id>
APP_URL=http://localhost:5173
ADMIN_URL=http://localhost:3000/admin
```

### Frontend `.env`

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

---

## Development Notes

- **DistilBERT** downloads on first API call to `/emotion/analyze` or `/chat/message`
- **SQLite** is default for local dev; use PostgreSQL for Docker/production
- **JWT tokens** expire by default after 60 minutes; configurable via `ACCESS_TOKEN_EXPIRE_MINUTES`
- **Webhook calls** from FastAPI to n8n are async and non-blocking
- **Failed workflows** in n8n won't block API responses; check n8n UI for logs

---

## Testing

### Test Risk Alert Flow
1. Register user → Login → Take PHQ-9 with scores ≥ 15
2. Check backend logs for n8n webhook call
3. Check n8n Executions tab to see workflow run
4. Verify emails sent (configurable in n8n Gmail node)

### Test API with cURL

```bash
# Register
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","full_name":"Test User","password":"secure_pass123"}'

# Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"secure_pass123"}'

# Submit PHQ-9
curl -X POST http://localhost:8000/api/v1/assessment/phq9 \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json" \
  -d '{"answers":[3,3,3,3,3,3,3,3,3]}'
```

---

## Production Checklist

- [ ] Generate strong `SECRET_KEY` and `WEBHOOK_SECRET`
- [ ] Configure PostgreSQL (managed DB service recommended)
- [ ] Set up HTTPS for FastAPI and n8n
- [ ] Configure Gmail or SES for email sending
- [ ] Enable rate limiting on webhook endpoints
- [ ] Set up monitoring/alerts for workflow failures
- [ ] Configure database backups
- [ ] Test all n8n workflows in production environment
- [ ] Document runbook for consultant/moderator actions

---

## Roadmap

- [ ] Video consultation integration (WebRTC / Daily.co)
- [ ] SMS notifications via Twilio
- [ ] Advanced NLP for better risk detection
- [ ] Mobile app (React Native)
- [ ] Analytics dashboard for admins
- [ ] Integration with external EHR systems
- [ ] Multi-language support
- [ ] HIPAA compliance documentation

---

## Support & Issues

For bug reports or feature requests, open an issue on GitHub.

For n8n-specific questions, see [N8N_SETUP_GUIDE.md](N8N_SETUP_GUIDE.md).

---

## License

TODO: Add license information
