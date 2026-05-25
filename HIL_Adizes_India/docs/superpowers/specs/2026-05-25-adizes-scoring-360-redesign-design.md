# Adizes Scoring & 360 Redesign — Design Spec
**Date:** 2026-05-25  
**Scope:** Two phases — Phase 1: new scoring engine + gap model + 5-page PDF redesign; Phase 2: Adizes360 feature (external respondents + 7-page report)

---

## 1. Context & Motivation

The report is evolving from a **PAEI Style Report** to a **PAEI Energy Alignment Profile**. The shift is conceptual: instead of describing a management style, the report diagnoses alignment and misalignment of energy across three perceptual lenses:

- **Current State (IS)** — how the person believes they currently operate
- **Role Expectations (SHOULD)** — what they believe is expected of them
- **Intrinsic Preference (WANT)** — what they naturally prefer

These are perceptions, not objective truths. The value lies in revealing where perceptions align and where they diverge.

Reference brief: `/Users/vrln/HIL_Adizes_India/PAEI Energy Alignment Profile — Report Redesign Brief.md`

---

## 2. Phased Delivery

### Phase 1 — Adizes90 Redesign
Scoring engine change, new gap model, clean-slate migration, redesigned 5-page PDF. Self-assessment only.

### Phase 2 — Adizes360 Extension
360-degree assessment layer: external respondents (superior / peer / direct report), aggregation logic, 7-page extended PDF report.

---

## 3. Phase 1: Scoring Engine

### 3.1 Points Mapping

Ranking direction **unchanged** (rank 1 = most like me, rank 4 = least like me). Only the points awarded change:

| Rank | Meaning | Old points | New points |
|---|---|---|---|
| 1 | Most like me | 4 | **5** |
| 2 | | 3 | 3 |
| 3 | | 2 | 2 |
| 4 | Least like me | 1 | 1 |

Points per question: 5+3+2+1 = **11**  
Points per section (12 questions): **132**  
Constraint per section: P + A + E + I = 132

Implementation in `scoring.py`:
```python
RANK_POINTS = {1: 5, 2: 3, 3: 2, 4: 1}
```

### 3.2 Dominance Factor (Consistency Adjustment)

Purpose: boost roles that are consistently strong across questions, not just occasionally high.

**Step 1 — Count high rankings per role:**
- For each role, count how many of the 12 questions it was ranked 1 or 2 (top two preferences)
- `dominance_ratio = count / 12`

**Step 2 — Apply boost:**
- If `dominance_ratio > 0.75`: `adjusted_score = raw_score × 1.05`
- Otherwise: no change

**Step 3 — Rebalance to 132:**
```
new_total = P + A + E + I   (after any boosts applied)
scale = 132 / new_total
final_score = adjusted_score × scale   (applied to all 4 roles)
```

Constraint: boost is small (max ~5%) and never changes which role is dominant — it enhances signal only.

### 3.3 Display Normalization (UI and PDF only)

```
display_score = (raw_score / 132) × 100
```

All four roles per section sum to 100 in display. The 132-scale raw scores are used for all gap calculations.

### 3.4 Dominance Threshold (Profile String)

A role is **dominant** (uppercase in profile string, e.g. `"PAei"`) when:
```
raw_score > 33   (= 132 ÷ 4, the equal-distribution point)
```

Any role scoring above 33 is pulling more than its proportional share — that is the dominance signal.

---

## 4. Phase 1: Gap Model

### 4.1 Three Core Gaps

For each PAEI role (P, A, E, I), three gaps are calculated on the 132 raw scale:

| Gap | Formula (signed) | Display | What it measures |
|---|---|---|---|
| **Execution Gap** | `SHOULD − IS` | `abs(value)` | Role demand vs current behaviour |
| **Engagement Gap** | `SHOULD − WANT` | `abs(value)` | Role demand vs natural preference |
| **Authenticity Gap** | `IS − WANT` | `abs(value)` | Current behaviour vs natural preference |

**Signed value** is preserved internally for narrative direction.  
**Absolute value** is used for all display, scoring, heatmaps, and severity.

### 4.2 Directional Interpretation

**Execution Gap:**
- Positive (SHOULD > IS): Role may require more of this energy than currently shown
- Negative (IS > SHOULD): Currently operating beyond what the role requires

