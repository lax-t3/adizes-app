# CLAUDE.md — FORGE FDE Training Project

## What This Is
Working directory for the **FORGE — Forward Deployed Engineer (FDE) Academy** training programme
run by **TechAdemy** (delivered to an EY Tech Consulting Unit cohort). This folder holds the
training calendars, day-by-day TOCs, per-session prep material, and trainer hand-over / lab-readiness
artefacts. It is **content/curriculum**, not application code.

> Not to be confused with the LEAP™ / Adizes app documented in `/Users/vrln/CLAUDE.md`.

## Trainers
- **Lakshminarayanan** (the user) — lead trainer.
- **Rammohan** — co-trainer.
Orientation is co-delivered; teaching days are split between the two (see Daywise Mapping `Trainer Names`).

## Batches (per `July Batch2_FDE_TOC.xlsx` → "Programme Path Extensions")
| Batch | Track | Status | Stack focus |
|-------|-------|--------|-------------|
| Batch 1 | **Azure** | Current pilot | ADF · Synapse · Fabric · OpenAI · AI Foundry · Agentic AI · React · FastAPI |
| Batch 2 | (see note) | Scale-up | The `July Batch2_FDE_TOC.xlsx` content is **Azure**, though the Path-Extensions roadmap tab labels Batch 2 as the AWS track — **the two docs disagree; confirm before relying on it.** |
| Batch 3 | GCP / Multi-cloud | Q2 plan | Vertex AI · BigQuery · Dataflow · Gemini |

Common framework across all tracks: FDE Mindset (M01) · Client Engagement (M02) · Stakeholder
Intelligence (M03) · 4 Sprint Gates · TechDrive case study woven through · production-grade prototype capstone.

## Cohort Model (important)
Programmes run as a **single mixed cohort** of three role streams that sit in the **same sessions**
and diverge only in role-specific lab variants — there are **no separate per-track timetables**:
- **Data Engineers** — ADF · Synapse · Fabric · dbt · PySpark · Delta Lake
- **Data Scientists** — Azure ML · MLflow · AutoML · Python ML
- **FSE / Front-End** — React 18 · FastAPI · TypeScript · Azure Container Apps · Docker

When asked for "track hours", it means the sessions whose **topic** is that discipline, not a parallel clock.

## Key Files
| File | What it is |
|------|------------|
| `Forge_Training Calendar_Consolidated[8].xlsx` | **Batch-1 master calendar.** 3 sheets: `Training Calendar` (dates/trainers, 166 teaching hrs), `Daywise Mapping` (**v5.0 — authoritative**: per-day session, **Hands-on Labs**, **Tools & Frameworks**, outcomes, validators), `Lab Details` (tool → provisioning → VM/cloud). |
| `July Batch2_FDE_TOC.xlsx` | **Batch-2 TOC.** 41 days + pre-assessment ≈ 168 hrs. Sheets: Programme Overview, Day-by-Day TOC, Artefacts & Outcomes, Programme Path Extensions, TechDrive Use Case Framework. |
| `FORGE_Batch1_Our48hrs_Coverage.xlsx` | Lakshminarayanan's Batch-1 allocation: 12 sessions / 48 hrs. **Topic labels are STALE** vs the v5.0 Daywise Mapping (dates + 48h total still match). |
| `fde_curriculum_42day.xlsx` | 42-day curriculum source. |
| `prep/` | Per-day prep `.md` decks (D03–D25), `build_deck.py`, war-story + session `.pptx`, `Forward_Deployed_Engineer.pdf`, `Organiser_Questions.md`. |
| `Azure_Guides/` | Azure access guides + trainer/VM creds (`.rtf` — **secrets, do not commit/echo**), troubleshooting + workspace PDFs. |

### Generated this session (trainer artefacts)
| File | Purpose |
|------|---------|
| `Batch2_DE_Track_HandOver.xlsx` | DE-track hand-over sheet for an incoming trainer (M05 core = 20h; +sprint days = 32h; +Foundations = 36h). |
| `Batch1_Lakshminarayanan_LabReadiness.xlsx` | Lakshminarayanan's Batch-1 labs + approach by day, plus a colour-coded provisioning checklist. |

