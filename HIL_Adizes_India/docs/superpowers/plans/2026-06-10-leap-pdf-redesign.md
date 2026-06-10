# LEAP™ PDF Report Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the LEAP™ PDF report (Lambda v2) into a 5-page narrative-driven document with an executive summary, per-gap "day-to-day" callouts, a priority-sequenced action path, and a stress/reflection page — all driven by static role-keyed templates in `interpretation.py`.

**Architecture:** Three layers change together: (1) `interpretation.py` grows three new data structures and returns three new fields; (2) `results.py` adds the matching optional schema fields; (3) Lambda `report.html` + `styles.css` are fully restructured. The Lambda receives the full `interpretation` object from the backend payload, so new fields are automatically available in the EJS template once they exist in the Python dict.

**Tech Stack:** Python 3.11 + FastAPI + Pydantic v2 (backend); Node.js + EJS + Puppeteer (Lambda); pytest (tests); AWS ECR + Lambda (deploy).

---

## File Map

| File | Change |
|------|--------|
| `adizes-backend/app/services/interpretation.py` | Add 3 new dicts + `user_name` param + 3 new return fields |
| `adizes-backend/app/schemas/results.py` | Add `executive_summary`, `daily_feel`, `reflection_questions` to `Interpretation` |
| `adizes-backend/app/routers/assessment.py:192` | Pass `user_name=user_name` to `interpret()` |
| `adizes-backend/tests/test_interpretation.py` | Add tests for new fields |
| `lambda/pdf-generator-v2/template/assets/HIL-Isotope.png` | New asset (copy from `adizes-frontend/public/`) |
| `lambda/pdf-generator-v2/deploy.sh` | Copy `HIL-Isotope.png` instead of `logo.png` |
| `lambda/pdf-generator-v2/template/styles.css` | Add new component styles |
| `lambda/pdf-generator-v2/template/report.html` | Full 5-page restructure |

---

## Task 1 — Backend: new interpretation fields

**Context:** `interpretation.py` currently exports a single `interpret()` function that returns a dict.
We are adding three new data dicts as module-level constants, a helper `_first_name()`, and three
new keys in the returned dict. The `interpret()` signature gains `user_name: str = ""`.
All tests live in `adizes-backend/tests/test_interpretation.py`.

**Files:**
- Modify: `adizes-backend/app/services/interpretation.py`
- Modify: `adizes-backend/app/routers/assessment.py` (line 192 — call site)

- [ ] **Step 1: Write failing tests first**

Add these tests to `adizes-backend/tests/test_interpretation.py`, below the existing `TestInterpret` class:

```python
class TestInterpretNewFields:
    def test_executive_summary_present(self):
        result = interpret(_scaled({"E": 40}), {}, user_name="Alice Johnson")
        assert "executive_summary" in result
        assert isinstance(result["executive_summary"], str)
        assert len(result["executive_summary"]) > 20

    def test_executive_summary_contains_first_name(self):
        result = interpret(_scaled({"P": 45}), {}, user_name="Alice Johnson")
        assert "Alice" in result["executive_summary"]

    def test_executive_summary_fallback_when_no_name(self):
        result = interpret(_scaled({"A": 40}), {}, user_name="")
        assert "Your profile" in result["executive_summary"]

    def test_daily_feel_present_and_complete(self):
        result = interpret(_scaled({"I": 40}), {})
        assert "daily_feel" in result
        for role in ["P", "A", "E", "I"]:
            for gap_type in ["execution", "engagement", "authenticity"]:
                assert role in result["daily_feel"]
                assert gap_type in result["daily_feel"][role]
                assert len(result["daily_feel"][role][gap_type]) > 20

    def test_reflection_questions_present(self):
        result = interpret(_scaled({"E": 40}), {}, user_name="Bob")
        assert "reflection_questions" in result
        assert isinstance(result["reflection_questions"], list)
        assert len(result["reflection_questions"]) == 3

    def test_reflection_questions_e_content(self):
        result = interpret(_scaled({"E": 40}), {}, user_name="Bob")
        # E reflection questions mention things about role/energy
        joined = " ".join(result["reflection_questions"])
        assert len(joined) > 50

    def test_backward_compat_existing_keys_still_present(self):
        result = interpret(_scaled({"A": 40}), {}, user_name="Test")
        for key in ["dominant_roles", "identity_line", "style_label", "style_tagline",
                    "strengths", "watchouts", "mismanagement_risks",
                    "at_your_best", "friction_shows_up", "early_warnings"]:
            assert key in result
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd /Users/vrln/adizes-backend
docker exec adizes-backend pytest tests/test_interpretation.py -v -k "TestInterpretNewFields" 2>&1 | tail -20
```

Expected: all 7 new tests FAIL with `TypeError` (unexpected keyword argument `user_name`) or `KeyError`.

- [ ] **Step 3: Add new constants to `interpretation.py`**

Open `/Users/vrln/adizes-backend/app/services/interpretation.py`.

After the closing `}` of the `EARLY_WARNINGS` dict (currently line 187), add:

