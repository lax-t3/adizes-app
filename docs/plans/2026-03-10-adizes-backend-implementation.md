# Adizes Backend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Production-ready FastAPI backend for the Adizes PAEI assessment platform with Supabase PostgreSQL, JWT auth, PAEI scoring engine, gap analysis, PDF report generation, and admin endpoints.

**Architecture:** Two-repo setup. FastAPI owns all business logic. Supabase handles auth token issuance + PostgreSQL + Storage. Frontend calls Supabase Auth SDK directly; all other calls go through FastAPI which validates the Supabase JWT.

**Tech Stack:** Python 3.11+, FastAPI, Supabase Python SDK, python-jose (JWT), WeasyPrint + Jinja2 (PDF), pytest

---

## Status: Core files scaffolded ✓

The following files are already written and committed:
- `main.py` — FastAPI app with CORS + router registration
- `app/config.py` — pydantic-settings from .env
- `app/database.py` — Supabase client (anon + service role)
- `app/auth.py` — JWT validation dependency + admin guard
- `app/services/scoring.py` — PAEI scoring engine + full 36Q scoring key
- `app/services/gap_analysis.py` — gap calculator + severity + messages
- `app/services/interpretation.py` — dominant style detection + narratives
- `app/services/pdf_service.py` — WeasyPrint HTML→PDF
- `app/services/export_service.py` — CSV generation
- `app/schemas/` — all Pydantic request/response models
- `app/routers/` — auth, assessment, results, admin
- `migrations/001_initial_schema.sql` — full DB schema with RLS
- `migrations/002_seed_questions.sql` — all 36 questions + options
- `templates/report.html` — Jinja2 PDF report template
- `tests/test_scoring.py`, `test_gap_analysis.py`, `test_interpretation.py`

---

## Task 1: Environment Setup

**Files:**
- Read: `requirements.txt`, `.env.example`

**Step 1: Create and activate virtualenv**
```bash
cd /Users/vrln/adizes-backend
python3 -m venv venv
source venv/bin/activate
```

**Step 2: Install dependencies**
```bash
pip install -r requirements.txt
```
Expected: all packages install cleanly.

**Step 3: Copy env file**
```bash
cp .env.example .env
```
Fill in your Supabase credentials from the Supabase dashboard:
- `SUPABASE_URL` — Project URL (Settings → API)
- `SUPABASE_ANON_KEY` — anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` — service_role key (keep secret)
- `SUPABASE_JWT_SECRET` — JWT secret (Settings → API → JWT Secret)

**Step 4: Verify server starts**
```bash
uvicorn main:app --reload
```
Expected: `Application startup complete` at http://localhost:8000
Visit http://localhost:8000/health → `{"status": "ok"}`

---

## Task 2: Run Core Service Tests

**Files:**
- Test: `tests/test_scoring.py`, `tests/test_gap_analysis.py`, `tests/test_interpretation.py`

**Step 1: Run scoring tests**
```bash
pytest tests/test_scoring.py -v
```
Expected: all 9 tests PASS. Key test: `test_each_question_has_all_4_roles` validates the complete 36Q scoring key.

**Step 2: Run gap analysis tests**
```bash
pytest tests/test_gap_analysis.py -v
```
Expected: all 7 tests PASS.

**Step 3: Run interpretation tests**
```bash
pytest tests/test_interpretation.py -v
```
Expected: all 8 tests PASS.

**Step 4: Commit if any fixes were needed**
```bash
git add -A && git commit -m "test: verify core service layer passes"
```

---

## Task 3: Supabase Database Setup

**Files:**
- Read: `migrations/001_initial_schema.sql`, `migrations/002_seed_questions.sql`

**Step 1: Run schema migration**
- Open Supabase dashboard → SQL Editor
- Paste and run `migrations/001_initial_schema.sql`
- Expected: tables created (questions, options, cohorts, cohort_members, assessments, answers)

**Step 2: Seed questions**
- Paste and run `migrations/002_seed_questions.sql`
- Expected: 36 rows in `questions`, 144 rows in `options` (36 × 4)

**Step 3: Verify in Table Editor**
```sql
SELECT question_index, section, text FROM questions ORDER BY question_index;
SELECT COUNT(*) FROM options;  -- should return 144
```

**Step 4: Set admin role on your user**
```sql
-- Run in Supabase SQL Editor after creating your admin user account
UPDATE auth.users
SET app_metadata = jsonb_set(app_metadata, '{role}', '"admin"')
WHERE email = 'your-admin@email.com';
```

---

## Task 4: Integration Test — Assessment Flow

**Files:**
- Test: create `tests/test_api_assessment.py`

**Step 1: Write integration test**
```python
# tests/test_api_assessment.py
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from main import app

