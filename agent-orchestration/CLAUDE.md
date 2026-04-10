# CLAUDE.md — Agent Orchestration (JDQI Demo)

## What This Is
A Streamlit demo of the **Claude Advisor Strategy** applied to a real hiring use case:
**JD Quality Intelligence (JDQI)** — analyses a job description across 6 dimensions and
gates it with Opus before it becomes the source of truth for an AI hiring pipeline.

Core insight: AI amplifies whatever signal the JD carries. Garbage JD → garbage hiring at scale.

## Repo
`/Users/vrln/agent-orchestration` · branch: `master`

## Design & Plan
- Spec: `docs/superpowers/specs/2026-04-10-jdqi-advisor-strategy-design.md`
- Plan: `docs/superpowers/plans/2026-04-10-jdqi-advisor-strategy.md`

## Architecture — Advisor Strategy

```
JD Text + Industry
    │
    ▼
Agent 1: JD Parser (Sonnet)          → parsed_jd
    │
    ▼
Agents 2–7: Specialist Analyzers     → dimension_results  (parallel, ThreadPoolExecutor)
    Completeness · Skill Specificity · Cognitive Load
    Inclusion Signals · Compensation · Role Coherence
    │
    ▼
Agent 8: Synthesis Executor (Sonnet) → calls consult_advisor tool
    │  tool call
    ▼
Agent 9: Advisor (Opus, on-demand)   → advisor_report
    │
    ▼
JDQI Report UI (Streamlit)
```

All agents share a plain Python dict (`JDQIContext`) as the shared context.

## File Map
| File | Agent | Purpose |
|---|---|---|
| `agents/parser.py` | Agent 1 | Extract structured fields from raw JD |
| `agents/specialists.py` | Agents 2–7 | 6 dimension analyzers, run in parallel |
| `agents/advisor.py` | Agent 9 | Opus — benchmark comparison + scoring + suggestions |
| `agents/synthesizer.py` | Agent 8 | Sonnet tool loop — calls `consult_advisor` tool |
| `models/context.py` | — | TypedDict schemas for all shared context types |
| `app.py` | — | Streamlit UI: input → live pipeline → JDQI report |

## Local Dev
```bash
cd /Users/vrln/agent-orchestration

# Activate venv (Python 3.11)
source .venv/bin/activate

# Run app
streamlit run app.py --server.port 8501
# → http://localhost:8501
```

`.env` must contain `ANTHROPIC_API_KEY=sk-ant-...`

## Tech Stack
| Layer | Tech |
|---|---|
| UI | Streamlit 1.43+ |
| LLM SDK | anthropic 0.49+ |
| Parallelism | ThreadPoolExecutor (6 specialists) |
| Config | python-dotenv |
| Runtime | Python 3.11 (venv at `.venv/`) |

## JDQI Dimensions
| Dimension | What's checked | Scoring weight |
|---|---|---|
| Completeness | required/preferred skills, success criteria, reporting structure, growth path | 25% |
| Skill Specificity | tools/versions/proficiency levels explicit vs vague | 20% |
| Role Coherence | seniority vs. experience/responsibility alignment | 20% |
| Cognitive Load | word count, Flesch-Kincaid grade, jargon density | 15% |
| Inclusion Signals | exclusionary language flags | 10% |
| Compensation | salary band present/absent | 10% |

## Key Design Decisions
- **Advisor invoked via tool call** — synthesis executor (Sonnet) has one tool `consult_advisor`.
  It calls the tool with a brief summary; the tool handler invokes `run_advisor()` (Opus) with
  the full shared context. This is faithful to the advisor strategy diagram.
- **ThreadPoolExecutor not asyncio** — Streamlit runs its own event loop; threading avoids
  asyncio conflicts and `anthropic.Anthropic` client is thread-safe.
- **Fallback in synthesizer** — if Sonnet doesn't call the tool, `run_synthesizer` calls
  `run_advisor` directly so the pipeline never silently fails.
- **No database** — shared context is an in-memory dict per Streamlit session.
- **`_strip_fences()`** in each agent module — LLMs occasionally wrap JSON in markdown code
  fences despite instructions; stripping them prevents `json.loads` failures.

## Target Segments
- **High-tech Manufacturing** — under-specified JDs (missing Cadence/Altium, SPICE, tool chains)
- **IT/SaaS/AI** — skill inflation ("5 years React + K8s + ML" for mid role)
- **GCCs** — JDs copied from US/EU parent without India market calibration
