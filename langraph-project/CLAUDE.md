# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## What This Is

A LangGraph multi-agent investment research assistant built as a **training demonstration**. A user submits a stock query; 9 specialised agents collaborate to produce a structured investment brief that a human reviews before it is finalised.

Five LangGraph primitives are demonstrated: typed shared state (`TypedDict`), SQLite checkpointing (`SqliteSaver`), conditional fan-out (`conditional_edges` + `Send()`), human-in-the-loop (`interrupt_before` + `update_state`), and multi-agent orchestration (`StateGraph`).

---

## Commands

```bash
# Run the Streamlit demo
streamlit run main.py

# Run all 47 tests (no network calls — all mocked)
pytest -v

# Run a single test file
pytest tests/test_router.py -v

# Run a single test
pytest tests/test_router.py::test_complex_path_returns_three_sends -v

# Verify the graph compiles
python -c "from graph.builder import build_graph; print(build_graph())"

# Verify checkpointer works
python -c "
from checkpointing.setup import make_checkpointer, make_config
from graph.builder import build_graph
g = build_graph(make_checkpointer())
print('OK:', type(g).__name__)
"

# Reset all checkpoint history
rm research_checkpoints.db
```

---

## Environment Setup

Python 3.11+ required. The system Python on macOS may be older — use the venv:

```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then add ANTHROPIC_API_KEY
```

`.env` file:
```
ANTHROPIC_API_KEY=sk-ant-...
```

This is the **only required environment variable**. `yfinance` and DuckDuckGo need no API keys.

---

## Architecture

### Graph Topology

```
START → supervisor → planner
                        │
              conditional_edge (route_after_planner)
                        │
            ┌───────────┴─────────────────────────────────┐
       [simple]                                      [complex]
            │                               Send()   Send()   Send()
            ▼                                 ▼        ▼        ▼
       fundamentals                     fundamentals  news     risk
            │                                 └────────┼────────┘
            │                                          ▼
            └──────────────────────────────────►  merger
                                                      │
                                                  synthesizer
                                                      │
                                  interrupt_before=["review_gate"]
                                                      ▼
                                               review_gate   ← PAUSED
                                                      │
                                     conditional_edge (route_after_review)
                              ┌────────────┬──────────────────────┐
                        [approved]  [rejected_stop]      [rejected_revise]
                              │           │                      │
                          finalizer      END              synthesizer ↺ (max 3)
                              │
                             END
```

### Simple vs Complex Path

**Simple** (`complexity == "simple"`): `route_after_planner` returns the string `"fundamentals"`. Only the fundamentals agent runs. `news_data` and `risk_data` remain `[]` — the merger skips those sections.

**Complex** (`complexity == "complex"`): `route_after_planner` returns `[Send("fundamentals", state), Send("news", state), Send("risk", state)]`. LangGraph executes all three in parallel and fans them in at `merger`.

---

## State Schema

Defined in `state.py`. All 14 fields:

```python
class ResearchState(TypedDict):
    # Input
    query: str                    # raw user question
    ticker: str                   # extracted stock ticker (e.g. "AAPL")

    # Planning
    plan: list[str]               # 3-5 research steps from Planner
    complexity: Literal["simple", "complex"]   # drives Router

    # Research — one field per worker, no overlapping writes
    fundamentals: dict            # yfinance payload
    news_data: list[str]          # DDG news snippets
    risk_data: list[str]          # DDG risk/competitor snippets
    merged_research: str          # Merger combines all three

    # Synthesis & review
    draft_brief: str              # Synthesizer output (Markdown)
    human_feedback: str           # reviewer's revision note
    approval_status: Literal["pending", "approved", "rejected_stop", "rejected_revise"]
    iteration: int                # 0-based; capped at 3 for revise loop

    # Output
    final_brief: str              # approved brief with APPROVED header

    # Audit — append-only (operator.add reducer)
    execution_trace: Annotated[list[dict], operator.add]
```

**Key rule:** every field except `execution_trace` uses the default overwrite reducer. Each agent owns exactly one field and never writes to another agent's field. `execution_trace` uses `operator.add` so parallel agents (fundamentals + news + risk) can all append simultaneously.

