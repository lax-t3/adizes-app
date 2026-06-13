# CLAUDE.md — HIL Adizes India Project

## What This Is
Assessment platform for the **LEAP™ — Leadership Energy Alignment Profile**, powered by the Adizes PAEI framework.
Users take a 36-question assessment across 3 dimensions (Current State / Role Expectations / Intrinsic Preference),
view a PAEI alignment dashboard, and download a full PDF report.

> **Rebrand note (2026-05-27):** The platform was previously branded "Adizes PAEI Management Style Indicator (AMSI)".
> The product is now publicly named **LEAP™**. The underlying PAEI scoring engine, question set, and DB schema
> are unchanged. Frontend display labels use LEAP vocabulary; internal code still uses `is/should/want` as keys.

## Repo Map
| Repo | Path | Branch | Purpose |
|------|------|--------|---------|
| `adizes-backend` | `/Users/vrln/adizes-backend` | `adizes-backend` | FastAPI + Supabase — all business logic |
| `adizes-frontend` | `/Users/vrln/adizes-frontend` | `adizes-frontend` | React + Vite — UI |
| `HIL_Adizes_India` | `/Users/vrln/HIL_Adizes_India` | `main` | Source docs, design specs, data files |

All branches live at: **https://github.com/lax-t3/adizes-app**

## Brand Identity (canonical — 2026-06-11)

```
LEAP™                                          ← primary brand name
Leadership Energy Alignment Profile            ← descriptor
Developed by the Heartfulness Institute of Leadership  ← owner/developer
Powered by the Adizes PAEI Framework          ← methodology
```

**Rules:**
- The HIL isotype (three-petal loop symbol, `/public/HIL-Isotope.png`) is the **primary visual anchor** on all surfaces.
- Adizes is referenced only as "Powered by the Adizes PAEI Framework" — never as a logo or primary visual identifier.
- "Turiyaskills" appears only as a small technical note in footer/admin sidebar — not in emails.
- Email templates use a uniform navy header band: `#1D3557` background, HIL isotope circle (inline SVG), "LEAP™" bold white, "Leadership Energy Alignment Profile" right-aligned.

**Email header band spec:**
- Background: `#1D3557` (navy), red stripe `#C8102E` 3px at bottom
- Circle: 44×44px, `#2A4A6B` fill, HIL trefoil SVG (white stroke, `stroke-width: 2.4`)
- LEAP™: Arial bold 22px white; descriptor: Arial 11px `#a0b4c8`
- Implemented in `adizes-backend/app/services/email_service.py` → `_EMAIL_WRAPPER_OPEN`

**Brand assets in adizes-frontend/public:**
| Asset | File | Usage |
|-------|------|-------|
| HIL isotype (colour) | `HIL-Isotope.png` | Navbar, sidebar, footer, apple-touch-icon, OG image |
| HIL isotype (blue wordmark) | `hil_blue.png` | Available for full wordmark use |
| Favicon | `hil-favicon.png` | Browser tab + apple-touch-icon (HIL trefoil) — set in `index.html` (2026-06-13, replaced the old `icon.svg`/`icon.png` "A" placeholder) |

## Design Spec
Full approved design: `docs/plans/2026-03-10-adizes-paei-app-design.md`
Implementation plan: `docs/plans/2026-03-10-adizes-backend-implementation.md`

## PAEI Framework Quick Reference
| Role | Code | Focus | Strength | Stress trap (LEAP language) |
|------|------|-------|----------|-----------------------------|
| Producer | P | Results, short-term | Decisive, action-oriented | Dictator Trap |
| Administrator | A | Process, systems | Reliable, thorough | Perfectionist Trap |
| Entrepreneur | E | Change, vision | Innovative, creative | Know-It-All Trap |
| Integrator | I | People, consensus | Nurturing, team builder | Harmony Trap |

## Assessment Structure — Adizes90 / LEAP™ (current tool)

The individual PAEI self-assessment — sometimes called "Adizes90" internally, publicly branded as **LEAP™**.

Display labels (frontend + PDF): **Current State** (Is) · **Role Expectations** (Should) · **Intrinsic Preference** (Want).
Internal/DB keys: `is` / `should` / `want` — unchanged across all scoring, DB, and API code.

- **36 questions** = 12 per section × 3 sections (Is / Should / Want)
- Each question: rank all 4 options (P / A / E / I) from 1st choice to 4th
- **Scoring**: `RANK_POINTS = {1: 5, 2: 3, 3: 2, 4: 1}`
- **Total per section** = 12 questions × 11 pts = **132 points** (always fixed)
- **Dominant threshold** = 33 (= 132 ÷ 4, proportional equal share)
  - Score > 33 → capital letter (e.g. `P`)
  - Score ≤ 33 → lowercase (e.g. `p`)
