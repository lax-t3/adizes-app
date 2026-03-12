# PDF Lambda Generator Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy an AWS Lambda Docker function that generates a full AMSI-format PDF report (matching the Jack Allen sample) using Puppeteer, triggered as a fire-and-forget background task after assessment completion, with the PDF stored in S3 and a direct download link surfaced in the Results and AdminRespondent pages.

**Architecture:** FastAPI fires `boto3.invoke(InvocationType="Event")` as a `BackgroundTask` after assessment submit; Lambda renders an EJS template with Chart.js charts via Puppeteer, uploads to S3, and PATCHes `assessments.pdf_url` via the Supabase REST API. Frontend reads `pdf_url` from `GET /results/{id}` and shows "Generating…" until the URL is available.

**Tech Stack:** Node.js 20, Puppeteer 22, EJS, Chart.js 4 (CDN in template), `@aws-sdk/client-s3`, Python `boto3`, FastAPI `BackgroundTasks`, Supabase REST API, AWS ECR + Lambda Docker, S3.

---

## File Map

### New files (Lambda)
| Path | Responsibility |
|------|---------------|
| `lambda/pdf-generator/package.json` | Node dependencies |
| `lambda/pdf-generator/Dockerfile` | Lambda-compatible Docker image |
| `lambda/pdf-generator/index.js` | Lambda handler: parse → render → Puppeteer → S3 → Supabase PATCH |
| `lambda/pdf-generator/template/report.html` | EJS 9-page AMSI report template with Chart.js |
| `lambda/pdf-generator/template/styles.css` | Print-optimised A4 CSS, page breaks, fonts |
| `lambda/pdf-generator/template/assets/logo.png` | Copied from frontend at deploy time |
| `lambda/pdf-generator/template/assets/paei_quad_P.svg` | P-role quadrant diagram (static SVG) |
| `lambda/pdf-generator/template/assets/paei_quad_A.svg` | A-role quadrant diagram |
| `lambda/pdf-generator/template/assets/paei_quad_E.svg` | E-role quadrant diagram |
| `lambda/pdf-generator/template/assets/paei_quad_I.svg` | I-role quadrant diagram |
| `lambda/pdf-generator/deploy.sh` | Build → ECR push → Lambda create/update |

### Modified files (FastAPI — `adizes-backend` repo)
| Path | Change |
|------|--------|
| `app/config.py` | Add 4 AWS Settings fields |
| `app/schemas/results.py` | Add `pdf_url: Optional[str] = None` to `ResultResponse` |
| `app/routers/results.py` | Pass `pdf_url` through in `get_result` |
| `app/routers/assessment.py` | Add `BackgroundTasks`, `trigger_pdf_lambda()`, `_build_pdf_payload()` |

### Modified files (Frontend — `adizes-frontend` repo)
| Path | Change |
|------|--------|
| `src/types/api.ts` | Add `pdf_url: string | null` to `ResultResponse` |
| `src/api/results.ts` | Remove `downloadPdf()` (replaced by direct S3 URL) |
| `src/pages/Results.tsx` | Replace download button with pdf_url state machine |
| `src/pages/AdminRespondent.tsx` | Same pdf_url state machine |

---

## Chunk 1: Git Branch + Lambda Scaffold

### Task 1: Create feature branch in adizes-backend

**Files:**
- (no file changes)

- [ ] **Step 1: Create branch from adizes-backend main**

```bash
cd /Users/vrln/adizes-backend
git checkout adizes-backend
git checkout -b feature/pdf-lambda
```

Expected: `Switched to a new branch 'feature/pdf-lambda'`

- [ ] **Step 2: Create directory structure**

```bash
mkdir -p lambda/pdf-generator/template/assets
```

- [ ] **Step 3: Commit empty scaffold**

```bash
git add lambda/
git commit -m "chore: scaffold lambda/pdf-generator directory"
```

---

### Task 2: Write `package.json` and `Dockerfile`

**Files:**
- Create: `lambda/pdf-generator/package.json`
- Create: `lambda/pdf-generator/Dockerfile`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "adizes-pdf-generator",
  "version": "1.0.0",
  "description": "AWS Lambda PDF generator for Adizes PAEI assessment reports",
  "main": "index.js",
  "dependencies": {
    "puppeteer": "^22.0.0",
    "ejs": "^3.1.9",
    "@aws-sdk/client-s3": "^3.0.0",
    "chart.js": "^4.4.0"
  },
  "engines": {
    "node": ">=20"
  }
}
```

Note: `node-fetch` is NOT included — Node 20 has built-in `fetch` (available globally, no import needed). `chart.js` is installed locally so `index.js` can inject it via `page.addScriptTag({ path: CHARTJS_PATH })` — Lambda has no internet access so a CDN `<script>` tag would fail.

- [ ] **Step 2: Write `Dockerfile`**

```dockerfile
FROM public.ecr.aws/lambda/nodejs:20

# Install Chromium system dependencies for Puppeteer on Amazon Linux 2023
RUN dnf install -y \
    atk \
    cups-libs \
    gtk3 \
    libXcomposite \
    libXdamage \
    libXrandr \
    libXtst \
    pango \
    alsa-lib \
    at-spi2-atk \
    libxkbcommon \
    nss \
    && dnf clean all

# Set Puppeteer cache inside image (not Lambda's read-only /tmp)
ENV PUPPETEER_CACHE_DIR=/var/task/.cache/puppeteer

COPY package*.json ./
RUN npm ci

COPY index.js ./
COPY template/ ./template/

CMD ["index.handler"]
```

- [ ] **Step 3: Run `npm install` locally to generate lock file**

```bash
cd lambda/pdf-generator
npm install
```

Expected: `package-lock.json` created, Chrome downloaded into `.cache/puppeteer/`.

- [ ] **Step 4: Add `.gitignore` for node_modules and Chrome cache**

Create `lambda/pdf-generator/.gitignore`:
```
node_modules/
.cache/
```

- [ ] **Step 5: Commit scaffold files**

```bash
cd /Users/vrln/adizes-backend
git add lambda/pdf-generator/package.json lambda/pdf-generator/package-lock.json lambda/pdf-generator/Dockerfile lambda/pdf-generator/.gitignore
git commit -m "feat(lambda): add package.json and Dockerfile for pdf-generator"
```

---

## Chunk 2: SVG Assets + CSS + EJS Template

### Task 3: Create SVG quadrant diagrams

**Files:**
- Create: `lambda/pdf-generator/template/assets/paei_quad_P.svg`
- Create: `lambda/pdf-generator/template/assets/paei_quad_A.svg`
- Create: `lambda/pdf-generator/template/assets/paei_quad_E.svg`
- Create: `lambda/pdf-generator/template/assets/paei_quad_I.svg`

Each SVG shows the 2×2 PAEI matrix with the given role's quadrant highlighted. Dimensions: 220×220px. Colors: highlighted quadrant uses role color; others use `#f3f4f6`.

- [ ] **Step 1: Write `paei_quad_P.svg`** (top-left = P highlighted)

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 220 220">
  <!-- Border -->
  <rect x="10" y="10" width="200" height="200" fill="none" stroke="#d1d5db" stroke-width="1.5"/>
  <!-- Dividers -->
  <line x1="110" y1="10" x2="110" y2="210" stroke="#d1d5db" stroke-width="1.5"/>
  <line x1="10" y1="110" x2="210" y2="110" stroke="#d1d5db" stroke-width="1.5"/>
  <!-- P quadrant highlighted (top-left) -->
  <rect x="10" y="10" width="100" height="100" fill="#C8102E" fill-opacity="0.15"/>
  <!-- Labels -->
  <text x="60" y="65" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#C8102E" text-anchor="middle">P</text>
  <text x="160" y="65" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#9ca3af" text-anchor="middle">E</text>
  <text x="60" y="165" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#9ca3af" text-anchor="middle">A</text>
  <text x="160" y="165" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#9ca3af" text-anchor="middle">I</text>
</svg>
```

- [ ] **Step 2: Write `paei_quad_A.svg`** (bottom-left = A highlighted)

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 220 220">
  <rect x="10" y="10" width="200" height="200" fill="none" stroke="#d1d5db" stroke-width="1.5"/>
  <line x1="110" y1="10" x2="110" y2="210" stroke="#d1d5db" stroke-width="1.5"/>
  <line x1="10" y1="110" x2="210" y2="110" stroke="#d1d5db" stroke-width="1.5"/>
  <!-- A quadrant highlighted (bottom-left) -->
  <rect x="10" y="110" width="100" height="100" fill="#1D3557" fill-opacity="0.15"/>
  <text x="60" y="65" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#9ca3af" text-anchor="middle">P</text>
  <text x="160" y="65" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#9ca3af" text-anchor="middle">E</text>
  <text x="60" y="165" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#1D3557" text-anchor="middle">A</text>
  <text x="160" y="165" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#9ca3af" text-anchor="middle">I</text>
</svg>
```

- [ ] **Step 3: Write `paei_quad_E.svg`** (top-right = E highlighted)

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 220 220">
  <rect x="10" y="10" width="200" height="200" fill="none" stroke="#d1d5db" stroke-width="1.5"/>
  <line x1="110" y1="10" x2="110" y2="210" stroke="#d1d5db" stroke-width="1.5"/>
  <line x1="10" y1="110" x2="210" y2="110" stroke="#d1d5db" stroke-width="1.5"/>
  <!-- E quadrant highlighted (top-right) -->
  <rect x="110" y="10" width="100" height="100" fill="#E87722" fill-opacity="0.15"/>
  <text x="60" y="65" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#9ca3af" text-anchor="middle">P</text>
  <text x="160" y="65" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#E87722" text-anchor="middle">E</text>
  <text x="60" y="165" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#9ca3af" text-anchor="middle">A</text>
  <text x="160" y="165" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#9ca3af" text-anchor="middle">I</text>
