# LangGraph Multi-Agent Investment Research Brief — Design Spec

**Date:** 2026-05-02  
**Domain:** Investment Research  
**Purpose:** Training demonstration — replaces single-step AI prompts with a stateful multi-agent assistant that solves 5 real orchestration problems.

---

## 1. Problem → Solution Mapping

| # | Problem | LangGraph Solution | Primitive |
|---|---------|-------------------|-----------|
| 1 | Loses intermediate context during multi-step reasoning | Typed state carried across all agents | `TypedDict` + reducers |
| 2 | Failures require restarting the entire workflow | Persistent checkpoints; resume from last successful node | `SqliteSaver` checkpointer |
| 3 | No conditional decisions or parallel research paths | Router branches simple/complex; complex path fans out | `conditional_edges` + `Send()` |
| 4 | Critical responses generated without human review | Graph pauses before Finalizer; human approves/rejects/revises | `interrupt_before` + `update_state` |
| 5 | Multiple specialist agents cannot collaborate | Supervisor + 3 workers with non-overlapping state ownership | `StateGraph` multi-node |

---

## 2. Architecture

### Graph Topology

```
START → Supervisor → Planner
                         │ conditional_edge (route_after_planner)
                         ↓
                       Router
                    ┌────┴────────────────────────┐
              [simple]                        [complex]
                    │                              │
             Fundamentals                  ┌───────┼───────┐
                    │              Fundamentals  News    Risk   ← parallel (Send)
                    │                      └───────┼───────┘
                    └──────────────────────────────┘
                                           ↓
                                         Merger        ← handles absent fields gracefully
                                           ↓
                                      Synthesizer
                                           │ interrupt_before=["review_gate"]
                                           ↓
                                      review_gate       (graph paused — Streamlit UI)
                                           │ conditional_edge (route_after_review)
                    ┌──────────────────────┼──────────────────┐
              [approved]             [rejected_stop]   [rejected_revise]
                    │                      │                   │
               Finalizer                  END          Synthesizer ↺ (max 3 iterations)
                    │
                   END
```

**Note on `review_gate`:** This is a real but trivial node (`return {}`) whose only purpose is to be the `interrupt_before` target. The 3-way routing lives on the conditional edge that follows it — not inside the node itself and not hardcoded into any prompt.

### Anti-Patterns Explicitly Avoided

- Supervisor contains no reasoning logic — it only writes `ticker` to state and routes to Planner
- Workers own non-overlapping output fields — no two agents write to the same state key
- Workers never import each other or influence routing
- Subgraphs are not used (avoids nesting anti-pattern)
- HITL approval is implemented as `interrupt_before` middleware — not hardcoded into agent prompts
- Parallel agents do not share intermediate reasoning before Merger combines them
- Checkpoints are always validated before resume (root cause check in recovery helper)

---

## 3. State Schema

```python
# state.py
from typing import Annotated, TypedDict
import operator

class ResearchState(TypedDict):
    # Input
    query:           str           # raw user question
    ticker:          str           # resolved stock ticker (e.g. "AAPL")

    # Planning
    plan:            list[str]     # research steps from Planner
    complexity:      str           # "simple" | "complex" — drives Router

    # Research results (one field per worker — no overlapping writes)
    fundamentals:    dict          # yfinance payload: price, P/E, revenue, margins
    news_data:       list[str]     # DuckDuckGo headlines + snippets
    risk_data:       list[str]     # DuckDuckGo risk/competitor findings
    merged_research: str           # Merger combines fundamentals + news_data + risk_data

    # Synthesis & review
    draft_brief:     str           # Synthesizer output
    human_feedback:  str           # rejection/revision note from human
    approval_status: str           # "pending"|"approved"|"rejected_stop"|"rejected_revise"
    iteration:       int           # caps Reject+Revise loop at 3

    # Output
    final_brief:     str           # formatted, approved brief

    # Audit — append-only via custom reducer
    execution_trace: Annotated[list[dict], operator.add]
    # every node appends {"node": str, "timestamp": str, "summary": str}
```

**Reducer strategy:**
- All fields except `execution_trace` use the default overwrite reducer — each field is owned by exactly one agent, so no conflicts arise.
- `execution_trace` uses `operator.add` so parallel agents (Fundamentals, News, Risk) can all append simultaneously without race conditions.

---

## 4. Agents

