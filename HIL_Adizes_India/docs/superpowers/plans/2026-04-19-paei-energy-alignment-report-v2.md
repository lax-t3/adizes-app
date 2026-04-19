# PAEI Energy Alignment Profile — Report v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `lambda/pdf-generator-v2/` — a new AWS Lambda function that generates the redesigned 5-page PAEI Energy Alignment Profile PDF, deployable as `adizes-pdf-generator-v2` without touching v1.

**Architecture:** All tension logic is computed in a pure JS library (`lib/tensions.js`) before EJS rendering. The Lambda handler assembles computed data and passes it to the template; the template is display-only with no logic. Puppeteer + S3 + Supabase wiring is identical to v1; Chart.js is removed entirely.

**Tech Stack:** Node.js 20, Puppeteer + `@sparticuz/chromium`, EJS, `@aws-sdk/client-s3`, AWS Lambda container image (ECR). No Chart.js.

**Spec:** `HIL_Adizes_India/docs/superpowers/specs/2026-04-19-paei-energy-alignment-report-v2-design.md`

**Working directory for all tasks:** `/Users/vrln/adizes-backend`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `lambda/pdf-generator-v2/lib/tensions.js` | Create | Tension calculation, classification, action path — pure JS |
| `lambda/pdf-generator-v2/lib/tensions.test.js` | Create | Unit tests for tensions.js |
| `lambda/pdf-generator-v2/template/styles.css` | Create | All CSS for 5-page report |
| `lambda/pdf-generator-v2/template/report.html` | Create | EJS template — 5 pages |
| `lambda/pdf-generator-v2/template/assets/logo.png` | Copy from v1 | HILeadership logo |
| `lambda/pdf-generator-v2/index.js` | Create | Lambda handler — assembles data, renders EJS, Puppeteer → S3 → Supabase |
| `lambda/pdf-generator-v2/test-local.js` | Create | Local end-to-end test (no S3/Supabase) |
| `lambda/pdf-generator-v2/package.json` | Create | Deps: same as v1 minus chart.js |
| `lambda/pdf-generator-v2/Dockerfile` | Create | Identical to v1 |
| `lambda/pdf-generator-v2/deploy.sh` | Create | Deploys as `adizes-pdf-generator-v2` |

---

## Task 1: Scaffold directory, package.json, Dockerfile, copy assets