</svg>
```

- [ ] **Step 4: Write `paei_quad_I.svg`** (bottom-right = I highlighted)

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 220 220">
  <rect x="10" y="10" width="200" height="200" fill="none" stroke="#d1d5db" stroke-width="1.5"/>
  <line x1="110" y1="10" x2="110" y2="210" stroke="#d1d5db" stroke-width="1.5"/>
  <line x1="10" y1="110" x2="210" y2="110" stroke="#d1d5db" stroke-width="1.5"/>
  <!-- I quadrant highlighted (bottom-right) -->
  <rect x="110" y="110" width="100" height="100" fill="#2A9D8F" fill-opacity="0.15"/>
  <text x="60" y="65" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#9ca3af" text-anchor="middle">P</text>
  <text x="160" y="65" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#9ca3af" text-anchor="middle">E</text>
  <text x="60" y="165" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#9ca3af" text-anchor="middle">A</text>
  <text x="160" y="165" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#2A9D8F" text-anchor="middle">I</text>
</svg>
```

- [ ] **Step 5: Commit SVG assets**

```bash
cd /Users/vrln/adizes-backend
git add lambda/pdf-generator/template/assets/*.svg
git commit -m "feat(lambda): add PAEI quadrant SVG diagrams"
```

---

### Task 4: Write print CSS

**Files:**
- Create: `lambda/pdf-generator/template/styles.css`

- [ ] **Step 1: Write `styles.css`**

```css
/* ── Reset & page setup ─────────────────────────────────────── */
@page {
  size: A4;
  margin: 18mm 15mm 22mm 15mm;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 10pt;
  color: #1a1a1a;
  line-height: 1.5;
}

/* ── Page breaks ────────────────────────────────────────────── */
.page {
  width: 100%;
  min-height: 257mm;   /* A4 height minus margins */
  position: relative;
  padding-bottom: 8mm;
}

.page-break {
  page-break-after: always;
  break-after: page;
}

/* ── Header (repeated via template, not @page header) ─────── */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 2px solid #C8102E;
  padding-bottom: 6pt;
  margin-bottom: 18pt;
}

.page-header img.logo {
  height: 36pt;
  object-fit: contain;
}

.page-header .header-tagline {
  font-size: 8pt;
  color: #6b7280;
  text-align: right;
}

/* ── Footer ─────────────────────────────────────────────────── */
.page-footer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  border-top: 1px solid #e5e7eb;
  padding-top: 5pt;
  font-size: 7.5pt;
  color: #6b7280;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* ── Cover page ─────────────────────────────────────────────── */
.cover {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  min-height: 240mm;
  padding: 24pt 0;
}

.cover img.logo-large {
  height: 60pt;
  margin-bottom: 36pt;
  object-fit: contain;
}

.cover .report-title {
  font-size: 24pt;
  font-weight: 700;
  color: #1a1a1a;
  letter-spacing: -0.5pt;
  margin-bottom: 8pt;
}

.cover .report-subtitle {
  font-size: 14pt;
  font-weight: 400;
  color: #4b5563;
  margin-bottom: 32pt;
}

.cover .cover-band {
  background: #C8102E;
  color: white;
  width: 100%;
  padding: 14pt 0;
  margin: 20pt 0;
}

.cover .cover-name {
  font-size: 20pt;
  font-weight: 700;
  letter-spacing: 0.5pt;
}

.cover .cover-date {
  font-size: 10pt;
  color: rgba(255,255,255,0.8);
  margin-top: 4pt;
}

.cover .confidential {
  font-size: 8pt;
  color: #6b7280;
  margin-top: 32pt;
}

/* ── Section headings ───────────────────────────────────────── */
h1 {
  font-size: 18pt;
  font-weight: 700;
  color: #1a1a1a;
  margin-bottom: 12pt;
}

h2 {
  font-size: 13pt;
  font-weight: 700;
  color: #1a1a1a;
  margin-bottom: 8pt;
}

h3 {
  font-size: 11pt;
  font-weight: 600;
  color: #374151;
  margin-bottom: 6pt;
}

/* ── Role pages (P/A/E/I) ────────────────────────────────────── */
.role-page-header {
  display: flex;
  align-items: center;
  gap: 16pt;
  margin-bottom: 14pt;
}

.role-badge {
  width: 48pt;
  height: 48pt;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22pt;
  font-weight: 800;
  color: white;
  flex-shrink: 0;
}

.role-badge.P { background: #C8102E; }
.role-badge.A { background: #1D3557; }
.role-badge.E { background: #E87722; }
.role-badge.I { background: #2A9D8F; }

.role-title h2 { margin: 0 0 3pt 0; }
.role-title .role-tagline { font-size: 9.5pt; color: #6b7280; }

.role-content {
  display: grid;
  grid-template-columns: 1fr 160pt;
  gap: 16pt;
  align-items: start;
}

.role-description p {
  font-size: 9.5pt;
  color: #374151;
  margin-bottom: 8pt;
  line-height: 1.55;
}

.role-quadrant img {
  width: 160pt;
  height: 160pt;
}

.role-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 12pt;
  font-size: 9pt;
}

.role-table th {
  background: #f3f4f6;
  padding: 5pt 8pt;
  text-align: left;
  font-weight: 600;
  border-bottom: 1px solid #e5e7eb;
}

.role-table td {
  padding: 5pt 8pt;
  border-bottom: 1px solid #f3f4f6;
  vertical-align: top;
}

/* ── Personal Results ───────────────────────────────────────── */
.results-header-band {
  background: #1a1a1a;
  color: white;
  padding: 14pt 16pt;
  border-radius: 6pt;
  margin-bottom: 16pt;
}

.results-header-band h2 {
  color: white;
  margin-bottom: 4pt;
}

.results-header-band .profile-string {
  font-size: 24pt;
  font-weight: 800;
  letter-spacing: 4pt;
  margin: 8pt 0;
}

.style-section {
  background: #f9fafb;
  border-left: 3pt solid #C8102E;
  padding: 10pt 12pt;
  border-radius: 0 4pt 4pt 0;
  margin-bottom: 12pt;
}

.style-section h3 { color: #C8102E; margin-bottom: 6pt; }
.style-section p { font-size: 9.5pt; line-height: 1.55; color: #374151; }

.profile-badges {
  display: flex;
  gap: 6pt;
  margin: 8pt 0;
}

.profile-badge {
  width: 32pt;
  height: 32pt;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15pt;
  font-weight: 800;
  color: white;
}

.profile-badge.P { background: #C8102E; }
.profile-badge.A { background: #1D3557; }
.profile-badge.E { background: #E87722; }
.profile-badge.I { background: #2A9D8F; }
.profile-badge.non-dominant {
  background: #e5e7eb;
  color: #6b7280;
}

/* ── Charts ─────────────────────────────────────────────────── */
.chart-container {
  position: relative;
  width: 100%;
}

.chart-container canvas {
  max-width: 100%;
}

/* ── Gap table ──────────────────────────────────────────────── */
.gap-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 14pt;
  font-size: 9pt;
}

.gap-table th {
  background: #1a1a1a;
  color: white;
  padding: 6pt 8pt;
  text-align: left;
  font-weight: 600;
}

.gap-table td {
  padding: 6pt 8pt;
  border-bottom: 1px solid #f3f4f6;
  vertical-align: top;
}

.gap-table tr:nth-child(even) td { background: #f9fafb; }

.severity-badge {
  display: inline-block;
  padding: 1.5pt 6pt;
  border-radius: 10pt;
  font-size: 8pt;
  font-weight: 600;
}

.severity-badge.aligned { background: #dcfce7; color: #166534; }
.severity-badge.watch   { background: #fef9c3; color: #854d0e; }
.severity-badge.tension { background: #fee2e2; color: #991b1b; }

/* ── Interpretation ─────────────────────────────────────────── */
.interp-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12pt;
  margin-bottom: 14pt;
}

.interp-card {
  border: 1px solid #e5e7eb;
  border-radius: 6pt;
  padding: 10pt;
}

.interp-card h3 {
  font-size: 9pt;
  text-transform: uppercase;
  letter-spacing: 0.5pt;
  margin-bottom: 6pt;
}

.interp-card p {
  font-size: 8.5pt;
  line-height: 1.55;
  color: #374151;
}

.interp-card.strengths h3 { color: #166534; }
.interp-card.blind-spots h3 { color: #92400e; }
.interp-card.working-with h3 { color: #1e40af; }

.risk-item {
  background: #fff1f2;
  border-left: 3pt solid #f43f5e;
  padding: 6pt 10pt;
  border-radius: 0 4pt 4pt 0;
  font-size: 8.5pt;
  color: #374151;
  margin-bottom: 5pt;
}
```

- [ ] **Step 2: Commit CSS**

```bash
cd /Users/vrln/adizes-backend
git add lambda/pdf-generator/template/styles.css
git commit -m "feat(lambda): add print-optimised CSS for PDF report"
```

---

### Task 5: Write EJS report template

**Files:**
- Create: `lambda/pdf-generator/template/report.html`

This is the full 9-page AMSI report. Static text (PAEI role descriptions) is embedded directly. Dynamic data uses EJS tags.