### Supervisor
- **Input:** `state.query`
- **Output:** `{"ticker": <extracted>, "execution_trace": [...]}`
- **Logic:** Extracts ticker via regex (`[A-Z]{1,5}`) — looks for an all-caps word in the query, falls back to the full query string if none found. Routes unconditionally to Planner. No Claude call.
- **No reasoning beyond ticker extraction.**

### Planner
- **Model:** `claude-haiku-4-5-20251001`
- **Input:** `state.query`, `state.ticker`
- **Output:** `{"plan": [...], "complexity": "simple"|"complex", "execution_trace": [...]}`
- **Logic:** Claude call with structured output. Tags complexity as `simple` (price check, quick overview) or `complex` (full analysis, comparison, deep dive). Plan is a list of 3–5 research steps.

### Router (not a node — a conditional edge function)
- **Input:** `state.complexity`
- **Returns:** `"fundamentals"` (simple path — only Fundamentals runs, then Merger) or `[Send("fundamentals"), Send("news"), Send("risk")]` (complex path — all three run in parallel, fan-in at Merger)

### Fundamentals Agent
- **Tool:** `yfinance_tool` — fetches current price, P/E ratio, revenue TTM, gross margin, market cap, 52-week range
- **Output:** `{"fundamentals": {...}, "execution_trace": [...]}`

### News Agent
- **Tool:** `ddg_search` — queries `"{ticker} stock news"`, returns top 5 snippets
- **Output:** `{"news_data": [...], "execution_trace": [...]}`

### Risk Agent
- **Tool:** `ddg_search` — queries `"{ticker} risks competitors regulatory"`, returns top 5 snippets
- **Output:** `{"risk_data": [...], "execution_trace": [...]}`

### Merger
- **Input:** `state.fundamentals`, `state.news_data`, `state.risk_data`
- **Output:** `{"merged_research": <formatted string>, "execution_trace": [...]}`
- **Logic:** Pure Python — formats all populated research fields into a single structured string for the Synthesizer prompt. `news_data` and `risk_data` may be `None` (simple path) — Merger skips those sections gracefully.

### Synthesizer
- **Model:** `claude-sonnet-4-6`
- **Input:** `state.merged_research`, `state.plan`, `state.ticker`, `state.human_feedback` (on revise)
- **Output:** `{"draft_brief": <markdown brief>, "iteration": state.iteration + 1, "approval_status": "pending", "execution_trace": [...]}`
- **On revise:** Includes `state.human_feedback` in the prompt for targeted revision.

### review_gate (HITL interrupt target)
- **Compiled with:** `interrupt_before=["review_gate"]` — graph pauses before this node runs.
- The node itself returns `{}` — no state changes. Its only job is to be the pause point.
- Streamlit detects the interrupt, reads `state.draft_brief`, and renders the approval panel.
- On human submit: `graph.update_state(config, {"approval_status": <choice>, "human_feedback": <text>})`
- Then `graph.invoke(None, config)` resumes — `review_gate` runs (returns `{}`), then `route_after_review` conditional edge routes based on `approval_status`.

### Finalizer
- **Input:** `state.draft_brief`, `state.approval_status`
- **Output:** `{"final_brief": <formatted>, "execution_trace": [...]}`
- **Also calls:** `graph.get_state_history(config)` to build the time-travel debug panel.

---

## 5. Routing Logic

```python
# graph/router.py
from langgraph.types import Send

def route_after_planner(state: ResearchState):
    if state["complexity"] == "simple":
        return "fundamentals"          # simple: only Fundamentals runs → Merger
    # complex: all three run in parallel, fan-in at Merger
    return [Send("fundamentals", state), Send("news", state), Send("risk", state)]

def route_after_review(state: ResearchState):
    status = state["approval_status"]
    if status == "approved":
        return "finalizer"
    if status == "rejected_stop":
        return END
    # rejected_revise — guard against infinite loop
    if state.get("iteration", 0) >= 3:
        return "finalizer"             # force approval after 3 revisions
    return "synthesizer"
```

---

## 6. Checkpointing & Recovery

- **Checkpointer:** `SqliteSaver` writing to `research_checkpoints.db` in the project root
- **Thread ID:** Generated per Streamlit session (`uuid4()`), stored in `st.session_state`
- **Every node** is automatically checkpointed after it completes (LangGraph default)
- **Recovery helper** in `checkpointing/setup.py`:
  - Lists checkpoints for a thread via `graph.get_state_history(config)`
  - Validates the last checkpoint's `current_node` before resuming
  - Exposes a "Resume from checkpoint" button in the Streamlit sidebar