**Engagement Gap:**
- Positive (SHOULD > WANT): Role requires energies that don't naturally energise
- Negative (WANT > SHOULD): Role underutilises naturally preferred energies

**Authenticity Gap:**
- Positive (IS > WANT): Sustained adaptation beyond natural preference — fatigue risk
- Negative (WANT > IS): Natural strengths not fully expressed in current behaviour

### 4.3 Severity Thresholds (132 scale)

| Absolute gap size | Level | Display |
|---|---|---|
| < 6 | Low | Not shown |
| 6 – 15 | Medium | 🟡 MODERATE |
| > 15 | High | 🔴 HIGH |

### 4.4 Top Gaps Selection

Total gap values: 4 roles × 3 gap types = 12 values.  
Select top 3 by absolute magnitude. These drive:
- Page 1 summary pills
- Page 2 gap cards
- Pages 3–5 narrative generation

### 4.5 DB Storage

The `assessments.gaps` JSONB field expands to store all three gap types per role:

```json
[
  {
    "role": "E",
    "execution_gap": 27,       "execution_gap_signed": 27,
    "engagement_gap": 10,      "engagement_gap_signed": -10,
    "authenticity_gap": 19,    "authenticity_gap_signed": -19,
    "execution_severity": "high",
    "engagement_severity": "medium",
    "authenticity_severity": "high"
  },
  ...
]
```

---

## 5. Phase 1: Database Migration

### Migration 010 — Clean Slate

```sql
-- Migration 010: Clean slate for new scoring engine
-- answers cascade-deleted via FK ON DELETE CASCADE
DELETE FROM assessments;
```

**Why delete rather than expire:** The points mapping change (rank 1: 4 pts → 5 pts) means all existing stored scores are incompatible with the new formula. Stored `ranks` JSONB values are valid but would produce different scores under the new engine. Clean slate is the correct approach.

**S3 note:** Existing PDF objects at `s3://adizes-pdf-reports/reports/<id>.pdf` become orphaned. They are not deleted by this migration — small storage cost, no functional impact.

**No schema changes needed for Phase 1** — `raw_scores`, `scaled_scores`, `gaps`, `profile` are all JSONB and accommodate the new structure without alteration.

---

## 6. Phase 1: PDF Report Structure (5 Pages)