- **3 gap types** per role (all on the 132-point scale):
  - **Execution Gap** = `|should − is|` — role demand vs current behaviour
  - **Engagement Gap** = `|should − want|` — role demand vs natural preference
  - **Authenticity Gap** = `|is − want|` — current behaviour vs natural preference
- **Severity thresholds**: `< 6` → low · `6–15` → medium · `> 15` → high

## Adizes360 — Phase 2 (pending)

Multi-rater 360° assessment where peers, direct reports, and manager each rate the subject.
Not yet implemented. Phase 2 scope: rater roles, multi-respondent data collection, aggregated
scores, self-vs-rater comparison, and admin workflow for assigning rater cohorts.

## Source Files
- `PAEI-Questions.xlsx` — all 36 questions + 4 options each
- `AMSI for Jack Allen.pdf` — sample full report (reference for PDF layout)
- `AMSI for Peter Fianu.pdf` — second sample report
- `Management Style Assessment Worksheet 010221.xlsx` — behavioral checklist (different tool)
- `PAEI_Questions_Turiyaskills_Format.xlsx` — questions converted to Turiyaskills format

## Tech Stack
| Layer | Tech |
|-------|------|
| Frontend | React 19 + Vite + TypeScript + Tailwind CSS v4 |
| State | Zustand v5 |
| Charts | Recharts v3 |
| HTTP client | Axios (JWT Bearer auto-attach) |
| Backend | FastAPI (Python 3.11+) |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth (JWT — ES256 local / HS256 cloud) |
| Storage | Supabase Storage (PDFs) |
| PDF gen | WeasyPrint + Jinja2 |
| Containerization | Docker (backend) |

## Brand Colors
```
Primary Red:   #C8102E
Dark/Black:    #1A1A1A
P role:        #C8102E  (red)
A role:        #1D3557  (navy)
E role:        #E87722  (amber)
I role:        #2A9D8F  (teal)
```

## Local Development URLs
| Service | URL | Notes |
|---------|-----|-------|
| Frontend | http://localhost:3000 | `npm run dev` in adizes-frontend |
| Backend API | http://localhost:8000 | Docker container `adizes-backend` |
| Backend Docs | http://localhost:8000/docs | FastAPI auto-docs (Swagger) |
| Supabase Studio | http://127.0.0.1:54323 | Local Supabase dashboard |
| Supabase API | http://127.0.0.1:54321 | Local Supabase REST/Auth |
| Supabase DB | postgresql://postgres:postgres@127.0.0.1:54322/postgres | Direct DB access |

## Local Dev Quick Start

```bash
# 1. Start Supabase (from adizes-backend dir)
cd /Users/vrln/adizes-backend && supabase start

# 2. Refresh .env with current Supabase keys (REQUIRED after every supabase start)
#    Keys rotate each time Supabase starts — copy ANON_KEY and SERVICE_ROLE_KEY:
supabase status -o env   # copy ANON_KEY + SERVICE_ROLE_KEY into .env

# 3. Apply DB migrations (REQUIRED after every supabase start — DB resets)
docker exec -i supabase_db_adizes-backend psql -U postgres -d postgres < migrations/001_initial_schema.sql
docker exec -i supabase_db_adizes-backend psql -U postgres -d postgres < migrations/002_seed_questions.sql
docker exec -i supabase_db_adizes-backend psql -U postgres -d postgres < migrations/003_add_user_name.sql
docker exec -i supabase_db_adizes-backend psql -U postgres -d postgres < migrations/004_email_settings.sql
docker exec -i supabase_db_adizes-backend psql -U postgres -d postgres < migrations/005_ranking_scoring.sql
docker exec -i supabase_db_adizes-backend psql -U postgres -d postgres < migrations/006_cohort_scoped_assessments.sql
docker exec -i supabase_db_adizes-backend psql -U postgres -d postgres < migrations/007_organizations.sql
docker exec -i supabase_db_adizes-backend psql -U postgres -d postgres < migrations/008_employee_extended_fields.sql
docker exec -i supabase_db_adizes-backend psql -U postgres -d postgres < migrations/009_employee_name_column.sql
docker exec -i supabase_db_adizes-backend psql -U postgres -d postgres < migrations/011_cohort_status.sql
docker exec -i supabase_db_adizes-backend psql -U postgres -d postgres < migrations/012_fix_question_sections.sql
docker exec -i supabase_db_adizes-backend psql -U postgres -d postgres < migrations/013_fix_q9_q26_sections.sql
docker exec -i supabase_db_adizes-backend psql -U postgres -d postgres < migrations/014_update_question_texts.sql

# 4. Create test users (REQUIRED after every supabase start — users reset)
SK="<SUPABASE_SERVICE_ROLE_KEY from .env>"
curl -s -X POST "http://127.0.0.1:54321/auth/v1/admin/users" \
  -H "apikey: $SK" -H "Authorization: Bearer $SK" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@adizes.com","password":"Admin@1234","email_confirm":true,"app_metadata":{"role":"admin"}}'
curl -s -X POST "http://127.0.0.1:54321/auth/v1/admin/users" \
  -H "apikey: $SK" -H "Authorization: Bearer $SK" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@adizes.com","password":"User@1234","email_confirm":true}'

# 5. Build and start backend (rebuild if any Python file changed)
cd /Users/vrln/adizes-backend && docker compose up --build -d

# 6. Start frontend
cd /Users/vrln/adizes-frontend && npm run dev
```