- [ ] **Step 1: Write `report.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AMSI Report — <%= user_name %></title>
  <link rel="stylesheet" href="./styles.css">
</head>
<body>

<!-- ═══════════════════════════════════════════════════════════ -->
<!-- PAGE 1: Cover Page                                          -->
<!-- ═══════════════════════════════════════════════════════════ -->
<div class="page page-break">
  <div class="cover">
    <img class="logo-large" src="./assets/logo.png" alt="Adizes India Logo">

    <div class="report-title">Adizes Management Style Indicator</div>
    <div class="report-subtitle">Personal Assessment Report</div>

    <div class="cover-band">
      <div class="cover-name"><%= user_name %></div>
      <div class="cover-date">
        <%= new Date(completed_at).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' }) %>
      </div>
    </div>

    <p style="font-size:10pt; color:#374151; max-width:380pt; text-align:center; margin-top:20pt;">
      This report presents your personal PAEI management style profile based on your responses
      to the Adizes Management Style Indicator questionnaire. It provides insights into
      how you currently operate, what your role demands, and what you naturally prefer.
    </p>

    <p class="confidential">
      CONFIDENTIAL — For individual use only.<br>
      © Adizes Institute. All rights reserved.
    </p>
  </div>

  <div class="page-footer">
    <span>Adizes India | info@adizesindia.com | www.adizesindia.com</span>
    <span>Confidential — Page 1</span>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════ -->
<!-- PAGE 2: P Role Description                                  -->
<!-- ═══════════════════════════════════════════════════════════ -->
<div class="page page-break">
  <div class="page-header">
    <img class="logo" src="./assets/logo.png" alt="Adizes India">
    <span class="header-tagline">PAEI Management Style Indicator</span>
  </div>

  <h1 style="color:#C8102E; margin-bottom:16pt;">The Four Management Styles</h1>

  <div class="role-page-header">
    <div class="role-badge P">P</div>
    <div class="role-title">
      <h2>Producer (P) — The Driver</h2>
      <div class="role-tagline">Short-term results · Execution · Action orientation</div>
    </div>
  </div>

  <div class="role-content">
    <div class="role-description">
      <p>The Producer role is focused on <strong>getting things done</strong>. Producers are highly results-oriented,
      motivated by short-term goals, and thrive on action. They know what needs to be accomplished and
      push hard to deliver it — on time, within budget, and to the required standard.</p>

      <p>In organisations, the P function provides the energy and drive to move from planning to execution.
      Without adequate P function, organisations talk without doing — paralysed by discussion while
      opportunities pass.</p>

      <p>At their best, Producers are decisive, persistent, and intensely focused. They cut through
      ambiguity and deliver. At their worst, they become <em>Lone Rangers</em> — doing everything
      themselves, burning out, and failing to develop others around them.</p>

      <table class="role-table">
        <tr>
          <th>Work Habits</th>
          <th>Attitude toward Other Styles</th>
        </tr>
        <tr>
          <td>Focuses on immediate tasks<br>Sets tight deadlines<br>Pushes for closure<br>Prefers action over analysis</td>
          <td><strong>A:</strong> Too slow, too many rules<br><strong>E:</strong> Too many ideas, never executes<br><strong>I:</strong> Too focused on feelings, not results</td>
        </tr>
      </table>
    </div>
    <div class="role-quadrant">
      <img src="./assets/paei_quad_P.svg" alt="P Quadrant">
    </div>
  </div>

  <div class="page-footer">
    <span>Adizes India | info@adizesindia.com | www.adizesindia.com</span>
    <span>Confidential — Page 2</span>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════ -->
<!-- PAGE 3: A Role Description                                  -->
<!-- ═══════════════════════════════════════════════════════════ -->
<div class="page page-break">
  <div class="page-header">
    <img class="logo" src="./assets/logo.png" alt="Adizes India">
    <span class="header-tagline">PAEI Management Style Indicator</span>
  </div>

  <div class="role-page-header">
    <div class="role-badge A">A</div>
    <div class="role-title">
      <h2>Administrator (A) — The Organiser</h2>
      <div class="role-tagline">Systems · Process · Reliability · Order</div>
    </div>
  </div>

  <div class="role-content">
    <div class="role-description">
      <p>The Administrator role is focused on <strong>how things are done</strong>. Administrators
      build systems, establish processes, and ensure that the organisation functions efficiently,
      consistently, and in compliance with its own standards. They are the guardians of institutional
      memory and procedural discipline.</p>

      <p>Without adequate A function, organisations become chaotic — innovation and energy dissipate
      into disorder. With too much A and too little of other functions, organisations become rigid
      and bureaucratic, optimising the process at the expense of results.</p>

      <p>At their best, Administrators are thorough, reliable, and precise — ensuring that what
      works today still works tomorrow. At their worst, they become <em>Bureaucrats</em> — following
      rules that no longer serve the organisation's goals, prioritising procedure over purpose.</p>

      <table class="role-table">
        <tr>
          <th>Work Habits</th>
          <th>Attitude toward Other Styles</th>
        </tr>
        <tr>
          <td>Documents and systematises<br>Monitors compliance<br>Manages by policy<br>Values predictability</td>
          <td><strong>P:</strong> Cuts corners, ignores process<br><strong>E:</strong> Disruptive, changes for change's sake<br><strong>I:</strong> Soft, avoids difficult decisions</td>
        </tr>
      </table>
    </div>
    <div class="role-quadrant">
      <img src="./assets/paei_quad_A.svg" alt="A Quadrant">
    </div>
  </div>

  <div class="page-footer">
    <span>Adizes India | info@adizesindia.com | www.adizesindia.com</span>
    <span>Confidential — Page 3</span>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════ -->
<!-- PAGE 4: E Role Description                                  -->
<!-- ═══════════════════════════════════════════════════════════ -->
<div class="page page-break">
  <div class="page-header">
    <img class="logo" src="./assets/logo.png" alt="Adizes India">
    <span class="header-tagline">PAEI Management Style Indicator</span>
  </div>

  <div class="role-page-header">
    <div class="role-badge E">E</div>
    <div class="role-title">
      <h2>Entrepreneur (E) — The Visionary</h2>
      <div class="role-tagline">Change · Innovation · Long-term vision · Risk-taking</div>
    </div>
  </div>

  <div class="role-content">
    <div class="role-description">
      <p>The Entrepreneur role is focused on <strong>what could be done</strong>. Entrepreneurs are
      driven by change, innovation, and the future. They identify opportunities before others see them,
      challenge the status quo, and inspire organisations to evolve. They are energised by possibilities
      and have a high tolerance for risk.</p>

      <p>Without adequate E function, organisations stagnate — incrementally optimising a declining
      strategy. With too much E and insufficient A and P, organisations launch initiatives that never
      land and exhaust their people through constant change.</p>

      <p>At their best, Entrepreneurs see the future clearly and inspire others to build it. At their
      worst, they become <em>Arsonists</em> — burning down what works in pursuit of the next exciting
      idea, leaving trails of unfinished projects.</p>

      <table class="role-table">
        <tr>
          <th>Work Habits</th>
          <th>Attitude toward Other Styles</th>
        </tr>
        <tr>
          <td>Generates many ideas<br>Pivots quickly<br>Comfortable with ambiguity<br>Challenges assumptions</td>
          <td><strong>P:</strong> Too narrow, misses the big picture<br><strong>A:</strong> Kills ideas with bureaucracy<br><strong>I:</strong> Too consensus-driven, moves too slowly</td>
        </tr>
      </table>
    </div>
    <div class="role-quadrant">
      <img src="./assets/paei_quad_E.svg" alt="E Quadrant">
    </div>
  </div>

  <div class="page-footer">
    <span>Adizes India | info@adizesindia.com | www.adizesindia.com</span>
    <span>Confidential — Page 4</span>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════ -->
<!-- PAGE 5: I Role Description                                  -->
<!-- ═══════════════════════════════════════════════════════════ -->
<div class="page page-break">
  <div class="page-header">
    <img class="logo" src="./assets/logo.png" alt="Adizes India">
    <span class="header-tagline">PAEI Management Style Indicator</span>
  </div>

  <div class="role-page-header">
    <div class="role-badge I">I</div>
    <div class="role-title">
      <h2>Integrator (I) — The Cohesive Shepherd</h2>
      <div class="role-tagline">People · Consensus · Team harmony · Long-term cohesion</div>
    </div>
  </div>

  <div class="role-content">
    <div class="role-description">
      <p>The Integrator role is focused on <strong>who needs to be aligned</strong>. Integrators
      build team cohesion, resolve interpersonal conflicts, and ensure that the organisation functions
      as a united whole rather than a collection of competing silos. They are skilled listeners,
      consensus builders, and political navigators.</p>

      <p>Without adequate I function, organisations fracture — talented individuals pull in different
      directions, knowledge is hoarded, and politics undermine execution. With too much I and insufficient
      P and E, organisations drift toward groupthink and conflict-avoidance.</p>

      <p>At their best, Integrators create environments where diverse talent thrives and the whole
      exceeds the sum of its parts. At their worst, they become <em>Super-Followers</em> — unable to
      make unpopular decisions, prioritising harmony over necessary change.</p>

      <table class="role-table">
        <tr>
          <th>Work Habits</th>
          <th>Attitude toward Other Styles</th>
        </tr>
        <tr>
          <td>Builds consensus before deciding<br>Invests in relationships<br>Seeks diverse input<br>Addresses interpersonal friction</td>
          <td><strong>P:</strong> Drives results at the cost of people<br><strong>A:</strong> Hides behind rules instead of talking<br><strong>E:</strong> Disrupts team stability with constant change</td>
        </tr>
      </table>
    </div>
    <div class="role-quadrant">
      <img src="./assets/paei_quad_I.svg" alt="I Quadrant">
    </div>
  </div>

  <div class="page-footer">
    <span>Adizes India | info@adizesindia.com | www.adizesindia.com</span>
    <span>Confidential — Page 5</span>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════ -->
<!-- PAGE 6: Personal Results Overview                           -->
<!-- ═══════════════════════════════════════════════════════════ -->
<div class="page page-break">
  <div class="page-header">
    <img class="logo" src="./assets/logo.png" alt="Adizes India">
    <span class="header-tagline">PAEI Management Style Indicator</span>
  </div>

  <div class="results-header-band">
    <h2>Personal Results — <%= user_name %></h2>
    <div style="font-size:9pt; color:rgba(255,255,255,0.7); margin-bottom:8pt;">
      Assessment completed <%= new Date(completed_at).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' }) %>
    </div>

    <%
      const roleColors = { P: '#C8102E', A: '#1D3557', E: '#E87722', I: '#2A9D8F' };
      const wantProfile = profile.want || 'paei';
    %>

    <div style="margin-top:6pt;">
      <div style="font-size:8pt; color:rgba(255,255,255,0.6); text-transform:uppercase; letter-spacing:1pt; margin-bottom:6pt;">
        Your PAEI Profile (Want dimension)
      </div>
      <div class="profile-badges">
        <% wantProfile.split('').forEach(function(char) {
             const role = char.toUpperCase();
             const isDominant = char === char.toUpperCase();
        %>
          <div class="profile-badge <%= isDominant ? role : 'non-dominant' %>">
            <%= char %>
          </div>
        <% }); %>
      </div>
      <div style="font-size:8pt; color:rgba(255,255,255,0.55); margin-top:5pt;">
        CAPITAL = dominant (score &gt; 30/50) · lowercase = non-dominant (≤ 30)
      </div>
    </div>
  </div>

  <div style="display:flex; align-items:center; gap:10pt; margin-bottom:12pt;">
    <span style="background:#C8102E; color:white; font-size:9pt; font-weight:700; padding:3pt 10pt; border-radius:12pt;">
      <%= interpretation.style_label %>
    </span>
    <span style="font-size:9.5pt; color:#6b7280; font-style:italic;">
      <%= interpretation.style_tagline %>
    </span>
  </div>

  <% if (interpretation.combined_description) { %>
    <p style="font-size:9.5pt; color:#374151; line-height:1.6; margin-bottom:12pt;">
      <%= interpretation.combined_description %>
    </p>
  <% } %>

  <h3 style="color:#1a1a1a; margin-bottom:10pt; font-size:10pt; text-transform:uppercase; letter-spacing:0.5pt;">
    Score Summary
  </h3>

  <table class="role-table">
    <thead>
      <tr>
        <th>Role</th>
        <th>Is (current)</th>
        <th>Should (role demands)</th>
        <th>Want (preferred)</th>
      </tr>
    </thead>
    <tbody>
      <% ['P','A','E','I'].forEach(function(role) { %>
        <tr>
          <td style="font-weight:600; color:<%= roleColors[role] %>;"><%= role %></td>
          <td><%= scaled_scores.is[role] %> / 50</td>
          <td><%= scaled_scores.should[role] %> / 50</td>
          <td><%= scaled_scores.want[role] %> / 50</td>
        </tr>
      <% }); %>
    </tbody>
  </table>

  <div class="page-footer">
    <span>Adizes India | info@adizesindia.com | www.adizesindia.com</span>
    <span>Confidential — Page 6</span>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════ -->
<!-- PAGE 7: Radar Chart                                         -->
<!-- ═══════════════════════════════════════════════════════════ -->
<div class="page page-break">
  <div class="page-header">
    <img class="logo" src="./assets/logo.png" alt="Adizes India">
    <span class="header-tagline">PAEI Management Style Indicator</span>
  </div>

  <h2 style="margin-bottom:4pt;">Style Comparison — Is / Should / Want</h2>
  <p style="font-size:8.5pt; color:#6b7280; margin-bottom:16pt;">
    Three overlapping profiles across the four PAEI dimensions. Gaps between the lines reveal tension
    between how you currently behave, what your role demands, and what you prefer.
  </p>

  <div class="chart-container" style="height:380pt;">
    <canvas id="radarChart"></canvas>
  </div>

  <div class="page-footer">
    <span>Adizes India | info@adizesindia.com | www.adizesindia.com</span>
    <span>Confidential — Page 7</span>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════ -->
<!-- PAGE 8: Gap Analysis                                        -->
<!-- ═══════════════════════════════════════════════════════════ -->
<div class="page page-break">
  <div class="page-header">
    <img class="logo" src="./assets/logo.png" alt="Adizes India">
    <span class="header-tagline">PAEI Management Style Indicator</span>
  </div>

  <h2 style="margin-bottom:4pt;">Gap Analysis</h2>
  <p style="font-size:8.5pt; color:#6b7280; margin-bottom:16pt;">
    <strong>External Gap</strong> = difference between Is (current behaviour) and Should (role demands).
    <strong>Internal Gap</strong> = difference between Should and Want (natural preference).
    Green &lt; 7 pts · Yellow 7–14 pts · Red 15+ pts.
  </p>

  <div class="chart-container" style="height:220pt; margin-bottom:18pt;">
    <canvas id="barChart"></canvas>
  </div>

  <table class="gap-table">
    <thead>
      <tr>
        <th>Role</th>
        <th>Is</th>
        <th>Should</th>
        <th>External Gap</th>
        <th>Severity</th>
        <th>Internal Gap</th>
        <th>Severity</th>
      </tr>
    </thead>
    <tbody>
      <% gaps.forEach(function(g) { %>
        <tr>
          <td style="font-weight:600;"><%= g.role_name %></td>
          <td><%= g.is_score %></td>
          <td><%= g.should_score %></td>
          <td style="text-align:center;"><%= g.external_gap > 0 ? '+' : '' %><%= g.external_gap %></td>
          <td><span class="severity-badge <%= g.external_severity %>"><%= g.external_severity %></span></td>
          <td style="text-align:center;"><%= g.internal_gap > 0 ? '+' : '' %><%= g.internal_gap %></td>
          <td><span class="severity-badge <%= g.internal_severity %>"><%= g.internal_severity %></span></td>
        </tr>
        <% if (g.external_message || g.internal_message) { %>
          <tr>
            <td></td>
            <td colspan="3" style="font-size:8pt; color:#6b7280; font-style:italic; padding-top:2pt;">
              <%= g.external_message %>
            </td>
            <td></td>
            <td colspan="2" style="font-size:8pt; color:#6b7280; font-style:italic; padding-top:2pt;">
              <%= g.internal_message %>
            </td>
          </tr>
        <% } %>
      <% }); %>
    </tbody>
  </table>

  <div class="page-footer">
    <span>Adizes India | info@adizesindia.com | www.adizesindia.com</span>
    <span>Confidential — Page 8</span>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════ -->
<!-- PAGE 9: Style Interpretation                                -->
<!-- ═══════════════════════════════════════════════════════════ -->
<div class="page">
  <div class="page-header">
    <img class="logo" src="./assets/logo.png" alt="Adizes India">
    <span class="header-tagline">PAEI Management Style Indicator</span>
  </div>

  <h2 style="margin-bottom:6pt;">Style Interpretation — <%= interpretation.style_label %></h2>
  <p style="font-size:8.5pt; color:#6b7280; margin-bottom:14pt; font-style:italic;">
    "<%= interpretation.style_tagline %>"
  </p>

  <div class="interp-grid">
    <div class="interp-card strengths">
      <h3>✓ Strengths</h3>
      <p><%= interpretation.strengths %></p>
    </div>
    <div class="interp-card blind-spots">
      <h3>⚠ Blind Spots</h3>
      <p><%= interpretation.blind_spots %></p>
    </div>
    <div class="interp-card working-with">
      <h3>⟳ Working with Others</h3>
      <p><%= interpretation.working_with_others %></p>
    </div>
  </div>

  <% if (interpretation.mismanagement_risks && interpretation.mismanagement_risks.length > 0) { %>
    <div style="margin-top:14pt;">
      <h3 style="font-size:9pt; text-transform:uppercase; letter-spacing:0.5pt; color:#6b7280; margin-bottom:8pt;">
        Mismanagement Risk Under Stress
      </h3>
      <% interpretation.mismanagement_risks.forEach(function(risk) { %>
        <div class="risk-item"><%= risk %></div>
      <% }); %>
    </div>
  <% } %>

  <div style="margin-top:20pt; padding:12pt; background:#f9fafb; border-radius:6pt; border:1px solid #e5e7eb;">
    <p style="font-size:8pt; color:#6b7280; line-height:1.6;">
      <strong>How to use this report:</strong> Your PAEI profile is a tool for self-awareness, not a fixed label.
      Strengths can become liabilities when over-used. Blind spots are growth opportunities. Use this report
      to open conversations with colleagues, coaches, and managers — not to limit yourself or others.
    </p>
  </div>

  <div class="page-footer">
    <span>Adizes India | info@adizesindia.com | www.adizesindia.com</span>
    <span>Confidential — Page 9</span>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════ -->
<!-- Chart.js — injected after page load in index.js            -->
<!-- ═══════════════════════════════════════════════════════════ -->
<script>
  // initCharts() is called by the Lambda handler after injecting Chart.js via page.addScriptTag()
  // It renders both charts, then sets window.__chartsReady = true as the Puppeteer readiness signal.
  function initCharts(scaledScores, gaps) {
    // ── Radar Chart ────────────────────────────────────────────
    const radarCtx = document.getElementById('radarChart').getContext('2d');
    new Chart(radarCtx, {
      type: 'radar',
      data: {
        labels: ['Producer (P)', 'Administrator (A)', 'Entrepreneur (E)', 'Integrator (I)'],
        datasets: [
          {
            label: 'Is',
            data: [scaledScores.is.P, scaledScores.is.A, scaledScores.is.E, scaledScores.is.I],
            borderColor: '#C8102E',
            backgroundColor: 'rgba(200,16,46,0.15)',
            borderWidth: 2,
            pointRadius: 4,
          },
          {
            label: 'Should',
            data: [scaledScores.should.P, scaledScores.should.A, scaledScores.should.E, scaledScores.should.I],
            borderColor: '#1D3557',
            backgroundColor: 'rgba(29,53,87,0.15)',
            borderWidth: 2,
            pointRadius: 4,
          },
          {
            label: 'Want',
            data: [scaledScores.want.P, scaledScores.want.A, scaledScores.want.E, scaledScores.want.I],
            borderColor: '#E87722',
            backgroundColor: 'rgba(232,119,34,0.15)',
            borderWidth: 2,
            pointRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          r: {
            min: 0,
            max: 50,
            ticks: { stepSize: 10 },
          },
        },
        plugins: {
          legend: { position: 'bottom' },
        },
        animation: false,
      },
    });

    // ── Bar Chart (Gap Analysis) ────────────────────────────────
    const barCtx = document.getElementById('barChart').getContext('2d');
    new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: gaps.map(g => g.role_name),
        datasets: [
          {
            label: 'Is',
            data: gaps.map(g => g.is_score),
            backgroundColor: '#C8102E',
            borderRadius: 3,
          },
          {
            label: 'Should',
            data: gaps.map(g => g.should_score),
            backgroundColor: '#1D3557',
            borderRadius: 3,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          x: { min: 0, max: 50 },
        },
        plugins: {
          legend: { position: 'bottom' },
        },
        animation: false,
      },
    });

    // Signal to Puppeteer that charts are fully rendered
    window.__chartsReady = true;
  }
</script>

</body>
</html>
```

