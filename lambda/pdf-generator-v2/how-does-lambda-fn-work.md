# How the PDF Lambda v2 Function Works

## Overview

Lambda v2 generates the **PAEI Energy Alignment Profile** — a 5-page PDF for each completed
Adizes90 assessment. FastAPI fires it as a `BackgroundTask` after saving the assessment, so the
user gets their result page immediately while the PDF is generated in the background.

Key differences from v1:
- No Chart.js — all visuals are HTML `<div>` bars with inline width percentages
- 5 pages instead of 9 (no PAEI theory sections)
- 3 gap types (132-scale): Execution, Engagement, Authenticity (not Role Pressure / Energy Tension / Identity Drift from the old naming)
- Faster render (no `addScriptTag`, no `page.evaluate`, no `waitForFunction`)

---

## Trigger Flow

```
POST /assessment/submit
  └── score answers → save to DB (assessments table)
  └── BackgroundTask: _trigger_pdf_lambda(assessment_id, payload)
        └── boto3.invoke(adizes-pdf-generator-v2, InvocationType="RequestResponse")  ← synchronous
        └── Lambda returns { statusCode: 200, pdf_url: "https://..." }
        └── Backend patches assessments.pdf_url (redundant safety net)
  └── return { result_id } to frontend immediately
```

`InvocationType="RequestResponse"` (synchronous). Lambda generates PDF, uploads to S3, and patches
Supabase itself. Backend also patches from the returned URL as a redundant fallback. If the trigger
fails, the error is logged and swallowed — the assessment is always saved.

**Payload sent to Lambda:**

```json
{
  "assessment_id": "<uuid>",
  "user_name": "Jane Smith",
  "completed_at": "2026-05-26T08:09:05Z",
  "profile": { "is": "PAei", "should": "pAEi", "want": "PAei" },
  "scaled_scores": {
    "is":     { "P": 26, "A": 33, "E": 18, "I": 23 },
    "should": { "P": 25, "A": 26, "E": 26, "I": 23 },
    "want":   { "P": 27, "A": 27, "E": 21, "I": 25 }
  },
  "gaps": [
    {
      "role": "A", "role_name": "Administrator",
      "is_score": 44, "should_score": 34, "want_score": 36,
      "execution_gap": 10, "execution_gap_signed": -10, "execution_severity": "medium",
      "execution_narrative": "You are more process-focused than your role demands...",
      "engagement_gap": 2, "engagement_gap_signed": -2, "engagement_severity": "low",
      "engagement_narrative": "...",
      "authenticity_gap": 8, "authenticity_gap_signed": 8, "authenticity_severity": "medium",
      "authenticity_narrative": "..."
    }
  ],
  "interpretation": {
    "style_label": "Administrator",
    "style_tagline": "The Reliable Architect",
    "combined_description": "...",
    "dominant_roles": ["P", "A"],
    "strengths": "...",
    "watchouts": "...",
    "working_with_others": "...",
    "mismanagement_risks": ["Bureaucrat — ..."]
  }
}
```

> **Field name note:** The Lambda handler accepts both `assessment_id` and `result_id`
> (`event.result_id || event.assessment_id`) for resilience.
>
> **Gap field names (v2):** `execution_gap`, `engagement_gap`, `authenticity_gap` — NOT the old
> v1 names `external_gap` / `internal_gap`. Using v1 names will cause wrong or missing report content.
>
> **Interpretation field names (v2):** `watchouts` — NOT the old v1 name `blind_spots`.

---

## Gap Scoring Reference (132-scale)

| Gap type | Formula | Meaning |
|---|---|---|
| Execution Gap | `\|should − is\|` | Role demand vs current behaviour |
| Engagement Gap | `\|should − want\|` | Role demand vs natural preference |
| Authenticity Gap | `\|is − want\|` | Current behaviour vs natural preference |

**Severity thresholds (132-point scale):**

| Gap value | Severity |
|---|---|
| < 6 | low |
| 6–15 | medium |
| > 15 | high |

