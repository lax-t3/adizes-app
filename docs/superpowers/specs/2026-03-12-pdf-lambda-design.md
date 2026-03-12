# Design: AWS Lambda PDF Report Generator

**Date:** 2026-03-12
**Status:** Approved
**Scope:** New `lambda/pdf-generator/` directory on `feature/pdf-lambda` branch (adizes-backend repo) + FastAPI trigger changes + frontend pdf_url handling

---

## Problem

The current WeasyPrint/Jinja2 PDF generation runs synchronously inside the FastAPI Docker container. It is limited in CSS fidelity, cannot render JavaScript-based charts (radar chart), and blocks the HTTP response while generating. The Jack Allen reference report format — with multi-page educational content, PAEI quadrant diagrams, and a radar chart — cannot be faithfully reproduced with WeasyPrint.

## Goal

Replace the PDF download path with a headless-browser renderer (Puppeteer) deployed as an AWS Lambda Docker function. PDF generation is fully async: triggered as a background task after assessment completion, PDF uploaded to S3, URL stored in `assessments.pdf_url`. Frontend shows a "Generating…" state until the URL is available, then enables a direct S3 download link.

The **completion email** continues to use the existing WeasyPrint PDF attachment path unchanged. The Lambda only replaces the on-demand download button.

---

## Chosen Approach: Node.js Lambda + Puppeteer in Docker (ECR)

Rejected alternatives:
- **Python Lambda + WeasyPrint**: weak CSS/JS support, radar chart requires SVG hand-coding, font embedding issues on Lambda.
- **Lambda + wkhtmltopdf**: unmaintained, no JavaScript execution, kills Chart.js charts.

---

## Architecture

### Flow

```
User completes assessment
        │
        ▼
FastAPI saves result to DB
        │
        ├─ Completion email (existing WeasyPrint path, unchanged)
        │
        ▼ BackgroundTask (non-blocking, fires concurrently)
boto3.invoke(FunctionName="adizes-pdf-generator",
             InvocationType="Event",   ← fire-and-forget async
             Payload=JSON)
        │
        ▼
┌────────────────────────────────────────────┐
│  Lambda (Docker / Node.js 20 / ECR)        │
│  1. Parse JSON payload                     │
│  2. Render report.html with EJS            │
│  3. Puppeteer renders HTML → PDF bytes     │
│     Chart.js draws radar + bar charts      │
│  4. Upload PDF to S3 (private bucket)      │
│  5. PATCH assessments.pdf_url via          │
│     Supabase service-role REST API         │
└────────────────────────────────────────────┘
        │
        ▼
assessments.pdf_url = "https://s3.../reports/{id}.pdf"

Frontend (Results / AdminRespondent page):
  GET /results/{id} returns pdf_url field:
    pdf_url is set   → "Download PDF Report" → window.open(pdf_url)
    pdf_url is null  → "Generating report…" (disabled button)
                       + "Check again" link
                       Click → re-fetch GET /results/{id}
                         if now set  → enable button
                         if still null → show "Still generating, try again shortly"
```

### JSON Payload (FastAPI → Lambda)

```json
{
  "assessment_id": "f9402f78-6d78-4899-b672-2ef70478bff9",
  "user_name": "Jack Allen",
  "completed_at": "2026-03-12T08:45:23.123456+00:00",
  "profile": {
    "is": "paEI",
    "should": "Paei",
    "want": "paei"
  },
  "scaled_scores": {
    "is":     { "P": 20, "A": 15, "E": 35, "I": 40 },
    "should": { "P": 25, "A": 30, "E": 20, "I": 35 },
    "want":   { "P": 18, "A": 12, "E": 28, "I": 42 }
  },
  "gaps": [
    {
      "role": "P",
      "role_name": "Producer",
      "is_score": 20,
      "should_score": 25,
      "want_score": 18,
      "external_gap": 5,
      "internal_gap": 7,
      "external_severity": "watch",
      "internal_severity": "watch",
      "external_message": "Moderate gap — role demands slightly more P than current behaviour.",
      "internal_message": "Slight mismatch between role demands and natural preference."
    }
  ],
  "interpretation": {
    "dominant_roles": ["I"],
    "style_label": "Integrator",
    "style_tagline": "The Cohesive Shepherd",
    "strengths": "...",
    "blind_spots": "...",
    "working_with_others": "...",
    "combined_description": null,
    "mismanagement_risks": ["Super-Follower — may become conflict-avoidant under stress."]
  }
}
```

Note: `completed_at` is a full ISO 8601 timestamp. EJS template must format it for display (e.g. `new Date(completed_at).toLocaleDateString('en-GB', { year:'numeric', month:'long', day:'numeric' })`).

---

## Lambda Internals

