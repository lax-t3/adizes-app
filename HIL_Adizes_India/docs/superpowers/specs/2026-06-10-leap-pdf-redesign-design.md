# LEAP™ PDF Report Redesign — Design Spec
**Date:** 2026-06-10  
**Repos affected:** `adizes-backend` (Lambda v2 + FastAPI interpretation service)  
**Deploy path:** backend code change → `docker compose up --build -d` → Lambda ECR redeploy  

---

## Overview

Redesign the LEAP™ PDF report (Lambda v2 / `adizes-pdf-generator-v2`) to be more personalized,
narrative-driven, and better connected across pages. The 5-page structure is reordered, new
static-template content is added to `interpretation.py`, and the template + CSS are fully
restructured. No AI API calls — all new text is pre-written static strings keyed by role and gap type.

---

## New 5-Page Structure

| Page | Title | Key Content |
|------|-------|-------------|
| 1 | Personal Snapshot | Executive summary prose + identity badge + at-your-best / friction cards + top gap highlight |
| 2 | Energy Alignment Matrix | Full 3×4 matrix + one-line definition + misalignment pills |
| 3 | Your Three Gaps | Gap cards (existing layout + new "day-to-day" callout box per card) |
| 4 | Your Action Path | Priority-sequenced table: This Week → This Month → This Quarter → Ongoing |
| 5 | Stress Signature + Reflection | Stress pattern block + early warnings + 3 guided reflection questions |

---

## Page-by-Page Content

### Page 1 — Personal Snapshot

**Sections (top to bottom):**

1. **Executive summary prose** — 2–3 sentence paragraph using `executive_summary` field. Pre-written per dominant role, interpolates `user_name` and top gap info. See § Backend Fields.

2. **Identity badge** — role-colored pill: `<identity_line>` (existing field, unchanged).

3. **Two-column block** — "When you're at your best" (`at_your_best`) / "Where friction shows up" (`friction_shows_up`). Same content as current Page 3 meaning-grid, relocated here.

4. **Biggest gap card** — single highlighted block for `topGaps[0]` only. Role-colored left border. Shows: role circle + gap type label + severity pill + score + existing `narrative` text. No bar charts on this page (bars live on Page 3).

**Logo + header:** `HIL-Isotope.png`. Header tagline: `"LEAP™ — Leadership Energy Alignment Profile"`.

---

### Page 2 — Energy Alignment Matrix

**Sections (top to bottom):**

1. **Section heading:** `"Energy Alignment Matrix"`

2. **One-line definition** (static, same for all profiles — hardcoded in template):
   > *"Three lenses on the same person — Current State shows how you operate today, Role Expectations shows what your role demands, Intrinsic Preference shows what naturally energises you."*

3. **Full 3×4 matrix** — existing lens-rows layout, unchanged. Row labels use full names: **Current State** / **Role Expectations** / **Intrinsic Preference** (no IS/SHD/WNT abbreviations). Intrinsic Preference row stays dimmed at 0.55 opacity.

4. **Top Energy Misalignments** pills — existing `topGaps` pills, unchanged, relocated from Page 1.

**Logo + header:** `HIL-Isotope.png`. Header tagline: `"LEAP™ — Energy Alignment Matrix"`.

---

### Page 3 — Your Three Gaps

**Gap cards — same structure as current Page 2 Gap Map**, plus one new element per card:

After the existing `gap-card-narrative` div, add a `daily-feel-callout` box:

```
┌─────────────────────────────────────────────┐
│ [role-colored left border, #f0f4f8 bg]       │
│ italic: "What this feels like day-to-day:"   │
│ <daily_feel text for this gap>               │
└─────────────────────────────────────────────┘
```

`daily_feel` is looked up from the Lambda template using:
`interpretation.daily_feel[tg.role][tg.gap_type]`

The `daily_feel` object is added to the `interpretation` payload by the backend (see § Backend Fields).

Row labels in formula strings on gap cards: use "Current State" / "Role Expectations" / "Intrinsic Preference" (no SHD/WNT). The `GAP_TYPE_META` in `lib/gaps.js` must be updated to use full label names.

**Logo + header:** `HIL-Isotope.png`. Header tagline: `"LEAP™ — Your Three Gaps"`.

---

### Page 4 — Your Action Path

Replace the current 5-card parallel layout (2-column Internal/External grid) with a
**priority-sequenced single-column table**:

| # | Priority | Role | Action | Timeline chip |
|---|----------|------|--------|---------------|
| 1 | Stretch | role circle | description + action prompt | This Week |
| 2 | Balance | role circle | description + action prompt | This Month |
| 3 | Protect | role circle | description + action prompt | This Quarter |
| 4 | Complement | role circle | description + action prompt | This Quarter |
| 5 | Role Design | grey R | static text | Ongoing |

Each row has a role-colored left stripe (4px). Timeline chips are small pills: navy for "This Week", medium-blue for "This Month", grey-blue for "This Quarter", grey for "Ongoing".

Introductory line (static, same for all):
> *"Your action path is sequenced by urgency — start at the top."*

The underlying `actionPath` data structure from `lib/gaps.js` is unchanged; only the template layout changes.

**Logo + header:** `HIL-Isotope.png`. Header tagline: `"LEAP™ — Your Action Path"`.

---

### Page 5 — Stress Signature + Reflection Prompts

**Sections (top to bottom):**

