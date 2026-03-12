# Design: AWS Lambda PDF Report Generator

**Date:** 2026-03-12
**Status:** Approved
**Scope:** New `lambda/pdf-generator/` directory on `feature/pdf-lambda` branch (adizes-backend repo) + FastAPI trigger changes + frontend pdf_url handling

---

## Problem

The current WeasyPrint/Jinja2 PDF generation runs synchronously inside the FastAPI Docker container. It is limited in CSS fidelity, cannot render JavaScript-based charts (radar chart), and blocks the HTTP response while generating. The Jack Allen reference report format — with multi-page educational content, PAEI quadrant diagrams, and a radar chart — cannot be faithfully reproduced with WeasyPrint.

## Goal

Replace PDF generation with a headless-browser-quality renderer (Puppeteer) deployed as an AWS Lambda Docker function. PDF generation is fully async: triggered as a background task after assessment completion, PDF uploaded to S3, URL stored in `assessments.pdf_url`. Frontend shows a "Generating…" state until the URL is available, then enables a direct S3 download link.

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
        ▼ BackgroundTask (non-blocking)
boto3.invoke(FunctionName="adizes-pdf-generator",
             InvocationType="Event",
             Payload=JSON)
        │
        ▼
┌────────────────────────────────────────────┐
│  Lambda (Docker / Node.js 20 / ECR)        │
│  1. Parse JSON payload                     │
│  2. Render report.html with EJS            │
│  3. Puppeteer → PDF bytes (A4, landscape)  │
│     Chart.js renders radar chart in-page   │
│  4. Upload PDF to S3                       │
│  5. PATCH assessments.pdf_url via          │
│     Supabase service-role REST API         │
└────────────────────────────────────────────┘
        │
        ▼
assessments.pdf_url = "https://s3.../reports/{id}.pdf"

Frontend (Results / AdminRespondent page):
  pdf_url present  → "Download PDF Report" → window.open(pdf_url)
  pdf_url null     → "Generating report…" + [Check again] button
                     "Check again" re-fetches GET /results/{id}
