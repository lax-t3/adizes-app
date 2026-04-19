# How the PDF Lambda v2 Function Works

## Overview

Lambda v2 generates the **PAEI Energy Alignment Profile** — a 5-page PDF replacing the
9-page AMSI report. It runs asynchronously: FastAPI fires it as a `BackgroundTask` after
saving the assessment, so the user gets their result page immediately.

Key differences from v1:
- No Chart.js — all visuals are HTML `<div>` bars with inline width percentages
- 5 pages instead of 9 (no PAEI theory sections)
- New tension logic: Role Pressure / Energy Tension / Identity Drift
- Faster render (no `addScriptTag`, no `page.evaluate`, no `waitForFunction`)

---

## Trigger

```
POST /assessment/submit
  └── score answers
  └── save to DB (assessments table)
  └── BackgroundTask: boto3.invoke(adizes-pdf-generator-v2, InvocationType="Event")
  └── return { result_id } to frontend immediately
```

`InvocationType="Event"` is fire-and-forget. If the trigger fails, the error is logged
and swallowed — the assessment is always saved.

**Payload sent to Lambda:**

```json
{
  "assessment_id": "<uuid>",
  "user_name": "Jane Smith",
  "completed_at": "2026-04-19T14:25:46Z",
  "profile": { "is": "PAei", "should": "PAei", "want": "pAeI" },
  "scaled_scores": {
    "is":     { "P": 32, "A": 32, "E": 29, "I": 27 },
    "should": { "P": 32, "A": 37, "E": 24, "I": 27 },
    "want":   { "P": 29, "A": 31, "E": 28, "I": 32 }
  },
  "gaps": [
    {
      "role": "A", "is_score": 32, "should_score": 37, "want_score": 31,
      "external_gap": 5, "internal_gap": 1,
      "external_message": "...", "internal_message": "...",
      "external_severity": "watch", "internal_severity": "aligned"
    },
    ...
  ],
  "interpretation": {
    "style_label": "Integrator",
    "style_tagline": "The Cohesive Shepherd",
    "combined_description": "The Steady Team Builder — ...",
    "dominant_roles": ["A", "I"],
    "strengths": "...",
    "blind_spots": "...",
    "mismanagement_risks": ["Bureaucrat — ...", "Super-Follower — ..."],
    "working_with_others": "..."
  }
}
```

> **Field name note:** The backend sends `assessment_id` in the payload. The Lambda handler
> also accepts `result_id` as a fallback (`event.result_id || event.assessment_id`) for
> resilience against any future field rename.

---

## Tension Calculation (`lib/tensions.js`)

Three tension types are computed per PAEI role from `scaled_scores`:

| Tension Type | Formula | Meaning |
|---|---|---|
| Role Pressure | `abs(should − is)` | Gap between role demand and current behaviour |
| Energy Tension | `abs(want − should)` | Gap between natural preference and role demand |
| Identity Drift | `abs(want − is)` | Gap between natural preference and current behaviour |

**Level classification:**

| Gap | Level |
|---|---|
| < 5 | ALIGNED |
| 5–15 | MODERATE |
| > 15 | HIGH |

**Per-role primary tension:** highest of the three values for that role.
**Top tensions (Page 1):** the two role+type combinations with the largest absolute gap across all 12.

**Action Path (Page 5):**
- **Stretch** → role with highest Role Pressure (`abs(should − is)`)
- **Balance** → role with highest Identity Drift (`abs(want − is)`)
- **Protect** → role with lowest peak tension (min of all three values)

---

## Inside the Lambda (`index.js`)

### Step 1 — Compute derived data

```js
const tensions       = computeTensions(scaled_scores);   // 12 tension values
const topTensions    = getTopTensions(tensions, 2);       // top 2 role+type combos
const actionPath     = computeActionPath(tensions);       // stretch/balance/protect roles
const actionPathMsgs = generateActionPathMessages(tensions, actionPath);
```

### Step 2 — Render EJS template

```js
renderedHtml = ejs.render(templateSrc, {
  user_name, completed_at, profile, scaled_scores, gaps, interpretation,
  tensions, topTensions, actionPath, actionPathMsgs,
  ROLES, ROLE_NAMES, ROLE_COLORS, ROLE_TINTS, TYPE_LABELS,
});
```

### Step 3 — Inline all assets

```js
html = inlineAssets(renderedHtml);
```

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

