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

### `answers` table

Add a `ranks` JSONB column to store the full rank assignment per question:

```sql
ALTER TABLE answers ADD COLUMN ranks JSONB;
-- Example value: {"a": 1, "b": 3, "c": 4, "d": 2}
-- Key: option_key (a/b/c/d), Value: rank (1=most preferred, 4=least preferred)

CREATE INDEX IF NOT EXISTS idx_answers_ranks ON answers USING gin(ranks);
```

The existing `option_key` column is retained but now records the rank-1 (most preferred) option for convenience. All 4 ranks are authoritative in `ranks`.

### `assessments` table

New terminal status value: `expired`.

```sql
UPDATE assessments
SET status = 'expired', updated_at = NOW()
WHERE status IN ('completed', 'in_progress', 'pending');
```

No rows deleted. Status `expired` means the assessment was completed or started under the old format and must be retaken.

### Migration file

`migrations/003_ranking_scoring.sql` — contains both DDL changes and the expiry UPDATE.

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
- Per-question total across all 4 roles: 4+3+2+1 = 10 (constant — scores sum to 120 per section)

### No scaling

`scaled_scores` now stores the 12–48 values directly. The `round(raw / 12 * 50)` formula is removed.

### Thresholds

| Threshold | Old value | New value | Rationale |
|-----------|-----------|-----------|-----------|
| Dominant  | > 30 (out of 50) | > 30 (out of 48) | Midpoint of 12–48 = 30; same numeric value, correct meaning |
| Gap       | ≥ 7 | ≥ 7 | Reasonable on 12–48 scale; consistent with Adizes literature |

### Answer payload (frontend → backend)

Old format:
```json
[{ "question_index": 0, "option_key": "b" }]
```

New format:
```json
[{ "question_index": 0, "ranks": {"a": 3, "b": 1, "c": 4, "d": 2} }]
```

`option_key` at the top level is the rank-1 option (derived from `ranks`).

### `expired` status handling

- Expired assessments cannot be resumed; the API returns 409 if a resume is attempted
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
  ranks: rankMap,
  option_key: Object.keys(rankMap).find(k => rankMap[k] === 1) ?? "",
}));
```

---

## Section 4: Migration & Deployment

### Migration file

`migrations/003_ranking_scoring.sql`:
```sql
ALTER TABLE answers ADD COLUMN ranks JSONB;
CREATE INDEX IF NOT EXISTS idx_answers_ranks ON answers USING gin(ranks);
UPDATE assessments SET status = 'expired', updated_at = NOW()
WHERE status IN ('completed', 'in_progress', 'pending');
```

### Deployment order (critical)

1. Run `003_ranking_scoring.sql` on production Supabase
2. Deploy backend (new scoring engine, new payload schema)
3. Deploy frontend (new assessment UX)

Backend must deploy before frontend to avoid old single-choice payloads hitting the new scoring engine.

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

When the user's most recent assessment has `status = 'expired'`, show an expiry card instead of results:

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
| `migrations/003_ranking_scoring.sql` | New migration |
| `app/services/scoring.py` | New formula, new payload schema, remove scaling |
| `app/routers/assessment.py` | New answer payload handling, expired status guard |
| `src/pages/Assessment.tsx` | Full UX rewrite — click-to-rank |
| `src/pages/Dashboard.tsx` | Expired state card |
| `src/pages/Results.tsx` | Domain labels, tooltip copy |
| `src/pages/AdminRespondent.tsx` | Expired badge, domain labels |
| `src/store/assessmentStore.ts` | State shape update |

---

## Out of Scope

- PDF report layout (scores will update automatically via existing template variables)
- Question content / `SCORING_KEY` mapping (unchanged)
- Admin cohort management flows
- Email templates
