# Adizes AMSI — Ranking-Based Scoring Redesign

**Date:** 2026-03-13
**Status:** Approved for implementation
**Scope:** Backend scoring engine, database migration, frontend assessment UX, results display

---

## Problem Statement

The current assessment uses a **single-choice** format (user picks one of four options per question). This produces raw scores of 0–12 per role per dimension, scaled to 0–50. This does not match the Adizes AMSI standard, which uses a **rank-order** format producing scores in the range **12–48**.

The correct scoring model requires users to rank all four options per question from most to least preferred. Each rank contributes a weighted score (rank 1 = 4 pts, rank 2 = 3 pts, rank 3 = 2 pts, rank 4 = 1 pt), giving every role a score on every question.

---

## Decision: Full Re-Take (Approach C)

All existing assessments are marked `expired`. Users must retake under the new format. No attempt is made to re-score old single-choice data — ranks 2–4 were never captured and cannot be fabricated meaningfully. Existing records are preserved for audit purposes only.

---

## Section 1: Data Model

### `answers` table — existing constraints

The current `answers` table has:
- `option_key CHAR(1) NOT NULL CHECK (option_key IN ('a','b','c','d'))` — retained; stores the rank-1 (most preferred) option key
- `UNIQUE (assessment_id, question_id)` — retained; one row per question per assessment. The new format keeps this one-row-per-question model unchanged. All four ranks are stored in the new `ranks` JSONB column on that single row.

Add a `ranks` JSONB column:

```sql
ALTER TABLE answers ADD COLUMN ranks JSONB;
-- Example value: {"a": 1, "b": 3, "c": 4, "d": 2}
-- Key: option_key (a/b/c/d), Value: rank (1=most preferred, 4=least preferred)
-- Invariant: all four keys (a,b,c,d) present, values are a permutation of {1,2,3,4}

CREATE INDEX IF NOT EXISTS idx_answers_ranks ON answers USING gin(ranks);
```

The `option_key` column records the rank-1 option (most preferred) for convenience. The authoritative data is in `ranks`.

### `answers` validation

The backend must validate each submitted `ranks` dict before storing:
- All four option keys (`a`, `b`, `c`, `d`) must be present
- Values must be a permutation of `{1, 2, 3, 4}` (no duplicates, no missing ranks)
- Return HTTP 422 with a descriptive message if validation fails

### `assessments` table — add `status` column

The `assessments` table currently has no `status` column. It must be added before the expiry UPDATE can run:

```sql
-- Add status column with all valid states
ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'in_progress', 'completed', 'expired'));

-- Derive initial status from existing data
UPDATE assessments SET status = 'completed' WHERE completed_at IS NOT NULL;
UPDATE assessments SET status = 'in_progress' WHERE completed_at IS NULL AND started_at IS NOT NULL;

-- Mark all existing assessments expired (clean slate)
UPDATE assessments SET status = 'expired', updated_at = NOW();
```

The assessment router must also write `status` on state transitions:
- On assessment start: `status = 'in_progress'`
- On submit: `status = 'completed'`

### Migration file

`migrations/003_ranking_scoring.sql` — contains all DDL and data changes above, in order.

---

## Section 2: Backend Scoring Engine

### Formula

```
points(rank) = 5 - rank
  rank 1 → 4 pts  (most preferred)
  rank 2 → 3 pts
  rank 3 → 2 pts
  rank 4 → 1 pt   (least preferred)

raw_score[role][section] = Σ points(rank) for each question where option_key → role
```

- Minimum per role per section: 1 × 12 = **12**
- Maximum per role per section: 4 × 12 = **48**
- Per-question total across all 4 roles: 4+3+2+1 = 10 (constant — scores sum to 120 per section when all 36 questions are fully ranked)

### Input validation

Before scoring, assert:
- Exactly 36 answers submitted (one per question)
- Each answer's `ranks` dict contains all four option keys with values forming a permutation of `{1, 2, 3, 4}`

### No scaling

