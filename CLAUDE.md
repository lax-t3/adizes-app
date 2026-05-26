# CLAUDE.md — adizes-backend

## What This Is
FastAPI backend for the **Adizes PAEI Management Style Assessment** platform (Adizes90).
Provides REST API for auth, assessment scoring, results, admin, email, and PDF generation.

## Related Repos
- Frontend UI: `/Users/vrln/adizes-frontend` → branch `adizes-frontend`
- Source docs: `/Users/vrln/HIL_Adizes_India` → branch `main`
- GitHub: `https://github.com/lax-t3/adizes-app`

## Tech Stack
- Python 3.11+ / FastAPI
- Supabase PostgreSQL + Auth (JWT — ES256 local / HS256 cloud)
- AWS Lambda Docker + Puppeteer (primary PDF — `adizes-pdf-generator-v2`, active)
- boto3 (synchronous Lambda invocation from FastAPI background task)
- WeasyPrint + Jinja2 (server-side PDF fallback — preserved, not primary)
- Python smtplib (email via SMTP)
- Docker (containerized deployment)

## Scoring Engine (Adizes90 — 132-scale ranking)

- 36 questions × 3 sections (Is / Should / Want) = 108 ranked responses
- Each question: user ranks 4 options (P/A/E/I) 1st → 4th
- `RANK_POINTS = {1: 5, 2: 3, 3: 2, 4: 1}` → total per section = 12 × 11 = **132 pts**
- Dominant threshold = **33** (= 132 ÷ 4); score > 33 → capital letter
- 3 gap types per role: Execution `|should−is|`, Engagement `|should−want|`, Authenticity `|is−want|`
- Severity thresholds: < 6 low · 6–15 medium · > 15 high

## Local Dev Quick Start

```bash
# 1. Start local Supabase
supabase start

# 2. Refresh .env with current Supabase keys (keys rotate on each start)
supabase status -o env   # copy ANON_KEY + SERVICE_ROLE_KEY into .env

# 3. Apply DB migrations (all, in order)
DB=supabase_db_adizes-backend
for m in 001 002 003 004 005 006 007 008 009; do
  docker exec -i $DB psql -U postgres -d postgres < migrations/${m}_*.sql
done

# 4. Recreate test users (reset on every supabase start)
SK="<SUPABASE_SERVICE_ROLE_KEY from .env>"
curl -s -X POST "http://127.0.0.1:54321/auth/v1/admin/users" \
  -H "apikey: $SK" -H "Authorization: Bearer $SK" -H "Content-Type: application/json" \
  -d '{"email":"admin@adizes.com","password":"Admin@1234","email_confirm":true,"app_metadata":{"role":"admin"}}'
curl -s -X POST "http://127.0.0.1:54321/auth/v1/admin/users" \
  -H "apikey: $SK" -H "Authorization: Bearer $SK" -H "Content-Type: application/json" \
  -d '{"email":"user@adizes.com","password":"User@1234","email_confirm":true}'

# 5. Build and start backend (rebuild after any .py change)
docker compose up --build -d
```

API: http://localhost:8000 · Swagger: http://localhost:8000/docs

## Key Gotchas

- Supabase keys reset on every `supabase start` — always update `.env`
- DB and users reset on every `supabase start` — re-apply migrations + recreate users
- Python source files are baked into Docker image — rebuild after every `.py` change
- `SUPABASE_URL` in `.env` uses `127.0.0.1`; `docker-compose.yml` overrides to `host.docker.internal`
- `boto3` is required; Lambda trigger is skipped if `AWS_ACCESS_KEY_ID` is empty (safe for local dev)

## Lambda PDF Config (optional in local dev, required in production)

```
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=<IAM user key for adizes-backend-lambda-invoker>
AWS_SECRET_ACCESS_KEY=<IAM user secret>
PDF_LAMBDA_FUNCTION_NAME=adizes-pdf-generator-v2
LAMBDA_INVOKE_ROLE_ARN=   # leave BLANK — direct invoke via resource-based policy
```

**Critical**: `LAMBDA_INVOKE_ROLE_ARN` must be empty. The Lambda has a resource-based policy
granting direct invoke. STS assume-role was cleared because the managed IAM policy only covered v1.

## Lambda SUPABASE_SERVICE_ROLE_KEY — production key required

The Lambda's `SUPABASE_SERVICE_ROLE_KEY` env var **must be the production Supabase HS256 key**,
not the local dev ES256 key. Using the local dev key against the production URL causes silent 401
failures — the Lambda still returns 200 but never patches the `assessments.pdf_url` column.

Verify the Lambda has the right key:
```bash
AWS_PROFILE=lax-t3-assumed aws lambda get-function-configuration \
  --function-name adizes-pdf-generator-v2 --region ap-south-1 \
  --query 'Environment.Variables.SUPABASE_URL'
```

## Re-triggering a stuck PDF (pdf_url = null)

Use Python boto3 — not `aws lambda invoke --payload file://` (CLI v2 double-encodes the payload):

```python
import boto3, json
session = boto3.Session(profile_name='lax-t3-assumed')
client  = session.client('lambda', region_name='ap-south-1')
with open('/tmp/lambda-payload.json') as f:
    payload = json.load(f)
resp = client.invoke(
    FunctionName='adizes-pdf-generator-v2',
    InvocationType='RequestResponse',
    Payload=json.dumps(payload).encode('utf-8'),
)
print(json.loads(resp['Payload'].read()))
```

Build `payload` from the full assessment row (all fields including gaps + interpretation).

## Adizes360 — Phase 2 (not yet implemented)

Multi-rater 360° assessment. Planned scope: rater roles, multi-respondent data collection,
aggregated scores, self-vs-rater comparison, admin workflow for assigning rater cohorts.
