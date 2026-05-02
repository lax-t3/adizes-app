# LangGraph Investment Research Brief

A multi-agent investment research assistant built with LangGraph, demonstrating five core orchestration patterns through a working Streamlit application. Each agent run produces a structured investment brief with human review before finalisation.

---

## What This Demonstrates

This project is a training demonstration. It replaces a single-step "ask the AI" prompt with a stateful multi-agent workflow that solves five real orchestration problems:

| # | Problem | LangGraph Solution |
|---|---------|-------------------|
| 1 | Loses intermediate context during multi-step reasoning | Typed `ResearchState` carried across all nodes |
| 2 | Failures require restarting the entire workflow | `SqliteSaver` checkpoints — resume from last good node |
| 3 | No conditional decisions or parallel research paths | `conditional_edges` + `Send()` fan-out |
| 4 | Critical responses generated without human review | `interrupt_before` + `update_state` HITL gate |
| 5 | Multiple specialist agents cannot collaborate | `StateGraph` with non-overlapping state ownership |
| C | Debugging multi-agent runs is opaque | `get_state_history()` time-travel debug panel |

---

## Prerequisites

- Python 3.11+
- An [Anthropic API key](https://console.anthropic.com/)
- No other paid services — `yfinance` and DuckDuckGo are free

---

## Quickstart

```bash
# 1. Clone
git clone https://github.com/vrlnarayana/langgraph-project.git
cd langgraph-project

# 2. Create virtual environment
python3.11 -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Set your API key
cp .env.example .env
# Edit .env and set: ANTHROPIC_API_KEY=sk-ant-...

# 5. Run
streamlit run main.py
```

Open `http://localhost:8501` in your browser.

---

## Example Queries

| Query | Path | Agents Used |
|-------|------|-------------|
| `AAPL price check` | Simple | Supervisor → Planner → Fundamentals → Merger → Synthesizer |
| `Full AAPL analysis` | Complex | + News and Risk agents run in parallel |
| `TSLA risks and competitors` | Complex | All three research agents |
| `MSFT vs GOOGL cloud comparison` | Complex | All three research agents |

---

## Architecture

### Graph Topology

```
START
  └─► supervisor          (extracts ticker from query — no AI call)
        └─► planner       (Claude Haiku: tags complexity, creates plan)
               │
               │  conditional_edge: route_after_planner
               │
        ┌──────┴──────────────────────────────────┐
   [simple]                                  [complex]
        │                              Send()  Send()  Send()
        ▼                                ▼       ▼       ▼
   fundamentals                    fundamentals news   risk
        │                                └───────┼───────┘
        │                                        ▼
        └──────────────────────────────► merger  (fan-in, formats research)
                                              │
                                              ▼
                                        synthesizer  (Claude Sonnet: writes brief)
                                              │
                             interrupt_before=["review_gate"]
                                              ▼
                                        review_gate  ◄── GRAPH PAUSED
                                              │       human calls update_state()
                                              │       then invoke(None, config)
                               conditional_edge: route_after_review
                          ┌──────────┬──────────────────┐
                    [approved]  [rejected_stop]  [rejected_revise]
                          │           │                  │
                      finalizer      END           synthesizer ↺
                          │                        (max 3 loops)
                         END
```

### The Five LangGraph Primitives in Action

**1. `TypedDict` state — shared memory across all agents**
```python
class ResearchState(TypedDict):
    query: str
    ticker: str
    plan: list[str]
    complexity: Literal["simple", "complex"]
    fundamentals: dict
    news_data: list[str]
    risk_data: list[str]
    merged_research: str
    draft_brief: str
    human_feedback: str
    approval_status: Literal["pending", "approved", "rejected_stop", "rejected_revise"]
    iteration: int
    final_brief: str
    execution_trace: Annotated[list[dict], operator.add]   # ← custom reducer
```

**2. `SqliteSaver` checkpointing — resume from failure**
```python
from langgraph.checkpoint.sqlite import SqliteSaver

conn = sqlite3.connect("research_checkpoints.db", check_same_thread=False)
graph = build_graph(SqliteSaver(conn))

# Every node completion is automatically saved.
# Resume after error:
graph.invoke(None, config)   # resumes from last checkpoint
```

**3. `conditional_edges` + `Send()` — branching and parallel fan-out**
```python
def route_after_planner(state):
    if state["complexity"] == "simple":
        return "fundamentals"                   # single node
    return [                                     # parallel fan-out
        Send("fundamentals", state),
        Send("news", state),
        Send("risk", state),
    ]
```

**4. `interrupt_before` + `update_state` — human-in-the-loop**
```python
graph = build_graph(checkpointer, interrupt_before=["review_gate"])

# Graph pauses automatically before review_gate runs.
# Human injects decision:
graph.update_state(config, {"approval_status": "approved"})
graph.invoke(None, config)   # resumes — review_gate runs, then routes
```

**5. Multi-agent state ownership — no write conflicts**

Each agent writes to exactly one field. No two agents touch the same key:

| Agent | Writes to |
|-------|-----------|
| `supervisor` | `ticker` |
| `planner` | `plan`, `complexity` |
| `fundamentals` | `fundamentals` |
| `news` | `news_data` |
| `risk` | `risk_data` |
| `merger` | `merged_research` |
| `synthesizer` | `draft_brief`, `iteration`, `approval_status` |
| `review_gate` | *(nothing — interrupt target only)* |
| `finalizer` | `final_brief` |

All agents append to `execution_trace` — safe via `operator.add` reducer.

---

## The Nine Agents

### Supervisor
Pure Python. Extracts the stock ticker from the user's query using regex `\b([A-Z]{2,5})\b`. Falls back to uppercasing the first 5 characters of the query. No Claude call — keeps the entry point fast and deterministic.

### Planner
Claude Haiku with prompt caching. Classifies the query as `"simple"` (price check, quick overview) or `"complex"` (full analysis, comparison, deep dive) and produces a 3–5 step research plan. Uses structured JSON output.

### Fundamentals
Calls `yfinance` to fetch current price, P/E ratio, revenue TTM, gross margin, market cap, and 52-week range. Handles API failures gracefully — returns an error-flagged dict rather than crashing the graph.

### News
Calls DuckDuckGo with `"{ticker} stock news latest"` and returns up to 5 text snippets. Returns `[]` on rate-limit or network failure — the merger handles absent data gracefully.

### Risk
Calls DuckDuckGo with `"{ticker} risks competitors regulatory outlook"` and returns up to 5 text snippets.

### Merger
Pure Python fan-in. Combines `fundamentals`, `news_data`, and `risk_data` into a single formatted string for the Synthesizer prompt. Skips sections that are absent or empty (simple path has no news or risk). Detects and labels yfinance error states so the Synthesizer is never misled by error text presented as financial data.

### Synthesizer
Claude Sonnet with prompt caching. Writes a structured investment brief in Markdown covering fundamentals, news sentiment, key risks, and an outlook (Buy / Hold / Sell). On revision loops, incorporates the human reviewer's feedback. Resets `approval_status` to `"pending"` on every call so each output requires a fresh human decision.

### review_gate
A trivial node (`return {"execution_trace": [...]}`) that exists solely as the `interrupt_before` target. The graph pauses before this node runs. The 3-way routing logic lives on the conditional edge that follows — not inside this node.

### Finalizer
Wraps the approved `draft_brief` with an `# APPROVED` header and a signed-off footer. Also builds the time-travel debug panel via `graph.get_state_history()`.

---

## The HITL Flow in Detail

```
1. User submits query
2. graph.invoke(initial_state(query), config)
   → supervisor runs
   → planner runs (tags complexity)
   → router branches
   → research agents run (1 or 3)
   → merger combines results
   → synthesizer writes draft brief
   → graph PAUSES (interrupt_before=["review_gate"])

3. Streamlit detects: "review_gate" in graph.get_state(config).next
   → renders draft brief + 3 approval buttons

4a. Human clicks Approve
    graph.update_state(config, {"approval_status": "approved"})
    graph.invoke(None, config)
    → review_gate runs (logs decision)
    → routes to finalizer
    → final brief shown with download button

4b. Human clicks Reject + Stop
    graph.update_state(config, {"approval_status": "rejected_stop"})
    graph.invoke(None, config)
    → review_gate runs
    → routes to END (no finalizer, no brief)

4c. Human clicks Reject + Revise (with feedback text)
    graph.update_state(config, {
        "approval_status": "rejected_revise",
        "human_feedback": "Add more detail on China revenue exposure"
    })
    graph.invoke(None, config)
    → review_gate runs
    → routes back to synthesizer (incorporates feedback)
    → graph PAUSES again at review_gate
    → loop repeats (max 3 iterations, then forced to finalizer)
```

---

## Checkpointing and Recovery

Every node completion is automatically saved to `research_checkpoints.db` (SQLite) via `SqliteSaver`. The thread ID (stored in `st.session_state`) is the key to all checkpoints for a session.

**To recover from a mid-run error:**
1. Streamlit shows the error state with a "Resume from Checkpoint" button
2. Clicking it calls `graph.invoke(None, config)` with the same thread ID
3. LangGraph replays from the last successfully completed node

**To reset all history:** delete `research_checkpoints.db` from the project root.

**Time-travel debug:** the "Execution Timeline" expander in the complete screen shows every checkpoint step, the node that ran, and what came next — built with `graph.get_state_history(config)`.

---

## Running Tests

```bash
# All 47 tests
pytest -v

# Single module
pytest tests/test_router.py -v

# Single test
pytest tests/test_graph_integration.py::test_approve_produces_final_brief -v
```

All tests use mocks — no real API calls, no network access required.

**Test coverage by module:**

| Test file | What it covers |
|-----------|---------------|
| `test_state.py` | TypedDict fields, `operator.add` reducer behaviour |
| `test_tools.py` | yfinance field mapping, DDG body filtering, error handling |
| `test_supervisor.py` | Ticker regex, fallback, trace entry format |
| `test_planner.py` | Claude mock, JSON parsing, cache_control, trace |
| `test_research_agents.py` | Field ownership, query string content, error surfacing |
| `test_merger.py` | Simple/complex paths, None handling, section counting |
| `test_synthesizer.py` | Draft output, iteration increment, feedback injection |
| `test_finalizer.py` | review_gate returns only trace, APPROVED header |
| `test_router.py` | All 7 routing branches including iteration cap |
| `test_graph_integration.py` | Full graph: interrupt, approve, reject-stop, reject-revise |

---

## File Structure

```
langraph-project/
├── main.py                  # Streamlit entry point (4 app states: idle/hitl/complete/error)
├── state.py                 # ResearchState TypedDict + initial_state() factory
├── requirements.txt
├── pytest.ini
├── .env.example
│
├── graph/
│   ├── builder.py           # build_graph(checkpointer=None) — all wiring in one place
│   └── router.py            # route_after_planner, route_after_review — pure, testable functions
│
├── agents/
│   ├── supervisor.py        # Regex ticker extraction — no Claude call
│   ├── planner.py           # Claude Haiku — complexity tagging + plan
│   ├── fundamentals.py      # yfinance data fetch
│   ├── news.py              # DuckDuckGo news search
│   ├── risk.py              # DuckDuckGo risk/competitor search
│   ├── merger.py            # Fan-in: combines research → merged_research string
│   ├── synthesizer.py       # Claude Sonnet — investment brief writer
│   ├── review_gate.py       # Trivial interrupt target (returns only execution_trace)
│   └── finalizer.py        # Wraps approved brief with APPROVED header + footer
│
├── tools/
│   ├── yfinance_tool.py     # get_stock_fundamentals(ticker) → dict
│   └── ddg_search.py        # search_web(query, max_results) → list[str]
│
├── checkpointing/
│   └── setup.py             # make_checkpointer(), make_config(), get_checkpoint_history()
│
├── ui/
│   ├── cards.py             # CONCEPT_CARDS dict — one card per node explaining the primitive
│   ├── hitl_panel.py        # Approval form: Approve / Reject+Stop / Reject+Revise
│   └── trace_display.py     # Sidebar execution timeline renderer
│
└── tests/
    ├── test_state.py
    ├── test_tools.py
    ├── test_supervisor.py
    ├── test_planner.py
    ├── test_research_agents.py
    ├── test_merger.py
    ├── test_synthesizer.py
    ├── test_finalizer.py
    ├── test_router.py
    └── test_graph_integration.py
```

---

## Dependencies

```
langgraph>=0.2                    # StateGraph, Send, conditional_edges, interrupt_before
langgraph-checkpoint-sqlite>=1.0  # SqliteSaver (separate package in langgraph v1.x)
anthropic>=0.49                   # Raw Anthropic SDK — no LangChain abstractions
yfinance>=0.2                     # Free stock data
duckduckgo-search>=6.0            # Free web search
streamlit>=1.40                   # UI framework
python-dotenv>=1.0                # .env loading
pytest>=8.0                       # Test runner
```

> **Note:** `langgraph-checkpoint-sqlite` is a separate package. It is not bundled with `langgraph` in v1.x. The `requirements.txt` includes both.

---

## Models Used

| Agent | Model | Why |
|-------|-------|-----|
| Planner | `claude-haiku-4-5-20251001` | Fast, cheap structured output |
| Synthesizer | `claude-sonnet-4-6` | Higher quality brief generation |

Both agents use `cache_control: {"type": "ephemeral"}` on their system prompts to reduce latency and cost on repeated calls.

---

## Anti-Patterns This Project Explicitly Avoids

- **Supervisor with reasoning logic** — supervisor does only ticker extraction, never analysis
- **Agents importing each other** — workers are fully independent; only the graph wires them
- **Routing hardcoded into prompts** — all routing is in `router.py` as Python logic
- **HITL via prompt instructions** — the pause is structural (`interrupt_before`), not "ask the model to wait"
- **Parallel agents sharing a writable state field** — each writes to its own field; `operator.add` handles the trace
- **Subgraph nesting** — flat single-level graph only
- **Checking `isinstance` on state** — TypedDict + Literal types do the job at definition time