**Top gaps (Page 1 of report):** the 3 largest `gap_abs` values across all 12 gap values
(4 roles × 3 types), filtered to severity ≥ medium.

---

## Inside the Lambda (`index.js`)

### Step 1 — Compute derived data

```js
const topGaps        = getTopGaps(gaps, 3);
const actionPath     = computeActionPath(gaps);
const actionPathMsgs = generateActionPathMessages(gaps, actionPath, scaled_scores);
const gapsMap        = {};
for (const g of gaps) gapsMap[g.role] = g;
```

### Step 2 — Render EJS template

```js
renderedHtml = ejs.render(templateSrc, {
  user_name, completed_at, profile, scaled_scores, interpretation,
  gaps, gapsMap, topGaps, actionPath,
  ROLES, ROLE_NAMES, ROLE_COLORS, ROLE_TINTS, GAP_TYPE_META,
});
```

### Step 3 — Inline all assets

`page.setContent()` has no base URL — relative paths silently fail. `inlineAssets()`:
- Reads `template/styles.css` and replaces the `<link>` tag with an inline `<style>` block
- Reads every `./assets/*.{png,svg}` and replaces `src=` with base64 data URIs

### Step 4 — Launch Chromium

```js
const browser = await puppeteer.launch({
  args: chromium.args,
  executablePath: await chromium.executablePath(),
  headless: chromium.headless,
});
```

`@sparticuz/chromium` is used — Lambda-optimized binary.

### Step 5 — Load HTML and generate PDF

```js
await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 });
pdfBytes = await page.pdf({
  format: 'A4',
  printBackground: true,
  margin: { top: '18mm', bottom: '22mm', left: '15mm', right: '15mm' },
});
```

### Step 6 — Upload to S3

```js
await s3.send(new PutObjectCommand({
  Bucket: process.env.S3_BUCKET_NAME,
  Key: `reports/${assessment_id}.pdf`,
  Body: pdfBytes,
  ContentType: 'application/pdf',
}));
const pdfUrl = `https://${S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/reports/${assessment_id}.pdf`;
```

### Step 7 — Patch Supabase

```js
await fetch(`${SUPABASE_URL}/rest/v1/assessments?id=eq.${assessment_id}`, {
  method: 'PATCH',
  headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
  body: JSON.stringify({ pdf_url: pdfUrl }),
});
```

Retried once on failure. Returns `{ statusCode: 200, assessment_id, pdf_url }` regardless —
even if Supabase patch fails (PDF is still in S3; backend's redundant patch then takes over).

**CRITICAL — `SUPABASE_SERVICE_ROLE_KEY` must be the production HS256 key.** Using the local dev
ES256 key (header `"alg":"ES256","iss":"supabase-demo"`) against the production URL returns HTTP
401. The Lambda silently logs the error and still returns 200, making it appear to succeed while
`assessments.pdf_url` is never set. Always verify after deploy:

```bash
AWS_PROFILE=lax-t3-assumed aws lambda get-function-configuration \
  --function-name adizes-pdf-generator-v2 --region ap-south-1 \
  --query 'Environment.Variables.SUPABASE_URL'
# → should print: "https://swiznkamzxyfzgckebqi.supabase.co"
```

---

## Five-Page Report Structure

| Page | Title | Primary content |
|---|---|---|
| 1 | Energy Alignment Snapshot | 2×2 role card matrix + top gap pills |
| 2 | Gap Map | 4 full role cards with Is/Should/Want bars + gap highlights |
| 3 | What This Means | Strengths / friction / early warning signs |
| 4 | Style Summary | Style label + tagline + strengths/watchouts/working-with-others |
| 5 | Action Path | Stretch / Balance / Protect cards |

---

## Frontend — How the UI picks it up

```
Results page loads
  │
  ├─ GET /results/:id  →  pdf_url = null
  │     └─ shows "Generating your PDF…" spinner + "Check again" link
  │
  └─ user clicks "Check again"
       ├─ GET /results/:id  →  pdf_url still null  →  same state
       └─ GET /results/:id  →  pdf_url set          →  window.open(pdfUrl, '_blank')