Visual system: role colors (P=#C8102E red, A=#1D3557 navy, E=#E87722 amber, I=#2A9D8F teal), horizontal bars on 0–100 display scale, gap severity pills (🔴 HIGH / 🟡 MODERATE).

### Page 1 — Energy Alignment Snapshot

- **Header:** Name · Date · Identity label chip (e.g. "Adaptive Driver — P–E Weighted")
- **Energy Alignment Matrix:** 3-row × 4-column table
  - Rows: Current State / Role Expectations / Intrinsic Preference
  - Columns: P / A / E / I
  - Each cell: horizontal bar (display %) in role color + percentage label
  - Intrinsic Preference row: slightly reduced bar opacity (visual de-emphasis as anchor lens)
- **Core Insight:** Left-accent block, 2–3 sentence rule-generated narrative from top gap
- **Top Energy Misalignments:** 3 pills showing top gaps (role + type + severity + signed magnitude)

### Page 2 — Gap Map

Top 3 gaps rendered as individual cards. Each card:
- Role badge (colored circle) + gap type name + formula subtitle
- Two comparison bars (the two lenses involved, not all three)
- Severity pill with signed magnitude (e.g. `+27 pts` or `−14 pts`)
- Direction-aware rule-generated narrative (2–3 sentences)
- Card border color = severity (red = HIGH, amber = MODERATE)

### Page 3 — What This Means

Three rule-generated subsections:
- **When you are at your best** — from the role with the lowest peak gap (aligned role)
- **Where friction shows up** — from the HIGH gap role(s)
- **Early warning signs** — from the signed direction of top gaps

### Page 4 — Style Summary

Four blocks, rule-generated from dominant roles (raw score > 33):
- **Core style** — paragraph combining dominant role labels and characteristics
- **Strengths** — bulleted list from dominant roles' strength library
- **Watchouts** — from dominant roles' mismanagement-risk library (e.g., "Lone Ranger" for dominant P)
- **Behaviour under stress** — from per-role stress-response library

Each role has a pre-written text library for all four blocks. Engine picks and combines based on which roles are dominant.

### Page 5 — Action Path

Two-column, six-cell layout, all rule-generated:

| Internal Shifts | External Shifts |
|---|---|
| **Stretch** → role with highest Execution Gap | **Complement** → role with lowest score (seek in others) |
| **Balance** → role with highest Authenticity Gap | **Role Design** → narrative about reshaping role toward WANT |
| **Protect** → role with lowest peak gap | |

Each cell: 2–3 directive sentences from a per-role × per-cell text library.

---

## 7. Phase 2: 360 Assessment — Data Model

### 7.1 New Tables (Migration 011)

**`assessment_360_sessions`**

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `cohort_id` | UUID FK → cohorts | |
| `subject_user_id` | UUID FK → auth.users | person being assessed |
| `self_assessment_id` | UUID FK → assessments | nullable — set when subject completes |
| `status` | TEXT | `open` \| `closed` \| `report_generated` |
| `deadline` | TIMESTAMPTZ | nullable, admin-controlled |
| `aggregated_scores` | JSONB | `{is_others:{P,A,E,I}, should_others:{P,A,E,I}}` — written on close |
| `gaps_360` | JSONB | Perception / Expectation / Execution gaps — written on close |
| `pdf_url` | TEXT | 7-page report URL, set after Lambda completes |
| `created_by` | UUID | admin user_id |
| `created_at` | TIMESTAMPTZ | |
| `closed_at` | TIMESTAMPTZ | |

UNIQUE constraint: `(cohort_id, subject_user_id)` — one active 360 session per person per cohort.

**`assessment_360_respondents`**

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `session_id` | UUID FK → assessment_360_sessions | |
| `respondent_user_id` | UUID FK → auth.users | |
| `respondent_type` | TEXT | `up` \| `sideways` \| `down` |
| `assessment_id` | UUID FK → assessments | nullable — set when respondent submits |
| `invited_at` | TIMESTAMPTZ | |

UNIQUE: `(session_id, respondent_user_id)` — one response per assessor per session.

### 7.2 Modified Existing Tables (Migration 011)

**`assessments`** — three new columns:
```sql
ALTER TABLE assessments
  ADD COLUMN respondent_type TEXT DEFAULT 'self'
    CHECK (respondent_type IN ('self','up','sideways','down')),
  ADD COLUMN subject_user_id UUID,
  ADD COLUMN session_360_id UUID REFERENCES assessment_360_sessions(id);
```

**`questions`** — one new column:
```sql
ALTER TABLE questions ADD COLUMN text_360 TEXT;
-- Seeded for Q0–Q23 only (IS + SHOULD sections)
-- Self-perspective text remains in questions.text (unchanged)
```

> **Content authoring prerequisite:** Before Phase 2 can ship, all 24 IS + SHOULD questions need a `text_360` version rewritten from the assessor's perspective (e.g. "I spend most of my time..." → "This person spends most of their time..."). This is a content task, not a code task. The migration seeds `text_360 = NULL`; the assessment router falls back to `questions.text` if `text_360` is null, so the feature degrades gracefully until all entries are populated.

### 7.3 Anonymity & RLS

- Individual respondent assessment rows are **never visible to the subject** — only aggregated scores in `assessment_360_sessions` are accessible to the subject
- Respondent sees and edits only their own assessment (`user_id = auth.uid()` — existing policy unchanged)
- Admin (service role) sees all rows
- Subject can read their own `assessment_360_sessions` row (aggregated results) but cannot join through to individual respondent assessments

---

## 8. Phase 2: Aggregation Logic

Runs when admin closes a session (`POST /admin/360/sessions/{id}/close`).

### 8.1 Respondent Scoring

Each respondent answers 24 questions (IS: Q0–Q11, SHOULD: Q12–Q23) using the same scoring engine as self-assessment (same RANK_POINTS mapping, same 132-point total per section, same dominance factor).

### 8.2 IS_others Aggregation (Weighted)

Base weights: up=25%, sideways=25%, down=50%

**Proportional redistribution for missing types:**
- If a respondent type has zero completions, its weight is redistributed proportionally to the remaining types
- E.g., no "down" responses → up=50%, sideways=50%
- E.g., no "up" or "sideways" → down=100%

**Group score** = average of all individual scores within that type.

```
IS_others[role] = Σ (group_weight × group_average[role])
```

### 8.3 SHOULD_others Aggregation (Equal weight)

```
SHOULD_others[role] = average across all present respondent-type group averages
```

No directional weighting for SHOULD — reflects collective role expectation alignment.

### 8.4 360 Gap Calculations

Three gap types, per PAEI role, same severity thresholds as self-report (<6 low, 6–15 medium, >15 high):

| Gap | Formula | Measures |
|---|---|---|
| **Perception Gap** | `IS_self − IS_others` | Self-view vs how others experience behaviour |
| **Role Expectation Gap** | `SHOULD_self − SHOULD_others` | Alignment on role definition |
| **Role Execution Gap (others)** | `SHOULD_others − IS_others` | How others assess execution against their expectations |

All three stored with both signed value (for narrative direction) and absolute value (for display) in `assessment_360_sessions.gaps_360`.

### 8.5 Top Gaps per Section

- Perception: top 3 by absolute magnitude → drive Section 1 pills + narrative
- Role Expectation: top 3 → drive Section 2 pills (no narrative)
- Role Execution (others): top 3 → drive Section 3 pills (no narrative)

---

## 9. Phase 2: PDF Report Extension (Pages 6–7)

Lambda receives extended payload when `session_360` field is present. Pages 6–7 are appended to the 5-page self-report.

### Page 6 — 360° Perspective

Same visual language as Pages 1–2 (matrix bars, role colors, severity pills). Self rows use full opacity; Others rows use reduced opacity to distinguish source.

**Section 1 — Do I see myself as others see me?**
- Mini 2×4 matrix: Self (IS) vs Others (IS)
- Top Perception Gap pills (role + severity + signed magnitude)
- Direction-aware narrative paragraph (rule-generated)

**Section 2 — How do others understand my role?**
- Mini 2×4 matrix: Self (SHOULD) vs Others (SHOULD)
- Top Role Expectation Gap pills, OR aligned confirmation block if all gaps < 6
- No narrative (per spec)

**Section 3 — How do others see my execution performance?**
- Mini 2×4 matrix: Others (SHOULD) vs Others (IS)
- Top Role Execution Gap pills
- No narrative (per spec)

### Page 7 — Action Path Adjustments

Same card layout as Page 5, with 360-adjusted content.

- **Coaching Inputs block** — reserved open-text placeholder for coach/admin annotation before sharing. No automated content in v1.
- **Internal Shifts (adjusted):** Stretch / Balance / Protect cells from Page 5, each appended with a one-line 360 modifier informed by perception and execution gaps
- **External Shifts (adjusted):** Complement / Role Design cells similarly adjusted with 360 context

---

## 10. Phase 2: Backend API

### New Admin Endpoints (`routers/admin.py`)

| Method | Path | Action |
|---|---|---|
| POST | `/admin/360/sessions` | Create 360 session (cohort_id, subject_user_id, deadline?) |
| GET | `/admin/360/sessions` | List sessions with status and respondent counts |
| GET | `/admin/360/sessions/{id}` | Session detail — respondent list, completion status |
| POST | `/admin/360/sessions/{id}/respondents` | Add assessor (respondent_user_id, respondent_type) |
| DELETE | `/admin/360/sessions/{id}/respondents/{rid}` | Remove assessor |
| POST | `/admin/360/sessions/{id}/close` | Close session → run aggregation → fire Lambda |

### New Assessment Endpoints (`routers/assessment_360.py`)

| Method | Path | Action |
|---|---|---|
| GET | `/assessment/360/{session_id}` | Get session context for respondent (subject name, their type, questions with text_360) |
| POST | `/assessment/360/{session_id}/submit` | Respondent submits 24-question assessment (IS + SHOULD) |

### New Service (`services/aggregation_service.py`)

Handles all aggregation logic described in Section 8. Called exclusively by the close-session endpoint.

---

## 11. Frontend Changes

### 11.1 Phase 1 — Existing Pages Modified

#### `Results.tsx` (user-facing results page)

The current page shows a radar chart, a 2-gap bar chart, and an interpretation panel. All three sections need updating:

**Replace radar chart with Energy Alignment Matrix:**
- Remove `RadarChart` (Recharts) — replaced by the 3-row × 4-column matrix bar layout matching the PDF design
- Bars use display% (0–100), role colors (P=#C8102E, A=#1D3557, E=#E87722, I=#2A9D8F)
- Rows: Current State / Role Expectations / Intrinsic Preference

**Update gap display:**
- Remove 2-gap layout (External / Internal) — replace with 3-gap cards (Execution / Engagement / Authenticity)
- New severity thresholds: <6 low (not shown), 6–15 🟡 MODERATE, >15 🔴 HIGH — all on 132 scale
- Show only top 3 gaps (not all 12 values)
- Show signed direction alongside absolute severity (e.g. "+27 pts — role expects more than current behaviour")

**Update ScoresTable component:**
- Change scale display from 12–48 to display% (0–100)
- Update InfoTooltip copy to use new terminology (Current State / Role Expectations / Intrinsic Preference)

**Update dominant style badge:**
- Change tooltip: threshold is now raw > 33 (not > 30 scaled)

**PDF sticky bar:** no change — still polls `pdf_url` and opens in new tab when ready.

---

#### `AdminCohortDetail.tsx` (admin cohort management page)

**Team analytics section:**
- Remove radar chart — replace with matrix bar visualization using display% (aggregate average across completed members)
- Update score axis labels (0–100 instead of 12–48)

**Members table — per-row changes:**
- "Dominant Style" column: profile string generated with new threshold (raw > 33)
- "Status" column: add `expired` as a valid badge state (amber, distinct from pending) — existing expired assessments show as expired, not pending
- "Actions" column for completed members: "View Results" link unchanged

---

#### `AdminRespondent.tsx` (admin view of individual member results)

- Update score display to display% (0–100)
- Update gap display to 3-gap model (Execution / Engagement / Authenticity) with new thresholds
- Remove radar chart, add matrix bar layout (consistent with Results.tsx and PDF)

---

### 11.2 Phase 2 — Existing Pages Modified

#### `Results.tsx` — 360 status section

Add a new section below the existing content (visible only when the user has an active 360 session for the current cohort):

```
┌─────────────────────────────────────────────────────┐
│  360° Assessment                                     │
│  Status: Open — 3 of 5 respondents completed        │
│  Waiting for: 1 superior, 1 peer                    │
│                                                      │
│  [Download 360 Report]  ← shown when report_generated│
└─────────────────────────────────────────────────────┘
```

- Polls `/assessment/360/session-status?cohort_id=<id>` on load
- Shows spinner + "Generating…" state while `status = closed` and `pdf_url = null`
- Shows download button when `pdf_url` is set

---

#### `AdminCohortDetail.tsx` — 360 management integration

**Members table — new 360 column:**

| 360 Status | Display |
|---|---|
| No session | "— " + "Start 360" button |
| Open, incomplete | "Open · X/Y done" + "Manage" link |
| Closed, generating | "Generating report…" |
| Report ready | "Report Ready" + "Download" button |

**New "Manage 360" action per member row:**
- Opens a slide-over/modal OR routes to `/admin/cohorts/:id/360/:session_id`
- Shows: respondent list (type + name + status), add respondent form, close session button
- Close session disabled until at least 1 respondent has completed (per type OR total — admin's discretion)

---

### 11.3 Phase 2 — New Pages

| Screen | Route | Who | Purpose |
|---|---|---|---|
| Respondent: 360 assessment | `/assess/360/:session_id` | Assessor | 24-question flow (IS + SHOULD), subject name shown, `text_360` phrasing |
| Admin: 360 session detail | `/admin/cohorts/:id/360/:session_id` | Admin | Add/remove respondents, completion tracking, close session |

---

## 12. Guardrails

**Phase 1:**
- Never combine IS, SHOULD, WANT into a single score
- Boost never exceeds 5%; always rebalance to 132 after boost
- Show only top 3 gaps — never all 12
- Totals always equal 132 per section

**Phase 2:**
- Individual respondent assessments are never shown to the subject — aggregated only
- 360 is presented as additional insight, not correction
- Interpretation is constructive, not judgmental
- WANT dimension is not collected from 360 respondents