- [ ] **Step 2: Verify EJS syntax — no runtime errors**

Manually scan for matched `<% %>` tags and correct EJS expressions. Key patterns to check:
- `profile.want` used on page 6 (ensure it's not `profile['want']`)
- `scaled_scores.is.P` — note `is` is a reserved word in some JS contexts; ensure no conflicts (it's an object property, so `scaled_scores.is.P` is valid)
- `interpretation.mismanagement_risks.length > 0` guard present on page 9

- [ ] **Step 3: Commit template**

```bash
cd /Users/vrln/adizes-backend
git add lambda/pdf-generator/template/report.html
git commit -m "feat(lambda): add 9-page AMSI EJS report template with Chart.js charts"
```

---

## Chunk 3: Lambda Handler

### Task 6: Write `index.js`

**Files:**
- Create: `lambda/pdf-generator/index.js`

Key implementation notes before writing:
- `puppeteer.executablePath()` is used (not a hardcoded path) — Chrome is downloaded into `PUPPETEER_CACHE_DIR` during `npm ci`.
- `page.setContent()` does NOT support `baseURL` — relative `./styles.css` and `./assets/*` refs in the HTML will break. The `inlineAssets()` helper must be called on the rendered HTML to inline CSS as `<style>` and convert all asset `src=` refs to base64 data URIs before passing to Puppeteer.
- Chart.js is injected via `page.addScriptTag({ path: CHARTJS_PATH })` after `setContent`. The `chart.js` package is in `node_modules` (added to `package.json` in Task 2).
- `window.initCharts()` is called via `page.evaluate()` after Chart.js is loaded, then `waitForFunction` waits for `window.__chartsReady === true`.
- `AWS_REGION` is auto-injected by Lambda runtime — do not set it manually in env vars.

- [ ] **Step 1: Write the complete `index.js`**

```javascript
'use strict';

const puppeteer = require('puppeteer');
const ejs = require('ejs');
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const TEMPLATE_PATH = path.join(__dirname, 'template', 'report.html');
const CHARTJS_PATH = path.join(__dirname, 'node_modules', 'chart.js', 'dist', 'chart.umd.min.js');

/**
 * Inline CSS and convert asset src= references to base64 data URIs.
 * Required because page.setContent() does not support baseURL — relative paths
 * like ./styles.css and ./assets/logo.png will not resolve without this step.
 */
function inlineAssets(html) {
  const templateDir = path.join(__dirname, 'template');

  // Inline styles.css
  const css = fs.readFileSync(path.join(templateDir, 'styles.css'), 'utf8');
  html = html.replace(
    /<link rel="stylesheet" href="\.\/styles\.css">/,
    `<style>${css}</style>`
  );

  // Convert all ./assets/*.{png,svg} references to base64 data URIs
  html = html.replace(/src="\.\/assets\/([^"]+)"/g, (_match, filename) => {
    const assetPath = path.join(templateDir, 'assets', filename);
    if (!fs.existsSync(assetPath)) {
      console.warn(`[pdf-generator] Asset not found, skipping: ${assetPath}`);
      return `src=""`;
    }
    const ext = path.extname(filename).toLowerCase();
    const mime = ext === '.svg' ? 'image/svg+xml' : `image/${ext.slice(1)}`;
    const b64 = fs.readFileSync(assetPath).toString('base64');
    return `src="data:${mime};base64,${b64}"`;
  });

  return html;
}

exports.handler = async (event) => {
  const {
    assessment_id,
    user_name,
    completed_at,
    profile,
    scaled_scores,
    gaps,
    interpretation,
  } = event;

  console.log(`[pdf-generator] Starting PDF for assessment ${assessment_id}, user: ${user_name}`);

  // ── 1. Render EJS template + inline all assets ─────────────────────────────
  const templateSrc = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const renderedHtml = ejs.render(templateSrc, {
    user_name,
    completed_at,
    profile,
    scaled_scores,
    gaps,
    interpretation,
  });
  const html = inlineAssets(renderedHtml);

  // ── 2. Launch Puppeteer ────────────────────────────────────────────────────
  // executablePath() returns the Chrome binary downloaded by 'npm ci' into
  // PUPPETEER_CACHE_DIR (/var/task/.cache/puppeteer/chrome/linux-*/chrome-linux64/chrome)
  const browser = await puppeteer.launch({
    executablePath: puppeteer.executablePath(),
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process',
      '--no-zygote',
      '--disable-setuid-sandbox',
    ],
    headless: 'new',
  });

  let pdfBytes;

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123 });  // A4 at 96dpi

    // ── 3. Load fully self-contained HTML ────────────────────────────────────
    await page.setContent(html, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    // ── 4. Inject Chart.js from local node_modules ───────────────────────────
    // Lambda has no internet access — CDN scripts would fail; inject from disk.
    await page.addScriptTag({ path: CHARTJS_PATH });

    // ── 5. Call initCharts() now that Chart.js is available ──────────────────
    await page.evaluate((ss, gapsData) => {
      window.initCharts(ss, gapsData);
    }, scaled_scores, gaps);

    // ── 6. Wait for Chart.js to finish rendering ─────────────────────────────
    // initCharts() sets window.__chartsReady = true as its last line.
    await page.waitForFunction(() => window.__chartsReady === true, {
      timeout: 10000,
    });

    // ── 7. Generate PDF bytes ─────────────────────────────────────────────────
    pdfBytes = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '18mm', bottom: '22mm', left: '15mm', right: '15mm' },
    });

    console.log(`[pdf-generator] PDF generated, size: ${pdfBytes.length} bytes`);
  } finally {
    await browser.close();
  }

  // ── 8. Upload to S3 ────────────────────────────────────────────────────────
  // AWS_REGION is auto-injected by Lambda runtime — do not set it in env vars.
  const s3 = new S3Client({ region: process.env.AWS_REGION });
  const key = `reports/${assessment_id}.pdf`;

  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key,
    Body: pdfBytes,
    ContentType: 'application/pdf',
    ACL: 'public-read',  // requires Block Public Access disabled at bucket level (see deploy checklist)
  }));

  const pdfUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  console.log(`[pdf-generator] Uploaded to S3: ${pdfUrl}`);

  // ── 9. PATCH Supabase assessments.pdf_url ─────────────────────────────────
  // Retry once — PDF is in S3 already, just need the URL stored.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const resp = await fetch(
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
      if (!resp.ok) {
        throw new Error(`Supabase PATCH returned ${resp.status}: ${await resp.text()}`);
      }
      console.log(`[pdf-generator] Supabase pdf_url updated for assessment ${assessment_id}`);
      break;
    } catch (err) {
      console.error(`[pdf-generator] Supabase PATCH attempt ${attempt} failed: ${err.message}`);
      if (attempt === 2) {
        // Non-fatal — PDF exists in S3; user can use "Check again" after manual recovery
        console.error(`[pdf-generator] Giving up on Supabase PATCH after 2 attempts`);
      }
    }
  }

  return {
    statusCode: 200,
    assessment_id,
    pdf_url: pdfUrl,
  };
};
```

- [ ] **Step 2: Commit handler**

```bash
cd /Users/vrln/adizes-backend
git add lambda/pdf-generator/index.js
git commit -m "feat(lambda): add Lambda handler with Puppeteer PDF generation, S3 upload, and Supabase PATCH"
```

---

## Chunk 4: Deploy Script + Local Test

### Task 7: Write `deploy.sh`

**Files:**
- Create: `lambda/pdf-generator/deploy.sh`

- [ ] **Step 1: Write `deploy.sh`**

```bash
#!/bin/bash
set -euo pipefail

REGION="ap-south-1"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPO="adizes-pdf-generator"
LAMBDA_NAME="adizes-pdf-generator"
LAMBDA_ROLE="arn:aws:iam::${ACCOUNT_ID}:role/adizes-pdf-lambda-role"
IMAGE_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${ECR_REPO}:latest"

# ── Required environment variables ────────────────────────────────────────────
: "${SUPABASE_URL:?Need to set SUPABASE_URL}"
: "${SUPABASE_SERVICE_ROLE_KEY:?Need to set SUPABASE_SERVICE_ROLE_KEY}"
: "${S3_BUCKET_NAME:?Need to set S3_BUCKET_NAME}"

# ── Copy logo from frontend repo ───────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOGO_SRC="${SCRIPT_DIR}/../../../adizes-frontend/public/logo.png"
if [ -f "$LOGO_SRC" ]; then
  cp "$LOGO_SRC" "${SCRIPT_DIR}/template/assets/logo.png"
  echo "✓ Copied logo from $LOGO_SRC"
else
  echo "⚠ Logo not found at $LOGO_SRC — using existing asset if present"
fi

# ── Authenticate Docker to ECR ─────────────────────────────────────────────────
aws ecr get-login-password --region "$REGION" | \
  docker login --username AWS --password-stdin \
  "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

# ── Create ECR repository if it doesn't exist ─────────────────────────────────
aws ecr describe-repositories --repository-names "$ECR_REPO" \
  --region "$REGION" 2>/dev/null || \
  aws ecr create-repository --repository-name "$ECR_REPO" \
  --region "$REGION" --image-scanning-configuration scanOnPush=true

# ── Build for linux/amd64 and push ────────────────────────────────────────────
docker build --platform linux/amd64 -t "$IMAGE_URI" "$SCRIPT_DIR"
docker push "$IMAGE_URI"

# ── Create Lambda (first deploy) or update image URI (subsequent deploys) ──────
if aws lambda get-function --function-name "$LAMBDA_NAME" --region "$REGION" 2>/dev/null; then
  echo "Updating existing Lambda function..."
  aws lambda update-function-code \
    --function-name "$LAMBDA_NAME" \
    --image-uri "$IMAGE_URI" \
    --region "$REGION"
  aws lambda wait function-updated \
    --function-name "$LAMBDA_NAME" \
    --region "$REGION"
  aws lambda update-function-configuration \
    --function-name "$LAMBDA_NAME" \
    --timeout 60 \
    --memory-size 1024 \
    --region "$REGION" \
    --environment "Variables={SUPABASE_URL=${SUPABASE_URL},SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY},S3_BUCKET_NAME=${S3_BUCKET_NAME}}"
else
  echo "Creating new Lambda function..."
  aws lambda create-function \
    --function-name "$LAMBDA_NAME" \
    --package-type Image \
    --code "ImageUri=${IMAGE_URI}" \
    --role "$LAMBDA_ROLE" \
    --timeout 60 \
    --memory-size 1024 \
    --architectures x86_64 \
    --region "$REGION" \
    --environment "Variables={SUPABASE_URL=${SUPABASE_URL},SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY},S3_BUCKET_NAME=${S3_BUCKET_NAME}}"
  aws lambda wait function-active \
    --function-name "$LAMBDA_NAME" \
    --region "$REGION"
fi

echo "✓ Lambda deployed: ${LAMBDA_NAME} → ${IMAGE_URI}"
```

- [ ] **Step 2: Make executable and commit**

```bash
cd /Users/vrln/adizes-backend/lambda/pdf-generator
chmod +x deploy.sh
cd /Users/vrln/adizes-backend
git add lambda/pdf-generator/deploy.sh
git commit -m "feat(lambda): add deploy.sh for ECR + Lambda deployment"
```

---

### Task 8: Local Docker smoke test

**Files:**
- (no file changes — test only)

This tests the Docker image builds and the handler can be invoked locally before AWS deployment.

- [ ] **Step 1: Copy logo for local test**

```bash
cp /Users/vrln/adizes-frontend/public/logo.png \
   /Users/vrln/adizes-backend/lambda/pdf-generator/template/assets/logo.png
```

- [ ] **Step 2: Build Docker image locally**

```bash
cd /Users/vrln/adizes-backend/lambda/pdf-generator
docker build --platform linux/amd64 -t adizes-pdf-generator-test .
```

Expected: Build completes with no errors. Chrome downloads during `npm ci` step (~200MB).

- [ ] **Step 3: Start local Lambda emulator**

```bash
docker run --rm -p 9000:8080 \
  -e SUPABASE_URL=http://host.docker.internal:54321 \
  -e SUPABASE_SERVICE_ROLE_KEY=your_service_role_key \
  -e S3_BUCKET_NAME=adizes-pdf-reports \
  -e AWS_ACCESS_KEY_ID=test \
  -e AWS_SECRET_ACCESS_KEY=test \
  -e AWS_REGION=ap-south-1 \
  adizes-pdf-generator-test
```

- [ ] **Step 4: Invoke with test payload**

```bash
curl -s -XPOST "http://localhost:9000/2015-03-31/functions/function/invocations" \
  -H "Content-Type: application/json" \
  -d '{
    "assessment_id": "test-00000000-0000-0000-0000-000000000001",
    "user_name": "Test User",
    "completed_at": "2026-03-12T08:45:23.123456+00:00",
    "profile": { "is": "paEI", "should": "Paei", "want": "paei" },
    "scaled_scores": {
      "is":     { "P": 20, "A": 15, "E": 35, "I": 40 },
      "should": { "P": 25, "A": 30, "E": 20, "I": 35 },
      "want":   { "P": 18, "A": 12, "E": 28, "I": 42 }
    },
    "gaps": [
      { "role": "P", "role_name": "Producer", "is_score": 20, "should_score": 25, "want_score": 18,
        "external_gap": 5, "internal_gap": 7, "external_severity": "watch", "internal_severity": "watch",
        "external_message": "Moderate gap.", "internal_message": "Slight mismatch." }
    ],
    "interpretation": {
      "dominant_roles": ["I"],
      "style_label": "Integrator",
      "style_tagline": "The Cohesive Shepherd",
      "strengths": "Builds cohesion and consensus.",
      "blind_spots": "May avoid conflict.",
      "working_with_others": "Respect directness of P, structure of A.",
      "combined_description": null,
      "mismanagement_risks": ["Super-Follower under stress."]
    }
  }'
```

Expected: Lambda returns an error from the S3 upload step (AWS credentials are fake). The key thing to verify is that Puppeteer ran successfully — check the container stdout for:

```
[pdf-generator] Starting PDF for assessment test-...
[pdf-generator] PDF generated, size: NNNNNN bytes
```

If those two lines appear before the S3 error, Puppeteer + Chart.js + EJS rendering all worked correctly. The S3 error is expected with fake credentials.

- [ ] **Step 5: Add logo.png to .gitignore (it's binary and copied at deploy time)**

Add to `lambda/pdf-generator/.gitignore`:
```
node_modules/
.cache/
template/assets/logo.png
```

```bash
cd /Users/vrln/adizes-backend
git add lambda/pdf-generator/.gitignore
git commit -m "chore(lambda): exclude logo.png from git (copied at deploy time)"
```

---

## Chunk 5: FastAPI Changes

### Task 9: Update `app/config.py`

**Files:**
- Modify: `app/config.py`

Current file has 5 fields. Add 4 AWS fields.

- [ ] **Step 1: Edit `app/config.py`**

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    supabase_jwt_secret: str
    frontend_url: str = "http://localhost:5173"
    # AWS Lambda PDF trigger
    aws_region: str = "ap-south-1"
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    pdf_lambda_function_name: str = "adizes-pdf-generator"

    class Config:
        env_file = ".env"


settings = Settings()
```

- [ ] **Step 2: Verify app still loads — run in Docker**

```bash
cd /Users/vrln/adizes-backend
docker compose up --build -d
curl -s http://localhost:8000/docs | head -5
```

Expected: FastAPI Swagger HTML returned (settings still loads with empty AWS defaults).

- [ ] **Step 3: Commit**

```bash
git add app/config.py
git commit -m "feat(backend): add AWS Lambda settings to config.py"
```

---

### Task 10: Update `app/schemas/results.py` and `app/routers/results.py`

**Files:**
- Modify: `app/schemas/results.py` (add `pdf_url` field)
- Modify: `app/routers/results.py` (pass `pdf_url` through)

- [ ] **Step 1: Add `pdf_url` to `ResultResponse` in `app/schemas/results.py`**

Current `ResultResponse` (lines 47–54):
```python
class ResultResponse(BaseModel):
    result_id: str
    user_name: str
    completed_at: str
    profile: Dict[str, str]
    scaled_scores: Dict
    gaps: List[GapDetail]
    interpretation: Interpretation
```

Add `pdf_url` field (add after `interpretation`):
```python
class ResultResponse(BaseModel):
    result_id: str
    user_name: str
    completed_at: str
    profile: Dict[str, str]
    scaled_scores: Dict
    gaps: List[GapDetail]
    interpretation: Interpretation
    pdf_url: Optional[str] = None
```

`Optional` is already imported at line 2 (`from typing import Dict, List, Optional`).

- [ ] **Step 2: Pass `pdf_url` through in `app/routers/results.py`**

Current `get_result` return statement (lines 36–44):
```python
return ResultResponse(
    result_id=data["id"],
    user_name=data.get("user_name", ""),
    completed_at=data["completed_at"],
    profile=data["profile"],
    scaled_scores=data["scaled_scores"],
    gaps=[GapDetail(**g) for g in data["gaps"]],
    interpretation=Interpretation(**data["interpretation"]),
)
```

Add `pdf_url` argument:
```python
return ResultResponse(
    result_id=data["id"],
    user_name=data.get("user_name", ""),
    completed_at=data["completed_at"],
    profile=data["profile"],
    scaled_scores=data["scaled_scores"],
    gaps=[GapDetail(**g) for g in data["gaps"]],
    interpretation=Interpretation(**data["interpretation"]),
    pdf_url=data.get("pdf_url"),
)
```

- [ ] **Step 3: Write a manual test against the local API**

```bash
# Ensure local env is running (supabase + backend)
# Login as user@adizes.com, get token, fetch a result:
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@adizes.com","password":"User@1234"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Fetch a known result (get result_id from previous assessment submit)
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/results/<RESULT_ID> | python3 -m json.tool
```

Expected: JSON includes `"pdf_url": null` (field present, value null since Lambda not yet triggered).

- [ ] **Step 4: Rebuild Docker and verify**

```bash
docker compose up --build -d
# Repeat the curl test above
```

- [ ] **Step 5: Commit**

```bash
cd /Users/vrln/adizes-backend
git add app/schemas/results.py app/routers/results.py
git commit -m "feat(backend): add pdf_url to ResultResponse schema and results router"
```

---

### Task 11: Update `app/routers/assessment.py` — add BackgroundTask trigger

**Files:**
- Modify: `app/routers/assessment.py`

- [ ] **Step 1: Add imports at top of file**

Current imports (lines 1–10):
```python
from fastapi import APIRouter, Depends, HTTPException, status
from app.auth import get_current_user
from app.database import supabase_admin
from app.schemas.assessment import QuestionsResponse, SubmitRequest, SubmitResponse, Section, Question, Option
from app.services.scoring import score_answers
from app.services.gap_analysis import compute_gaps
from app.services.interpretation import interpret
from app.config import settings
import uuid
from datetime import datetime, timezone
```

Replace with (add `BackgroundTasks`, `boto3`, `json`, `logging`):
```python
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from app.auth import get_current_user
from app.database import supabase_admin
from app.schemas.assessment import QuestionsResponse, SubmitRequest, SubmitResponse, Section, Question, Option
from app.services.scoring import score_answers
from app.services.gap_analysis import compute_gaps
from app.services.interpretation import interpret
from app.config import settings
import boto3
import json
import logging
import uuid
from datetime import datetime, timezone

logger = logging.getLogger(__name__)
```

- [ ] **Step 2: Add helper functions after `router = APIRouter()` line (line 12)**

Insert after `router = APIRouter()`:

```python
def _build_pdf_payload(result_id: str, user_name: str, now: str,
                        scores: dict, gaps: list, interp: dict) -> dict:
    """Build the JSON payload for the PDF Lambda function."""
    return {
        "assessment_id": result_id,
        "user_name": user_name,
        "completed_at": now,
        "profile": scores["profile"],
        "scaled_scores": scores["scaled"],
        "gaps": gaps,
        "interpretation": interp,
    }


def _trigger_pdf_lambda(assessment_id: str, payload: dict) -> None:
    """Fire-and-forget: invoke Lambda async. Non-fatal if it fails."""
    if not settings.aws_access_key_id:
        logger.info(f"[pdf-lambda] AWS credentials not configured — skipping trigger for {assessment_id}")
        return
    try:
        client = boto3.client(
            "lambda",
            region_name=settings.aws_region,
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
        )
        client.invoke(
            FunctionName=settings.pdf_lambda_function_name,
            InvocationType="Event",   # async — returns immediately
            Payload=json.dumps(payload).encode(),
        )
        logger.info(f"[pdf-lambda] Triggered async PDF generation for assessment {assessment_id}")
    except Exception as e:
        logger.error(f"[pdf-lambda] Trigger failed for assessment {assessment_id}: {e}")
        # Non-fatal — assessment saved, pdf_url stays null, user sees "Check again"
```

- [ ] **Step 3: Update `submit_assessment` signature to accept `BackgroundTasks`**

Current signature (line 85):
```python
@router.post("/submit", response_model=SubmitResponse)
def submit_assessment(body: SubmitRequest, user: dict = Depends(get_current_user)):
```

New signature:
```python
@router.post("/submit", response_model=SubmitResponse)
def submit_assessment(body: SubmitRequest, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
```

- [ ] **Step 4: Add BackgroundTask call before the `return` statement**

Current last 2 lines of `submit_assessment` (lines 178–180):
```python
    except Exception as e:
        print(f"[assessment] Completion email failed (non-fatal): {e}")

    return SubmitResponse(result_id=result_id)
```

Add `background_tasks.add_task` before the return:
```python
    except Exception as e:
        print(f"[assessment] Completion email failed (non-fatal): {e}")

    # Trigger async PDF generation in Lambda (non-blocking)
    pdf_payload = _build_pdf_payload(result_id, user_name, now, scores, gaps, interp)
    background_tasks.add_task(_trigger_pdf_lambda, result_id, pdf_payload)

    return SubmitResponse(result_id=result_id)
```

Note: `gaps` and `interp` at this point are Python dicts/lists (the raw data structures, not Pydantic models), which is what we need for JSON serialization.

- [ ] **Step 5: Verify `gaps` and `scores["profile"]` are JSON-serializable**

`score_answers()` is confirmed to return `{"raw": ..., "scaled": ..., "profile": {"is": str, "should": str, "want": str}}` — `scores["profile"]` is a plain dict with string values, safe for `json.dumps`.

For `gaps`: the result of `compute_gaps(scores["scaled"])` — verify it returns a list of plain dicts:

```bash
grep -n "return" /Users/vrln/adizes-backend/app/services/gap_analysis.py | head -5
```

Expected: `compute_gaps` returns a list of plain dicts. If it returns Pydantic models, convert in `_build_pdf_payload`: `"gaps": [g.model_dump() for g in gaps_data]`.

Similarly for `interp` (result of `interpret()`):
```bash
grep -n "return" /Users/vrln/adizes-backend/app/services/interpretation.py | head -5
```

Expected: `interpret()` returns a plain dict. If it returns a Pydantic model, convert with `.model_dump()`.

- [ ] **Step 6: Rebuild Docker and test submit endpoint**

```bash
cd /Users/vrln/adizes-backend
docker compose up --build -d
```

Submit a test assessment and verify:
1. Response returns `result_id` (unchanged)
2. No errors in logs (check `docker logs adizes-backend`)
3. `[pdf-lambda] AWS credentials not configured` log appears (since `.env` has empty AWS keys)

```bash
docker logs adizes-backend 2>&1 | grep pdf-lambda
```

Expected: `INFO: [pdf-lambda] AWS credentials not configured — skipping trigger for <id>`

- [ ] **Step 7: Commit**

```bash
git add app/routers/assessment.py
git commit -m "feat(backend): trigger Lambda PDF generation as BackgroundTask after assessment submit"
```

---

## Chunk 6: Frontend Changes

### Task 12: Update TypeScript API types

**Files:**
- Modify: `src/types/api.ts`

- [ ] **Step 1: Add `pdf_url` to `ResultResponse` interface**

Current `ResultResponse` (lines 74–82):
```typescript
export interface ResultResponse {
  result_id: string;
  user_name: string;
  completed_at: string;
  profile: { is: string; should: string; want: string };
  scaled_scores: { is: ScoreSet; should: ScoreSet; want: ScoreSet };
  gaps: GapDetail[];
  interpretation: Interpretation;
}
```

Add `pdf_url`:
```typescript
export interface ResultResponse {
  result_id: string;
  user_name: string;
  completed_at: string;
  profile: { is: string; should: string; want: string };
  scaled_scores: { is: ScoreSet; should: ScoreSet; want: ScoreSet };
  gaps: GapDetail[];
  interpretation: Interpretation;
  pdf_url: string | null;
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/vrln/adizes-frontend
git add src/types/api.ts
git commit -m "feat(frontend): add pdf_url to ResultResponse TypeScript type"
```

---

### Task 13: Update `src/api/results.ts` — remove `downloadPdf`

**Files:**
- Modify: `src/api/results.ts`

The `downloadPdf()` streaming helper is removed entirely. The PDF is now a direct S3 URL in `result.pdf_url`. No new API function needed.

- [ ] **Step 1: Remove `downloadPdf()` from `results.ts`**

Current file contents:
```typescript
import { apiClient } from "./client";
import type { ResultResponse, MyAssessmentItem } from "@/types/api";

export async function getResult(resultId: string): Promise<ResultResponse> {
  const { data } = await apiClient.get<ResultResponse>(`/results/${resultId}`);
  return data;
}

export async function getMyAssessments(): Promise<MyAssessmentItem[]> {
  const { data } = await apiClient.get<MyAssessmentItem[]>("/auth/my-assessments");
  return data;
}

export async function downloadPdf(resultId: string, userName: string): Promise<void> {
  // ... blob download logic ...
}
```

New file contents (remove `downloadPdf`, keep the rest):
```typescript
import { apiClient } from "./client";
import type { ResultResponse, MyAssessmentItem } from "@/types/api";

export async function getResult(resultId: string): Promise<ResultResponse> {
  const { data } = await apiClient.get<ResultResponse>(`/results/${resultId}`);
  return data;
}

export async function getMyAssessments(): Promise<MyAssessmentItem[]> {
  const { data } = await apiClient.get<MyAssessmentItem[]>("/auth/my-assessments");
  return data;
}
```

- [ ] **Step 2: Check for other imports of `downloadPdf`**

```bash
grep -rn "downloadPdf" /Users/vrln/adizes-frontend/src/
```

Expected: Only `Results.tsx` and `AdminRespondent.tsx` import it. These will be updated in the next task.

- [ ] **Step 3: Commit**

```bash
cd /Users/vrln/adizes-frontend
git add src/api/results.ts
git commit -m "feat(frontend): remove downloadPdf from results API (replaced by direct S3 URL)"
```

---

### Task 14: Update `Results.tsx` — PDF button state machine

**Files:**
- Modify: `src/pages/Results.tsx`

- [ ] **Step 1: Update imports** — remove `downloadPdf` import, keep everything else

Current line 17:
```typescript
import { getResult, downloadPdf } from "@/api/results";
```

New:
```typescript
import { getResult } from "@/api/results";
```

- [ ] **Step 2: Replace state variables** — remove `pdfLoading`, add `pdfUrl` and `checkingPdf`

Current state (lines 26–27):
```typescript
const [pdfLoading, setPdfLoading] = useState(false);
const [error, setError] = useState("");
```

New:
```typescript
const [pdfUrl, setPdfUrl] = useState<string | null>(null);
const [checkingPdf, setCheckingPdf] = useState(false);
const [pdfCheckMessage, setPdfCheckMessage] = useState("");
const [error, setError] = useState("");
```

- [ ] **Step 3: Initialise `pdfUrl` from the result after fetch**

Current `useEffect` (lines 32–42):
```typescript
useEffect(() => {
  if (!id) {
    setError("No result found. Please complete the assessment first.");
    setLoading(false);
    return;
  }
  getResult(id)
    .then(setResult)
    .catch(() => setError("Failed to load results. Please try again."))
    .finally(() => setLoading(false));
}, [id]);
```

New (also call `setPdfUrl` from result):
```typescript
useEffect(() => {
  if (!id) {
    setError("No result found. Please complete the assessment first.");
    setLoading(false);
    return;
  }
  getResult(id)
    .then((r) => {
      setResult(r);
      setPdfUrl(r.pdf_url);
    })
    .catch(() => setError("Failed to load results. Please try again."))
    .finally(() => setLoading(false));
}, [id]);
```

- [ ] **Step 4: Replace `handleDownloadPdf` with `handleCheckAgain`**

Remove `handleDownloadPdf`. Add `handleCheckAgain`:
```typescript
const handleCheckAgain = async () => {
  if (!id) return;
  setCheckingPdf(true);
  setPdfCheckMessage("");
  try {
    const r = await getResult(id);
    if (r.pdf_url) {
      setPdfUrl(r.pdf_url);
      setPdfCheckMessage("");
    } else {
      setPdfCheckMessage("Still generating, try again shortly.");
    }
  } catch {
    setPdfCheckMessage("Could not check status. Please try again.");
  } finally {
    setCheckingPdf(false);
  }
};
```

- [ ] **Step 5: Replace the sticky bottom bar button JSX**

Current sticky bar (lines 298–317):
```tsx
<div className="fixed bottom-0 left-0 right-0 ...">
  <div className="...">
    <div className="hidden sm:block">
      <p className="text-sm font-medium text-gray-900">Ready to dive deeper?</p>
      <p className="text-xs text-gray-500">Download your comprehensive report.</p>
    </div>
    <Button
      size="lg"
      onClick={handleDownloadPdf}
      disabled={pdfLoading}
      className="w-full sm:w-auto shadow-md hover:shadow-lg transition-all"
    >
      {pdfLoading
        ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Generating…</>
        : <><Download className="mr-2 h-5 w-5" /> Download Full Report (PDF)</>
      }
    </Button>
  </div>
</div>
```

New sticky bar:
```tsx
<div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)] z-50">
  <div className="mx-auto max-w-7xl flex items-center justify-between px-4 sm:px-6 lg:px-8">
    <div className="hidden sm:block">
      <p className="text-sm font-medium text-gray-900">Your PDF report</p>
      {pdfUrl
        ? <p className="text-xs text-gray-500">Ready to download.</p>
        : <p className="text-xs text-gray-500">Being generated in the background.</p>
      }
    </div>
    <div className="flex flex-col items-end gap-1">
      {pdfUrl ? (
        <Button
          size="lg"
          onClick={() => window.open(pdfUrl, "_blank")}
          className="w-full sm:w-auto shadow-md hover:shadow-lg transition-all"
        >
          <Download className="mr-2 h-5 w-5" /> Download Full Report (PDF)
        </Button>
      ) : (
        <Button
          size="lg"
          disabled
          className="w-full sm:w-auto opacity-60 cursor-not-allowed"
        >
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Generating report…
        </Button>
      )}
      {!pdfUrl && (
        <button
          onClick={handleCheckAgain}
          disabled={checkingPdf}
          className="text-xs text-primary hover:underline disabled:opacity-50"
        >
          {checkingPdf ? "Checking…" : "Check again"}
        </button>
      )}
      {pdfCheckMessage && (
        <p className="text-xs text-gray-500">{pdfCheckMessage}</p>
      )}
    </div>
  </div>
</div>
```

- [ ] **Step 6: Run TypeScript check**

```bash
cd /Users/vrln/adizes-frontend
npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Results.tsx
git commit -m "feat(frontend): replace downloadPdf with S3 pdf_url state machine in Results page"
```

---

### Task 15: Update `AdminRespondent.tsx` — same PDF state machine

**Files:**
- Modify: `src/pages/AdminRespondent.tsx`

- [ ] **Step 1: Remove `downloadPdf` import**

Current line 27:
```typescript
import { downloadPdf } from "@/api/results";
```

Remove this line entirely.

- [ ] **Step 2: Update `RespondentData` interface — add `pdf_url` to result**

Current `result` type in `RespondentData` (lines 32–40):
```typescript
result: {
  id: string;
  user_name: string;
  completed_at: string;
  profile: { is: string; should: string; want: string };
  scaled_scores: { is: ScoreSet; should: ScoreSet; want: ScoreSet };
  gaps: GapDetail[];
  interpretation: Interpretation;
};
```

Add `pdf_url`:
```typescript
result: {
  id: string;
  user_name: string;
  completed_at: string;
  profile: { is: string; should: string; want: string };
  scaled_scores: { is: ScoreSet; should: ScoreSet; want: ScoreSet };
  gaps: GapDetail[];
  interpretation: Interpretation;
  pdf_url: string | null;
};
```

- [ ] **Step 3: Replace state variables and handlers**

Remove:
```typescript
const [pdfLoading, setPdfLoading] = useState(false);
```

Add:
```typescript
const [pdfUrl, setPdfUrl] = useState<string | null>(null);
const [checkingPdf, setCheckingPdf] = useState(false);
const [pdfCheckMessage, setPdfCheckMessage] = useState("");
```

Replace `handleDownloadPdf`:
```typescript
const handleCheckAgain = async () => {
  if (!id) return;
  setCheckingPdf(true);
  setPdfCheckMessage("");
  try {
    const fresh = await getRespondent(id);
    if (fresh.result.pdf_url) {
      setPdfUrl(fresh.result.pdf_url);
      setPdfCheckMessage("");
    } else {
      setPdfCheckMessage("Still generating, try again shortly.");
    }
  } catch {
    setPdfCheckMessage("Could not check status.");
  } finally {
    setCheckingPdf(false);
  }
};
```

- [ ] **Step 4: Initialise `pdfUrl` from fetched data**

In the `useEffect`, after `setData(d)`, add:
```typescript
.then((d) => {
  setData(d);
  setPdfUrl(d.result.pdf_url);
})
```

- [ ] **Step 5: Replace PDF button in the header actions area**

Current (lines 159–164):
```tsx
<Button variant="outline" onClick={handleDownloadPdf} disabled={pdfLoading}>
  {pdfLoading
    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…</>
    : <><Download className="mr-2 h-4 w-4" /> PDF Report</>
  }
</Button>
```

New:
```tsx
<div className="flex flex-col items-end gap-1">
  {pdfUrl ? (
    <Button variant="outline" onClick={() => window.open(pdfUrl, "_blank")}>
      <Download className="mr-2 h-4 w-4" /> PDF Report
    </Button>
  ) : (
    <Button variant="outline" disabled className="opacity-60">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…
    </Button>
  )}
  {!pdfUrl && (
    <button
      onClick={handleCheckAgain}
      disabled={checkingPdf}
      className="text-xs text-primary hover:underline disabled:opacity-50"
    >
      {checkingPdf ? "Checking…" : "Check again"}
    </button>
  )}
  {pdfCheckMessage && (
    <p className="text-xs text-gray-500">{pdfCheckMessage}</p>
  )}
</div>
```

- [ ] **Step 6: Import `getRespondent` for re-fetch in `handleCheckAgain`**

`getRespondent` is already imported from `@/api/admin` (line 26). No new import needed.

- [ ] **Step 7: Run TypeScript check**

```bash
cd /Users/vrln/adizes-frontend
npx tsc --noEmit 2>&1 | head -20
```

Expected: No TypeScript errors.

- [ ] **Step 8: Run dev server and manually verify the UI**

```bash
npm run dev
```

Navigate to a Results page:
- If `pdf_url` is null → button shows "Generating report…" (disabled) + "Check again" link
- Click "Check again" → should show "Still generating, try again shortly." (since Lambda not deployed)
- If `pdf_url` is set (test by manually patching the DB) → button shows "Download Full Report (PDF)" and opens URL in new tab

- [ ] **Step 9: Commit**

```bash
cd /Users/vrln/adizes-frontend
git add src/pages/AdminRespondent.tsx
git commit -m "feat(frontend): replace downloadPdf with S3 pdf_url state machine in AdminRespondent"
```

---

## Infrastructure Checklist (Manual AWS Steps)

These must be completed before running `deploy.sh` in production. Document in a `README.md` in `lambda/pdf-generator/`:

- [ ] **IAM: Create `adizes-pdf-lambda-role`**

```bash
# Create role with Lambda trust policy
aws iam create-role \
  --role-name adizes-pdf-lambda-role \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}'

# Attach basic execution (CloudWatch logs)
aws iam attach-role-policy \
  --role-name adizes-pdf-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Create S3 put policy
aws iam put-role-policy \
  --role-name adizes-pdf-lambda-role \
  --policy-name S3PdfReports \
  --policy-document '{
    "Version":"2012-10-17",
    "Statement":[{
      "Effect":"Allow",
      "Action":["s3:PutObject","s3:PutObjectAcl"],
      "Resource":"arn:aws:s3:::adizes-pdf-reports/reports/*"
    }]
  }'
```

- [ ] **S3: Create bucket and disable Block Public Access**

```bash
aws s3api create-bucket \
  --bucket adizes-pdf-reports \
  --region ap-south-1 \
  --create-bucket-configuration LocationConstraint=ap-south-1

aws s3api put-public-access-block \
  --bucket adizes-pdf-reports \
  --public-access-block-configuration "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"
```

- [ ] **IAM: Create FastAPI IAM user with `lambda:InvokeFunction` permission**

```bash
aws iam create-user --user-name adizes-backend-lambda-invoker
aws iam put-user-policy \
  --user-name adizes-backend-lambda-invoker \
  --policy-name InvokePdfLambda \
  --policy-document '{
    "Version":"2012-10-17",
    "Statement":[{
      "Effect":"Allow",
      "Action":"lambda:InvokeFunction",
      "Resource":"arn:aws:lambda:ap-south-1:*:function:adizes-pdf-generator"
    }]
  }'
aws iam create-access-key --user-name adizes-backend-lambda-invoker
# Copy AccessKeyId and SecretAccessKey to .env
```

- [ ] **`.env` / Render env vars: Add AWS fields**

```
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=ap-south-1
PDF_LAMBDA_FUNCTION_NAME=adizes-pdf-generator
```

- [ ] **Deploy Lambda**

```bash
cd /Users/vrln/adizes-backend/lambda/pdf-generator
export SUPABASE_URL=https://xxx.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=eyJ...
export S3_BUCKET_NAME=adizes-pdf-reports
bash deploy.sh
```

- [ ] **Smoke test deployed Lambda via AWS CLI**

```bash
aws lambda invoke \
  --function-name adizes-pdf-generator \
  --invocation-type RequestResponse \
  --payload file://test-payload.json \
  --region ap-south-1 \
  output.json && cat output.json
```

Expected: `{"statusCode":200,"assessment_id":"...","pdf_url":"https://adizes-pdf-reports.s3..."}` and `assessments.pdf_url` updated in Supabase.