**Simulated failure demo:** The `fundamentals` agent catches `yfinance` exceptions and raises `RuntimeError`. The Streamlit app catches this, displays the error, and offers the resume button — which replays from the last good checkpoint (post-Planner).

---

## 7. Streamlit UI

### Layout
- **Sidebar:** Query input, Run button, live execution trace, checkpoint status, thread ID
- **Main — Screen 1 (Running):** Active concept card + live agent output as each node completes
- **Main — Screen 2 (HITL Gate):** Draft brief (left) + approval panel with feedback textarea (right)
- **Main — Screen 3 (Complete):** Final brief + download button + time-travel debug expander

### Concept Cards
One card shown per active node. Each card contains: primitive name, one-line explanation, inline code snippet, and which Problem # it solves.

| Node | Primitive Taught | Problem Solved |
|------|-----------------|----------------|
| Supervisor | `StateGraph` entry + `TypedDict` | 5 — multi-agent |
| Planner | State write + custom reducer | 1 — context loss |
| Router | `conditional_edges` + `Send()` | 3 — no branching |
| Fundamentals/News/Risk | Parallel fan-out | 3 — no parallel paths |
| Merger | Fan-in + `operator.add` reducer | 3 — branch merge |
| Synthesizer | `SqliteSaver` checkpoint | 2 — full restart |
| review_gate | `interrupt_before` + `update_state` | 4 — no human review |
| Finalizer | `get_state_history` time-travel | Capstone req: Debugging & Explainability |

### HITL Panel Behaviour
- **Approve:** `update_state({"approval_status": "approved"})` → resume → `review_gate` runs → routes to Finalizer
- **Reject + Stop:** `update_state({"approval_status": "rejected_stop"})` → resume → `review_gate` runs → routes to END
- **Reject + Revise:** `update_state({"approval_status": "rejected_revise", "human_feedback": <text>})` → resume → `review_gate` runs → routes back to Synthesizer, which re-runs incorporating the feedback

---

## 8. Tools

### `tools/yfinance_tool.py`
```python
@tool
def get_stock_fundamentals(ticker: str) -> dict:
    """Fetch current stock fundamentals from Yahoo Finance."""
    # Returns: price, pe_ratio, revenue_ttm, gross_margin, market_cap, week_52_range
```

### `tools/ddg_search.py`
```python
@tool
def search_web(query: str, max_results: int = 5) -> list[str]:
    """Search the web using DuckDuckGo. Returns a list of text snippets."""
```

---

## 9. Models Used

| Agent | Model | Reason |
|-------|-------|--------|
| Supervisor (optional) | `claude-haiku-4-5-20251001` | Fast, cheap ticker extraction |
| Planner | `claude-haiku-4-5-20251001` | Structured output, low latency |
| Synthesizer | `claude-sonnet-4-6` | Higher quality brief generation |

---

## 10. File Structure

```
langraph-project/
├── main.py                  # Streamlit entry point
├── state.py                 # ResearchState TypedDict
├── graph/
│   ├── builder.py           # StateGraph construction + compile()
│   └── router.py            # conditional_edge routing functions
├── agents/
│   ├── supervisor.py
│   ├── planner.py
│   ├── fundamentals.py
│   ├── news.py
│   ├── risk.py
│   ├── merger.py
│   ├── synthesizer.py
│   ├── review_gate.py       # trivial node: returns {} — interrupt_before target
│   └── finalizer.py
├── tools/
│   ├── yfinance_tool.py
│   └── ddg_search.py
├── ui/
│   ├── cards.py             # CONCEPT_CARDS dict keyed by node name
│   ├── hitl_panel.py        # Streamlit approval form component
│   └── trace_display.py     # execution timeline sidebar renderer
├── checkpointing/
│   └── setup.py             # SqliteSaver init + recovery helper
├── requirements.txt
├── .env.example
└── CLAUDE.md
```

---

## 11. Dependencies

```
langgraph>=0.2
langchain-anthropic>=0.3
anthropic>=0.49
langchain-community>=0.3   # DuckDuckGo search tool
yfinance>=0.2
streamlit>=1.40
duckduckgo-search>=6.0
python-dotenv>=1.0
```

---

## 12. Environment Variables

```bash
# .env.example
ANTHROPIC_API_KEY=sk-ant-...
```

No other API keys required. `yfinance` and DuckDuckGo are free with no authentication.
