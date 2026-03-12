# CLAUDE.md — adizes-frontend

## What This Is
React + Vite frontend for the Adizes PAEI Management Style Assessment platform.
Scaffolded via Google AI Studio, wired to `adizes-backend` FastAPI.

## Related Repos
- Backend API: `/Users/vrln/adizes-backend` → branch `adizes-backend`
- Source docs: `/Users/vrln/HIL_Adizes_India` → branch `main`
- GitHub: `https://github.com/lax-t3/adizes-app`

## Tech Stack
- React 19 + Vite + TypeScript
- Tailwind CSS v4
- Zustand (auth + assessment state)
- Recharts (PAEI radar + gap bar charts)
- Axios (API client with JWT interceptor)
- Motion/Framer Motion (animations)
- Lucide React (icons)

## Key Files
| File | Purpose |
|------|---------|
| `src/api/client.ts` | Axios instance — reads JWT from localStorage, attaches as Bearer token |
| `src/api/auth.ts` | `login()`, `register()` → POST /auth/* |
| `src/api/assessment.ts` | `getQuestions()`, `submitAssessment()` |
| `src/api/results.ts` | `getResult()`, `getMyAssessments()` — `downloadPdf` removed; PDFs now served from S3 via `pdf_url` field |
| `src/api/admin.ts` | `listCohorts()`, `getCohort()`, `exportCohortCsv()` |
| `src/store/authStore.ts` | Persisted Zustand — `{ user, role, token }` |
| `src/store/assessmentStore.ts` | In-memory — sections, answers (question_index→option_key), resultId |
| `src/types/api.ts` | TypeScript interfaces matching FastAPI Pydantic schemas |

## Answer Format
Assessment answers are stored as `Record<number, string>`:
- Key = `question_index` (0-based, 0–35)
- Value = `option_key` ('a' | 'b' | 'c' | 'd')

Submitted to backend as: `[{ question_index: 0, option_key: 'b' }, ...]`

## Environment
```
VITE_API_URL=http://localhost:8000   # FastAPI backend URL
```

## Running Locally
```bash
npm install
cp .env.example .env.local
# set VITE_API_URL
npm run dev   # runs on port 3000
```

## Brand Colors
```
Primary Red:  #C8102E
P role:       #C8102E  Administrator: #1D3557  Entrepreneur: #E87722  Integrator: #2A9D8F
```

## Design Spec
Full spec: `/Users/vrln/HIL_Adizes_India/docs/plans/2026-03-10-adizes-paei-app-design.md`