## Test Credentials (local only)
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@adizes.com | Admin@1234 |
| User | user@adizes.com | User@1234 |

> These must be recreated after every `supabase start` (local DB resets).

## Production Services

| Service | Details |
|---------|---------|
| Supabase Cloud | Project: `t3-adizes-db` · URL: `https://swiznkamzxyfzgckebqi.supabase.co` · Project ID: `swiznkamzxyfzgckebqi` · Publishable key: `sb_publishable_WEHbUUR_iDtHlyAkNz8BRg_s-KGpVkV` |
| AWS ECR | `094492115510.dkr.ecr.ap-south-1.amazonaws.com/adizes-backend:latest` |
| AWS Profile | Use `lax-t3-assumed` for all ECR operations (`AWS_PROFILE=lax-t3-assumed`) |

### Migrations → Production Supabase
The project is already linked in the Supabase CLI. However, **`supabase db push --linked` only tracks migrations in `supabase/migrations/`** — the project's custom `migrations/` folder is NOT tracked by the CLI. New migrations in `migrations/` must be applied manually via the Supabase MCP `execute_sql` tool or the Supabase Dashboard SQL editor. The `supabase/migrations/` folder only contains copies of migrations 007–009 that were applied via `supabase db push`.

```bash
cd /Users/vrln/adizes-backend
supabase db push --linked        # dry-run: add --dry-run
```

## Production Architecture
```
┌──────────────────────────────────────────────────────────────┐
│                        PRODUCTION                            │
├─────────────────┬──────────────────┬────────────────────────┤
│   FRONTEND      │    BACKEND       │   DATABASE / STORAGE   │
│   Netlify       │  AWS App Runner  │ Supabase Cloud         │
│                 │  ← ECR image     │                        │
│ React + Vite    │  FastAPI Docker  │ PostgreSQL             │
│ adizes-frontend │  adizes-backend  │ Auth + Storage         │
│ branch → Netlify│  ECR push →      │ supabase.com           │
│                 │  App Runner      ├────────────────────────┤
│                 │                  │   PDF STORAGE          │
│                 │  PDF Lambda      │ S3 (adizes-pdf-reports)│
│                 │  ← ECR image     │ Lambda writes PDF here │
└─────────────────┴──────────────────┴────────────────────────┘
```

### Production Deploy Steps

#### Frontend → Netlify
1. Connect `lax-t3/adizes-app` repo to Netlify
2. Set branch: `adizes-frontend`
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Set env var: `VITE_API_URL=https://<app-runner-url>`

#### Backend → AWS App Runner (via ECR)
App Runner pulls the Docker image from ECR. **Git push alone does NOT redeploy** — you must
push a new image to ECR, then App Runner auto-deploys (if auto-deploy is enabled on the service).

```bash
# From adizes-backend directory
AWS_ACCOUNT_ID=<your-account-id>
AWS_REGION=ap-south-1
ECR_REPO=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/adizes-backend

# Authenticate Docker to ECR  (use lax-t3-assumed profile)
AWS_PROFILE=lax-t3-assumed aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Build for linux/amd64 (required if building on Apple Silicon)
docker buildx build --platform linux/amd64 --provenance=false -t $ECR_REPO:latest .

# Push — App Runner auto-deploys on new image push
docker push $ECR_REPO:latest
```