```python
EXECUTIVE_SUMMARIES = {
    "P": (
        "{name}, you are wired as a Producer — a decisive, results-driven leader who "
        "creates momentum that others can follow. Right now, something is creating friction "
        "between the energy you bring and what the role is drawing out of you. "
        "This report shows you exactly where that tension is and what to do about it."
    ),
    "A": (
        "{name}, you are wired as an Administrator — a disciplined, systematic thinker "
        "who builds the reliability that organisations depend on. Your data shows a gap "
        "between how you operate and what the role is asking of you. "
        "This report pinpoints where that pressure is concentrated and how to respond."
    ),
    "E": (
        "{name}, you are wired as an Entrepreneur — a strategic, creative thinker who "
        "sees possibilities others miss. Right now, your day-to-day behaviour is not fully "
        "expressing that instinct. The gap between what you do and what energises you is "
        "significant. This report shows where those tensions are and what to do about them."
    ),
    "I": (
        "{name}, you are wired as an Integrator — the leader who builds the trust and "
        "connection that make teams perform. Your profile shows a gap between how you "
        "invest in people and what the role is currently calling for. "
        "This report shows you where alignment is strongest and where to focus next."
    ),
}

DAILY_FEEL = {
    "P": {
        "execution": (
            "You may find yourself moving fast but feeling unsatisfied — delivering results "
            "your role needs, yet sensing the effort is unsustainable at this pace."
        ),
        "engagement": (
            "You may feel pulled between what you want to produce and what the role "
            "actually rewards — like running hard in the wrong direction."
        ),
        "authenticity": (
            "You may notice a quiet disconnect — doing what the role expects, but not "
            "feeling like it reflects your natural way of working."
        ),
    },
    "A": {
        "execution": (
            "You may feel the weight of maintaining standards while others move past them — "
            "holding the line costs energy when the environment pushes against it."
        ),
        "engagement": (
            "You may sense that the structure you want to build is not what the role "
            "rewards — your instinct for order is undervalued or overspent."
        ),
        "authenticity": (
            "You may find yourself operating with less discipline than feels right — "
            "cutting corners that quietly bother you, or over-engineering what doesn't need it."
        ),
    },
    "E": {
        "execution": (
            "You may find yourself in process-heavy meetings thinking 'we should be building "
            "something new.' That restlessness is real data — your entrepreneurial instinct "
            "is looking for an outlet the role isn't providing."
        ),
        "engagement": (
            "You may feel your best ideas are underused — bringing creative energy to a role "
            "that rewards execution, leaving your strategic instincts frustrated."
        ),
        "authenticity": (
            "You may notice you are performing more innovation than you feel — generating "
            "ideas because the role demands it, while the internal creative drive has quietened."
        ),
    },
    "I": {
        "execution": (
            "You may feel the relational fabric around you fraying — your instinct says "
            "invest in people, but the role's pace is leaving less room for that."
        ),
        "engagement": (
            "You may sense that the connecting and listening you want to do is being "
            "crowded out by task demands — integration is needed but not rewarded."
        ),
        "authenticity": (
            "You may find yourself going through relationship motions without the genuine "
            "warmth behind them — performing cohesion rather than feeling it."
        ),
    },
}

REFLECTION_QUESTIONS = {
    "P": [
        "Where in the last month did you create momentum that others could follow? What made that possible?",
        "What result are you currently pushing for that, honestly, someone else should own?",
        "If you could change one thing about how your role measures success, what would it be?",
    ],
    "A": [
        "Which system or process you've built are you most proud of — and is it still serving its purpose?",
        "Where are you maintaining standards that the organisation no longer requires you to hold?",
        "If you had to operate with 30% less process next quarter, what would you protect and what would you release?",
    ],
    "E": [
        "Where in the last month did you feel most switched on? What were you doing?",
        "What responsibility currently on your plate drains you most — and who else could own it?",
        "If you could redesign your role with no constraints, what would you add first and remove first?",
    ],
    "I": [
        "Which relationship at work most needs your investment right now — and what has been stopping you?",
        "Where have you kept the peace when honest friction would have been more useful?",
        "If your team described the environment you create, what would you want them to say — and what do you think they'd actually say?",
    ],
}
```

- [ ] **Step 4: Add `_first_name()` helper and update `interpret()` signature**

Add this helper function after the `_build_identity_line` function (currently near the bottom):

```python
def _first_name(user_name: str) -> str:
    name = (user_name or "").strip()
    if not name:
        return "Your profile"
    return name.split()[0]
```

Change the `interpret()` signature from:

```python
def interpret(
    raw_scores: Dict[str, Dict[str, int]],
    profile: Dict[str, str],
    gaps: Optional[List[Dict]] = None,
) -> Dict:
```

to:

```python
def interpret(
    raw_scores: Dict[str, Dict[str, int]],
    profile: Dict[str, str],
    gaps: Optional[List[Dict]] = None,
    user_name: str = "",
) -> Dict:
```

- [ ] **Step 5: Add new fields to the `return` dict in `interpret()`**

Find the `return {` block at the bottom of `interpret()`. Add three new keys at the end, inside the returned dict:

```python
        "executive_summary":   EXECUTIVE_SUMMARIES[primary].format(name=_first_name(user_name)),
        "daily_feel":          DAILY_FEEL,
        "reflection_questions": REFLECTION_QUESTIONS[primary],
```

- [ ] **Step 6: Update the call site in `assessment.py`**

Find line 192 in `/Users/vrln/adizes-backend/app/routers/assessment.py`:
```python
    interp = interpret(scores["raw"], scores["profile"], gaps=gaps)
```

Change it to:
```python
    interp = interpret(scores["raw"], scores["profile"], gaps=gaps, user_name=user_name)
```

- [ ] **Step 7: Run tests — confirm all pass**

```bash
cd /Users/vrln/adizes-backend
docker exec adizes-backend pytest tests/test_interpretation.py -v 2>&1 | tail -25
```