`scaled_scores` now stores the 12–48 values directly. The `round(raw / 12 * 50)` formula is removed.

### Thresholds

| Threshold | Old value | New value | Rationale |
|-----------|-----------|-----------|-----------|
| `DOMINANT_THRESHOLD` | > 30 (out of 50) | > 30 (out of 48) | Midpoint of 12–48 = 30; same numeric value, correct semantics |
| Gap (tension) | ≥ 7 | ≥ 7 | Reasonable on 36-point range; consistent with Adizes literature |
| `GAP_GREEN` (`gap_analysis.py`) | ≤ 4 | ≤ 4 | Unchanged — still proportionally meaningful on 12–48 scale |
| `GAP_AMBER` (`gap_analysis.py`) | ≤ 6 | ≤ 6 | Unchanged |

`gap_analysis.py` severity thresholds are **not changed** — the values 4 and 6 remain reasonable on the 12–48 scale (12% and 17% of range respectively, vs 8% and 12% on 0–50).

### Answer payload (frontend → backend)

Old format:
```json
[{ "question_index": 0, "option_key": "b" }]
```

New format:
```json
[{ "question_index": 0, "ranks": {"a": 3, "b": 1, "c": 4, "d": 2} }]
```

`option_key` at the top level is derived server-side as the key where `ranks[key] == 1`. Frontend does not need to send it explicitly (or may send it as a convenience; backend derives authoritatively from `ranks`).

### `expired` status handling

- Expired assessments cannot be resumed; the API returns 409 Conflict if resume is attempted
- Starting a new assessment when one is expired creates a fresh record (existing behavior)
- `SCORING_KEY` dict (option → PAEI role mapping) is unchanged

---

## Section 3: Frontend Assessment UX

### State shape

```ts
// Old
answers: Record<number, string>  // { question_index: option_key }

// New
answers: Record<number, Record<string, number | null>>
// { question_index: { a: rank | null, b: rank | null, c: rank | null, d: rank | null } }
```

`src/types/api.ts` status union types must add `"expired"`:
```ts
// MyAssessmentItem.status
status: "pending" | "in_progress" | "completed" | "expired"

// RespondentSummary.status
status: "pending" | "in_progress" | "completed" | "expired"
```

### Interaction model: click-to-rank sequentially

1. All 4 options display an empty rank badge (unfilled circle)
2. A prompt above the options shows: **"Select your 1st choice"** (updates as ranks fill)
3. Clicking an unranked option assigns the next available rank; badge fills with the rank number
4. After the 3rd click, the 4th option auto-assigns rank 4
5. Question auto-advances after ~400ms once all 4 are ranked

### Undo / correction

Clicking a ranked option clears that rank and all ranks above it:
- Example: [A=1, B=2, C=3, D=4] → click B → B, C, D clear → prompt returns to "Select your 2nd choice"
- Rank 1 can be cleared, resetting the entire question

### Visual design

Each option card:
```
┌──────────────────────────────────────────┐
│  ②  I tend to focus on building...       │
└──────────────────────────────────────────┘
```