App Runner env vars (set in AWS Console → App Runner service → Configuration):
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `FRONTEND_URL=https://<netlify-app>.netlify.app`
- `AWS_ACCESS_KEY_ID` (IAM user key to invoke PDF Lambda)
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION=ap-south-1`
- `PDF_LAMBDA_FUNCTION_NAME=adizes-pdf-generator-v2`

> **Rollback:** Change `PDF_LAMBDA_FUNCTION_NAME=adizes-pdf-generator` to revert to v1 with no code changes.

#### PDF Lambda v2 → AWS Lambda (via ECR)
```bash
cd lambda/pdf-generator-v2
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
export S3_BUCKET_NAME=adizes-pdf-reports
./deploy.sh
```

#### Database → Supabase Cloud
1. Create project at supabase.com
2. Run all migrations in SQL Editor (001 through 007)
3. Copy Project URL, anon key, service role key, JWT secret to App Runner env vars
4. Set admin role: `UPDATE auth.users SET app_metadata = '{"role":"admin"}' WHERE email = 'admin@yourorg.com'`

## Key Decisions
- **PDF Lambda v2 is active** (`adizes-pdf-generator-v2`). Cutover/rollback is one App Runner env var:
  `PDF_LAMBDA_FUNCTION_NAME=adizes-pdf-generator-v2` (v2) or `=adizes-pdf-generator` (v1 rollback).
  V1 (`lambda/pdf-generator/`) is preserved deployed and untouched.
- **PDF Lambda v2 report identity:** "LEAP™ — Leadership Energy Alignment Profile" — **5 pages**, no Chart.js,
  HTML div bars only. Three gap types (132-scale): Execution (`abs(should−is)`), Engagement (`abs(should−want)`),
  Authenticity (`abs(is−want)`). Severity thresholds: <6 low, 6–15 medium, >15 high.
  **Page structure (redesigned 2026-06-10; HIL-review revision 2026-06-13):**
  - Page 1 — Personal Snapshot: executive summary prose; **PAEI amplitude style code** (all four letters P A E I, font size ∝ Current-State score, role-colored); dominant role identity badge; at-your-best / friction callouts; top gap highlight card; **gap-definitions box** (one-line defs for the three gap types).
  - Page 2 — Energy Alignment Matrix: 3-row (IS/SHD/WNT) × 4-col (P/A/E/I) lens-rows table; each cell has role-colored progress bar + percentage; WNT row dimmed at 0.55 opacity. Top-misalignment pills always show all three.
  - Page 3 — Your Three Gaps: one gap card per gap type with **severity-colored** bars/accents (red/orange/yellow — role colors are reserved for the role circle only), severity badge, narrative, and a `daily_feel` callout. Gap formula reads "X **VS** Y" (not "−").
  - Page 4 — Suggested Focus Areas: priority table (rows 1–4: Stretch / Balance / Protect / Complement), followed by a standalone **"Leveraging Your Strength"** block (Role Design — no longer a numbered table row).
  - Page 5 — Stress Signature & next steps: **"Your Current Stress Signature"** narrative (stress labels tagged e.g. "Dictator Trap (P - Stressor)") + plain-English Early Warning Signs; **"Key Insights & Commitments"** write-in (My Top 3 Insights + My Next 3 Actions, blank lines — replaces the old guided-reflection questions); **"Continue the Conversation"** block linking to the `/leap-coaching` landing page.
  - **Pagination:** the report is **exactly 5 A4 pages** — Page 3/5 spacing is tuned so content never overflows into header-less pages (verified via local Chrome render at the Lambda's margins).
  **Header band (all pages):** solid navy `#1D3557` band, `rgba(255,255,255,0.15)` circle containing HIL-Isotope logo (`filter: brightness(0) invert(1)` knockout), "LEAP™" bold white left, page name right, `border-bottom: 3pt solid #C8102E` red accent stripe.
  **Sample PDF URL:** `https://leap-reports.turiyaskills.co/reports/f17b1f2c-0273-4b5d-88d2-e27b826d1738.pdf`
  (used on Dashboard "View Sample Report" button and `/leap` landing page CTA).
- **Report URLs use the custom domain `leap-reports.turiyaskills.co`** (2026-06-13). PDFs still live in the
  `adizes-pdf-reports` S3 bucket; the domain is a **Cloudflare-proxied CNAME** → a tiny **Cloudflare Worker**
  (`leap-reports.turiyaskills.co/*`) that re-fetches from `adizes-pdf-reports.s3.ap-south-1.amazonaws.com`
  (the Worker is needed because Cloudflare Pro can't override the origin Host header, and S3 selects the bucket
  by Host). The Lambda builds the URL from env `PDF_PUBLIC_BASE_URL=https://leap-reports.turiyaskills.co`
  (falls back to the raw S3 URL if unset — `index.js`). Existing rows were repointed by migration
  `017_pdf_url_custom_domain.sql` (string-replace of the host). To revert: clear `PDF_PUBLIC_BASE_URL` on the
  Lambda + reverse-replace the host in `assessments.pdf_url`.
- **Lambda invocation is synchronous (`RequestResponse`)**: backend calls Lambda and waits for the
  response. Lambda generates PDF → uploads to S3 → patches Supabase directly. Backend also patches
  Supabase from the returned `pdf_url` as a redundant safety net. Previously was fire-and-forget
  (`"Event"`) — changed so the backend can confirm success and log failures.
- **Lambda SUPABASE_SERVICE_ROLE_KEY must be the production key**: Lambda env var previously held the
  local dev key (ES256, `iss: supabase-demo`), which production Supabase rejects with 401. The Lambda
  silently swallowed the error and still returned 200, making PDF generation appear to work while
  Supabase was never patched. Fixed by setting the Lambda's `SUPABASE_SERVICE_ROLE_KEY` to the
  production HS256 key. **When redeploying Lambda, always pass the production key — not the local one.**