Expected: all tests PASS (including original `TestInterpret` class and new `TestInterpretNewFields`).

If `docker exec` is not available (Docker not running locally), run:
```bash
cd /Users/vrln/adizes-backend
python -m pytest tests/test_interpretation.py -v 2>&1 | tail -25
```

- [ ] **Step 8: Commit**

```bash
cd /Users/vrln/adizes-backend
git add app/services/interpretation.py app/routers/assessment.py tests/test_interpretation.py
git commit -m "feat: add executive_summary, daily_feel, reflection_questions to interpretation service"
```

---

## Task 2 — Schema: new fields on `Interpretation`

**Context:** `results.py` defines the `Interpretation` Pydantic model. Lambda receives the raw
Python dict (not validated through Pydantic) — schema changes here affect the API response
schema and Swagger docs only. Add `Optional` fields so existing stored results (which lack
the new keys) still deserialise without error.

**Files:**
- Modify: `adizes-backend/app/schemas/results.py`

- [ ] **Step 1: Add `Optional` imports if not present**

Open `/Users/vrln/adizes-backend/app/schemas/results.py`. The `Optional` and `Dict` imports are
already present. Confirm line 3: `from typing import Dict, List, Optional`.

- [ ] **Step 2: Add new fields to `Interpretation` model**

Find the `Interpretation` class. After `early_warnings: List[str]`, add:

```python
    executive_summary: Optional[str] = None
    daily_feel: Optional[Dict] = None
    reflection_questions: Optional[List[str]] = None
```

The full class should now look like:

```python
class Interpretation(BaseModel):
    dominant_roles: List[str]
    identity_line: str
    style_label: str
    style_tagline: str
    strengths: str
    watchouts: str
    working_with_others: str
    combined_description: Optional[str]
    mismanagement_risks: List[str]
    at_your_best: str
    friction_shows_up: str
    early_warnings: List[str]
    executive_summary: Optional[str] = None
    daily_feel: Optional[Dict] = None
    reflection_questions: Optional[List[str]] = None
```

- [ ] **Step 3: Verify no import errors**

```bash
cd /Users/vrln/adizes-backend
python -c "from app.schemas.results import Interpretation; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
cd /Users/vrln/adizes-backend
git add app/schemas/results.py
git commit -m "feat: add executive_summary, daily_feel, reflection_questions to Interpretation schema"
```

---

## Task 3 — Lambda: logo asset + deploy.sh

**Context:** The PDF headers currently show `logo.png` (Adizes logo). We are replacing it with
`HIL-Isotope.png`. The asset must be in `template/assets/` so `inlineAssets()` in `index.js`
can base64-encode it. `deploy.sh` currently copies `logo.png` from the frontend public dir —
update it to copy `HIL-Isotope.png` instead.

**Files:**
- Create: `lambda/pdf-generator-v2/template/assets/HIL-Isotope.png`
- Modify: `lambda/pdf-generator-v2/deploy.sh`

- [ ] **Step 1: Copy the asset**

```bash
cp /Users/vrln/adizes-frontend/public/HIL-Isotope.png \
   /Users/vrln/adizes-backend/lambda/pdf-generator-v2/template/assets/HIL-Isotope.png
```

Verify:
```bash
ls -lh /Users/vrln/adizes-backend/lambda/pdf-generator-v2/template/assets/
```

Expected: `HIL-Isotope.png` present, size > 0.

- [ ] **Step 2: Update deploy.sh**

In `/Users/vrln/adizes-backend/lambda/pdf-generator-v2/deploy.sh`, find the logo copy block:

```bash
LOGO_SRC="${SCRIPT_DIR}/../../../adizes-frontend/public/logo.png"
if [ -f "$LOGO_SRC" ]; then
  cp "$LOGO_SRC" "${SCRIPT_DIR}/template/assets/logo.png"
  echo "✓ Copied logo from $LOGO_SRC"
else
  echo "⚠ Logo not found at $LOGO_SRC — using existing asset if present"
fi
```

Replace with:

```bash
LOGO_SRC="${SCRIPT_DIR}/../../../adizes-frontend/public/HIL-Isotope.png"
if [ -f "$LOGO_SRC" ]; then
  cp "$LOGO_SRC" "${SCRIPT_DIR}/template/assets/HIL-Isotope.png"
  echo "✓ Copied HIL-Isotope.png from $LOGO_SRC"
else
  echo "⚠ HIL-Isotope.png not found at $LOGO_SRC — using existing asset if present"
fi
```

- [ ] **Step 3: Commit**

```bash
cd /Users/vrln/adizes-backend
git add lambda/pdf-generator-v2/template/assets/HIL-Isotope.png lambda/pdf-generator-v2/deploy.sh
git commit -m "feat(lambda): replace Adizes logo with HIL-Isotope.png in PDF template"
```

---

## Task 4 — Lambda: CSS new component styles

**Context:** `styles.css` is inlined into the HTML by `inlineAssets()` at render time, so changes
take effect immediately on next Lambda invocation. We need new styles for: dark navy page header,
exec-summary prose block, daily-feel callout, priority action table, stress signature block,
and reflection question cards.

**Files:**
- Modify: `lambda/pdf-generator-v2/template/styles.css`

- [ ] **Step 1: Update page-header for dark navy background**

Find the `.page-header` block:
```css
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 2.5pt solid #C8102E;
  padding-bottom: 7pt;
  margin-bottom: 18pt;
}
.page-header img.logo { height: 32pt; object-fit: contain; }
.header-tagline { font-size: 8pt; color: #9ca3af; text-align: right; }
```

