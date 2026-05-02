# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A LangGraph multi-agent investment research assistant built as a training demonstration. Shows typed state, conditional routing, parallel fan-out, SQLite checkpointing, and human-in-the-loop patterns via a Streamlit UI.

## Commands

```bash
# Run the Streamlit demo
streamlit run main.py

# Run all tests
pytest -v

# Run a single test file
pytest tests/test_router.py -v

# Run a single test
pytest tests/test_router.py::test_complex_path_returns_three_sends -v
```

## Architecture

9-node `StateGraph`: `supervisor → planner → [router] → fundamentals/(news+risk parallel) → merger → synthesizer → review_gate → finalizer`

- `interrupt_before=["review_gate"]` — graph pauses here for human approval
- `SqliteSaver` — every node completion is checkpointed to `research_checkpoints.db`
- Simple path: only `fundamentals` runs. Complex path: `fundamentals + news + risk` run in parallel via `Send()`
- `execution_trace` is the only `Annotated` reducer field — uses `operator.add` for safe parallel appends

## Key Files

| File | Purpose |
|------|---------|
| `state.py` | `ResearchState` TypedDict + `initial_state()` factory |
| `graph/builder.py` | Single function `build_graph(checkpointer=None)` — all wiring here |
| `graph/router.py` | `route_after_planner` and `route_after_review` — pure functions, easy to test |
| `agents/review_gate.py` | Trivial `return {}` — exists only as `interrupt_before` target |
| `ui/cards.py` | `CONCEPT_CARDS` dict — one `ConceptCard` per node explaining the primitive |
| `checkpointing/setup.py` | `make_checkpointer()` → `SqliteSaver`; `get_checkpoint_history()` |

## Environment

```bash
ANTHROPIC_API_KEY=sk-ant-...   # only required env var
```

## Models

| Agent | Model |
|-------|-------|
| Planner | `claude-haiku-4-5-20251001` |
| Synthesizer | `claude-sonnet-4-6` |

Both use `cache_control: ephemeral` on system prompts.

## HITL Flow

1. `graph.invoke(initial_state(query), config)` — runs until `interrupt_before=["review_gate"]`
2. Check `graph.get_state(config).next` — contains `"review_gate"` when interrupted
3. `graph.update_state(config, {"approval_status": "approved"})` — inject human decision
4. `graph.invoke(None, config)` — resume; `review_gate` runs, conditional edge routes to outcome

## Known Gotchas

- `review_gate` must return only `execution_trace` — any other key written here causes unexpected state mutation
- In simple path, `news_data` and `risk_data` stay empty; `merger` skips those sections gracefully
- `research_checkpoints.db` persists across sessions — delete it to reset all thread history
- DuckDuckGo rate-limits aggressively; if search fails, the error bubbles to Streamlit and the checkpoint resume button appears
- Python 3.11+ required (use `.venv/` at project root); system python may be older