- **`.dockerignore` is critical**: A missing `.dockerignore` caused `.env` to be baked into every Docker
  image via `COPY . .`. `LAMBDA_INVOKE_ROLE_ARN` in `.env` was loaded by pydantic-settings in production,
  overriding the "not set" App Runner env. STS AssumeRole failed (AccessDenied), Lambda was never invoked,
  `pdf_url` stayed null. Fixed: `.dockerignore` now excludes `.env`. Never remove it.
- **Lambda IAM — direct invoke, no STS**: `LAMBDA_INVOKE_ROLE_ARN` is cleared (`""`) on App Runner.
  Backend uses its base IAM user credentials directly. A Lambda resource-based policy grants
  `adizes-backend-lambda-invoker` direct `lambda:InvokeFunction` on `adizes-pdf-generator-v2`.
  (The managed IAM policy only covered v1; we could not add permissions so we used resource policy instead.)
- **Re-trigger stuck PDF (pdf_url = null):** Use Python boto3 — **not** `aws lambda invoke --payload
  file://`. AWS CLI v2 with `file://` raises `Invalid base64` due to double-encoding. Use:
  ```python
  import boto3, json
  session = boto3.Session(profile_name='lax-t3-assumed')
  client  = session.client('lambda', region_name='ap-south-1')
  resp    = client.invoke(FunctionName='adizes-pdf-generator-v2',
                          InvocationType='RequestResponse',
                          Payload=json.dumps(payload).encode('utf-8'))
  print(json.loads(resp['Payload'].read()))
  ```
  Build `payload` from the full assessment row. Lambda patches Supabase on success.
  See `lambda/pdf-generator-v2/how-does-lambda-fn-work.md`.
- **Lambda deploy IAM:** `power-admin-role` needs `AWSLambda_FullAccess` + `PowerUserAccess` +
  inline policy `iam-pass-for-lambda` (`iam:PassRole` on `adizes-pdf-lambda-role`).
- **user_name fallback**: `submit_assessment` derives `user_name` as:
  `user_metadata.name` → fallback to `email.split("@")[0]` → fallback to `""`.
  This prevents `user_name = ""` for users who registered without setting a display name (causes
  `"'s Results"` heading on results page). Frontend also guards: shows `"Your Results"` when
  `result.user_name` is falsy. Dashboard welcome: `user?.name || user?.email?.split('@')[0]`
  — email prefix fallback when `user.name` is empty string.
- **EnergyMatrix component** is role-centric (4 sections, one per role) rather than lens-centric
  (3 rows). Each role section shows Is / Should / Want bars with a gap badge when the max gap ≥ 10.
  Want bars are dimmed (0.55 opacity) as the reference/background lens.
- Frontend calls FastAPI for ALL API calls (auth, assessment, results, admin)
- FastAPI validates Supabase JWT on every protected endpoint
- Local Supabase uses ES256 JWT; cloud Supabase uses HS256 — auth.py handles both
- PDF generated server-side via WeasyPrint, streamed directly (no Storage in v1)
- Admin role set via Supabase custom JWT claim `app_metadata.role: admin`
- `docker-compose.yml` overrides `SUPABASE_URL` to `http://host.docker.internal:54321`
  so the container can reach local Supabase (127.0.0.1 in .env is host-only)
- **Cohort-scoped assessments** (migration 006): every assessment row has a `cohort_id NOT NULL FK`.
  Assessments are keyed on `(user_id, cohort_id)` — one per enrollment. All backend queries
  scope to this pair. Frontend passes `?cohort_id=<uuid>` on `/assessment` and the assessment
  store carries `cohortId` through to `submitAssessment(cohort_id, answers)`.
- **Enrollment email — three cases**: `enroll_user` / `bulk_enroll` / `resend_enrollment_invite`
  check `email_confirmed_at`: new/unactivated users get `user_enrolled` (invite/recovery link);
  already-activated users get `cohort_enrollment_existing` (dashboard link only).
- **Organisation module** (migration 007): four tables — `organizations`, `org_nodes`, `org_employees`,
  `cohort_organizations`. Orgs are independent of cohorts until explicitly linked. Employees are added
  to org nodes and receive `org_welcome` emails with activation links (`redirect_to=/register`). After
  linking an org to a cohort, admins can enrol employees into that cohort by scope or individually.
- **Org employee activation redirect**: `_add_employee_to_node` in `admin.py` calls
  `generate_link(type="invite"/"recovery", options={"redirect_to": f"{settings.frontend_url}/register"})`.
  The `redirect_to` option controls where Supabase redirects after token verification — it does NOT
  change the magic link URL in the email itself (`lr.properties.action_link`).
- **Forgot-password flow**: `POST /auth/forgot-password` (public, no JWT). Requires SMTP configured.
  Uses `supabase_admin.auth.admin.list_users()` (no filter param — linear search). Returns
  `{"status": "sent"}` for unknown emails (anti-enumeration). Returns `{"status": "not_activated"}`
  if user exists but `email_confirmed_at is None`. For activated users: generates recovery link with
  `redirect_to=/reset-password`, sends `password_reset` email. Frontend: `/forgot-password` page +
  `/reset-password` page (reads `access_token` + `type=recovery` from URL hash, passes token as Bearer
  header to `POST /auth/set-password`).