### Git Branch

```bash
# From adizes-backend repo root
git checkout -b feature/pdf-lambda
```

Lambda code lives at `lambda/pdf-generator/` within the branch.

### Directory Structure

```
lambda/pdf-generator/
├── Dockerfile
├── index.js                  ← Lambda handler
├── template/
│   ├── report.html           ← Full AMSI report (EJS template)
│   ├── styles.css            ← Print-optimised CSS (A4, page breaks, fonts)
│   └── assets/
│       ├── logo.png          ← Copied from adizes-frontend/public/logo.png at deploy time
│       ├── paei_quad_P.svg   ← P-role quadrant diagram (static)
│       ├── paei_quad_A.svg
│       ├── paei_quad_E.svg
│       └── paei_quad_I.svg
├── package.json
├── package-lock.json
└── deploy.sh                 ← Build → ECR push → Lambda create/update
```

### `package.json` dependencies

```json
{
  "dependencies": {
    "puppeteer": "^22.0.0",
    "ejs": "^3.1.9",
    "@aws-sdk/client-s3": "^3.0.0",
    "node-fetch": "^3.3.0"
  }
}
```

### Dockerfile

```dockerfile
FROM public.ecr.aws/lambda/nodejs:20
COPY package*.json ./
RUN npm ci
COPY index.js ./
COPY template/ ./template/
CMD ["index.handler"]
```

### Handler Flow (`index.js`)

```javascript
exports.handler = async (event) => {
  // 1. Parse payload
  const { assessment_id, user_name, completed_at,
          profile, scaled_scores, gaps, interpretation } = event;

  // 2. Render EJS template
  const html = ejs.render(
    fs.readFileSync('./template/report.html', 'utf8'),
    { user_name, completed_at, profile, scaled_scores, gaps, interpretation }
  );

  // 3. Launch Puppeteer with bundled Chromium
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    headless: true,
  });
  const page = await browser.newPage();

  // 4. Load HTML — wait for domcontentloaded, then wait for Chart.js readiness flag
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__chartsReady === true, { timeout: 10000 });

  // 5. Generate PDF
  const pdfBytes = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
  });
  await browser.close();

  // 6. Upload to S3
  const s3 = new S3Client({ region: process.env.AWS_REGION });  // AWS_REGION auto-injected
  const key = `reports/${assessment_id}.pdf`;
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key,
    Body: pdfBytes,
    ContentType: 'application/pdf',
  }));

  // 7. Build URL (pre-signed, 7-day expiry — see Infrastructure section)
  const pdfUrl = `https://${process.env.S3_BUCKET_NAME}.s3.amazonaws.com/${key}`;

  // 8. Update Supabase pdf_url
  await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/assessments?id=eq.${assessment_id}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ pdf_url: pdfUrl }),
    }
  );

  return { statusCode: 200, assessment_id, pdf_url: pdfUrl };
};
```

**Chart.js readiness signal in `report.html`** — after all charts are drawn, the template sets:
```javascript
window.__chartsReady = true;
```
This is the signal `waitForFunction` waits for before generating the PDF, ensuring all canvas elements are fully rendered.

### Report HTML Template (`report.html`) — Page Structure

| Page(s) | Content | Type |
|---------|---------|------|
| 1 | Header (logo + tagline), Title: "AMSI Report for `<%= user_name %>`", formatted date, PAEI intro | Mixed |
| 2–5 | P / A / E / I role descriptions + quadrant SVG diagrams, work habits tables, attitudes toward other styles | Static |
| 6 | Personal Results header, dominant style badge (`<%= interpretation.dominant_roles %>`), `combined_description` if non-null, profile string `<%= profile.want %>`, style label + tagline | Dynamic |
| 7 | Radar chart: Chart.js RadarChart with Is/Should/Want datasets across P, A, E, I axes from `scaled_scores` | Dynamic |
| 8 | Gap Analysis: Chart.js horizontal bar chart (Is vs Should) + severity table (Ext/Int per role, with `external_message` / `internal_message` as row tooltips or sub-text) | Dynamic |
| 9 | Style Interpretation: Strengths, Blind Spots, Working with Others, Mismanagement Risks | Dynamic |
| All | Footer: Adizes Institute address, phone, web, page number, confidentiality notice | Static |

### Lambda Configuration

| Setting | Value |
|---------|-------|
| Runtime | Node.js 20 (Docker / ECR) |
| Memory | 1024 MB |
| Timeout | 60 seconds |
| Architecture | x86_64 (Puppeteer Chromium binary requirement) |
| Package type | Image (ECR) |

### Lambda Environment Variables

```
SUPABASE_URL              = https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY = eyJ...
S3_BUCKET_NAME            = adizes-pdf-reports
```

Note: `AWS_REGION` is **not** set manually — it is automatically injected by the Lambda runtime and available as `process.env.AWS_REGION`. Setting it explicitly will cause a deployment error (`InvalidParameterValueException: reserved variable`).

---

## FastAPI Changes

### `app/config.py` — Add AWS fields to `Settings`

```python
class Settings(BaseSettings):
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    supabase_jwt_secret: str
    frontend_url: str = "http://localhost:5173"
    # New — AWS Lambda PDF trigger
    aws_region: str = "ap-south-1"
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    pdf_lambda_function_name: str = "adizes-pdf-generator"

    class Config:
        env_file = ".env"