Each trace entry shape: `{"node": str, "timestamp": str (ISO), "summary": str}`.

---

## Agent Contracts

Each agent is a plain Python function `(state: ResearchState) -> dict`. The dict is a **partial state update** — only return keys you are writing. LangGraph merges it.

### supervisor (`agents/supervisor.py`)
- **Input:** `state["query"]`
- **Output:** `{"ticker": str, "execution_trace": [entry]}`
- **Logic:** Regex `\b([A-Z]{2,5})\b` on query. Fallback: `query.upper()[:5].strip()`. No Claude call.

### planner (`agents/planner.py`)
- **Input:** `state["query"]`, `state["ticker"]`
- **Output:** `{"plan": list[str], "complexity": "simple"|"complex", "execution_trace": [entry]}`
- **Model:** `claude-haiku-4-5-20251001`, `max_tokens=512`
- **Prompt caching:** system message has `cache_control: {"type": "ephemeral"}`
- **JSON parsing:** wrapped in `try/except (json.JSONDecodeError, KeyError)` — raises `ValueError` on malformed response

### fundamentals (`agents/fundamentals.py`)
- **Input:** `state["ticker"]`
- **Output:** `{"fundamentals": dict, "execution_trace": [entry]}`
- **Tool:** `tools/yfinance_tool.get_stock_fundamentals(ticker)`
- **Error handling:** tool returns `{"error": "...", "price": None, ...}` on failure. Agent surfaces this in trace summary.

### news (`agents/news.py`)
- **Input:** `state["ticker"]`
- **Output:** `{"news_data": list[str], "execution_trace": [entry]}`
- **Tool:** `tools/ddg_search.search_web(f"{ticker} stock news latest", max_results=5)`
- **Error handling:** tool returns `[]` on failure. Agent logs "No news results (possible tool failure)" in trace.

### risk (`agents/risk.py`)
- **Input:** `state["ticker"]`
- **Output:** `{"risk_data": list[str], "execution_trace": [entry]}`
- **Tool:** `tools/ddg_search.search_web(f"{ticker} risks competitors regulatory outlook", max_results=5)`

### merger (`agents/merger.py`)
- **Input:** `state["fundamentals"]`, `state["news_data"]`, `state["risk_data"]`, `state["ticker"]`
- **Output:** `{"merged_research": str, "execution_trace": [entry]}`
- **Logic:** Pure Python. Uses `state.get("news_data") or []` to handle `None` and `[]` equally. Skips fundamentals entries where the value is `None`. If `fundamentals` has an `"error"` key, labels it as unavailable rather than passing error text as data.

### synthesizer (`agents/synthesizer.py`)
- **Input:** `state["ticker"]`, `state["merged_research"]`, `state["human_feedback"]`, `state["iteration"]`
- **Output:** `{"draft_brief": str, "iteration": int, "approval_status": "pending", "execution_trace": [entry]}`
- **Model:** `claude-sonnet-4-6`, `max_tokens=1024`
- **Prompt caching:** system message has `cache_control: {"type": "ephemeral"}`
- **Revision:** if `human_feedback` is non-empty, appends it to the user message
- **Always** resets `approval_status` to `"pending"` — each output requires a fresh human decision

### review_gate (`agents/review_gate.py`)
- **Input:** `state["approval_status"]`
- **Output:** `{"execution_trace": [entry]}` — **nothing else**
- **Purpose:** exists solely as the `interrupt_before` target. The graph pauses *before* this node runs. When the human calls `update_state()` and then `invoke(None, config)`, this node's body executes, reads the human-injected status, and records it in the trace. The 3-way routing is on the conditional edge that follows, not inside this function.
- **Critical:** any extra key returned here will modify state unexpectedly. Return only `execution_trace`.

### finalizer (`agents/finalizer.py`)
- **Input:** `state["ticker"]`, `state["draft_brief"]`
- **Output:** `{"final_brief": str, "execution_trace": [entry]}`
- **Guard:** raises `ValueError` if `draft_brief` is empty
- **Format:** `"# APPROVED — {ticker} Investment Brief\n\n{brief}\n\n---\n*Reviewed and approved by human analyst.*"`

---

## Router Functions (`graph/router.py`)