- **org_employees has NO email column**: Email is stored in `auth.users` only. The `org_employees`
  table has `user_id` (FK to `auth.users.id`). Any endpoint needing email must resolve it via
  `_get_auth_users_map()` — a dict keyed on `user_id`. Selecting `email` from `org_employees` causes
  a Supabase schema cache 500 error.
- **Reporting tree** (added 2026-03-21): `GET /admin/organizations/{org_id}/reporting-tree` builds
  a manager→report hierarchy from `manager_email` relationships. Returns `{has_structure, reason, roots}`
  where `roots` are recursive `ReportingNode` objects. Returns `reason: "no_employees"` or
  `"no_manager_emails"` when no hierarchy can be built. Frontend: `AdminOrgReportingTree.tsx` with
  SVG connector lines (layout algorithm: subtree-width-based x-positioning; horizontal bars drawn at
  midpoint between parent bottom and child top). Pan/zoom: non-passive wheel listener, mouse drag,
  pinch-to-zoom, ± buttons.
- **Bulk upload Content-Type bug**: When using Axios + `FormData`, NEVER set `Content-Type:
  multipart/form-data` manually. Axios auto-generates this header WITH the required `boundary`
  parameter. Setting it manually strips the boundary → FastAPI's python-multipart cannot parse the
  fields → all form fields arrive empty → every CSV row fails "invalid email".
- **Bulk upload node_path**: The `node_path` column in CSV must match nodes that already exist in
  the org. Uploading to a new org with no sub-nodes will fail all rows with "node_path not found".
  Options: (A) build node tree first then upload, or (B) leave node_path blank to place all employees
  on the selected node.
- **Cohort lifecycle status** (migration 011): `cohorts` table has `cohort_status VARCHAR(20) NOT NULL DEFAULT 'active'`
  with CHECK constraint `IN ('active', 'completed', 'archived')`. `PATCH /admin/cohorts/{id}/status` updates it.
  Enrollment is blocked for non-active cohorts — `enroll_user`, `bulk_enroll`, and `enroll_from_org` all
  raise HTTP 409 if `cohort_status != 'active'`. Frontend: status filter tabs, ⋮ action menu per cohort,
  read-only banner on `AdminCohortDetail`, enrollment buttons hidden for non-active cohorts.
  Migration applied directly to production via Supabase MCP `execute_sql` (not via `supabase db push`).
- **scaled_scores are 0–100 percentages** (not 132-scale raw scores). The style distribution threshold in
  `_compute_team_scores()` is `> 25` (equal share = 100 ÷ 4 = 25%). The dominant threshold on the raw 132-scale
  is `> 33` (= 132 ÷ 4). Using `> 30` on scaled scores caused the style distribution chart to show all zeros
  for typical assessments — fixed to `> 25`.
- **Question section assignments are interleaved — NOT sequential blocks** (migrations 012 + 013 + 014): The
  original seed and backend code wrongly assumed Q0-Q11=Is, Q12-Q23=Should, Q24-Q35=Want. The correct
  distribution (confirmed 2026-05-28 against source spreadsheet) interleaves sections throughout:
  Is (12): Q0,Q4,Q7,Q10,Q14,Q19,Q21,Q23,Q26,Q29,Q33,Q35 · Should (12): Q2,Q5,Q6,Q9,Q12,Q13,Q18,Q20,Q24,Q27,Q31,Q34 · Want (12): Q1,Q3,Q8,Q11,Q15,Q16,Q17,Q22,Q25,Q28,Q30,Q32.
  Note: migration 013 had Q9 and Q26 swapped; migration 014 corrects them (Q9→should, Q26→is).
  Fixed in three layers: (1) DB — migrations 012/013/014 applied to local + production, seed updated;
  (2) `assessment.py` — `get_questions()` reads `section` column from DB; `submit_assessment()` fetches
  `section_map` from DB and passes it to `score_answers()`; (3) `scoring.py` — `SECTION_MAP` constant
  updated, `score_answers()` accepts optional `section_map` param (defaults to `SECTION_MAP`).
- **Cohort member activation status** (added 2026-05-26): `GET /admin/cohorts/{id}` returns `activated: bool`
  per respondent — `True` if `email_confirmed_at` is set in `auth.users`, `False` if the user never clicked
  the invite link. Frontend `AdminCohortDetail` shows green "Active" / amber "Invite Pending" badge per row.
  "Resend Invite" button now appears for all unactivated members (`!r.activated`), not just `pending` ones.
  No migration needed — pure read from the existing `auth.users` object already fetched in `get_cohort`.