## Source-of-Truth Rule (version drift exists)
Two Batch-1 files disagree on **session topics** while agreeing on **dates and the 48-hr total**.
Treat **`Daywise Mapping` (v5.0)** in the consolidated calendar as authoritative — it is the only
source with actual lab definitions + tool lists. The `Our48hrs_Coverage` topic labels are an older
mapping. **Flag the mismatch rather than silently merging; ask the user which is canonical.**

## Programme Numbers (as documented)
- **Batch 1:** ~166 teaching hrs · 42 sessions · 4 hrs/session · 5 weeks · VILT + labs. Runs **23-Jun → 19-Aug-2026** (Mon–Fri; weekends off). Cohort ~10–15.
- **Batch 2:** ~168 contact hrs · 41 days + pre-assessment · 4h/day · 9 weeks · 4 sprint gates. Cohort 15.
- **Lakshminarayanan's Batch-1 load:** 48 hrs across 12 teaching days + shared 1-hr orientation.

## Lakshminarayanan's Batch-1 Teaching Days (by date — v5.0 Daywise Mapping)
23-Jun (ORI, 1h, shared) · 26-Jun Python AI Scaffolding · 29-Jun DDD Bounded Contexts ·
30-Jun DDD Context-Map Studio · 02-Jul Architecture Studio + Coaching #1 · 03-Jul W1 Integration/SCQA ·
06-Jul Azure AI Foundry/IAM **[infra-heavy, co-deliver SME]** · 13-Jul Eval Harness/Telemetry (2h) ·
14-Jul Container Apps/CI-CD/LLMOps + Coaching #2 **(5h, longest)** · 20-Jul Knowledge Graph/Cypher ·
21-Jul Architecture Discovery · 27-Jul AI Security/OWASP/Guardrails · 28-Jul Spec-Driven Development.

## Lab Provisioning — gating items (from `Lab Details`)
- ⚠️ **Azure OpenAI + AI Foundry access approval** (06-Jul) — has lead-time, request early.
- **Azure subscription + quota** per pod — ACA/ACR/AKS, Cosmos, AI Search, Monitor (Weeks 2–3).
- **Local VM per learner** — VS Code, 16 GB/4 vCPU, Python 3.12, uv, Docker; **Copilot Business + Cursor** licences (D02/03/28).
- **Neo4j Aura sandbox** (20-Jul) · **Guardrails AI / NeMo** (27-Jul) · **App Insights / Azure Monitor** (13/14-Jul).
- Browser tools (no install): Miro/FigJam · Structurizr · Mermaid.

## Working Conventions
- **Excel is the working format.** Use the project venv at `.venv` (Python 3.12, openpyxl) — run scripts
  with `.venv/bin/python`. It is git-ignored; recreate with
  `/usr/local/bin/python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt`.
- **`.venv` is for local authoring only — NOT the delivery target.** Any **lab** built here in the
  local venv must be **migrated to the Techademy-provided Azure VM and tested there** before it is
  considered done. The local venv is a scratch/authoring environment; the Azure VM is the real
  runtime learners use. Treat "works in `.venv`" as a draft — always verify on the Azure VM.
  (VM access: `Azure_Guides/Lakshminarayanan Azure & VM Creds.rtf`, `MML_Azure_Access_Guide-N.pdf`.)
- Generated artefacts follow the user's house style: navy `#1D3557` headers, red `#C8102E` accents,
  amber/teal section bands, frozen header row, gridlines off, a blank **"✓ Ready?"** sign-off column.
- When asked to total "track" or "trainer" hours, sum the relevant **sessions** (4h each; note the
  2h on 13-Jul and 5h on 14-Jul exceptions) — there is no separate per-track schedule.
- **Secrets:** `Azure_Guides/*Creds.rtf` hold live Azure/VM credentials — never echo, commit, or paste them.