```

### `app/routers/assessment.py` — Add BackgroundTask

After saving the assessment result, fire the Lambda asynchronously. The existing completion email block is unchanged.

```python
from fastapi import BackgroundTasks
import boto3, json, logging
from app.config import settings

logger = logging.getLogger(__name__)

def trigger_pdf_lambda(assessment_id: str, payload: dict):
    try:
        client = boto3.client(
            "lambda",
            region_name=settings.aws_region,
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
        )
        client.invoke(
            FunctionName=settings.pdf_lambda_function_name,
            InvocationType="Event",   # async fire-and-forget
            Payload=json.dumps(payload).encode(),
        )
    except Exception as e:
        logger.error(f"[pdf-lambda] trigger failed for assessment {assessment_id}: {e}")
        # Non-fatal — assessment is saved, pdf_url stays null, user sees "Check again"

@router.post("/submit")
def submit_assessment(background_tasks: BackgroundTasks, ...):
    result = save_assessment(...)
    # Existing email block (unchanged) ...
    # New: trigger PDF Lambda
    background_tasks.add_task(trigger_pdf_lambda, result.id, _build_pdf_payload(result))
    return {"result_id": result.id}
```

`_build_pdf_payload(result)` constructs the JSON payload from the already-computed assessment data (same fields used for the email: `user_name`, `completed_at`, `scaled_scores`, `profile`, `gaps`, `interpretation`). All fields are already available in the submit handler scope.

### `app/schemas/results.py` — Add `pdf_url` to `ResultResponse`

```python
class ResultResponse(BaseModel):
    result_id: str
    user_name: str
    completed_at: str
    profile: dict
    scaled_scores: dict
    gaps: List[GapDetail]
    interpretation: Interpretation
    pdf_url: Optional[str] = None   ← ADD THIS
```

### `app/routers/results.py` — Pass `pdf_url` through

```python
return ResultResponse(
    result_id=data["id"],
    user_name=data.get("user_name", ""),
    completed_at=data["completed_at"],
    profile=data["profile"],
    scaled_scores=data["scaled_scores"],
    gaps=[GapDetail(**g) for g in data["gaps"]],
    interpretation=Interpretation(**data["interpretation"]),
    pdf_url=data.get("pdf_url"),   ← ADD THIS
)
```

### New FastAPI `.env` variables

```
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=ap-south-1
PDF_LAMBDA_FUNCTION_NAME=adizes-pdf-generator
```

---

## Frontend Changes

### `src/types/api.ts` — Add `pdf_url` to `ResultResponse`

```typescript
export interface ResultResponse {
  result_id: string;
  user_name: string;
  completed_at: string;
  profile: { is: string; should: string; want: string };
  scaled_scores: { is: ScoreSet; should: ScoreSet; want: ScoreSet };
  gaps: GapDetail[];
  interpretation: Interpretation;
  pdf_url: string | null;   ← ADD THIS
}
```

### `src/api/results.ts` — Remove `downloadPdf()`

The `downloadPdf()` streaming helper is removed entirely. The PDF is now a direct S3 URL stored in `result.pdf_url`.

### `Results.tsx` and `AdminRespondent.tsx` — PDF button state machine

```
On page load → result.pdf_url from GET /results/{id}:

  CASE A: pdf_url is set
    → "Download PDF Report" button (enabled)
    → onClick: window.open(result.pdf_url, '_blank')

  CASE B: pdf_url is null
    → Button shows "Generating report…" (disabled)
    → Small link below: "Check again"
    → "Check again" onClick:
        re-fetch GET /results/{id}
        if pdf_url now set  → update state → CASE A
        if pdf_url still null → show "Still generating, try again shortly"
                                 (brief text, no spinner)