Replace with:
```css
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #1D3557;
  padding: 8pt 12pt;
  margin-bottom: 18pt;
  border-radius: 4pt;
}
.page-header img.logo { height: 26pt; object-fit: contain; filter: brightness(0) invert(1); }
.header-tagline { font-size: 7.5pt; color: rgba(255,255,255,0.75); text-align: right; }
```

- [ ] **Step 2: Add executive summary prose style**

Append to the end of `styles.css`:

```css
/* ── Executive summary prose ─────────────────────────────────── */
.exec-summary {
  font-size: 10pt;
  color: #1a1a1a;
  line-height: 1.75;
  margin-bottom: 16pt;
  padding: 14pt 16pt;
  background: #f8fafc;
  border-left: 4pt solid #1D3557;
  border-radius: 0 4pt 4pt 0;
}
```

- [ ] **Step 3: Add daily-feel callout style**

Append:

```css
/* ── Daily-feel callout (per gap card) ───────────────────────── */
.daily-feel-callout {
  margin-top: 10pt;
  padding: 8pt 10pt;
  background: #f0f4f8;
  border-radius: 4pt;
  border-left: 3pt solid currentColor;
  font-size: 8pt;
  font-style: italic;
  color: #374151;
  line-height: 1.6;
}
.daily-feel-label {
  font-style: normal;
  font-weight: 700;
  font-size: 7pt;
  text-transform: uppercase;
  letter-spacing: 0.8pt;
  margin-bottom: 4pt;
  color: #6b7280;
}
```

- [ ] **Step 4: Add priority action table styles**

Append:

```css
/* ── Priority action table (Page 4) ─────────────────────────── */
.priority-table { width: 100%; border-collapse: collapse; margin-top: 4pt; }
.priority-row { border-bottom: 1pt solid #e5e7eb; }
.priority-row td { padding: 9pt 8pt; vertical-align: top; }
.priority-num {
  width: 18pt;
  font-size: 10pt;
  font-weight: 800;
  color: #d1d5db;
  text-align: center;
  padding-top: 10pt !important;
}
.priority-stripe { width: 4pt; padding: 0 !important; border-radius: 2pt; }
.priority-label {
  width: 60pt;
  font-size: 8pt;
  font-weight: 700;
  color: #374151;
  text-transform: uppercase;
  letter-spacing: 0.5pt;
}
.priority-role-circle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20pt; height: 20pt;
  border-radius: 50%;
  font-size: 9pt;
  font-weight: 800;
  color: white;
  margin-bottom: 4pt;
}
.priority-content { font-size: 8.5pt; color: #374151; line-height: 1.55; }
.priority-content strong { font-size: 9pt; color: #1a1a1a; display: block; margin-bottom: 2pt; }
.priority-action {
  margin-top: 5pt;
  padding: 5pt 7pt;
  background: #f9fafb;
  border-left: 2pt solid #e5e7eb;
  font-size: 7.5pt;
  color: #6b7280;
  font-style: italic;
  border-radius: 0 3pt 3pt 0;
}
.timeline-chip {
  display: inline-block;
  padding: 2pt 7pt;
  border-radius: 10pt;
  font-size: 7pt;
  font-weight: 700;
  white-space: nowrap;
}
.chip-week   { background: #1D3557; color: white; }
.chip-month  { background: #2d4f7c; color: white; }
.chip-quarter{ background: #e2e8f0; color: #334155; }
.chip-ongoing{ background: #f1f5f9; color: #64748b; }
```

- [ ] **Step 5: Add stress signature block and reflection card styles**

Append:

```css
/* ── Stress signature block (Page 5) ────────────────────────── */
.stress-signature {
  background: #1D3557;
  color: white;
  border-radius: 6pt;
  padding: 14pt 16pt;
  margin-bottom: 16pt;
}
.stress-signature h3 {
  color: white;
  font-size: 11pt;
  margin-bottom: 8pt;
}
.stress-signature p {
  color: rgba(255,255,255,0.88);
  font-size: 9pt;
  line-height: 1.7;
}
.stress-connection {
  margin-top: 8pt;
  padding-top: 8pt;
  border-top: 1pt solid rgba(255,255,255,0.2);
  font-size: 8pt;
  color: rgba(255,255,255,0.65);
  font-style: italic;
}

/* ── Reflection question cards (Page 5) ─────────────────────── */
.reflection-intro {
  font-size: 8.5pt;
  color: #6b7280;
  margin-bottom: 12pt;
  font-style: italic;
}
.reflection-card {
  display: flex;
  gap: 10pt;
  margin-bottom: 10pt;
  padding: 10pt 12pt;
  background: #f9fafb;
  border-radius: 5pt;
  border-left: 3pt solid #1D3557;
}
.reflection-num {
  font-size: 14pt;
  font-weight: 800;
  color: #e5e7eb;
  min-width: 16pt;
  line-height: 1;
  padding-top: 1pt;
}
.reflection-q {
  font-size: 9pt;
  color: #1a1a1a;
  line-height: 1.65;
}
```

- [ ] **Step 6: Commit**

```bash
cd /Users/vrln/adizes-backend
git add lambda/pdf-generator-v2/template/styles.css
git commit -m "feat(lambda): add CSS for new PDF components (exec summary, daily-feel, priority table, stress, reflection)"
```

---