Both are pure Python functions — no side effects, easy to unit test.

### `route_after_planner(state) -> str | list[Send]`
```python
if state["complexity"] == "simple":
    return "fundamentals"
return [Send("fundamentals", state), Send("news", state), Send("risk", state)]
```

### `route_after_review(state) -> str`
```python
status = state.get("approval_status", "pending")
if status == "approved":       return "finalizer"
if status == "rejected_stop":  return END
if status == "rejected_revise":
    if state.get("iteration", 0) >= 3:
        return "finalizer"     # force approval after 3 revision loops
    return "synthesizer"
return "synthesizer"           # safe default for unknown status
```

**Important:** the iteration cap (`>= 3`) is scoped to `"rejected_revise"` only. A `"pending"` status at iteration 3 does not get forced to finalizer.

---

## Graph Builder (`graph/builder.py`)

Single function: `build_graph(checkpointer=None) -> CompiledStateGraph`

The optional `checkpointer` parameter:
- `None` — no persistence (unit tests use this)
- `MemorySaver()` — in-memory (integration tests)
- `SqliteSaver(conn)` — SQLite persistence (production/Streamlit)

`interrupt_before=["review_gate"]` is hardcoded in the compile call. This is the HITL pause point and must not be moved.

The routing dict for `review_gate`'s conditional edge is explicit:
```python
{"finalizer": "finalizer", "synthesizer": "synthesizer", END: END}
```
This lets LangGraph validate all branches at compile time.

---

## Checkpointing (`checkpointing/setup.py`)

```python
make_checkpointer() -> SqliteSaver    # creates/opens research_checkpoints.db
make_config(thread_id: str) -> dict   # {"configurable": {"thread_id": thread_id}}
get_checkpoint_history(graph, config) -> list[dict]  # [{step, node, next}, ...]
```

The SQLite connection uses `check_same_thread=False` — required because Streamlit reruns happen in different threads.

`DB_PATH` is `Path("research_checkpoints.db")` — relative to wherever the app is launched (project root when running `streamlit run main.py`).

---

## Streamlit App (`main.py`)

Four `app_state` values drive the entire UI:

| State | Meaning | What the user sees |
|-------|---------|-------------------|
| `idle` | No run in progress | Query input + example queries |
| `hitl` | Graph paused at review_gate | Draft brief + Approve/Reject buttons |
| `complete` | Finalizer ran or rejected_stop | Final brief / rejection message + debug expander |
| `error` | Exception during graph run | Error message + "Resume from Checkpoint" button |

`graph` and `thread_id` are stored in `st.session_state` so they survive Streamlit reruns. A new `thread_id` is generated on "New Session" or each new "Run Research" click.

`CONCEPT_CARDS` from `ui/cards.py` are shown contextually: the `review_gate` card during HITL, the `synthesizer` card during error recovery, and all cards for nodes that ran in the completion screen.

---

## Tools

### `tools/yfinance_tool.py` — `get_stock_fundamentals(ticker: str) -> dict`

Returns: `{price, pe_ratio, revenue_ttm, gross_margin, market_cap, week_52_range}`

All fields use `.get()` to avoid `KeyError`. On any exception, returns:
`{"price": None, ..., "week_52_range": "N/A - N/A", "error": str(e)}`

### `tools/ddg_search.py` — `search_web(query: str, max_results: int = 5) -> list[str]`

Returns a list of `body` strings from DuckDuckGo results. Skips results with no `body` key. Returns `[]` on any exception (rate-limit, network failure, etc.).

---

## Testing Approach

All tests are unit/integration tests with mocks — **no real network calls, no Claude API calls**.

**Mocking pattern for Claude clients:**
```python
with patch("agents.planner.client") as mock_client:
    mock_client.messages.create.return_value = _mock_response('{"plan": [...], "complexity": "simple"}')
    result = planner({...})
```

**Mocking pattern for tools:**
```python
with patch("agents.fundamentals.get_stock_fundamentals", return_value={...}):
    result = fundamentals({"ticker": "AAPL", "execution_trace": []})
```

**Integration tests** use `MemorySaver` (not `SqliteSaver`) so no `.db` file is created.