**Files:**
- Create: `lambda/pdf-generator-v2/package.json`
- Create: `lambda/pdf-generator-v2/Dockerfile`
- Create: `lambda/pdf-generator-v2/template/assets/` (copy logo from v1)

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p lambda/pdf-generator-v2/lib
mkdir -p lambda/pdf-generator-v2/template/assets
```

- [ ] **Step 2: Copy logo asset from v1**

```bash
cp lambda/pdf-generator/template/assets/logo.png lambda/pdf-generator-v2/template/assets/logo.png
```

- [ ] **Step 3: Create package.json**

Write `lambda/pdf-generator-v2/package.json`:

```json
{
  "name": "adizes-pdf-generator-v2",
  "version": "2.0.0",
  "description": "AWS Lambda PDF generator for PAEI Energy Alignment Profile (v2)",
  "main": "index.js",
  "dependencies": {
    "puppeteer-core": "^22.0.0",
    "@sparticuz/chromium": "^130.0.0",
    "ejs": "^3.1.9",
    "@aws-sdk/client-s3": "^3.0.0"
  },
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 4: Create Dockerfile** (identical to v1)

Write `lambda/pdf-generator-v2/Dockerfile`:

```dockerfile
FROM public.ecr.aws/lambda/nodejs:20

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

COPY package*.json ./
RUN npm ci

COPY index.js ./
COPY lib/ ./lib/
COPY template/ ./template/

CMD ["index.handler"]
```

- [ ] **Step 5: Install dependencies**

```bash
cd lambda/pdf-generator-v2 && npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 6: Commit**

```bash
git add lambda/pdf-generator-v2/package.json lambda/pdf-generator-v2/package-lock.json \
        lambda/pdf-generator-v2/Dockerfile \
        lambda/pdf-generator-v2/template/assets/logo.png
git commit -m "feat(pdf-v2): scaffold directory, package.json, Dockerfile, copy assets"
```

---

## Task 2: Tension calculation library + unit tests

**Files:**
- Create: `lambda/pdf-generator-v2/lib/tensions.js`
- Create: `lambda/pdf-generator-v2/lib/tensions.test.js`

- [ ] **Step 1: Write the failing test first**

Write `lambda/pdf-generator-v2/lib/tensions.test.js`:

```js
'use strict';

const assert = require('assert');
const {
  classifyTension,
  computeTensions,
  getTopTensions,
  computeActionPath,
  generateActionPathMessages,
  ROLE_NAMES,
  ROLE_COLORS,
  TYPE_LABELS,
} = require('./tensions');

// ── classifyTension ──────────────────────────────────────────────────────────
assert.strictEqual(classifyTension(0),  'aligned',  'gap=0 should be aligned');
assert.strictEqual(classifyTension(4),  'aligned',  'gap=4 should be aligned');
assert.strictEqual(classifyTension(5),  'moderate', 'gap=5 should be moderate');
assert.strictEqual(classifyTension(15), 'moderate', 'gap=15 should be moderate');
assert.strictEqual(classifyTension(16), 'high',     'gap=16 should be high');
assert.strictEqual(classifyTension(30), 'high',     'gap=30 should be high');

// ── computeTensions ──────────────────────────────────────────────────────────
const sample = {
  is:     { P: 28, A: 37, E: 34, I: 25 },
  should: { P: 22, A: 30, E: 42, I: 28 },
  want:   { P: 18, A: 42, E: 38, I: 30 },
};
const tensions = computeTensions(sample);

// P: rolePressure=|22-28|=6, energyTension=|18-22|=4, identityDrift=|18-28|=10 → peak=10 moderate
assert.strictEqual(tensions.P.rolePressure,      6);
assert.strictEqual(tensions.P.rolePressureDelta, -6);    // should-is = 22-28
assert.strictEqual(tensions.P.energyTension,     4);
assert.strictEqual(tensions.P.identityDrift,     10);
assert.strictEqual(tensions.P.primaryType,       'identityDrift');
assert.strictEqual(tensions.P.peakGap,           10);
assert.strictEqual(tensions.P.level,             'moderate');

// A: rolePressure=|30-37|=7, energyTension=|42-30|=12, identityDrift=|42-37|=5 → peak=12 moderate
assert.strictEqual(tensions.A.rolePressure,      7);
assert.strictEqual(tensions.A.energyTension,     12);
assert.strictEqual(tensions.A.energyTensionDelta, 12);   // want-should = 42-30
assert.strictEqual(tensions.A.identityDrift,     5);
assert.strictEqual(tensions.A.primaryType,       'energyTension');
assert.strictEqual(tensions.A.peakGap,           12);
assert.strictEqual(tensions.A.level,             'moderate');

// E: rolePressure=|42-34|=8, energyTension=|38-42|=4, identityDrift=|38-34|=4 → peak=8 moderate
assert.strictEqual(tensions.E.rolePressure,      8);
assert.strictEqual(tensions.E.rolePressureDelta, 8);     // should-is = 42-34
assert.strictEqual(tensions.E.primaryType,       'rolePressure');
assert.strictEqual(tensions.E.peakGap,           8);
assert.strictEqual(tensions.E.level,             'moderate');

// I: rolePressure=|28-25|=3, energyTension=|30-28|=2, identityDrift=|30-25|=5 → peak=5 moderate
assert.strictEqual(tensions.I.rolePressure,      3);
assert.strictEqual(tensions.I.identityDrift,     5);
assert.strictEqual(tensions.I.primaryType,       'identityDrift');
assert.strictEqual(tensions.I.peakGap,           5);
assert.strictEqual(tensions.I.level,             'moderate');

// ── getTopTensions ───────────────────────────────────────────────────────────
const top2 = getTopTensions(tensions, 2);
assert.strictEqual(top2.length, 2);
assert.strictEqual(top2[0].gap,  12);               // A energyTension = 12 (highest)
assert.strictEqual(top2[0].role, 'A');
assert.strictEqual(top2[0].type, 'energyTension');
assert.strictEqual(top2[1].gap,  10);               // P identityDrift = 10 (second)
assert.strictEqual(top2[1].role, 'P');
assert.strictEqual(top2[1].type, 'identityDrift');
assert.ok(typeof top2[0].level === 'string');
assert.ok(typeof top2[0].delta === 'number');

// ── computeActionPath ────────────────────────────────────────────────────────
const ap = computeActionPath(tensions);
assert.strictEqual(ap.stretchRole, 'E');  // highest rolePressure = E(8)
assert.strictEqual(ap.balanceRole, 'P');  // highest identityDrift = P(10)
assert.strictEqual(ap.protectRole, 'I');  // lowest peakGap = I(5)

// ── generateActionPathMessages ───────────────────────────────────────────────
const msgs = generateActionPathMessages(tensions, ap);
assert.ok(typeof msgs.stretch.description === 'string' && msgs.stretch.description.length > 10);
assert.ok(typeof msgs.stretch.action      === 'string' && msgs.stretch.action.length > 10);
assert.ok(typeof msgs.balance.description === 'string');
assert.ok(typeof msgs.protect.description === 'string');
assert.strictEqual(msgs.stretch.role, 'E');
assert.strictEqual(msgs.balance.role, 'P');
assert.strictEqual(msgs.protect.role, 'I');
assert.ok(typeof msgs.stretch.roleColor === 'string');

// ── constants exported ───────────────────────────────────────────────────────
assert.strictEqual(ROLE_NAMES.P, 'Producer');
assert.strictEqual(ROLE_COLORS.P, '#C8102E');
assert.strictEqual(TYPE_LABELS.rolePressure, 'Role Pressure');

console.log('All tensions tests passed ✓');
```

- [ ] **Step 2: Run test — expect failure (module not found)**

```bash
cd lambda/pdf-generator-v2 && node lib/tensions.test.js
```

Expected output: `Error: Cannot find module './tensions'`

- [ ] **Step 3: Write tensions.js**

Write `lambda/pdf-generator-v2/lib/tensions.js`:

```js
'use strict';

const ROLES = ['P', 'A', 'E', 'I'];

const ROLE_NAMES = {
  P: 'Producer',
  A: 'Administrator',
  E: 'Entrepreneur',
  I: 'Integrator',
};

const ROLE_COLORS = {
  P: '#C8102E',
  A: '#1D3557',
  E: '#E87722',
  I: '#2A9D8F',
};

// Light tint backgrounds for role card headers (used inline in EJS)
const ROLE_TINTS = {
  P: 'rgba(200,16,46,0.07)',
  A: 'rgba(29,53,87,0.07)',
  E: 'rgba(232,119,34,0.07)',
  I: 'rgba(42,157,143,0.07)',
};

const TYPE_LABELS = {
  rolePressure:  'Role Pressure',
  energyTension: 'Energy Tension',
  identityDrift: 'Identity Drift',
};

// Plain-language messages for Energy Tension (WANT vs SHOULD) — not in gaps payload
const ENERGY_TENSION_MESSAGES = {
  P: {
    high: "The role's demand for results outpaces your natural preference — sustaining this output will cost energy over time.",
    low:  "You have more results-drive than your role currently demands — channel this into areas where direct ownership adds the most value.",
  },
  A: {
    high: "Your role requires more structural rigour than feels natural — build routines and templates to carry the load.",
    low:  "You naturally gravitate toward more structure than your role requires — a strength, but avoid over-engineering what needs to stay fluid.",
  },
  E: {
    high: "Your role expects more creative and innovative thinking than you naturally lean toward — carve out deliberate exploration time.",
    low:  "You carry more entrepreneurial drive than your role currently channels — seek assignments that let you operate at that level.",
  },
  I: {
    high: "Your role demands more people-investment than feels instinctive — prioritise a small number of key relationships rather than spreading thin.",
    low:  "You have stronger integrative instincts than your role exercises — bring them into cross-functional or collaborative projects.",
  },
};

// One-line action cues per tension type, role, and direction
const ACTION_CUES = {
  rolePressure: {
    P: { high: "Take direct ownership of a critical deliverable this cycle — close the loop yourself.", low:  "Delegate execution on defined tasks and direct your energy toward the next priority." },
    A: { high: "Invest an hour this week building or refining a process your team will use repeatedly.",  low:  "Identify one area where you can reduce structural overhead to free up speed." },
    E: { high: "Propose one forward-looking idea or experiment this cycle — don't wait for permission.", low:  "Channel your entrepreneurial energy into a specific innovation project with a clear outcome." },
    I: { high: "Schedule one-to-ones with two stakeholders you have under-invested in this month.",      low:  "Balance relationship investment with task accountability — results need attention too." },
  },
  energyTension: {
    P: { high: "Look for tasks with longer time horizons that better match your natural energy.",            low:  "Direct your extra results-drive into areas where direct ownership adds the most value." },
    A: { high: "Use checklists and templates to carry the structural load — reduce the manual effort.",     low:  "Deliberately allow one area to run with less oversight this month." },
    E: { high: "Block 30 minutes per week for exploratory thinking — protect it from operational demands.", low:  "Channel your creative energy into a specific project with a clear outcome." },
    I: { high: "Prioritise two key relationships this month — depth over breadth.",                         low:  "Apply your people instincts in a cross-functional or collaborative context." },
  },
  identityDrift: {
    P: { high: "Look for ways to redirect effort toward longer-horizon work that energises you.",                    low:  "Find one project where direct execution is the right tool — own it fully and visibly." },
    A: { high: "Build systems and checklists that carry the structural load without constant manual effort.",         low:  "Bring your structural instincts to an area that currently operates without enough clarity." },
    E: { high: "Block 30 minutes per week for exploratory thinking — protect it from operational demands.",           low:  "Choose one initiative where you can operate at your natural strategic and creative level." },
    I: { high: "Invest in one meaningful team relationship that has been crowded out by delivery pressure.",          low:  "Seek a project where team cohesion is the critical success factor — your instincts are needed there." },
  },
};

// ── Core calculation ─────────────────────────────────────────────────────────

function classifyTension(gap) {
  if (gap < 5)   return 'aligned';
  if (gap <= 15) return 'moderate';
  return 'high';
}

function computeTensions(scaledScores) {
  const result = {};
  for (const role of ROLES) {
    const is     = scaledScores.is[role];
    const should = scaledScores.should[role];
    const want   = scaledScores.want[role];

    const rolePressureDelta   = should - is;   // positive = role demands more
    const energyTensionDelta  = want - should; // positive = want exceeds should
    const identityDriftDelta  = want - is;     // positive = want exceeds is

    const rolePressure  = Math.abs(rolePressureDelta);
    const energyTension = Math.abs(energyTensionDelta);
    const identityDrift = Math.abs(identityDriftDelta);

    const peakGap = Math.max(rolePressure, energyTension, identityDrift);

    let primaryType;
    if (peakGap === rolePressure)        primaryType = 'rolePressure';
    else if (peakGap === energyTension)  primaryType = 'energyTension';
    else                                  primaryType = 'identityDrift';

    // Energy tension direction: want < should means role drains; want > should means role energises
    const etDir = energyTensionDelta < 0 ? 'high' : 'low';

    result[role] = {
      is, should, want,
      rolePressure,  rolePressureDelta,
      energyTension, energyTensionDelta,
      identityDrift, identityDriftDelta,
      primaryType,
      peakGap,
      level: classifyTension(peakGap),
      energyTensionMessage: ENERGY_TENSION_MESSAGES[role][etDir],
    };
  }
  return result;
}

function getTopTensions(tensionData, n) {
  const all = [];
  for (const role of ROLES) {
    const t = tensionData[role];
    all.push({ role, type: 'rolePressure',  gap: t.rolePressure,  delta: t.rolePressureDelta,  level: classifyTension(t.rolePressure) });
    all.push({ role, type: 'energyTension', gap: t.energyTension, delta: t.energyTensionDelta, level: classifyTension(t.energyTension) });
    all.push({ role, type: 'identityDrift', gap: t.identityDrift, delta: t.identityDriftDelta, level: classifyTension(t.identityDrift) });
  }
  return all.sort((a, b) => b.gap - a.gap).slice(0, n);
}

function computeActionPath(tensionData) {
  const stretchRole = ROLES.reduce((a, b) => tensionData[a].rolePressure  >= tensionData[b].rolePressure  ? a : b);
  const balanceRole = ROLES.reduce((a, b) => tensionData[a].identityDrift >= tensionData[b].identityDrift ? a : b);
  const protectRole = ROLES.reduce((a, b) => tensionData[a].peakGap       <= tensionData[b].peakGap       ? a : b);
  return { stretchRole, balanceRole, protectRole };
}

function generateActionPathMessages(tensionData, actionPath) {
  const { stretchRole, balanceRole, protectRole } = actionPath;
  const st = tensionData[stretchRole];
  const bt = tensionData[balanceRole];

  return {
    stretch: {
      role:      stretchRole,
      roleName:  ROLE_NAMES[stretchRole],
      roleColor: ROLE_COLORS[stretchRole],
      description: st.rolePressureDelta > 0
        ? `Your role demands more ${ROLE_NAMES[stretchRole]} behaviour than you are currently expressing — the gap is activation, not capability.`
        : `You are expressing more ${ROLE_NAMES[stretchRole]} behaviour than your role requires — redirect this energy intentionally.`,
      action: ACTION_CUES.rolePressure[stretchRole][st.rolePressureDelta > 0 ? 'high' : 'low'],
    },
    balance: {
      role:      balanceRole,
      roleName:  ROLE_NAMES[balanceRole],
      roleColor: ROLE_COLORS[balanceRole],
      description: bt.identityDriftDelta > 0
        ? `You prefer more ${ROLE_NAMES[balanceRole]} engagement than you are currently expressing — find space to express it.`
        : `You are operating with more ${ROLE_NAMES[balanceRole]} behaviour than your natural self prefers — this gap costs energy over time.`,
      action: ACTION_CUES.identityDrift[balanceRole][bt.identityDriftDelta > 0 ? 'low' : 'high'],
    },
    protect: {
      role:      protectRole,
      roleName:  ROLE_NAMES[protectRole],
      roleColor: ROLE_COLORS[protectRole],
      description: `Your ${ROLE_NAMES[protectRole]} dimension shows the strongest alignment across IS, SHOULD, and WANT — this is your most stable foundation.`,
      action: `Don't sacrifice your ${ROLE_NAMES[protectRole]} strength under pressure or in pursuit of closing other gaps.`,
    },
  };
}

module.exports = {
  ROLES, ROLE_NAMES, ROLE_COLORS, ROLE_TINTS, TYPE_LABELS, ACTION_CUES,
  classifyTension, computeTensions, getTopTensions,
  computeActionPath, generateActionPathMessages,
};
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
cd lambda/pdf-generator-v2 && node lib/tensions.test.js
```

Expected output: `All tensions tests passed ✓`

- [ ] **Step 5: Commit**

```bash
git add lambda/pdf-generator-v2/lib/tensions.js lambda/pdf-generator-v2/lib/tensions.test.js
git commit -m "feat(pdf-v2): add tension calculation library with unit tests"
```

---

## Task 3: CSS

**Files:**
- Create: `lambda/pdf-generator-v2/template/styles.css`

- [ ] **Step 1: Write styles.css**

Write `lambda/pdf-generator-v2/template/styles.css`:

```css
/* ── Reset & page setup ──────────────────────────────────────── */
@page { size: A4; margin: 18mm 15mm 22mm 15mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 10pt; color: #1a1a1a; line-height: 1.5; }

/* ── Page layout ─────────────────────────────────────────────── */
.page { width: 100%; min-height: 257mm; position: relative; padding-bottom: 8mm; }
.page-break { page-break-after: always; break-after: page; }

/* ── Header ──────────────────────────────────────────────────── */
.page-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #C8102E; padding-bottom: 6pt; margin-bottom: 16pt; }
.page-header img.logo { height: 34pt; object-fit: contain; }
.header-tagline { font-size: 8pt; color: #9ca3af; text-align: right; }

/* ── Footer ──────────────────────────────────────────────────── */
.page-footer { position: absolute; bottom: 0; left: 0; right: 0; border-top: 1px solid #e5e7eb; padding-top: 5pt; font-size: 7.5pt; color: #9ca3af; display: flex; justify-content: space-between; align-items: center; }

/* ── Section label ───────────────────────────────────────────── */
.section-label { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5pt; color: #9ca3af; margin-bottom: 8pt; margin-top: 14pt; }

/* ── Headings ────────────────────────────────────────────────── */
h2 { font-size: 13pt; font-weight: 700; color: #1a1a1a; margin-bottom: 6pt; }
h3 { font-size: 10pt; font-weight: 600; color: #374151; margin-bottom: 5pt; }

/* ════════════════════════════════════════════════════════════════
   PAGE 1 — Energy Alignment Snapshot
   ════════════════════════════════════════════════════════════════ */
.snapshot-hero { margin-bottom: 12pt; }
.snapshot-name { font-size: 21pt; font-weight: 800; letter-spacing: -0.5pt; color: #1a1a1a; }
.snapshot-date { font-size: 9pt; color: #6b7280; margin-top: 2pt; margin-bottom: 8pt; }
.identity-badge { display: inline-block; background: #1a1a1a; color: white; font-size: 9pt; font-weight: 700; padding: 4pt 12pt; border-radius: 14pt; letter-spacing: 0.2pt; }

/* Matrix grid: 2×2 */
.matrix-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10pt; margin-bottom: 0; }
.matrix-card { border: 1px solid #e5e7eb; border-radius: 7pt; overflow: hidden; }
.matrix-card.highlight-P { border: 2px solid #C8102E; }
.matrix-card.highlight-A { border: 2px solid #1D3557; }
.matrix-card.highlight-E { border: 2px solid #E87722; }
.matrix-card.highlight-I { border: 2px solid #2A9D8F; }

.matrix-card-header { display: flex; align-items: center; justify-content: space-between; padding: 7pt 9pt; }
.role-circle { width: 22pt; height: 22pt; border-radius: 50%; color: white; font-size: 11pt; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.role-full-name { font-size: 9.5pt; font-weight: 700; margin-left: 6pt; flex: 1; }

/* Tension badges */
.tension-badge { font-size: 7pt; font-weight: 700; padding: 2pt 7pt; border-radius: 10pt; white-space: nowrap; }
.badge-aligned  { background: #dcfce7; color: #166534; }
.badge-moderate { background: #fef9c3; color: #854d0e; }
.badge-high     { background: #fee2e2; color: #991b1b; }

/* Mini bars */
.matrix-card-bars { padding: 8pt 9pt 9pt; background: #fafafa; }
.bar-row { display: flex; align-items: center; gap: 6pt; margin-bottom: 4pt; }
.bar-row-label { font-size: 7.5pt; font-weight: 700; color: #9ca3af; width: 42pt; flex-shrink: 0; }
.bar-track { flex: 1; height: 9pt; background: #f3f4f6; border-radius: 5pt; overflow: hidden; }
.bar-fill { height: 100%; border-radius: 5pt; }
.bar-val { font-size: 8pt; color: #374151; font-weight: 600; width: 18pt; text-align: right; flex-shrink: 0; }

/* Core insight */
.core-insight { background: #f9fafb; border-left: 3pt solid #1a1a1a; padding: 9pt 11pt; border-radius: 0 5pt 5pt 0; font-size: 9.5pt; color: #374151; line-height: 1.55; margin-bottom: 10pt; }

/* Top tension pills */
.top-tensions { display: flex; gap: 7pt; flex-wrap: wrap; }
.tension-pill { display: flex; align-items: center; gap: 5pt; background: white; border: 1px solid #e5e7eb; border-radius: 20pt; padding: 4pt 10pt; font-size: 8pt; color: #374151; }
.pill-dot { width: 8pt; height: 8pt; border-radius: 50%; flex-shrink: 0; }
.pill-dot.aligned  { background: #22c55e; }
.pill-dot.moderate { background: #f59e0b; }
.pill-dot.high     { background: #ef4444; }

/* ════════════════════════════════════════════════════════════════
   PAGE 2 — Tension Map
   ════════════════════════════════════════════════════════════════ */
.tension-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10pt; }
.tension-card { border: 1px solid #e5e7eb; border-radius: 7pt; overflow: hidden; }
.tension-card.highlight-P { border: 2px solid #C8102E; }
.tension-card.highlight-A { border: 2px solid #1D3557; }
.tension-card.highlight-E { border: 2px solid #E87722; }
.tension-card.highlight-I { border: 2px solid #2A9D8F; }

.tension-card-header { display: flex; align-items: center; justify-content: space-between; padding: 8pt 10pt; }
.tension-card-bars { padding: 9pt 10pt; background: #fafafa; border-bottom: 1px solid #f3f4f6; }
.tension-card-body  { padding: 8pt 10pt; }

/* Primary tension highlight box */
.tension-highlight { border: 1px solid #e5e7eb; border-radius: 5pt; padding: 7pt 9pt; margin-bottom: 7pt; background: white; }
.tension-highlight.moderate { border-color: #fde68a; background: #fffbeb; }
.tension-highlight.high     { border-color: #fca5a5; background: #fef2f2; }
.tension-highlight-label { font-size: 8pt; font-weight: 700; color: #374151; margin-bottom: 3pt; }
.tension-highlight-label.high     { color: #991b1b; }
.tension-highlight-label.moderate { color: #92400e; }
.tension-highlight-text { font-size: 8.5pt; color: #374151; line-height: 1.45; }

.action-cue { border-left: 2pt solid #e5e7eb; padding: 5pt 8pt; font-size: 8pt; color: #374151; font-style: italic; line-height: 1.4; }
.action-cue.P { border-color: #C8102E; }
.action-cue.A { border-color: #1D3557; }
.action-cue.E { border-color: #E87722; }
.action-cue.I { border-color: #2A9D8F; }

.well-aligned-box { font-size: 8.5pt; color: #166534; background: #f0fdf4; border: 1px solid #bbf7d0; padding: 7pt 9pt; border-radius: 5pt; }

/* ════════════════════════════════════════════════════════════════
   PAGE 3 — What This Means
   ════════════════════════════════════════════════════════════════ */
.meaning-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12pt; margin-bottom: 14pt; }
.meaning-card { border: 1px solid #e5e7eb; border-radius: 6pt; padding: 11pt; }
.meaning-card.best    h3 { color: #166534; }
.meaning-card.friction h3 { color: #92400e; }
.meaning-card p { font-size: 9pt; color: #374151; line-height: 1.6; }

.warning-card { background: #fff1f2; border-left: 3pt solid #f43f5e; padding: 6pt 10pt; border-radius: 0 4pt 4pt 0; font-size: 8.5pt; color: #374151; line-height: 1.45; margin-bottom: 5pt; }

/* ════════════════════════════════════════════════════════════════
   PAGE 4 — Style Summary
   ════════════════════════════════════════════════════════════════ */
.style-hero { background: #1a1a1a; color: white; padding: 14pt 16pt; border-radius: 6pt; margin-bottom: 14pt; }
.style-hero-label { font-size: 17pt; font-weight: 800; letter-spacing: -0.3pt; margin-bottom: 3pt; }
.style-hero-tagline { font-size: 10pt; color: rgba(255,255,255,0.65); margin-bottom: 8pt; }
.style-hero-desc { font-size: 9pt; color: rgba(255,255,255,0.85); line-height: 1.6; }

.summary-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10pt; }
.summary-card { border: 1px solid #e5e7eb; border-radius: 6pt; padding: 10pt; }
.summary-card h3 { font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.5pt; margin-bottom: 7pt; }
.summary-card.strengths h3 { color: #166534; }
.summary-card.watchouts h3 { color: #92400e; }
.summary-card.stress    h3 { color: #991b1b; }
.summary-card p { font-size: 8.5pt; color: #374151; line-height: 1.55; }

/* ════════════════════════════════════════════════════════════════
   PAGE 5 — Action Path
   ════════════════════════════════════════════════════════════════ */
.action-path-cards { display: flex; flex-direction: column; gap: 12pt; }
.action-card { border-radius: 6pt; border: 1px solid #e5e7eb; display: flex; gap: 14pt; align-items: flex-start; padding: 12pt 14pt; }
.action-card-left { flex-shrink: 0; text-align: center; width: 44pt; }
.action-icon { width: 36pt; height: 36pt; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10pt; font-weight: 800; color: white; margin: 0 auto; }
.action-type-label { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5pt; margin-top: 5pt; }
.action-type-label.stretch { color: #C8102E; }
.action-type-label.balance { color: #1D3557; }
.action-type-label.protect { color: #166534; }
.action-card-right h3 { font-size: 10pt; font-weight: 700; margin-bottom: 5pt; }
.action-card-right p { font-size: 9pt; color: #374151; line-height: 1.55; margin-bottom: 8pt; }
.action-prompt { font-size: 8.5pt; color: #374151; border-left: 2pt solid #e5e7eb; padding-left: 8pt; font-style: italic; line-height: 1.45; }
```

- [ ] **Step 2: Commit**

```bash
git add lambda/pdf-generator-v2/template/styles.css
git commit -m "feat(pdf-v2): add CSS for 5-page Energy Alignment Profile"
```

---

## Task 4: EJS Template — Pages 1 and 2

**Files:**
- Create: `lambda/pdf-generator-v2/template/report.html` (Pages 1–2 only)

- [ ] **Step 1: Write report.html with Pages 1 and 2**

Write `lambda/pdf-generator-v2/template/report.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>PAEI Energy Alignment Profile — <%= user_name %></title>
  <link rel="stylesheet" href="./styles.css">
</head>
<body>

<%
  /* Helpers available in all pages */
  function barW(score) { return Math.round(score / 50 * 100); }
  function signedDelta(d) { return (d > 0 ? '+' : '') + d; }
  function badgeText(level) {
    return level === 'high' ? 'HIGH' : level === 'moderate' ? 'MODERATE' : 'ALIGNED';
  }
  const dateStr = new Date(completed_at).toLocaleDateString('en-GB',
    { year: 'numeric', month: 'long', day: 'numeric' });
  const highestTensionRole = ROLES.reduce((a, b) =>
    tensions[a].peakGap >= tensions[b].peakGap ? a : b);
%>

<!-- ═══════════════════════════════════════════════════════════
     PAGE 1 — Energy Alignment Snapshot
     ═══════════════════════════════════════════════════════════ -->
<div class="page page-break">
  <div class="page-header">
    <img class="logo" src="./assets/logo.png" alt="HILeadership">
    <span class="header-tagline">PAEI Energy Alignment Profile</span>
  </div>

  <div class="snapshot-hero">
    <div class="snapshot-name"><%= user_name %></div>
    <div class="snapshot-date"><%= dateStr %></div>
    <div class="identity-badge"><%= identityLine %></div>
  </div>

  <div class="section-label">Energy Alignment Matrix</div>
  <div class="matrix-grid">
    <% ROLES.forEach(function(role) {
         const t = tensions[role];
         const isHighest = (role === highestTensionRole);
    %>
    <div class="matrix-card<%= isHighest ? ' highlight-' + role : '' %>">
      <div class="matrix-card-header" style="background:<%- ROLE_TINTS[role] %>;">
        <div style="display:flex;align-items:center;gap:6pt;">
          <div class="role-circle" style="background:<%- ROLE_COLORS[role] %>;"><%= role %></div>
          <span class="role-full-name"><%= ROLE_NAMES[role] %></span>
        </div>
        <span class="tension-badge badge-<%= t.level %>"><%= badgeText(t.level) %></span>
      </div>
      <div class="matrix-card-bars">
        <div class="bar-row">
          <span class="bar-row-label">IS</span>
          <div class="bar-track"><div class="bar-fill" style="width:<%- barW(t.is) %>%;background:<%- ROLE_COLORS[role] %>;"></div></div>
          <span class="bar-val"><%= t.is %></span>
        </div>
        <div class="bar-row">
          <span class="bar-row-label">SHOULD</span>
          <div class="bar-track"><div class="bar-fill" style="width:<%- barW(t.should) %>%;background:<%- ROLE_COLORS[role] %>;opacity:0.55;"></div></div>
          <span class="bar-val"><%= t.should %></span>
        </div>
        <div class="bar-row">
          <span class="bar-row-label">WANT</span>
          <div class="bar-track"><div class="bar-fill" style="width:<%- barW(t.want) %>%;background:<%- ROLE_COLORS[role] %>;opacity:0.3;"></div></div>
          <span class="bar-val"><%= t.want %></span>
        </div>
      </div>
    </div>
    <% }); %>
  </div>

  <div class="section-label">Core Insight</div>
  <div class="core-insight"><%= interpretation.combined_description || interpretation.style_tagline %></div>

  <div class="section-label">Top Tensions</div>
  <div class="top-tensions">
    <% topTensions.forEach(function(tt) { %>
    <div class="tension-pill">
      <div class="pill-dot <%= tt.level %>"></div>
      <span><%= ROLE_NAMES[tt.role] %> (<%= tt.role %>) — <%= TYPE_LABELS[tt.type] %>: <%= badgeText(tt.level) %> (<%= signedDelta(tt.delta) %>)</span>
    </div>
    <% }); %>
  </div>

  <div class="page-footer">
    <span>HILeadership | PAEI Energy Alignment Profile</span>
    <span>Confidential — Page 1</span>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════
     PAGE 2 — Tension Map
     ═══════════════════════════════════════════════════════════ -->
<div class="page page-break">
  <div class="page-header">
    <img class="logo" src="./assets/logo.png" alt="HILeadership">
    <span class="header-tagline">PAEI Energy Alignment Profile — Tension Map</span>
  </div>

  <h2 style="margin-bottom:4pt;">Tension Map</h2>
  <p style="font-size:8.5pt;color:#6b7280;margin-bottom:14pt;">
    For each role: how your current behaviour (IS), role demands (SHOULD), and natural preference (WANT) compare.
    Role Pressure = IS vs SHOULD · Energy Tension = WANT vs SHOULD · Identity Drift = WANT vs IS.
  </p>

  <div class="tension-grid">
    <% ROLES.forEach(function(role) {
         const t = tensions[role];
         const gap = gapsMap[role];
         const isHighest = (role === highestTensionRole);
         let primaryMessage = '';
         let primaryActionCue = '';
         if (t.primaryType === 'rolePressure') {
           primaryMessage   = gap ? gap.external_message : '';
           primaryActionCue = ACTION_CUES.rolePressure[role][t.rolePressureDelta > 0 ? 'high' : 'low'];
         } else if (t.primaryType === 'energyTension') {
           primaryMessage   = t.energyTensionMessage;
           primaryActionCue = ACTION_CUES.energyTension[role][t.energyTensionDelta < 0 ? 'high' : 'low'];
         } else {
           primaryMessage   = gap ? gap.internal_message : '';
           primaryActionCue = ACTION_CUES.identityDrift[role][t.identityDriftDelta > 0 ? 'low' : 'high'];
         }
    %>
    <div class="tension-card<%= isHighest ? ' highlight-' + role : '' %>">
      <div class="tension-card-header" style="background:<%- ROLE_TINTS[role] %>;">
        <div style="display:flex;align-items:center;gap:6pt;">
          <div class="role-circle" style="background:<%- ROLE_COLORS[role] %>;"><%= role %></div>
          <span class="role-full-name"><%= ROLE_NAMES[role] %></span>
        </div>
        <span class="tension-badge badge-<%= t.level %>"><%= badgeText(t.level) %></span>
      </div>
      <div class="tension-card-bars">
        <div class="bar-row">
          <span class="bar-row-label">IS</span>
          <div class="bar-track"><div class="bar-fill" style="width:<%- barW(t.is) %>%;background:<%- ROLE_COLORS[role] %>;"></div></div>
          <span class="bar-val"><%= t.is %></span>
        </div>
        <div class="bar-row">
          <span class="bar-row-label">SHOULD</span>
          <div class="bar-track"><div class="bar-fill" style="width:<%- barW(t.should) %>%;background:<%- ROLE_COLORS[role] %>;opacity:0.55;"></div></div>
          <span class="bar-val"><%= t.should %></span>
        </div>
        <div class="bar-row">
          <span class="bar-row-label">WANT</span>
          <div class="bar-track"><div class="bar-fill" style="width:<%- barW(t.want) %>%;background:<%- ROLE_COLORS[role] %>;opacity:0.3;"></div></div>
          <span class="bar-val"><%= t.want %></span>
        </div>
      </div>
      <div class="tension-card-body">
        <% if (t.level === 'aligned') { %>
        <div class="well-aligned-box">Well aligned — IS, SHOULD, and WANT are closely matched.</div>
        <% } else { %>
        <div class="tension-highlight <%= t.level %>">
          <div class="tension-highlight-label <%= t.level %>">
            <%= TYPE_LABELS[t.primaryType] %> (<%= signedDelta(
              t.primaryType === 'rolePressure'  ? t.rolePressureDelta  :
              t.primaryType === 'energyTension' ? t.energyTensionDelta :
              t.identityDriftDelta
            ) %>)
          </div>
          <div class="tension-highlight-text"><%= primaryMessage %></div>
        </div>
        <div class="action-cue <%= role %>">→ <%= primaryActionCue %></div>
        <% } %>
      </div>
    </div>
    <% }); %>
  </div>

  <div class="page-footer">
    <span>HILeadership | PAEI Energy Alignment Profile</span>
    <span>Confidential — Page 2</span>
  </div>
</div>

</body>
</html>
```

- [ ] **Step 2: Create a quick HTML preview script to verify pages 1–2 render correctly**

Write `lambda/pdf-generator-v2/preview.js` (temporary, not committed):

```js
'use strict';
const ejs = require('ejs');
const fs  = require('fs');
const path = require('path');
const {
  computeTensions, getTopTensions, computeActionPath,
  generateActionPathMessages, ROLES, ROLE_NAMES, ROLE_COLORS, ROLE_TINTS, TYPE_LABELS, ACTION_CUES,
} = require('./lib/tensions');

const scaled_scores = {
  is:     { P: 28, A: 37, E: 34, I: 25 },
  should: { P: 22, A: 30, E: 42, I: 28 },
  want:   { P: 18, A: 42, E: 38, I: 30 },
};
const interpretation = {
  dominant_roles: ['A', 'E'],
  style_label: 'Administrator',
  style_tagline: 'The Reliable Architect',
  strengths: 'You bring discipline, consistency, and rigour to everything you touch. Your ability to create systems, maintain standards, and catch errors before they become problems makes you invaluable.',
  blind_spots: 'Your preference for process and precedent can slow adaptation to change. Trust that not every decision requires a procedure — learn to tolerate calculated ambiguity and speed.',
  working_with_others: 'Producers can seem reckless — channel their energy by building systems they can operate within.',
  combined_description: 'The Innovative Organiser — you vision the future and build the systems to get there.',
  mismanagement_risks: ['Bureaucrat — may become overly rigid and change-resistant under stress.', 'Arsonist — may become impractical and idea-without-delivery under stress.'],
};
const gaps = [
  { role:'P', external_message:'Your current work style is more action-driven than your job requires.', internal_message:'You prefer more action and results than your current role allows.' },
  { role:'A', external_message:'You are more process-focused than your role demands.', internal_message:'You have a stronger preference for structure than your current role exercises.' },
  { role:'E', external_message:'Your organisation expects more entrepreneurial, visionary behaviour than you are currently showing.', internal_message:'You crave more creative freedom than your current role provides.' },
  { role:'I', external_message:'You are more people-focused than your role requires.', internal_message:'You value collaboration more than your role currently provides.' },
];

const tensions       = computeTensions(scaled_scores);
const topTensions    = getTopTensions(tensions, 2);
const actionPath     = computeActionPath(tensions);
const actionPathMsgs = generateActionPathMessages(tensions, actionPath);
const gapsMap        = {};
for (const g of gaps) gapsMap[g.role] = g;
const identityLine   = interpretation.combined_description
  ? interpretation.combined_description.split(' — ')[0].replace(/^The /, '')
  : interpretation.style_label;

const tpl = fs.readFileSync(path.join(__dirname, 'template', 'report.html'), 'utf8');
const html = ejs.render(tpl, {
  user_name: 'Erika Garcia',
  completed_at: '2026-04-19T10:00:00Z',
  profile: { is: 'pAei', should: 'paEi', want: 'pAEi' },
  scaled_scores, interpretation, gaps,
  tensions, topTensions, actionPath: actionPathMsgs, gapsMap, identityLine,
  ROLES, ROLE_NAMES, ROLE_COLORS, ROLE_TINTS, TYPE_LABELS, ACTION_CUES,
});
fs.writeFileSync('/tmp/preview.html', html);
console.log('Preview written to /tmp/preview.html — open in browser to verify.');
```

- [ ] **Step 3: Run preview and visually verify Pages 1–2 in browser**

```bash
cd lambda/pdf-generator-v2 && node preview.js
open /tmp/preview.html
```

Expected: browser opens showing Page 1 (matrix, identity line, core insight, top tensions) and Page 2 (4 role cards with bars + tension highlights).

Verify:
- All 4 role cards render in 2×2 grid
- Bars show correct colours and widths
- Tension badges show ALIGNED / MODERATE / HIGH correctly
- Highest-tension role card has a coloured border
- Core insight text appears
- Top tensions pills appear with signed deltas

- [ ] **Step 4: Commit**

```bash
git add lambda/pdf-generator-v2/template/report.html
git commit -m "feat(pdf-v2): EJS template pages 1-2 (snapshot + tension map)"
```

(Do not commit `preview.js` — it is a scratch file.)

---

## Task 5: EJS Template — Pages 3, 4, and 5

**Files:**
- Modify: `lambda/pdf-generator-v2/template/report.html` (append pages 3–5 before `</body>`)

- [ ] **Step 1: Append Pages 3–5 to report.html**

Open `lambda/pdf-generator-v2/template/report.html`. Find the line `</body>` and replace it with the following three pages plus the closing tag:

```html
<!-- ═══════════════════════════════════════════════════════════
     PAGE 3 — What This Means
     ═══════════════════════════════════════════════════════════ -->
<div class="page page-break">
  <div class="page-header">
    <img class="logo" src="./assets/logo.png" alt="HILeadership">
    <span class="header-tagline">PAEI Energy Alignment Profile — What This Means</span>
  </div>

  <h2 style="margin-bottom:14pt;">What This Means</h2>

  <div class="meaning-grid">
    <div class="meaning-card best">
      <h3>✓ When you are at your best</h3>
      <p><%= interpretation.strengths %></p>
    </div>
    <div class="meaning-card friction">
      <h3>⚠ Where friction shows up</h3>
      <p><%= interpretation.blind_spots %></p>
    </div>
  </div>

  <div class="section-label">Early Warning Signs</div>
  <% interpretation.mismanagement_risks.forEach(function(risk) { %>
  <div class="warning-card"><%= risk %></div>
  <% }); %>

  <div class="page-footer">
    <span>HILeadership | PAEI Energy Alignment Profile</span>
    <span>Confidential — Page 3</span>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════
     PAGE 4 — Style Summary
     ═══════════════════════════════════════════════════════════ -->
<div class="page page-break">
  <div class="page-header">
    <img class="logo" src="./assets/logo.png" alt="HILeadership">
    <span class="header-tagline">PAEI Energy Alignment Profile — Style Summary</span>
  </div>

  <h2 style="margin-bottom:12pt;">Style Summary</h2>

  <div class="style-hero">
    <div class="style-hero-label"><%= interpretation.style_label %></div>
    <div class="style-hero-tagline"><%= interpretation.style_tagline %></div>
    <% if (interpretation.combined_description) { %>
    <div class="style-hero-desc"><%= interpretation.combined_description %></div>
    <% } %>
  </div>

  <div class="summary-grid">
    <div class="summary-card strengths">
      <h3>Strengths</h3>
      <p><%= interpretation.strengths %></p>
    </div>
    <div class="summary-card watchouts">
      <h3>Watchouts</h3>
      <p><%= interpretation.blind_spots %></p>
    </div>
    <div class="summary-card stress">
      <h3>Under Stress</h3>
      <% interpretation.mismanagement_risks.forEach(function(risk) { %>
      <p style="margin-bottom:5pt;"><%= risk %></p>
      <% }); %>
    </div>
  </div>

  <div class="page-footer">
    <span>HILeadership | PAEI Energy Alignment Profile</span>
    <span>Confidential — Page 4</span>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════
     PAGE 5 — Action Path
     ═══════════════════════════════════════════════════════════ -->
<div class="page">
  <div class="page-header">
    <img class="logo" src="./assets/logo.png" alt="HILeadership">
    <span class="header-tagline">PAEI Energy Alignment Profile — Action Path</span>
  </div>

  <h2 style="margin-bottom:4pt;">Your Action Path</h2>
  <p style="font-size:8.5pt;color:#6b7280;margin-bottom:16pt;">Three directions drawn from your energy alignment data. Focus on Stretch first, use Balance to recalibrate, and hold Protect as your anchor.</p>

  <div class="action-path-cards">
    <div class="action-card" style="border-left:3pt solid <%- actionPath.stretch.roleColor %>;">
      <div class="action-card-left">
        <div class="action-icon" style="background:<%- actionPath.stretch.roleColor %>;"><%= actionPath.stretch.role %></div>
        <div class="action-type-label stretch">Stretch</div>
      </div>
      <div class="action-card-right">
        <h3><%= actionPath.stretch.roleName %></h3>
        <p><%= actionPath.stretch.description %></p>
        <div class="action-prompt">→ <%= actionPath.stretch.action %></div>
      </div>
    </div>

    <div class="action-card" style="border-left:3pt solid <%- actionPath.balance.roleColor %>;">
      <div class="action-card-left">
        <div class="action-icon" style="background:<%- actionPath.balance.roleColor %>;"><%= actionPath.balance.role %></div>
        <div class="action-type-label balance">Balance</div>
      </div>
      <div class="action-card-right">
        <h3><%= actionPath.balance.roleName %></h3>
        <p><%= actionPath.balance.description %></p>
        <div class="action-prompt">→ <%= actionPath.balance.action %></div>
      </div>
    </div>

    <div class="action-card" style="border-left:3pt solid <%- actionPath.protect.roleColor %>;">
      <div class="action-card-left">
        <div class="action-icon" style="background:<%- actionPath.protect.roleColor %>;"><%= actionPath.protect.role %></div>
        <div class="action-type-label protect">Protect</div>
      </div>
      <div class="action-card-right">
        <h3><%= actionPath.protect.roleName %></h3>
        <p><%= actionPath.protect.description %></p>
        <div class="action-prompt">→ <%= actionPath.protect.action %></div>
      </div>
    </div>
  </div>

  <div style="margin-top:18pt;padding:10pt 12pt;background:#f9fafb;border-radius:5pt;border:1px solid #e5e7eb;">
    <p style="font-size:8pt;color:#6b7280;line-height:1.6;">
      <strong style="color:#374151;">How to use this report:</strong> Your PAEI profile is a tool for self-awareness, not a fixed label.
      Strengths become liabilities when over-used. Use this report to open conversations with colleagues, coaches, and managers.
    </p>
  </div>

  <div class="page-footer">
    <span>HILeadership | PAEI Energy Alignment Profile</span>
    <span>Confidential — Page 5</span>
  </div>
</div>

</body>
</html>
```

- [ ] **Step 2: Re-run preview and verify all 5 pages**

```bash
cd lambda/pdf-generator-v2 && node preview.js && open /tmp/preview.html
```

Verify:
- Page 3: strengths + blind_spots in 2-col grid; mismanagement risks as red-left-border cards
- Page 4: dark style-hero block; 3-col summary grid (strengths/watchouts/stress)
- Page 5: 3 action cards (stretch/balance/protect) with role-coloured left border + icon circle; disclaimer box at bottom

- [ ] **Step 3: Commit**

```bash
git add lambda/pdf-generator-v2/template/report.html
git commit -m "feat(pdf-v2): EJS template pages 3-5 (what this means, style summary, action path)"
```

---

## Task 6: Lambda handler (index.js)

**Files:**
- Create: `lambda/pdf-generator-v2/index.js`

- [ ] **Step 1: Write index.js**

Write `lambda/pdf-generator-v2/index.js`:

```js
'use strict';

const chromium    = require('@sparticuz/chromium');
const puppeteer   = require('puppeteer-core');
const ejs         = require('ejs');
const fs          = require('fs');
const path        = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const {
  computeTensions, getTopTensions, computeActionPath, generateActionPathMessages,
  ROLES, ROLE_NAMES, ROLE_COLORS, ROLE_TINTS, TYPE_LABELS, ACTION_CUES,
} = require('./lib/tensions');

const TEMPLATE_PATH = path.join(__dirname, 'template', 'report.html');

/**
 * Inline CSS and convert ./assets/* src references to base64 data URIs.
 * page.setContent() does not resolve relative paths — everything must be inline.
 */
function inlineAssets(html) {
  const templateDir = path.join(__dirname, 'template');

  const css = fs.readFileSync(path.join(templateDir, 'styles.css'), 'utf8');
  html = html.replace(
    /<link rel="stylesheet" href="\.\/styles\.css">/,
    `<style>${css}</style>`,
  );

  html = html.replace(/src="\.\/assets\/([^"]+)"/g, (_match, filename) => {
    const assetPath = path.join(templateDir, 'assets', filename);
    if (!fs.existsSync(assetPath)) {
      console.warn(`[pdf-v2] Asset not found: ${assetPath}`);
      return `src=""`;
    }
    const ext  = path.extname(filename).toLowerCase();
    const mime = ext === '.svg' ? 'image/svg+xml' : `image/${ext.slice(1)}`;
    const b64  = fs.readFileSync(assetPath).toString('base64');
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

  console.log(`[pdf-v2] Starting PDF for assessment ${assessment_id}, user: ${user_name}`);

  // ── Compute derived data ───────────────────────────────────────────────────
  const tensions       = computeTensions(scaled_scores);
  const topTensions    = getTopTensions(tensions, 2);
  const actionPath     = computeActionPath(tensions);
  const actionPathMsgs = generateActionPathMessages(tensions, actionPath);

  const gapsMap = {};
  for (const g of gaps) gapsMap[g.role] = g;

  const identityLine = interpretation.combined_description
    ? interpretation.combined_description.split(' — ')[0].replace(/^The /, '')
    : interpretation.style_label;

  // ── Render EJS template ────────────────────────────────────────────────────
  const templateSrc = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const renderedHtml = ejs.render(templateSrc, {
    user_name,
    completed_at,
    profile,
    scaled_scores,
    interpretation,
    gaps,
    tensions,
    topTensions,
    actionPath: actionPathMsgs,
    gapsMap,
    identityLine,
    ROLES,
    ROLE_NAMES,
    ROLE_COLORS,
    ROLE_TINTS,
    TYPE_LABELS,
    ACTION_CUES,
  });

  const html = inlineAssets(renderedHtml);

  // ── Puppeteer — render to PDF ──────────────────────────────────────────────
  const browser = await puppeteer.launch({
    args:            chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath:  await chromium.executablePath(),
    headless:        chromium.headless,
  });

  let pdfBytes;

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123 });
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 });

    pdfBytes = await page.pdf({
      format:          'A4',
      printBackground: true,
      margin: { top: '18mm', bottom: '22mm', left: '15mm', right: '15mm' },
    });

    console.log(`[pdf-v2] PDF generated, ${pdfBytes.length} bytes`);
  } finally {
    await browser.close();
  }

  // ── Upload to S3 ───────────────────────────────────────────────────────────
  const s3  = new S3Client({ region: process.env.AWS_REGION });
  const key = `reports/${assessment_id}.pdf`;

  await s3.send(new PutObjectCommand({
    Bucket:      process.env.S3_BUCKET_NAME,
    Key:         key,
    Body:        pdfBytes,
    ContentType: 'application/pdf',
  }));

  const pdfUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  console.log(`[pdf-v2] Uploaded to S3: ${pdfUrl}`);

  // ── PATCH Supabase assessments.pdf_url ─────────────────────────────────────
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const resp = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/assessments?id=eq.${assessment_id}`,
        {
          method: 'PATCH',
          headers: {
            apikey:         process.env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization:  `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            Prefer:         'return=minimal',
          },
          body: JSON.stringify({ pdf_url: pdfUrl }),
        },
      );
      if (!resp.ok) throw new Error(`Supabase PATCH ${resp.status}: ${await resp.text()}`);
      console.log(`[pdf-v2] Supabase pdf_url updated for ${assessment_id}`);
      break;
    } catch (err) {
      console.error(`[pdf-v2] Supabase PATCH attempt ${attempt} failed: ${err.message}`);
      if (attempt === 2) console.error(`[pdf-v2] Giving up on Supabase PATCH`);
    }
  }

  return { statusCode: 200, assessment_id, pdf_url: pdfUrl };
};
```

- [ ] **Step 2: Commit**

```bash
git add lambda/pdf-generator-v2/index.js
git commit -m "feat(pdf-v2): Lambda handler — tension assembly, EJS render, Puppeteer, S3, Supabase"
```

---

## Task 7: Local end-to-end test

**Files:**
- Create: `lambda/pdf-generator-v2/test-local.js`

This runs the handler locally with sample data, skipping S3 and Supabase, and writes the PDF to `/tmp/report-v2-test.pdf`.

- [ ] **Step 1: Write test-local.js**

Write `lambda/pdf-generator-v2/test-local.js`:

```js
'use strict';

/**
 * Local test runner for pdf-generator-v2.
 * Skips S3 upload and Supabase PATCH — writes PDF to /tmp/report-v2-test.pdf instead.
 *
 * Usage: node test-local.js
 * Requires: npm install (including @sparticuz/chromium which bundles Chromium locally)
 */

const ejs      = require('ejs');
const fs       = require('fs');
const path     = require('path');
const puppeteer = require('puppeteer-core');
const chromium  = require('@sparticuz/chromium');

const {
  computeTensions, getTopTensions, computeActionPath, generateActionPathMessages,
  ROLES, ROLE_NAMES, ROLE_COLORS, ROLE_TINTS, TYPE_LABELS, ACTION_CUES,
} = require('./lib/tensions');

const TEMPLATE_PATH = path.join(__dirname, 'template', 'report.html');
const OUTPUT_PATH   = '/tmp/report-v2-test.pdf';

function inlineAssets(html) {
  const templateDir = path.join(__dirname, 'template');
  const css = fs.readFileSync(path.join(templateDir, 'styles.css'), 'utf8');
  html = html.replace(/<link rel="stylesheet" href="\.\/styles\.css">/, `<style>${css}</style>`);
  html = html.replace(/src="\.\/assets\/([^"]+)"/g, (_match, filename) => {
    const assetPath = path.join(templateDir, 'assets', filename);
    if (!fs.existsSync(assetPath)) return `src=""`;
    const ext = path.extname(filename).toLowerCase();
    const mime = ext === '.svg' ? 'image/svg+xml' : `image/${ext.slice(1)}`;
    return `src="data:${mime};base64,${fs.readFileSync(assetPath).toString('base64')}"`;
  });
  return html;
}

async function run() {
  const scaled_scores = {
    is:     { P: 28, A: 37, E: 34, I: 25 },
    should: { P: 22, A: 30, E: 42, I: 28 },
    want:   { P: 18, A: 42, E: 38, I: 30 },
  };
  const interpretation = {
    dominant_roles: ['A', 'E'],
    style_label: 'Administrator',
    style_tagline: 'The Reliable Architect',
    strengths: 'You bring discipline, consistency, and rigour to everything you touch. Your ability to create systems, maintain standards, and catch errors before they become problems makes you invaluable in any organisation.',
    blind_spots: 'Your preference for process and precedent can slow adaptation to change. Trust that not every decision requires a procedure — learn to tolerate calculated ambiguity and speed.',
    working_with_others: 'Producers can seem reckless to you — channel their energy by building systems they can operate within.',
    combined_description: 'The Innovative Organiser — you vision the future and build the systems to get there.',
    mismanagement_risks: [
      'Bureaucrat — may become overly rigid, inflexible, and change-resistant under stress.',
      'Arsonist — may become impractical, chaotic, and idea-without-delivery under stress.',
    ],
  };
  const gaps = [
    { role: 'P', external_message: 'Your current work style is more action-driven than your job requires. This extra energy can be a strength but watch for impatience with process.', internal_message: 'You prefer more action and results than your current role allows. Seek opportunities for direct ownership and tangible outcomes.' },
    { role: 'A', external_message: 'You are more process-focused than your role demands. While thoroughness is valuable, ensure it does not slow decision-making.', internal_message: 'You have a stronger preference for structure than your current role exercises. Seek ways to bring more order and clarity to your work.' },
    { role: 'E', external_message: 'Your organisation expects more entrepreneurial, visionary behaviour than you are currently showing. Look for opportunities to propose new ideas and challenge the status quo.', internal_message: 'You crave more creative freedom than your current role provides. Seek stretch assignments or side projects that allow strategic thinking.' },
    { role: 'I', external_message: 'You are more people-focused than your role requires. Your relational strengths are an asset — ensure tasks and results are not secondary.', internal_message: 'You value collaboration more than your role currently provides. Seek cross-functional projects to satisfy your integrative nature.' },
  ];

  const tensions       = computeTensions(scaled_scores);
  const topTensions    = getTopTensions(tensions, 2);
  const actionPath     = computeActionPath(tensions);
  const actionPathMsgs = generateActionPathMessages(tensions, actionPath);
  const gapsMap        = {};
  for (const g of gaps) gapsMap[g.role] = g;
  const identityLine   = interpretation.combined_description
    ? interpretation.combined_description.split(' — ')[0].replace(/^The /, '')
    : interpretation.style_label;

  const tpl  = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const html = inlineAssets(ejs.render(tpl, {
    user_name: 'Erika Garcia', completed_at: '2026-04-19T10:00:00Z',
    profile: { is: 'pAei', should: 'paEi', want: 'pAEi' },
    scaled_scores, interpretation, gaps,
    tensions, topTensions, actionPath: actionPathMsgs, gapsMap, identityLine,
    ROLES, ROLE_NAMES, ROLE_COLORS, ROLE_TINTS, TYPE_LABELS, ACTION_CUES,
  }));

  const browser = await puppeteer.launch({
    args: chromium.args, defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(), headless: chromium.headless,
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123 });
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const pdfBytes = await page.pdf({ format: 'A4', printBackground: true,
      margin: { top: '18mm', bottom: '22mm', left: '15mm', right: '15mm' } });
    fs.writeFileSync(OUTPUT_PATH, pdfBytes);
    console.log(`[test-local] PDF written: ${OUTPUT_PATH} (${pdfBytes.length} bytes)`);
  } finally {
    await browser.close();
  }
}

run().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Run the local test**

```bash
cd lambda/pdf-generator-v2 && node test-local.js
```

Expected output:
```
[test-local] PDF written: /tmp/report-v2-test.pdf (NNNNNN bytes)
```

If it fails with a Chromium error, check that `@sparticuz/chromium` installed cleanly:
```bash
ls node_modules/@sparticuz/chromium/bin/
```

- [ ] **Step 3: Open and visually verify the PDF**

```bash
open /tmp/report-v2-test.pdf
```

Verify all 5 pages:
- Page 1: name, date, identity badge, 2×2 matrix cards, core insight, top tension pills
- Page 2: 4 role cards with tension highlight boxes and action cues
- Page 3: best/friction columns, warning cards for risks
- Page 4: dark style hero, 3-column summary grid
- Page 5: 3 action path cards (stretch/balance/protect) with role colours

- [ ] **Step 4: Commit**

```bash
git add lambda/pdf-generator-v2/test-local.js
git commit -m "feat(pdf-v2): add local end-to-end test script"
```

---

## Task 8: Deploy script + Lambda deployment

**Files:**
- Create: `lambda/pdf-generator-v2/deploy.sh`

- [ ] **Step 1: Write deploy.sh**

Write `lambda/pdf-generator-v2/deploy.sh`:

```bash
#!/bin/bash
set -euo pipefail

REGION="ap-south-1"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPO="adizes-pdf-generator-v2"
LAMBDA_NAME="adizes-pdf-generator-v2"
LAMBDA_ROLE="arn:aws:iam::${ACCOUNT_ID}:role/adizes-pdf-lambda-role"
IMAGE_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${ECR_REPO}:latest"

: "${SUPABASE_URL:?Need to set SUPABASE_URL}"
: "${SUPABASE_SERVICE_ROLE_KEY:?Need to set SUPABASE_SERVICE_ROLE_KEY}"
: "${S3_BUCKET_NAME:?Need to set S3_BUCKET_NAME}"

# Copy logo from frontend repo
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOGO_SRC="${SCRIPT_DIR}/../../../adizes-frontend/public/logo.png"
if [ -f "$LOGO_SRC" ]; then
  cp "$LOGO_SRC" "${SCRIPT_DIR}/template/assets/logo.png"
  echo "✓ Copied logo from $LOGO_SRC"
else
  echo "⚠ Logo not found at $LOGO_SRC — using existing asset"
fi

# Authenticate Docker to ECR
aws ecr get-login-password --region "$REGION" | \
  docker login --username AWS --password-stdin \
  "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

# Create ECR repository if it doesn't exist
aws ecr describe-repositories --repository-names "$ECR_REPO" \
  --region "$REGION" 2>/dev/null || \
  aws ecr create-repository --repository-name "$ECR_REPO" \
  --region "$REGION" --image-scanning-configuration scanOnPush=true

# Build for linux/amd64 and push
docker buildx build --platform linux/amd64 --provenance=false -t "$IMAGE_URI" --push "$SCRIPT_DIR"

# Create or update Lambda
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
    --timeout 90 \
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
    --timeout 90 \
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
chmod +x lambda/pdf-generator-v2/deploy.sh
git add lambda/pdf-generator-v2/deploy.sh
git commit -m "feat(pdf-v2): add deploy.sh for adizes-pdf-generator-v2"
```

- [ ] **Step 3: Deploy to AWS**

From `/Users/vrln/adizes-backend`:

```bash
export SUPABASE_URL=https://swiznkamzxyfzgckebqi.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<value from adizes-backend .env>
export S3_BUCKET_NAME=adizes-pdf-reports
AWS_PROFILE=lax-t3-assumed bash lambda/pdf-generator-v2/deploy.sh
```

Expected final line: `✓ Lambda deployed: adizes-pdf-generator-v2 → 094492115510.dkr.ecr.ap-south-1.amazonaws.com/adizes-pdf-generator-v2:latest`

- [ ] **Step 4: Smoke-test v2 Lambda directly via AWS CLI**

```bash
AWS_PROFILE=lax-t3-assumed aws lambda invoke \
  --function-name adizes-pdf-generator-v2 \
  --region ap-south-1 \
  --cli-binary-format raw-in-base64-out \
  --payload '{
    "assessment_id": "00000000-0000-0000-0000-000000000001",
    "user_name": "Erika Garcia",
    "completed_at": "2026-04-19T10:00:00Z",
    "profile": { "is": "pAei", "should": "paEi", "want": "pAEi" },
    "scaled_scores": {
      "is":     { "P": 28, "A": 37, "E": 34, "I": 25 },
      "should": { "P": 22, "A": 30, "E": 42, "I": 28 },
      "want":   { "P": 18, "A": 42, "E": 38, "I": 30 }
    },
    "gaps": [
      { "role": "P", "external_message": "More action-driven than role requires.", "internal_message": "Prefer more action than role allows." },
      { "role": "A", "external_message": "More process-focused than role demands.", "internal_message": "Stronger structure preference than role exercises." },
      { "role": "E", "external_message": "Role expects more entrepreneurial behaviour.", "internal_message": "Crave more creative freedom than role provides." },
      { "role": "I", "external_message": "More people-focused than role requires.", "internal_message": "Value collaboration more than role provides." }
    ],
    "interpretation": {
      "dominant_roles": ["A","E"],
      "style_label": "Administrator",
      "style_tagline": "The Reliable Architect",
      "strengths": "You bring discipline and rigour to everything you touch.",
      "blind_spots": "Your preference for process can slow adaptation to change.",
      "working_with_others": "Partner with Entrepreneurs to balance vision with delivery.",
      "combined_description": "The Innovative Organiser — you vision the future and build the systems to get there.",
      "mismanagement_risks": ["Bureaucrat — overly rigid under stress."]
    }
  }' \
  /tmp/lambda-v2-response.json

cat /tmp/lambda-v2-response.json
```

Expected: `{"statusCode": 200, "assessment_id": "00000000-...", "pdf_url": "https://adizes-pdf-reports.s3.ap-south-1.amazonaws.com/reports/00000000-0000-0000-0000-000000000001.pdf"}`

Verify the PDF URL resolves (download and inspect it).

---

## Task 9: Cutover — point App Runner at v2

This task has no code changes. It is an AWS Console operation.

- [ ] **Step 1: Update App Runner environment variable**

1. Open AWS Console → App Runner → `adizes-backend` service
2. Click **Configuration** → **Configure service**
3. Under **Environment variables**, find `PDF_LAMBDA_FUNCTION_NAME`
4. Change value from `adizes-pdf-generator` to `adizes-pdf-generator-v2`
5. Click **Save and deploy** — App Runner redeploys (takes ~2 minutes)

- [ ] **Step 2: Verify cutover with a live assessment submission**

Submit a real assessment through the frontend at `https://<netlify-url>`. After submission, wait ~30 seconds, then check the Results page. The PDF download should reflect the new 5-page Energy Alignment Profile layout.

Check the PDF generation logs in CloudWatch:
```bash
AWS_PROFILE=lax-t3-assumed aws logs tail \
  /aws/lambda/adizes-pdf-generator-v2 \
  --region ap-south-1 \
  --follow
```

Expected log lines: `[pdf-v2] Starting PDF...`, `[pdf-v2] PDF generated...`, `[pdf-v2] Uploaded to S3...`, `[pdf-v2] Supabase pdf_url updated...`

- [ ] **Step 3: Push all commits to origin/adizes-backend**

```bash
git push origin HEAD:adizes-backend
```

---

## Rollback Procedure

If v2 produces errors in production:

1. AWS Console → App Runner → change `PDF_LAMBDA_FUNCTION_NAME` back to `adizes-pdf-generator`
2. Deploy the service update

No code changes needed. V1 Lambda remains deployed and untouched.