```

### JSON Payload (FastAPI → Lambda)

```json
{
  "assessment_id": "uuid",
  "user_name": "Jack Allen",
  "completed_at": "2026-03-12",
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
      "role": "P", "role_name": "Producer",
      "is_score": 20, "should_score": 25, "want_score": 18,
      "external_gap": 5, "internal_gap": 7,
      "external_severity": "watch", "internal_severity": "watch"
    }
  ],
  "interpretation": {
    "style_label": "Integrator",
    "style_tagline": "The Cohesive Shepherd",
    "strengths": "...",
    "blind_spots": "...",
    "working_with_others": "...",
    "mismanagement_risks": ["Super-Follower — ..."]
  }
}
```

---

## Lambda Internals

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

```
exports.handler = async (event) => {
  1. Parse event payload (assessment_id, user_name, scaled_scores, gaps, interpretation)
  2. Read template/report.html
  3. Render with EJS — inject all dynamic fields
  4. Launch Puppeteer (bundled Chromium, --no-sandbox, --disable-dev-shm-usage)
  5. page.setContent(html, { waitUntil: 'networkidle0' })
  6. page.pdf({ format: 'A4', printBackground: true,
                margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' } })
  7. s3.putObject({
       Bucket: process.env.S3_BUCKET_NAME,
       Key: `reports/${assessment_id}.pdf`,
       Body: pdfBytes,
       ContentType: 'application/pdf',
       ACL: 'public-read'
     })
  8. Construct URL: `https://${bucket}.s3.${region}.amazonaws.com/reports/${assessment_id}.pdf`
  9. PATCH Supabase:
       fetch(`${SUPABASE_URL}/rest/v1/assessments?id=eq.${assessment_id}`, {
         method: 'PATCH',
         headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
         body: JSON.stringify({ pdf_url: s3Url })
       })
  10. Return { statusCode: 200, assessment_id, pdf_url }
}
```

### Report HTML Template (`report.html`) — Page Structure

| Page(s) | Content | Type |
|---------|---------|------|
| 1 | Header (logo + tagline), Title: "AMSI Report for `<%= user_name %>`", Date: `<%= completed_at %>`, PAEI intro | Mixed |
| 2–5 | P / A / E / I role descriptions + quadrant SVG diagrams, work habits tables, attitudes toward other styles | Static |
| 6 | Personal Results: dominant style badge, profile string `<%= profile.want %>`, style label + tagline | Dynamic |
| 7 | Radar chart: Chart.js RadarChart with Is/Should/Want datasets across P, A, E, I axes | Dynamic |
| 8 | Gap Analysis: Chart.js bar chart + severity table (Ext/Int per role with colour coding) | Dynamic |
| 9 | Style Interpretation: Strengths, Blind Spots, Working with Others, Mismanagement Risk | Dynamic |
| All | Footer: Adizes Institute address, phone, web, page number, confidentiality notice | Static |

### Lambda Configuration

| Setting | Value |
|---------|-------|
| Runtime | Node.js 20 (Docker / ECR) |
| Memory | 1024 MB |
| Timeout | 60 seconds |
| Architecture | x86_64 (Puppeteer Chromium requirement) |
| Package type | Image (ECR) |

### Lambda Environment Variables

```
SUPABASE_URL              = https://xxx.supabase.co (or local for dev)
SUPABASE_SERVICE_ROLE_KEY = eyJ...
S3_BUCKET_NAME            = adizes-pdf-reports
AWS_REGION                = ap-south-1
```

---

## FastAPI Changes

### `app/routers/assessment.py`

After saving the assessment result, add a `BackgroundTask` that invokes the Lambda asynchronously:

```python
from fastapi import BackgroundTasks
import boto3, json
from app.config import settings

def trigger_pdf_lambda(assessment_id: str, payload: dict):
    client = boto3.client("lambda", region_name=settings.aws_region)
    client.invoke(
        FunctionName=settings.pdf_lambda_function_name,
        InvocationType="Event",   # async fire-and-forget
        Payload=json.dumps(payload).encode(),
    )

@router.post("/submit")
def submit_assessment(background_tasks: BackgroundTasks, ...):
    result = save_assessment(...)
    background_tasks.add_task(trigger_pdf_lambda, result.id, build_pdf_payload(result))
    return {"result_id": result.id}
```

`build_pdf_payload()` assembles the JSON from the saved assessment row (same data already computed: scaled_scores, gaps, interpretation, profile, user_name, completed_at).

### `GET /results/{id}`

No change. Already returns the full assessment row including `pdf_url`. Frontend reads `pdf_url` from this existing response.

### New FastAPI `.env` Variables

```
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=ap-south-1
PDF_LAMBDA_FUNCTION_NAME=adizes-pdf-generator
```

---

## Frontend Changes

### `Results.tsx` and `AdminRespondent.tsx`

Replace the current `downloadPdf()` streaming call with direct S3 URL handling:

```
On page load → GET /results/{id} returns result with pdf_url field:

  pdf_url is set   → render "Download PDF Report" button
                     onClick: window.open(pdf_url, '_blank')

  pdf_url is null  → render disabled button labelled "Generating report…"
                     + small "Check again" link below
                     "Check again" onClick: re-fetch GET /results/{id}
                       if pdf_url now set → update state, enable button
                       if still null      → keep "Generating…" state
```

The `downloadPdf()` helper in `src/api/results.ts` is removed — no longer needed.

---

## Infrastructure

### S3 Bucket

- **Name:** `adizes-pdf-reports`
- **Region:** `ap-south-1` (or match deployment region)
- **ACL:** Public-read on objects (UUID-based keys are not guessable)
- **Object key pattern:** `reports/{assessment_id}.pdf`

### IAM Role: `adizes-pdf-lambda-role`

Required policies:
- `AWSLambdaBasicExecutionRole` — CloudWatch logging
- `s3:PutObject` on `arn:aws:s3:::adizes-pdf-reports/reports/*`

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

# 1. Copy logo from frontend repo into Lambda assets
cp ../../../adizes-frontend/public/logo.png template/assets/logo.png

# 2. Authenticate Docker to ECR
aws ecr get-login-password --region $REGION | \
  docker login --username AWS --password-stdin \
  "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

# 3. Create ECR repository if it doesn't exist
aws ecr describe-repositories --repository-names $ECR_REPO \
  --region $REGION 2>/dev/null || \
  aws ecr create-repository --repository-name $ECR_REPO --region $REGION

# 4. Build for linux/amd64 and push
docker build --platform linux/amd64 -t $IMAGE_URI .
docker push $IMAGE_URI

# 5. Create Lambda function (first time) or update image URI (subsequent deploys)
if aws lambda get-function --function-name $LAMBDA_NAME --region $REGION 2>/dev/null; then
  aws lambda update-function-code \
    --function-name $LAMBDA_NAME \
    --image-uri $IMAGE_URI \
    --region $REGION
else
  aws lambda create-function \
    --function-name $LAMBDA_NAME \
    --package-type Image \
    --code ImageUri=$IMAGE_URI \
    --role $LAMBDA_ROLE \
    --timeout 60 \
    --memory-size 1024 \
    --region $REGION
fi

echo "✓ Lambda deployed: $LAMBDA_NAME → $IMAGE_URI"
```

### Git Branch

```bash
# From adizes-backend repo
git checkout -b feature/pdf-lambda
# Lambda code lives at: lambda/pdf-generator/
```

---

## Error Handling

| Failure point | Behaviour |
|---------------|-----------|
| boto3 invoke fails (Lambda unreachable) | BackgroundTask catches exception silently — assessment is still saved, pdf_url stays null, user sees "Generating…" indefinitely until manually retried |
| Puppeteer crash inside Lambda | Lambda returns error; pdf_url not written; user sees "Check again" |
| S3 upload fails | Lambda catches, logs to CloudWatch; pdf_url not written |
| Supabase PATCH fails | PDF exists in S3 but url not stored; Lambda should retry once before giving up |
| User clicks "Check again" repeatedly | Each click is a simple GET /results/{id} — no rate issue |

---

## Out of Scope

- Real-time WebSocket/Supabase Realtime notification when PDF is ready (deferred)
- Admin-triggered PDF regeneration UI
- PDF caching invalidation if assessment data is edited
- Cost monitoring / Lambda concurrency limits
- Local dev Lambda emulation (aws-sam-local)