Mock introspection uses `call_args.kwargs` (not `call_args[1]`) — forward-compatible with Python mock API changes.

---

## Known Gotchas

**`review_gate` must return only `execution_trace`.**
Any other key it returns will modify state — the node is supposed to be a no-op checkpoint. This is tested in `test_finalizer.py::test_review_gate_returns_only_trace` using `set(result.keys()) == {"execution_trace"}`.

**`news_data` and `risk_data` are `[]` on the simple path.**
The merger uses `state.get("news_data") or []` to handle both `None` and `[]` identically. If you add a new consumer of these fields, test it with empty lists.

**`research_checkpoints.db` is persistent.**
The same thread ID can resume across Streamlit restarts. To reset: delete the file. It is in `.gitignore`.

**DuckDuckGo rate-limits aggressively.**
The search tool silently returns `[]` on failure. This produces a thin merger output and a brief with limited news/risk context. The trace summaries say "No results (possible tool failure)" to make this visible.

**`langgraph-checkpoint-sqlite` is a separate package.**
In `langgraph` v1.x, `SqliteSaver` is NOT bundled. `requirements.txt` includes `langgraph-checkpoint-sqlite>=1.0`. If you see `ModuleNotFoundError: No module named 'langgraph.checkpoint.sqlite'`, install it explicitly.

**Python 3.11+ required.**
`list[str]` and `str | list[Send]` type hints in function signatures are only valid in 3.10+. The system Python on macOS may be older — always use `.venv/` created with `python3.11`.

**Streamlit reruns and widget keys.**
`render_hitl_panel` in `ui/hitl_panel.py` keys all widgets on `iteration` to avoid Streamlit's duplicate-key error during the revise loop. If you add new widgets to the HITL panel, key them on `iteration` as well.

---

## Extending the Project

**Adding a new research agent:**
1. Create `agents/mynewagent.py` with a function `mynewagent(state) -> dict` that writes to a new state field
2. Add the new field to `ResearchState` in `state.py`
3. Register the node in `graph/builder.py`: `g.add_node("mynewagent", mynewagent)`
4. Add edges as appropriate
5. Add a `ConceptCard` entry in `ui/cards.py`
6. Add tests in `tests/test_research_agents.py`

**Changing the AI model:**
- Planner: change `model=` in `agents/planner.py`
- Synthesizer: change `model=` in `agents/synthesizer.py`
- Both use `cache_control: ephemeral` — keep this on the system prompt for cost efficiency

**Changing the HITL outcomes:**
- Add/remove status values in `ResearchState.approval_status` Literal
- Update `route_after_review` in `graph/router.py`
- Update `render_hitl_panel` in `ui/hitl_panel.py`
- Update the routing dict in `graph/builder.py`'s `add_conditional_edges` call

**Persisting to a different database:**
Replace `SqliteSaver` with any LangGraph-compatible checkpointer (e.g. `PostgresSaver` from `langgraph-checkpoint-postgres`). The only change is in `checkpointing/setup.py`.

---

## Design Decisions

**Why is supervisor a regex and not a Claude call?**
Keeping the entry node deterministic and free makes failures easier to diagnose. If the graph errors, you always know the supervisor succeeded. It also eliminates latency on the critical path.

**Why does `review_gate` return `{}`?**
The interrupt fires before the node runs. If the node returned state changes, it would be confusing — the node would both be the pause point AND a state writer. Separating concerns keeps the HITL pattern teachable.

**Why `operator.add` only on `execution_trace`?**
All other fields are owned by exactly one agent — last-write-wins is safe. `execution_trace` is appended by every agent including parallel ones, so it needs an additive reducer to avoid race conditions.

**Why no LangChain tool decorators?**
The `@tool` decorator from LangChain adds routing plumbing that's not needed here. Plain Python functions are simpler, easier to test, and make the data flow explicit.

**Why `interrupt_before` and not `interrupt_after`?**
`interrupt_before=["review_gate"]` pauses before the node runs. The human injects state, then the node runs, then the conditional edge routes. Using `interrupt_after` would run the (empty) node first, then pause — the routing edge would fire on resume with potentially stale state. `interrupt_before` is the canonical HITL pattern.