```

State variables needed: `pdfUrl: string | null` (initialised from `result.pdf_url`), `checkingPdf: boolean`.

---

## Infrastructure

### S3 Bucket

- **Name:** `adizes-pdf-reports`
- **Region:** `ap-south-1` (match Lambda deployment region)
- **Access:** Private bucket. Objects are accessed via direct URL (bucket must have "Block Public Access" disabled for `public-read` ACL, OR use pre-signed URLs).

**Recommended:** Disable "Block Public Access" at the bucket level and use `ACL: 'public-read'` per object. PDF keys are UUID-based (`reports/{uuid}.pdf`) and are not guessable. This avoids presigned URL expiry problems. Document this S3 console step:

```bash
aws s3api put-public-access-block \
  --bucket adizes-pdf-reports \
  --public-access-block-configuration \
    "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"
```

### IAM Role: `adizes-pdf-lambda-role`

Required policies:
- `AWSLambdaBasicExecutionRole` — CloudWatch logging
- `s3:PutObject` + `s3:PutObjectAcl` on `arn:aws:s3:::adizes-pdf-reports/reports/*`

FastAPI IAM user/role needs:
- `lambda:InvokeFunction` on `arn:aws:lambda:*:*:function:adizes-pdf-generator`

### `deploy.sh`

```bash
#!/bin/bash
set -e

REGION="ap-south-1"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPO="adizes-pdf-generator"
LAMBDA_NAME="adizes-pdf-generator"
LAMBDA_ROLE="arn:aws:iam::${ACCOUNT_ID}:role/adizes-pdf-lambda-role"
IMAGE_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${ECR_REPO}:latest"

# Required env — set these before running or export them
: "${SUPABASE_URL:?Need to set SUPABASE_URL}"
: "${SUPABASE_SERVICE_ROLE_KEY:?Need to set SUPABASE_SERVICE_ROLE_KEY}"
: "${S3_BUCKET_NAME:?Need to set S3_BUCKET_NAME}"

# 1. Copy logo from frontend repo into Lambda assets
cp ../../../adizes-frontend/public/logo.png template/assets/logo.png

# 2. Authenticate Docker to ECR
aws ecr get-login-password --region "$REGION" | \
  docker login --username AWS --password-stdin \
  "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

# 3. Create ECR repository if it doesn't exist
aws ecr describe-repositories --repository-names "$ECR_REPO" \
  --region "$REGION" 2>/dev/null || \
  aws ecr create-repository --repository-name "$ECR_REPO" --region "$REGION"

# 4. Build for linux/amd64 and push
docker build --platform linux/amd64 -t "$IMAGE_URI" .
docker push "$IMAGE_URI"

# 5. Create Lambda function (first deploy) or update image URI (subsequent deploys)
if aws lambda get-function --function-name "$LAMBDA_NAME" --region "$REGION" 2>/dev/null; then
  aws lambda update-function-code \
    --function-name "$LAMBDA_NAME" \
    --image-uri "$IMAGE_URI" \
    --region "$REGION"
else
  aws lambda create-function \
    --function-name "$LAMBDA_NAME" \
    --package-type Image \
    --code "ImageUri=${IMAGE_URI}" \
    --role "$LAMBDA_ROLE" \
    --timeout 60 \
    --memory-size 1024 \
    --region "$REGION" \
    --environment "Variables={
      SUPABASE_URL=${SUPABASE_URL},
      SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY},
      S3_BUCKET_NAME=${S3_BUCKET_NAME}
    }"
fi

echo "✓ Lambda deployed: ${LAMBDA_NAME} → ${IMAGE_URI}"
```

---

## Error Handling

| Failure point | Behaviour |
|---------------|-----------|
| `boto3.invoke` fails (Lambda unreachable, misconfigured) | BackgroundTask logs error with `assessment_id` to stdout/CloudWatch; assessment is still saved; `pdf_url` stays null; user sees "Generating…" and can use "Check again" |
| Puppeteer crash inside Lambda | Lambda returns error to AWS; `pdf_url` not written; user sees "Check again" |
| `waitForFunction` times out (Chart.js never sets `__chartsReady`) | Puppeteer raises TimeoutError; Lambda catches, logs, returns error; `pdf_url` not written |
| S3 upload fails | Lambda catches, logs to CloudWatch; `pdf_url` not written |
| Supabase PATCH fails | PDF exists in S3 but `pdf_url` not stored; Lambda retries the PATCH once before giving up and logging |
| User clicks "Check again" when still null | Re-fetch, show "Still generating, try again shortly" — no spinner or loading state |
| Completion email WeasyPrint fails | Existing non-fatal handler unchanged — email failure does not affect Lambda trigger |

---

## Out of Scope

- Real-time WebSocket/Supabase Realtime notification when PDF is ready
- Admin-triggered PDF regeneration UI
- PDF caching invalidation if assessment data is re-scored
- Cost monitoring / Lambda concurrency limits
- Local dev Lambda emulation (AWS SAM local)
- Replacing WeasyPrint in the completion email (email keeps WeasyPrint attachment)