1. **Stress Signature block** — prominent highlighted section (dark navy background, white text):
   - Heading: `"Your Stress Signature"` 
   - Body: `mismanagement_risks[0]` (existing field — the dominant role's `under_stress` text)
   - Connection line (static, role-interpolated in template): 
     `"Under sustained pressure, this <role_name> profile tends toward <mismanagement_label> behaviour — a direct expression of the tension identified on Page 3."`

2. **Early Warning Signs** — `early_warnings` list (relocated from current Page 3), rendered as warning cards (same style as current).

3. **Guided Reflection** — three questions from `reflection_questions` field. Rendered as numbered cards with a subtle left border in dominant role color.

   Introductory line: `"Set aside 10 minutes to write honest answers to these questions."`

**Logo + header:** `HIL-Isotope.png`. Header tagline: `"LEAP™ — Stress Signature & Reflection"`.

---

## Backend Fields

### New fields on `Interpretation` (added to `interpretation.py`)

#### `executive_summary: str`

Static per-dominant-role template string. Computed in `interpret()` using `primary` role.
When top gap exists, the string incorporates gap type name.

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
```

Computed as: `EXECUTIVE_SUMMARIES[primary].format(name=user_name_or_fallback)`

`user_name_or_fallback`: use first word of `user_name` if it contains a space (first name only);
otherwise use the full `user_name` string. Fall back to `"Your profile"` if empty.

**`interpret()` signature change:** Add `user_name: str = ""` parameter. The caller
(`assessment.py` → `submit_assessment()`) already has `user_name` available and must pass it in.

#### `daily_feel: Dict[str, Dict[str, str]]`

Nested dict: `daily_feel[role][gap_type]` — 12 entries (4 roles × 3 gap types: `execution`, `engagement`, `authenticity`).

```python
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
            "something new.' That restlessness is real data — your E instinct is looking for "
            "an outlet the role isn't providing."
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
```

Returned in `interpret()` as: `"daily_feel": DAILY_FEEL` (full nested dict — Lambda picks per-card).

#### `reflection_questions: List[str]`

Three static questions per dominant role.

```python
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

Returned as `"reflection_questions": REFLECTION_QUESTIONS[primary]`.

### Updated `Interpretation` schema (`results.py`)

Add two new optional fields (optional for backwards compat with existing stored results):

```python
executive_summary: Optional[str] = None
daily_feel: Optional[Dict] = None          # Dict[str, Dict[str, str]]
reflection_questions: Optional[List[str]] = None
```

---

## Logo + Theme Changes

### Logo

- **Source:** `/Users/vrln/adizes-frontend/public/HIL-Isotope.png`
- **Destination:** `lambda/pdf-generator-v2/template/assets/HIL-Isotope.png`
- **All 5 page headers:** change `src="./assets/logo.png"` → `src="./assets/HIL-Isotope.png"`
- **`deploy.sh`:** change the asset copy command from `logo.png` to `HIL-Isotope.png`

### CSS Updates

- **Page header:** dark navy background (`#1D3557`), white text and logo tint. Tagline in white.
- **`daily-feel-callout` block:** `background:#f0f4f8`, `border-left:3px solid <role-color>`, italic text, `font-size:8pt`, `padding:8pt 10pt`, `border-radius:4pt`.
- **Action path table:** single-column rows, timeline chips as inline pills. Role-colored left stripe per row.
- **Stress Signature block:** `background:#1D3557`, `color:white`, `border-radius:6pt`, `padding:14pt 16pt`.
- **Reflection question cards:** numbered, `border-left:3px solid <heroColor>`, `background:#f9fafb`.

---

## `lib/gaps.js` — Full Label Names

Update `GAP_TYPE_META` formula strings to use full labels:

| Current | New |
|---------|-----|
| `"\|SHD − IS\|"` | `"\|Role Expectations − Current State\|"` |
| `"\|SHD − WNT\|"` | `"\|Role Expectations − Intrinsic Preference\|"` |
| `"\|IS − WNT\|"` | `"\|Current State − Intrinsic Preference\|"` |

Update `lensALabel` / `lensBLabel` in `GAP_TYPE_META` similarly.

---

## Data Flow

```
FastAPI submit_assessment()
  └─ interpretation.interpret() [now returns executive_summary, daily_feel, reflection_questions]
      └─ payload sent to Lambda

Lambda handler (index.js)
  └─ receives interpretation object with new fields
  └─ EJS template accesses:
       - interpretation.executive_summary     → Page 1
       - interpretation.at_your_best          → Page 1
       - interpretation.friction_shows_up     → Page 1
       - scaled_scores, topGaps               → Page 2
       - topGaps[n].gap_type                  → Page 3
       - interpretation.daily_feel[role][type]→ Page 3 callout
       - actionPath                           → Page 4
       - interpretation.mismanagement_risks   → Page 5
       - interpretation.early_warnings        → Page 5
       - interpretation.reflection_questions  → Page 5
```

---

## Out of Scope

- Frontend results page — no changes in this initiative.
- Email templates — separate changeset (Changeset 2 of the branding spec).
- Adizes360 / multi-rater — Phase 2.
- Re-running PDF generation for existing assessments — manual via `/retrigger-pdf` if desired.

---

## Files Changed

| File | Change type |
|------|-------------|
| `app/services/interpretation.py` | Add 3 new data dicts + 3 new fields to `interpret()` return |
| `app/schemas/results.py` | Add `executive_summary`, `daily_feel`, `reflection_questions` to `Interpretation` |
| `lambda/pdf-generator-v2/template/report.html` | Full restructure — 5 pages in new order |
| `lambda/pdf-generator-v2/template/styles.css` | New component styles |
| `lambda/pdf-generator-v2/template/assets/HIL-Isotope.png` | New asset (copy from frontend/public) |
| `lambda/pdf-generator-v2/lib/gaps.js` | Update `GAP_TYPE_META` label strings |
| `lambda/pdf-generator-v2/deploy.sh` | Copy `HIL-Isotope.png` instead of `logo.png` |