## Task 5 — Lambda: restructure `report.html`

**Context:** The EJS template at `lambda/pdf-generator-v2/template/report.html` is fully replaced.
The EJS helper functions (`pct`, `signed`, `severityBadge`) and variables (`dateStr`, `topGap`,
`dominantRole`, `heroColor`, `LENS_META`) stay. The five pages are reordered and restructured
per the spec. `HIL-Isotope.png` replaces `logo.png` in all 5 headers.

Available EJS variables (from `index.js`): `user_name`, `completed_at`, `profile`, `scaled_scores`,
`interpretation`, `gaps`, `gapsMap`, `topGaps`, `actionPath` (the `actionPathMsgs` object with
keys: `stretch`, `balance`, `protect`, `complement` — each having `role`, `roleName`, `roleColor`,
`description`, `action`), `ROLES`, `ROLE_NAMES`, `ROLE_COLORS`.

`interpretation` now also contains: `executive_summary`, `daily_feel` (nested dict), `reflection_questions` (array of 3 strings).

**Files:**
- Modify: `lambda/pdf-generator-v2/template/report.html`

- [ ] **Step 1: Replace the entire file with the new template**

Write the following content to `/Users/vrln/adizes-backend/lambda/pdf-generator-v2/template/report.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>LEAP™ Leadership Energy Alignment Profile — <%= user_name %></title>
  <link rel="stylesheet" href="./styles.css">
</head>
<body>

<%
  function pct(val) { return Math.round(val); }
  function signed(d) { return (d > 0 ? '+' : '') + d; }

  function severityBadge(sev) {
    if (sev === 'high')   return { label: 'HIGH',     cls: 'sev-high',   color: '#991b1b', bg: '#fee2e2', border: '#fca5a5' };
    if (sev === 'medium') return { label: 'MODERATE', cls: 'sev-medium', color: '#92400e', bg: '#fef9c3', border: '#fde68a' };
    return                       { label: 'LOW',      cls: 'sev-low',    color: '#166534', bg: '#dcfce7', border: '#86efac' };
  }

  const dateStr = new Date(completed_at).toLocaleDateString('en-GB',
    { year: 'numeric', month: 'long', day: 'numeric' });

  const topGap = topGaps[0] || null;

  const dominantRole  = (interpretation.dominant_roles || ['A'])[0];
  const heroColor     = ROLE_COLORS[dominantRole] || '#1a1a1a';

  const ROLE_FULL_NAMES = {
    P: 'Producer', A: 'Administrator', E: 'Entrepreneur', I: 'Integrator'
  };
%>

<!-- ═══════════════════════════════════════════════════════════
     PAGE 1 — Personal Snapshot
     ═══════════════════════════════════════════════════════════ -->
<div class="page page-break">
  <div class="page-header">
    <img class="logo" src="./assets/HIL-Isotope.png" alt="Heartfulness Institute of Leadership">
    <span class="header-tagline">LEAP™ — Leadership Energy Alignment Profile</span>
  </div>

  <!-- Name + date + identity badge -->
  <div class="snapshot-hero">
    <div class="snapshot-name"><%= user_name %></div>
    <div class="snapshot-date"><%= dateStr %></div>
    <div class="identity-badge" style="background:<%- heroColor %>;"><%= interpretation.identity_line %></div>
  </div>

  <!-- Executive summary prose -->
  <% if (interpretation.executive_summary) { %>
  <div class="exec-summary"><%= interpretation.executive_summary %></div>
  <% } %>

  <!-- At-your-best / friction two-column -->
  <div class="meaning-grid" style="margin-bottom:14pt;">
    <div class="meaning-card best">
      <h3>✓ When you are at your best</h3>
      <p><%= interpretation.at_your_best %></p>
    </div>
    <div class="meaning-card friction">
      <h3>⚠ Where friction shows up</h3>
      <p><%= interpretation.friction_shows_up %></p>
    </div>
  </div>

  <!-- Biggest gap highlight card -->
  <% if (topGap) {
       const nb    = severityBadge(topGap.severity);
       const color = ROLE_COLORS[topGap.role];
  %>
  <div class="section-label">Your Biggest Energy Tension</div>
  <div class="gap-card" style="border-color:<%- color %>44;border-left:3.5pt solid <%- color %>;">
    <div class="gap-card-header" style="background:linear-gradient(90deg,<%- color %>0f 0%,white 100%);">
      <div class="gap-card-title-row">
        <div class="role-circle" style="background:<%- color %>;"><%= topGap.role %></div>
        <div class="gap-card-type-info">
          <div class="gap-card-type"><%= topGap.meta.label %></div>
          <div class="gap-card-formula"><%= topGap.meta.formula %></div>
        </div>
      </div>
      <div class="gap-sev-pill" style="color:<%- nb.color %>;background:<%- nb.bg %>;border-color:<%- nb.border %>;">
        <%- nb.label %> &nbsp;<%- signed(topGap.gap_signed) %> pts
      </div>
    </div>
    <div class="gap-card-narrative"><%= topGap.narrative %></div>
  </div>
  <% } %>

  <div class="page-footer">
    <span>HILeadership | LEAP™</span>
    <span>Confidential — Page 1</span>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════
     PAGE 2 — Energy Alignment Matrix
     ═══════════════════════════════════════════════════════════ -->
<div class="page page-break">
  <div class="page-header">
    <img class="logo" src="./assets/HIL-Isotope.png" alt="Heartfulness Institute of Leadership">
    <span class="header-tagline">LEAP™ — Energy Alignment Matrix</span>
  </div>

  <div class="section-label">Energy Alignment Matrix</div>
  <p style="font-size:8.5pt;color:#6b7280;margin-bottom:14pt;line-height:1.6;">
    Three lenses on the same person — <strong>Current State</strong> shows how you operate today,
    <strong>Role Expectations</strong> shows what your role demands,
    <strong>Intrinsic Preference</strong> shows what naturally energises you.
  </p>

  <!-- 3×4 matrix -->
  <div class="matrix-table">
    <div class="matrix-col-headers">
      <div class="matrix-corner"></div>
      <% ROLES.forEach(function(role) {
           const color = ROLE_COLORS[role];
      %>
      <div class="matrix-col-header">
        <div class="matrix-col-circle" style="background:<%- color %>;"><%= role %></div>
        <span class="matrix-col-name" style="color:<%- color %>;"><%= ROLE_NAMES[role] %></span>
      </div>
      <% }); %>
    </div>

    <% [['is','Current State'], ['should','Role Expectations'], ['want','Intrinsic Preference']].forEach(function(pair) {
         const lens = pair[0], lensLabel = pair[1];
         const rowOpacity = lens === 'want' ? '0.55' : '1';
    %>
    <div class="matrix-lens-row" style="opacity:<%- rowOpacity %>;">
      <div class="matrix-lens-label">
        <div class="matrix-lens-name"><%= lensLabel %></div>
      </div>
      <% ROLES.forEach(function(role) {
           const val = pct(scaled_scores[lens][role]);
           const color = ROLE_COLORS[role];
      %>
      <div class="matrix-cell">
        <div class="matrix-cell-track">
          <div class="matrix-cell-fill" style="width:<%- val %>%;background:<%- color %>;"></div>
        </div>
        <span class="matrix-cell-val"><%= val %>%</span>
      </div>
      <% }); %>
    </div>
    <% }); %>
  </div>

  <!-- Misalignment pills -->
  <div class="section-label" style="margin-top:18pt;">Top Energy Misalignments</div>
  <div class="top-gaps-row">
    <% topGaps.forEach(function(tg) {
         if (tg.severity === 'low') return;
         const nb    = severityBadge(tg.severity);
         const color = ROLE_COLORS[tg.role];
    %>
    <div class="gap-pill">
      <div class="gap-pill-role" style="background:<%- color %>;"><%= tg.role %></div>
      <div class="gap-pill-body">
        <span class="gap-pill-type"><%= tg.meta.label %> — <%= ROLE_NAMES[tg.role] %></span>
        <span class="gap-pill-meta" style="color:<%- nb.color %>;"><%- nb.label %> &nbsp;<%- signed(tg.gap_signed) %> pts</span>
      </div>
    </div>
    <% }); %>
  </div>

  <div class="page-footer">
    <span>HILeadership | LEAP™</span>
    <span>Confidential — Page 2</span>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════
     PAGE 3 — Your Three Gaps
     ═══════════════════════════════════════════════════════════ -->
<div class="page page-break">
  <div class="page-header">
    <img class="logo" src="./assets/HIL-Isotope.png" alt="Heartfulness Institute of Leadership">
    <span class="header-tagline">LEAP™ — Your Three Gaps</span>
  </div>

  <h2 style="margin-bottom:5pt;">Your Three Gaps</h2>
  <p style="font-size:8.5pt;color:#6b7280;margin-bottom:18pt;line-height:1.6;">
    The 3 largest energy misalignments across your PAEI profile — where Current State,
    Role Expectations, and Intrinsic Preference diverge most.
  </p>

  <% topGaps.forEach(function(tg) {
       const nb    = severityBadge(tg.severity);
       const meta  = tg.meta;
       const color = ROLE_COLORS[tg.role];
       const valA  = pct(scaled_scores[meta.lensA][tg.role]);
       const valB  = pct(scaled_scores[meta.lensB][tg.role]);
       const dailyFeel = interpretation.daily_feel &&
                         interpretation.daily_feel[tg.role] &&
                         interpretation.daily_feel[tg.role][tg.gap_type];
  %>
  <div class="gap-card" style="border-color:<%- color %>44;border-left:3.5pt solid <%- color %>;">
    <div class="gap-card-header" style="background:linear-gradient(90deg,<%- color %>0f 0%,white 100%);">
      <div class="gap-card-title-row">
        <div class="role-circle" style="background:<%- color %>;"><%= tg.role %></div>
        <div class="gap-card-type-info">
          <div class="gap-card-type"><%= meta.label %></div>
          <div class="gap-card-formula"><%= meta.formula %></div>
        </div>
      </div>
      <div class="gap-sev-pill" style="color:<%- nb.color %>;background:<%- nb.bg %>;border-color:<%- nb.border %>;">
        <%- nb.label %> &nbsp;<%- signed(tg.gap_signed) %> pts
      </div>
    </div>
    <div class="gap-bars">
      <div class="gap-bar-row">
        <span class="gap-bar-label"><%= meta.lensALabel %></span>
        <div class="gap-bar-track">
          <div class="gap-bar-fill" style="width:<%- valA %>%;background:<%- color %>;"></div>
        </div>
        <span class="gap-bar-val"><%= valA %>%</span>
      </div>
      <div class="gap-bar-row">
        <span class="gap-bar-label"><%= meta.lensBLabel %></span>
        <div class="gap-bar-track">
          <div class="gap-bar-fill" style="width:<%- valB %>%;background:<%- color %>;opacity:0.45;"></div>
        </div>
        <span class="gap-bar-val"><%= valB %>%</span>
      </div>
    </div>
    <div class="gap-card-narrative"><%= tg.narrative %></div>
    <% if (dailyFeel) { %>
    <div class="daily-feel-callout" style="border-left-color:<%- color %>;">
      <div class="daily-feel-label">What this feels like day-to-day</div>
      <%= dailyFeel %>
    </div>
    <% } %>
  </div>
  <% }); %>

  <% if (topGaps.filter(function(g){return g.severity !== 'low';}).length === 0) { %>
  <div class="well-aligned-box">Your energy profile is well-aligned — no significant misalignments detected.</div>
  <% } %>

  <div class="page-footer">
    <span>HILeadership | LEAP™</span>
    <span>Confidential — Page 3</span>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════
     PAGE 4 — Your Action Path
     ═══════════════════════════════════════════════════════════ -->
<div class="page page-break">
  <div class="page-header">
    <img class="logo" src="./assets/HIL-Isotope.png" alt="Heartfulness Institute of Leadership">
    <span class="header-tagline">LEAP™ — Your Action Path</span>
  </div>

  <h2 style="margin-bottom:4pt;">Your Action Path</h2>
  <p style="font-size:8.5pt;color:#6b7280;margin-bottom:14pt;">
    Sequenced by urgency — start at the top.
  </p>

  <table class="priority-table">
    <!-- Stretch — This Week -->
    <tr class="priority-row">
      <td class="priority-num">1</td>
      <td class="priority-stripe" style="background:<%- actionPath.stretch.roleColor %>;"></td>
      <td class="priority-label">
        <div class="priority-role-circle" style="background:<%- actionPath.stretch.roleColor %>;"><%= actionPath.stretch.role %></div>
        Stretch
      </td>
      <td class="priority-content">
        <strong><%= actionPath.stretch.roleName %></strong>
        <%= actionPath.stretch.description %>
        <div class="priority-action"><%= actionPath.stretch.action %></div>
      </td>
      <td style="width:52pt;text-align:right;vertical-align:top;padding-top:10pt;">
        <span class="timeline-chip chip-week">This Week</span>
      </td>
    </tr>
    <!-- Balance — This Month -->
    <tr class="priority-row">
      <td class="priority-num">2</td>
      <td class="priority-stripe" style="background:<%- actionPath.balance.roleColor %>;"></td>
      <td class="priority-label">
        <div class="priority-role-circle" style="background:<%- actionPath.balance.roleColor %>;"><%= actionPath.balance.role %></div>
        Balance
      </td>
      <td class="priority-content">
        <strong><%= actionPath.balance.roleName %></strong>
        <%= actionPath.balance.description %>
        <div class="priority-action"><%= actionPath.balance.action %></div>
      </td>
      <td style="width:52pt;text-align:right;vertical-align:top;padding-top:10pt;">
        <span class="timeline-chip chip-month">This Month</span>
      </td>
    </tr>
    <!-- Protect — This Quarter -->
    <tr class="priority-row">
      <td class="priority-num">3</td>
      <td class="priority-stripe" style="background:<%- actionPath.protect.roleColor %>;"></td>
      <td class="priority-label">
        <div class="priority-role-circle" style="background:<%- actionPath.protect.roleColor %>;"><%= actionPath.protect.role %></div>
        Protect
      </td>
      <td class="priority-content">
        <strong><%= actionPath.protect.roleName %></strong>
        <%= actionPath.protect.description %>
        <div class="priority-action"><%= actionPath.protect.action %></div>
      </td>
      <td style="width:52pt;text-align:right;vertical-align:top;padding-top:10pt;">
        <span class="timeline-chip chip-quarter">This Quarter</span>
      </td>
    </tr>
    <!-- Complement — This Quarter -->
    <tr class="priority-row">
      <td class="priority-num">4</td>
      <td class="priority-stripe" style="background:<%- actionPath.complement.roleColor %>;"></td>
      <td class="priority-label">
        <div class="priority-role-circle" style="background:<%- actionPath.complement.roleColor %>;"><%= actionPath.complement.role %></div>
        Complement
      </td>
      <td class="priority-content">
        <strong><%= actionPath.complement.roleName %></strong>
        <%= actionPath.complement.description %>
        <div class="priority-action"><%= actionPath.complement.action %></div>
      </td>
      <td style="width:52pt;text-align:right;vertical-align:top;padding-top:10pt;">
        <span class="timeline-chip chip-quarter">This Quarter</span>
      </td>
    </tr>
    <!-- Role Design — Ongoing -->
    <tr class="priority-row">
      <td class="priority-num">5</td>
      <td class="priority-stripe" style="background:#6b7280;"></td>
      <td class="priority-label">
        <div class="priority-role-circle" style="background:#6b7280;">R</div>
        Role Design
      </td>
      <td class="priority-content">
        <strong>Reshaping your role</strong>
        Your Intrinsic Preference reveals the energy you find most natural. Look for ways to
        redesign tasks, delegate, or negotiate responsibilities so your role draws more on what
        energises you.
        <div class="priority-action">Identify one responsibility that drains you and explore who could own it instead.</div>
      </td>
      <td style="width:52pt;text-align:right;vertical-align:top;padding-top:10pt;">
        <span class="timeline-chip chip-ongoing">Ongoing</span>
      </td>
    </tr>
  </table>

  <div style="margin-top:14pt;padding:10pt 13pt;background:#f9fafb;border-radius:6pt;border:1pt solid #e5e7eb;">
    <p style="font-size:8pt;color:#6b7280;line-height:1.7;">
      <strong style="color:#374151;">How to use this report:</strong>
      Your PAEI profile is a tool for self-awareness, not a fixed label. Strengths become
      liabilities when over-used. Use this report to open conversations with colleagues, coaches,
      and managers.
    </p>
  </div>

  <div class="page-footer">
    <span>HILeadership | LEAP™</span>
    <span>Confidential — Page 4</span>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════
     PAGE 5 — Stress Signature + Reflection Prompts
     ═══════════════════════════════════════════════════════════ -->
<div class="page">
  <div class="page-header">
    <img class="logo" src="./assets/HIL-Isotope.png" alt="Heartfulness Institute of Leadership">
    <span class="header-tagline">LEAP™ — Stress Signature & Reflection</span>
  </div>

  <!-- Stress Signature -->
  <div class="stress-signature">
    <h3>Your Stress Signature</h3>
    <% (interpretation.mismanagement_risks || []).forEach(function(risk) { %>
    <p><%= risk %></p>
    <% }); %>
    <% if (topGap) { %>
    <div class="stress-connection">
      Under sustained pressure, this <%= ROLE_FULL_NAMES[dominantRole] || dominantRole %>-dominant profile
      tends toward the pattern above — a direct expression of the tension identified on Page 3.
    </div>
    <% } %>
  </div>

  <!-- Early Warning Signs -->
  <% if (interpretation.early_warnings && interpretation.early_warnings.length > 0) { %>
  <div class="section-label">Early Warning Signs</div>
  <% interpretation.early_warnings.forEach(function(w) { %>
  <div class="warning-card"><%= w %></div>
  <% }); %>
  <% } %>

  <!-- Guided Reflection -->
  <div class="section-label" style="margin-top:18pt;">Guided Reflection</div>
  <p class="reflection-intro">Set aside 10 minutes to write honest answers to these questions.</p>
  <% (interpretation.reflection_questions || []).forEach(function(q, i) { %>
  <div class="reflection-card" style="border-left-color:<%- heroColor %>;">
    <div class="reflection-num"><%= i + 1 %></div>
    <div class="reflection-q"><%= q %></div>
  </div>
  <% }); %>

  <div class="page-footer">
    <span>HILeadership | LEAP™</span>
    <span>Confidential — Page 5</span>
  </div>
</div>

</body>
</html>
```

