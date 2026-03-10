# adizes-backend

FastAPI backend for the **Adizes PAEI Management Style Assessment** platform.

## Tech Stack
- Python 3.11+
- FastAPI
- Supabase (PostgreSQL + Auth + Storage)
- WeasyPrint + Jinja2 (PDF generation)
- python-jose (JWT validation)
- pytest (testing)

## Features
- Supabase JWT auth validation middleware
- PAEI scoring engine (12 questions × 3 dimensions)
- Gap analysis calculator with severity classification
- Style interpretation engine (dominant style detection)
- Full PDF report generation (WeasyPrint)
- Admin endpoints: cohorts, respondents, CSV export
- Supabase Storage integration for generated PDFs

## Getting Started

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Fill in Supabase credentials
uvicorn main:app --reload
```

## Environment Variables

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret
FRONTEND_URL=http://localhost:5173
```

## Project Structure

```
adizes-backend/
  main.py                    # FastAPI app, CORS, router registration
  app/
    config.py                # Settings (pydantic-settings)
    database.py              # Supabase client singleton
    auth.py                  # JWT validation dependency
    routers/
      auth.py                # POST /auth/login, /auth/register
      assessment.py          # GET /assessment/questions, POST /assessment/submit
      results.py             # GET /results/:id, GET /results/:id/pdf
      admin.py               # Cohorts, respondents, CSV export
    services/
      scoring.py             # PAEI scoring engine
      gap_analysis.py        # Gap calculator + severity
      interpretation.py      # Dominant style + narrative text
      pdf_service.py         # WeasyPrint HTML→PDF
      export_service.py      # CSV/Excel generation
    schemas/
      auth.py                # Pydantic request/response models
      assessment.py
      results.py
      admin.py
  migrations/
    001_initial_schema.sql   # Full DB schema
  tests/
    test_scoring.py
    test_gap_analysis.py
    test_interpretation.py
    test_api_assessment.py
    test_api_admin.py
  templates/
    report.html              # Jinja2 PDF report template
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | Login → JWT |
| POST | `/auth/register` | Register new user |
| GET | `/assessment/questions` | All 36 questions in 3 sections |
| POST | `/assessment/submit` | Submit answers → result_id |
| GET | `/results/{result_id}` | Scores + gaps + interpretation |
| GET | `/results/{result_id}/pdf` | Stream PDF report |
| GET | `/admin/cohorts` | List cohorts |
| POST | `/admin/cohorts` | Create cohort |
| GET | `/admin/cohorts/{id}` | Cohort detail + team scores |
| GET | `/admin/respondents/{id}` | Individual respondent result |
| GET | `/admin/export/{cohort_id}` | CSV export |

## Running Tests

```bash
pytest tests/ -v
```

## Related
- Frontend: [adizes-frontend](../adizes-frontend)
- Design spec: [HIL_Adizes_India/docs/plans/2026-03-10-adizes-paei-app-design.md](../HIL_Adizes_India/docs/plans/2026-03-10-adizes-paei-app-design.md)