client = TestClient(app)

MOCK_USER = {
    "sub": "test-user-id-123",
    "email": "test@example.com",
    "app_metadata": {"role": "user"},
}

MOCK_QUESTIONS_DATA = {
    "data": [
        {
            "id": f"q-{i}",
            "question_index": i,
            "text": f"Question {i}",
            "options": [
                {"option_key": k, "text": f"Option {k}", "paei_role": r}
                for k, r in zip("abcd", "PAEI")
            ],
        }
        for i in range(36)
    ]
}


def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


@patch("app.routers.assessment.get_current_user", return_value=MOCK_USER)
@patch("app.routers.assessment.supabase_admin")
def test_get_questions_returns_3_sections(mock_db, mock_auth):
    mock_db.table.return_value.select.return_value.order.return_value.execute.return_value = \
        MagicMock(data=MOCK_QUESTIONS_DATA["data"])
    resp = client.get("/assessment/questions", headers={"Authorization": "Bearer fake"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["sections"]) == 3
    assert data["sections"][0]["name"] == "is"
    assert data["sections"][1]["name"] == "should"
    assert data["sections"][2]["name"] == "want"
    assert len(data["sections"][0]["questions"]) == 12


@patch("app.routers.assessment.get_current_user", return_value=MOCK_USER)
@patch("app.routers.assessment.supabase_admin")
def test_submit_requires_36_answers(mock_db, mock_auth):
    resp = client.post(
        "/assessment/submit",
        json={"answers": [{"question_index": 0, "option_key": "a"}]},
        headers={"Authorization": "Bearer fake"},
    )
    assert resp.status_code == 422


@patch("app.routers.assessment.get_current_user", return_value=MOCK_USER)
@patch("app.routers.assessment.supabase_admin")
def test_submit_36_answers_succeeds(mock_db, mock_auth):
    mock_db.table.return_value.insert.return_value.execute.return_value = MagicMock(data=[])
    answers = [{"question_index": i, "option_key": "a"} for i in range(36)]
    resp = client.post(
        "/assessment/submit",
        json={"answers": answers},
        headers={"Authorization": "Bearer fake"},
    )
    assert resp.status_code == 200
    assert "result_id" in resp.json()
```

**Step 2: Run integration tests**
```bash
pytest tests/test_api_assessment.py -v
```
Expected: all 4 tests PASS.

**Step 3: Commit**
```bash
git add tests/test_api_assessment.py
git commit -m "test: add assessment API integration tests"
```

---

## Task 5: Integration Test — Admin Endpoints

**Files:**
- Test: create `tests/test_api_admin.py`

**Step 1: Write admin test**
```python
# tests/test_api_admin.py
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from main import app

client = TestClient(app)

ADMIN_USER = {
    "sub": "admin-user-id",
    "email": "admin@example.com",
    "app_metadata": {"role": "admin"},
}

REGULAR_USER = {
    "sub": "regular-user-id",
    "email": "user@example.com",
    "app_metadata": {"role": "user"},
}


@patch("app.routers.admin.require_admin", return_value=ADMIN_USER)
@patch("app.routers.admin.supabase_admin")
def test_list_cohorts_returns_list(mock_db, mock_auth):
    mock_db.table.return_value.select.return_value.order.return_value.execute.return_value = \
        MagicMock(data=[])
    resp = client.get("/admin/cohorts", headers={"Authorization": "Bearer fake"})
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_admin_route_rejects_non_admin():
    with patch("app.auth.get_current_user", return_value=REGULAR_USER):
        resp = client.get("/admin/cohorts", headers={"Authorization": "Bearer fake"})
        assert resp.status_code == 403


@patch("app.routers.admin.require_admin", return_value=ADMIN_USER)
@patch("app.routers.admin.supabase_admin")
def test_create_cohort(mock_db, mock_auth):
    mock_db.table.return_value.insert.return_value.execute.return_value = MagicMock(
        data=[{"id": "cohort-1", "name": "Test Cohort", "description": None, "created_at": "2026-03-10"}]
    )
    resp = client.post(
        "/admin/cohorts",
        json={"name": "Test Cohort"},
        headers={"Authorization": "Bearer fake"},
    )
    assert resp.status_code == 201
```

**Step 2: Run admin tests**
```bash
pytest tests/test_api_admin.py -v
```
Expected: all 3 tests PASS.

**Step 3: Run full test suite**
```bash
pytest tests/ -v
```
Expected: all tests PASS.

**Step 4: Commit**
```bash
git add tests/test_api_admin.py
git commit -m "test: add admin API integration tests"
```

---

## Task 6: PDF Generation Smoke Test

**Files:**
- Read: `app/services/pdf_service.py`, `templates/report.html`

**Step 1: Write smoke test script**
```python
# Run manually: python scripts/test_pdf.py
import sys
sys.path.insert(0, '.')
from app.services.pdf_service import generate_pdf

mock_data = {
    "users": {"name": "Test User"},
    "completed_at": "2026-03-10T10:00:00Z",
    "profile": {"is": "paEI", "should": "paEI", "want": "paEI"},
    "scaled_scores": {
        "is":     {"P": 18, "A": 21, "E": 40, "I": 41},
        "should": {"P": 24, "A": 22, "E": 35, "I": 39},
        "want":   {"P": 22, "A": 19, "E": 39, "I": 40},
    },
    "gaps": [
        {"role": "P", "role_name": "Producer", "is_score": 18, "should_score": 24,
         "want_score": 22, "external_gap": 6, "internal_gap": 4,
         "external_severity": "watch", "internal_severity": "aligned",
         "external_message": "Watch this gap.", "internal_message": "Well aligned."},
        {"role": "A", "role_name": "Administrator", "is_score": 21, "should_score": 22,
         "want_score": 19, "external_gap": 1, "internal_gap": 2,
         "external_severity": "aligned", "internal_severity": "aligned",
         "external_message": "Well aligned.", "internal_message": "Well aligned."},
        {"role": "E", "role_name": "Entrepreneur", "is_score": 40, "should_score": 35,
         "want_score": 39, "external_gap": 5, "internal_gap": 1,
         "external_severity": "watch", "internal_severity": "aligned",
         "external_message": "Watch this.", "internal_message": "Well aligned."},
        {"role": "I", "role_name": "Integrator", "is_score": 41, "should_score": 39,
         "want_score": 40, "external_gap": 2, "internal_gap": 1,
         "external_severity": "aligned", "internal_severity": "aligned",
         "external_message": "Well aligned.", "internal_message": "Well aligned."},
    ],
    "interpretation": {
        "dominant_roles": ["E", "I"],
        "style_label": "Entrepreneur",
        "style_tagline": "The Visionary Catalyst",
        "strengths": "You see possibilities others miss...",
        "blind_spots": "Ideas without follow-through...",
        "working_with_others": "Producers are your best implementers...",
        "combined_description": "Inspiring Visionary — see the future and bring people along.",
        "mismanagement_risks": ["Arsonist — impractical under stress."],
    },
}

pdf = generate_pdf(mock_data)
with open("/tmp/test_report.pdf", "wb") as f:
    f.write(pdf)
print(f"PDF generated: {len(pdf)} bytes → /tmp/test_report.pdf")
```

**Step 2: Run the script**
```bash
mkdir -p scripts
# paste the script above into scripts/test_pdf.py
python scripts/test_pdf.py
```
Expected: `PDF generated: NNNNN bytes → /tmp/test_report.pdf`
Open `/tmp/test_report.pdf` to visually verify the report layout.

**Step 3: Commit**
```bash
git add scripts/test_pdf.py
git commit -m "chore: add PDF smoke test script"
```

---

## Task 7: Deploy to Railway (or Render)

**Step 1: Create `Procfile`**
```
web: uvicorn main:app --host 0.0.0.0 --port $PORT
```

**Step 2: Create `railway.toml` (if Railway)**
```toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "uvicorn main:app --host 0.0.0.0 --port $PORT"
healthcheckPath = "/health"
```

**Step 3: Push to GitHub**
```bash
git remote add origin https://github.com/YOUR_ORG/adizes-backend.git
git push -u origin main
```

**Step 4: Set environment variables in Railway/Render dashboard**
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `FRONTEND_URL` (your Vercel frontend URL)

**Step 5: Verify deployed health endpoint**
```bash
curl https://your-railway-url.railway.app/health
```
Expected: `{"status":"ok"}`

---

## Task 8: Connect Frontend (when ready)

When the Google AI Studio frontend repo is shared:

1. Update `FRONTEND_URL` in Railway env vars to the Vercel deploy URL
2. In frontend: set `VITE_API_URL` to the Railway backend URL
3. In frontend: set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
4. Wire Zustand `authStore` to call `/auth/login` and `/auth/register`
5. Wire `assessmentStore` to `GET /assessment/questions` and `POST /assessment/submit`
6. Wire results page to `GET /results/:id`
7. Wire PDF download to `GET /results/:id/pdf`

---

## Out of Scope (v1)
- Email invitations for cohort members
- Supabase Storage PDF caching (currently streams on demand)
- Assessment retake/versioning
- Multi-language support