- [ ] **Step 2: Verify the template renders locally (optional but recommended)**

If Node.js is available locally:
```bash
cd /Users/vrln/adizes-backend/lambda/pdf-generator-v2
node test-local.js 2>&1 | tail -20
```

Expected: no EJS render errors; a PDF is written to `/tmp/` or the local dir.

- [ ] **Step 3: Commit**

```bash
cd /Users/vrln/adizes-backend
git add lambda/pdf-generator-v2/template/report.html
git commit -m "feat(lambda): 5-page PDF redesign — personal snapshot, priority action path, stress/reflection"
```

---

## Task 6 — Local Docker verification + ECR deploy

**Context:** The backend changes (interpretation.py, results.py) need a Docker rebuild to take
effect. The Lambda changes deploy via ECR. Verify locally before pushing to production.

**Files:** No code changes — deployment only.

- [ ] **Step 1: Rebuild backend Docker image**

```bash
cd /Users/vrln/adizes-backend
docker compose up --build -d
```

Wait ~15 seconds, then:
```bash
curl -s http://localhost:8000/health
```

Expected: `{"status":"ok"}` (or similar health response).

- [ ] **Step 2: Run all backend tests**

```bash
docker exec adizes-backend pytest tests/ -v 2>&1 | tail -30
```

Expected: all tests PASS. If any fail, fix before proceeding.