- **Unranked**: gray border, empty circle badge
- **Rank 1**: deepest red filled badge (#C8102E), strongest background tint
- **Rank 2–3**: progressively lighter red badge and tint
- **Rank 4**: lightest tint (auto-assigned, no click needed)

Prompt text (above option list, not inside cards):
> *"Select your **2nd** choice — 3 remaining"*

### Submission

```ts
const answerPayload = Object.entries(answers).map(([idx, rankMap]) => ({
  question_index: parseInt(idx),
  ranks: rankMap,  // { a: 3, b: 1, c: 4, d: 2 }
}));
```

---

## Section 4: Migration & Deployment

### Migration file

`migrations/003_ranking_scoring.sql` (full, in execution order):

```sql
-- 1. Add ranks to answers (one row per question, all 4 ranks in JSONB)
ALTER TABLE answers ADD COLUMN ranks JSONB;
CREATE INDEX IF NOT EXISTS idx_answers_ranks ON answers USING gin(ranks);

-- 2. Add status column to assessments
ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'in_progress', 'completed', 'expired'));

-- 3. Derive current status from timestamps (preserves audit trail before expiry)
UPDATE assessments SET status = 'completed' WHERE completed_at IS NOT NULL;
UPDATE assessments SET status = 'in_progress'
  WHERE completed_at IS NULL AND started_at IS NOT NULL;
-- (rows with neither timestamp remain 'pending')

-- 4. Mark all existing assessments expired (clean slate)
UPDATE assessments SET status = 'expired', updated_at = NOW();
```

### Deployment order (critical)

The window between backend deploy and frontend deploy creates a period where the old frontend could submit single-choice payloads to the new backend, receiving 422 errors. To minimise impact:

1. **Schedule during off-hours** (minimal active users)
2. Run `003_ranking_scoring.sql` on production Supabase
3. Deploy backend immediately after migration
4. Deploy frontend immediately after backend

Steps 3 and 4 should be executed back-to-back with minimal delay. There is no graceful fallback: during the gap, any submit attempt from an old frontend will fail with 422. This is acceptable given off-hours scheduling and the low volume of the current user base.

### Local run

```bash
docker exec -i supabase_db_adizes-backend psql -U postgres -d postgres \
  < migrations/003_ranking_scoring.sql
```

---

## Section 5: Results & Dashboard Display

### Chart domain updates

All radar and bar charts update their `domain` prop:
- `[0, 50]` → `[12, 48]` in `Results.tsx` and `AdminRespondent.tsx`

### Copy updates

| Location | Old text | New text |
|----------|----------|----------|
| Profile badge tooltip | "scored above 30/50 (dominant)" | "scored above 30 (dominant). Scores range 12–48." |
| Gap analysis tooltip | "0–50 scale" | "12–48 scale" |

### Expired state — user Dashboard

When the user's most recent assessment has `status = 'expired'`, show an expiry card instead of results. The `StatusBadge` component must add an `"expired"` branch (currently falls through to amber "Yet to start", which is incorrect):

```
┌─────────────────────────────────────────────┐
│  ⚠  Your previous assessment has expired    │
│  The assessment has been updated to a new   │
│  format. Please retake to see your results. │
│                                             │
│         [ Begin Assessment ]                │
└─────────────────────────────────────────────┘
```

### Expired state — AdminRespondent

Show an "Expired — awaiting retake" badge. No score charts rendered for expired assessments.

---

## Files Affected

| File | Change |
|------|--------|
| `migrations/003_ranking_scoring.sql` | New migration — adds `ranks` column, `status` column, expires all assessments |
| `app/services/scoring.py` | New formula (5−rank), remove scaling, validate ranks permutation |
| `app/schemas/assessment.py` | `AnswerInput`: add `ranks: dict[str, int]`, make `option_key` optional (derived) |
| `app/routers/assessment.py` | New answer payload handling, write `status` on transitions, expired guard (409) |
| `app/services/gap_analysis.py` | No formula change; confirm `GAP_GREEN=4` and `GAP_AMBER=6` unchanged |
| `src/types/api.ts` | Add `"expired"` to `MyAssessmentItem.status` and `RespondentSummary.status` unions |
| `src/store/assessmentStore.ts` | State shape: `answers` from `Record<number,string>` to `Record<number,Record<string,number\|null>>` |
| `src/pages/Assessment.tsx` | Full UX rewrite — click-to-rank with rank badges, prompt, undo, auto-advance |
| `src/pages/Dashboard.tsx` | Expired state card; `StatusBadge` expired branch |
| `src/pages/Results.tsx` | Domain `[12,48]`, tooltip copy updates |
| `src/pages/AdminRespondent.tsx` | Expired badge, domain `[12,48]` |
| `tests/test_scoring.py` | Rewrite all helpers and assertions for rank-order input and 12–48 range |

---

## Out of Scope

- PDF report layout (score values update automatically via existing template variables)
- Question content / `SCORING_KEY` mapping (unchanged)
- Admin cohort management flows
- Email templates