- **Assessment navigation UX** (added 2026-05-26): Three problems fixed in `Assessment.tsx` + `assessmentStore.ts`:
  (1) Submit failure now shows a persistent amber panel with clickable "Jump to: Question N" buttons for each
  incomplete question — panel auto-updates as questions are answered (`hasTriedSubmit` state gates first display).
  `handleJumpToQuestion(questionIndex)` finds section+position by searching `sections[si].questions.findIndex(...)`.
  (2) Auto-assigned rank-4 option is locked — when all 4 options are ranked, clicking the rank-4 option is a
  no-op (`if (isComplete && currentRank === 4) return;` at top of click handler).
  (3) `assessmentStore` tracks `farthestSection`/`farthestQuestion` (high-water mark). `handleNext()` calls
  `advanceFarthest(currentSection, currentQuestion)` before navigating. A "↑ Back to where I was" button
  appears when `currentSection/currentQuestion < farthestSection/farthestQuestion`, jumping back to the
  farthest reached point.
- **LEAP™ rebrand** (2026-05-27): Full frontend/PDF rebrand from "AMSI / PAEI Energy Alignment Profile" to LEAP™.
  Frontend: Inter Tight display font; navy `leap` Button variant (`--color-leap: #1D3557`); Dashboard header
  "Discover Your Leadership Alignment", tabs "Alignment Overview" / "My LEAP Profiles"; empty state full
  two-column LEAP split layout with decorative sample matrix and insight card; Assessment "Before You Begin"
  LEAP prose card replaces YouTube embed; LEAP™ replaces AMSI in sticky assessment header; ranking instruction
  callout updated to "most/least applicable" framing; "Begin Section" → "Begin Questions".
  Backend: `SECTION_META` labels "Is"→"Current State", "Should"→"Role Expectations", "Want"→"Intrinsic Preference".
  PDF Lambda v2: all 5 page headers rebranded to LEAP™; page 1 matrix redesigned to lens-rows layout;
  full 5-page report redesigned 2026-06-10 (see "PDF Lambda v2 report identity" key decision above).
  New public `/leap` landing page (no auth) with hero, tension cards, sample insights, comparison table, and CTA.
  Lambda ECR redeployed with redesigned template (2026-06-10).
  Remaining AMSI strings cleaned up (2026-05-27, commit `b4de9c1`): Landing.tsx h1 "management style" → "leadership
  alignment" + LEAP™ tagline description; UserHelp.tsx subtitle → "LEAP™ Assessment", results description uses
  "Current State / Role Expectations / Intrinsic Preference", footer attribution → LEAP™; AdminHelp.tsx subtitle +
  footer attribution → LEAP™; PolicyPage.tsx Terms §1 + Refund §1 "AMSI platform" → "LEAP™ platform".
- **PDF interpretation fields** (added 2026-06-10): `interpretation.py` returns `executive_summary` (str — 2-sentence
  narrative) and `daily_feel` (dict — keyed `{role: {gap_type: str}}`, used in gap-card callouts on page 3).
  These are absent from assessments submitted before the 2026-06-10 backend redeploy; the Lambda template guards
  missing keys. **Note (2026-06-13):** `reflection_questions` was **removed** — page 5 now uses a static
  "Key Insights & Commitments" write-in instead of generated questions.
- **Dominant PAEI code is derived from Current State (`is`), not Want** (changed 2026-06-13). `interpret()` computes
  `dominant` from `is_scores[r] > 33`. This drives the identity line, executive summary, stress-trap list, and the
  Page-1 amplitude style-code sizing. The frontend profile badges + tooltips (Results / Dashboard / AdminRespondent)
  read `profile.is` to match. New stress labels are tagged "(P - Stressor)" etc.; early-warning copy is plain English.
- **LEAP report revision per HIL Zoom review** (2026-06-13, see `HIL_Adizes_India/docs/HIL's Zoom Meeting.md`):
  is-based dominance; severity red/orange/yellow bands; "VS" gap formula; "Leveraging Your Strength" block;
  Page-1 gap-definitions box + 4-letter amplitude style code; Page-5 write-in + "Continue the Conversation"
  (→ `/leap-coaching`); "Current Stress Signature" header. Backend, Lambda, and frontend deployed 2026-06-13.
  **Historical data fix:** 5 assessments submitted 2026-05-26/27 (before the section-fix migrations 012–014) had
  wrong stored scores; all 12 completed assessments were recomputed from their stored `answers` rows and PDFs
  regenerated. Recompute recipe = `score_answers(answers, db_section_map)` → `compute_gaps` → `interpret`, then
  invoke `adizes-pdf-generator-v2` per assessment.
- **Supabase Auth SMTP → SES** (fixed 2026-06-13): Supabase Auth had **no custom SMTP** (`smtp_host=null`), so its
  own emails (self-registration confirmation) used the built-in mailer capped at `rate_limit_email_sent=2`/hr →
  silent drops → "confirmation email not coming" + "password not recognized". Fixed via Management API
  `PATCH /config/auth`: SMTP→SES (same creds as `app_settings`, sender `noreply@turiyaskills.co`),
  `mailer_otp_exp` 3600→86400 (24h link life), `rate_limit_email_sent` 2→100. App templated emails (enrol/reset)
  already went through SES directly and were unaffected — two separate mail systems. Managing Auth config needs a
  Supabase **Personal Access Token** (`sbp_…`); the Management API is behind Cloudflare which blocks the Python
  `urllib` user-agent (error 1010) — use `curl`.