```

The frontend does not poll automatically. Typical generation time: 15–45 s cold start, 5–10 s warm.

---

## Re-triggering a stuck assessment (pdf_url = null)

> **Do NOT use `aws lambda invoke --payload file://`** — AWS CLI v2 with `file://` prefix
> double-encodes the payload and throws `Invalid base64: "{...json...}"`. Use Python boto3.

```python
import boto3, json

# Build payload dict from the full assessment row (all fields)
with open('/tmp/lambda-payload.json') as f:
    payload = json.load(f)

session = boto3.Session(profile_name='lax-t3-assumed')
client  = session.client('lambda', region_name='ap-south-1')
resp = client.invoke(
    FunctionName='adizes-pdf-generator-v2',
    InvocationType='RequestResponse',
    Payload=json.dumps(payload).encode('utf-8'),
)
result = json.loads(resp['Payload'].read())
print(result)
# → {"statusCode": 200, "assessment_id": "...", "pdf_url": "https://..."}
```

On success the Lambda patches Supabase directly. No backend involvement needed.

Required payload fields: `assessment_id`, `user_name`, `completed_at`, `profile`,
`scaled_scores`, `gaps` (with execution/engagement/authenticity fields), `interpretation`.

---

## Configuration

| Environment Variable | Where set | Purpose |
|---|---|---|
| `SUPABASE_URL` | Lambda env | Production Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Lambda env | Production HS256 service-role JWT for DB write |
| `S3_BUCKET_NAME` | Lambda env | S3 bucket for PDF storage |
| `AWS_ACCESS_KEY_ID` | App Runner env only | IAM user key to invoke Lambda |
| `AWS_SECRET_ACCESS_KEY` | App Runner env only | IAM user secret |
| `PDF_LAMBDA_FUNCTION_NAME` | App Runner env | Active Lambda name — change to cut over or roll back |
| `LAMBDA_INVOKE_ROLE_ARN` | App Runner env | Must be **empty** — direct invoke via resource-based policy |

---

## Deployment

```bash
cd lambda/pdf-generator-v2
export SUPABASE_URL=https://swiznkamzxyfzgckebqi.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<production-service-role-key>   # HS256, NOT the local dev key
export S3_BUCKET_NAME=adizes-pdf-reports
./deploy.sh
```

`deploy.sh` performs:
1. Copies `logo.png` from the frontend repo into `template/assets/`
2. Authenticates Docker to ECR (`AWS_PROFILE=lax-t3-assumed`)
3. Creates ECR repository `adizes-pdf-generator-v2` if absent
4. Builds Docker image for `linux/amd64` with `--provenance=false`
5. Pushes image to ECR
6. Creates Lambda `adizes-pdf-generator-v2` on first run, updates image URI on subsequent runs
7. Sets timeout (90 s), memory (1024 MB), architecture (x86_64), and env vars

**IAM requirements for the deploying role (`power-admin-role`):**
- `AWSLambda_FullAccess` managed policy
- `PowerUserAccess` managed policy
- Inline policy `iam-pass-for-lambda`: `iam:PassRole` on `adizes-pdf-lambda-role`

After deploy, verify the Lambda env var `SUPABASE_SERVICE_ROLE_KEY` is the production key
(not the local dev key — see CRITICAL note in Step 7 above).

---

## AWS Infrastructure (one-time setup)

| Resource | Notes |
|---|---|
| ECR repository `adizes-pdf-generator-v2` | Created by `deploy.sh` |
| IAM role `adizes-pdf-lambda-role` | `AWSLambdaBasicExecutionRole` + `s3:PutObject` on `adizes-pdf-reports` |
| S3 bucket `adizes-pdf-reports` | Shared with v1; public-read PDFs |
| IAM user `adizes-backend-lambda-invoker` | Resource-based policy grants direct invoke on `adizes-pdf-generator-v2` (managed policy only covered v1) |
| Lambda resource-based policy | Grants `adizes-backend-lambda-invoker` `lambda:InvokeFunction` directly — no STS assume-role needed |