`@sparticuz/chromium` is used — Lambda-optimized binary, works in the restricted sandbox.

### Step 5 — Load HTML and generate PDF

```js
await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 });
pdfBytes = await page.pdf({
  format: 'A4',
  printBackground: true,
  margin: { top: '18mm', bottom: '22mm', left: '15mm', right: '15mm' },
});
```

No `addScriptTag`, no `page.evaluate`, no `waitForFunction` — those were only needed for
Chart.js. Pure HTML renders immediately on `domcontentloaded`.

### Step 6 — Upload to S3

```js
await s3.send(new PutObjectCommand({
  Bucket: process.env.S3_BUCKET_NAME,
  Key: `reports/${assessment_id}.pdf`,
  Body: pdfBytes,
  ContentType: 'application/pdf',
}));
```

Public URL: `https://adizes-pdf-reports.s3.ap-south-1.amazonaws.com/reports/<assessment_id>.pdf`

### Step 7 — Patch Supabase

```js
await fetch(`${SUPABASE_URL}/rest/v1/assessments?id=eq.${assessment_id}`, {
  method: 'PATCH',
  headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
  body: JSON.stringify({ pdf_url: pdfUrl }),
});
```

Retried once on failure. If both fail, the PDF is still in S3 — manual re-trigger restores it.

---

## Five-Page Report Structure

| Page | Title | Primary content |
|---|---|---|
| 1 | Energy Alignment Snapshot | 2×2 role card matrix + top tensions pills |
| 2 | Tension Map | 4 full role cards with bars + primary tension highlight |
| 3 | What This Means | Strengths / friction / early warning signs |
| 4 | Style Summary | Style label + tagline + three-column strengths/watchouts/stress |
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

The frontend never polls automatically — user triggers each check manually.
Typical generation time: 15–45 s cold start, 5–10 s warm.

---

## Re-triggering a stuck assessment (pdf_url = null)

If `pdf_url` is null after submission, invoke the Lambda synchronously with the full payload:

```bash
# 1. Fetch the assessment record from Supabase
SUPA_URL="https://swiznkamzxyfzgckebqi.supabase.co"
SUPA_KEY="<service-role-key>"
curl -s "${SUPA_URL}/rest/v1/assessments?id=eq.<uuid>&select=*" \
  -H "apikey: ${SUPA_KEY}" -H "Authorization: Bearer ${SUPA_KEY}"

# 2. Invoke Lambda with the payload (assessment_id = the id field)
AWS_PROFILE=lax-t3-assumed aws lambda invoke \
  --function-name adizes-pdf-generator-v2 \
  --region ap-south-1 \
  --invocation-type RequestResponse \
  --payload '{"assessment_id":"<uuid>","user_name":"...","completed_at":"...","profile":{...},"scaled_scores":{...},"gaps":[...],"interpretation":{...}}' \
  --cli-binary-format raw-in-base64-out \
  /tmp/response.json && cat /tmp/response.json
```

On success the Lambda returns `{"statusCode":200,"assessment_id":"...","pdf_url":"https://..."}` and
patches Supabase automatically. The user then clicks "Check again" to see the download button.

---

## Configuration

| Environment Variable | Where set | Purpose |
|---|---|---|
| `SUPABASE_URL` | Lambda env | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Lambda env | Service-role JWT for DB write |
| `S3_BUCKET_NAME` | Lambda env | S3 bucket for PDF storage |
| `AWS_ACCESS_KEY_ID` | FastAPI `.env` only | IAM user key to invoke Lambda |
| `AWS_SECRET_ACCESS_KEY` | FastAPI `.env` only | IAM user secret |
| `PDF_LAMBDA_FUNCTION_NAME` | App Runner env var | Active Lambda name — change here to cut over or roll back |

---

## Deployment

```bash
cd lambda/pdf-generator-v2
export SUPABASE_URL=https://swiznkamzxyfzgckebqi.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
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

---

## AWS Infrastructure (one-time setup)

Shared with v1 — no new infrastructure needed:

| Resource | Notes |
|---|---|
| ECR repository `adizes-pdf-generator-v2` | Created by `deploy.sh` |
| IAM role `adizes-pdf-lambda-role` | Same as v1: `AWSLambdaBasicExecutionRole` + `s3:PutObject` |
| S3 bucket `adizes-pdf-reports` | Same bucket as v1 |
| IAM user `adizes-backend-lambda-invoker` | Same user as v1: `lambda:InvokeFunction` |