- [ ] **Step 3: Smoke test — submit an assessment and verify new fields in the response**

Log in as `user@adizes.com` / `User@1234`, navigate through the assessment on `http://localhost:3000`,
and submit. On the results page, open browser DevTools → Network tab, find the `/results/{id}` response,
and confirm the `interpretation` object contains `executive_summary`, `daily_feel`, and `reflection_questions`.

- [ ] **Step 4: Deploy Lambda to ECR**

Use the `/deploy-lambda` skill for a guided deploy with production-key guard:
```
/deploy-lambda
```

The skill will prompt for confirmation of the production `SUPABASE_SERVICE_ROLE_KEY` before deploying.

- [ ] **Step 5: Trigger a test PDF**

After Lambda deploys, submit a new assessment via the production app (or use `/retrigger-pdf` on
an existing assessment). Open the resulting `pdf_url` and verify:
- Page 1: executive summary prose present + name in the text
- Page 1: at-your-best / friction two-column cards
- Page 2: matrix with "Current State" / "Role Expectations" / "Intrinsic Preference" row labels (no IS/SHD/WNT)
- Page 2: HIL Isotope logo in navy header
- Page 3: gap cards with "What this feels like day-to-day" italic callout box
- Page 4: priority table with This Week / This Month / This Quarter / Ongoing chips
- Page 5: dark navy stress signature block + 3 reflection questions

- [ ] **Step 6: Final commit (if any fixes made during verification)**

```bash
cd /Users/vrln/adizes-backend
git add -p   # stage only intentional changes
git commit -m "fix(lambda/backend): PDF redesign smoke-test fixes"
```