- **Auth reliability fixes** (2026-06-13): `email_service.send_email()` logs SMTP failures and returns a reliable
  bool (never raises); admin invite/resend endpoints report the true send status. `_action_link()` in `admin.py`
  returns None on `generate_link` failure and the email is skipped — no more tokenless homepage "invite" links that
  left users unable to set a password. `list_all_auth_users()` in `database.py` paginates past GoTrue's first-page
  limit; all six `auth.admin.list_users()` enumeration sites now use it.

## Known Gotchas (Local Dev)

### Supabase keys reset on every restart
`supabase start` regenerates `ANON_KEY` and `SERVICE_ROLE_KEY` each time.
Always run `supabase status -o env` after starting and update `.env`.
Symptom: backend returns `{"detail": "[Errno 111] Connection refused"}` on login.

### DB and users reset on every restart
Local Supabase is ephemeral. After `supabase stop` + `supabase start`:
- All tables are dropped → re-apply both migrations
- All auth users are deleted → recreate via admin API (see Quick Start above)

### Docker image must be rebuilt after code changes
`docker-compose.yml` only mounts `./templates`. All Python source files are
baked in at build time. After editing any `.py` file:
```bash
docker compose up --build -d
```
Symptom: code fix works in isolation but API still returns old behavior.

### JWT algorithm: python-jose JWKError ≠ JWTError
Local Supabase signs tokens with ES256. `python-jose` raises `JWKError` (not
`JWTError`) when you try to verify ES256 with an HS256 secret. These are
separate exception classes — `JWKError` does NOT inherit from `JWTError`.
`auth.py` uses a nested try/except to fall back to `verify_signature=False`.

### Supabase CLI new key formats (v2.72+)
`supabase status` now shows both:
- `sb_publishable_*` / `sb_secret_*` — new SDK keys (use for admin API calls)
- JWT-format `ANON_KEY` / `SERVICE_ROLE_KEY` — still needed for `.env`
Both key formats work for the admin API (`/auth/v1/admin/users`).

---

## Claude Code Automations

Skill files live in `HIL_Adizes_India/.claude/skills/`, agents in `.claude/agents/`, hooks in `.claude/hooks/`.

### Skills (invoke with `/skill-name`)

| Skill | Purpose |
|-------|---------|
| `/dev-start` | Full local stack boot — Supabase → rotate keys → 14 migrations → test users → Docker → frontend |
| `/db-reset` | Full DB teardown and rebuild (after `supabase stop`) |
| `/rotate-env` | Patch `.env` with new `ANON_KEY`/`SERVICE_ROLE_KEY` after `supabase start` |
| `/seed-local` | Recreate the two test users (admin + user) after a Supabase restart |
| `/check-stack` | One-glance health table for all local services |
| `/deploy-backend` | Build `linux/amd64` Docker image → ECR push → App Runner redeploy |
| `/deploy-lambda` | Deploy PDF Lambda v2 with production-key guard |
| `/check-prod` | Production health check — App Runner, Lambda, Supabase, CloudWatch logs |
| `/add-migration` | Auto-number + scaffold the next migration file with apply reminders |
| `/apply-migration` | Apply a migration locally + print the production apply reminder |
| `/new-router` | Scaffold a FastAPI router and wire it into `main.py` |
| `/new-page` | Scaffold a React page and wire it into `App.tsx` |
| `/retrigger-pdf` | Re-invoke Lambda via boto3 for assessments stuck with `pdf_url = null` |

### Subagent

**`security-reviewer`** — audits JWT algo confusion (ES256/HS256), Supabase RLS, `.dockerignore` secret leakage, IAM least-privilege, and CORS. References CLAUDE.md Key Decisions where applicable.

### Hooks (always-on)

| Hook | Trigger | Action |
|------|---------|--------|
| `block-env-edits.sh` | PreToolUse on Edit/Write | Blocks any `.env` file edit with explanation |
| `check-ts-types.sh` | PostToolUse on Edit/Write | Runs `tsc --noEmit` after any `.ts`/`.tsx` edit in `adizes-frontend` |

### MCP Servers

| Server | Package | Purpose |
|--------|---------|---------|
| `context7` | `@upstash/context7-mcp` | Live docs for React 19, FastAPI, Supabase, boto3, Tailwind v4 |
| `awslabs-lambda` | `awslabs.lambda-tool-mcp-server` | Lambda invoke, config, and policy tools |
| `awslabs-cloudwatch` | `awslabs.cloudwatch-mcp-server` | App Runner log tailing and CloudWatch queries |
