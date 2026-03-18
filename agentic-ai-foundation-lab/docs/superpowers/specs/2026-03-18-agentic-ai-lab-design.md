# Agentic AI Foundation Lab — Design Spec
**Date:** 2026-03-18
**Target audience:** Beginner Python developers
**Stack:** Python 3.11, Streamlit, virtual environment
**Deployable:** Local + Streamlit Cloud

---

## Purpose

An interactive Streamlit lab for teaching foundational AI concepts through live code, side-by-side comparisons, and step-through code walkthroughs. The lab showcases three progressively complex agent types and lets students observe the behavioral differences between them.

**Concepts taught:**
1. AI Agent vs LLM vs Chatbot
2. Deterministic vs Probabilistic systems
3. Stateless vs Stateful agents
4. Agent Roles & Responsibility Boundaries

---

## Project Structure

```
agentic-ai-foundation-lab/
├── app/
│   ├── 🏠_Home.py
│   └── pages/
│       ├── 1_🤖_LLM.py
│       ├── 2_⚙️_Deterministic.py
│       ├── 3_🧠_Stateful_Agent.py
│       ├── 4_📊_Compare_All.py
│       └── 5_📖_How_It_Works.py
├── agents/
│   ├── llm_agent.py
│   ├── deterministic_agent.py
│   └── stateful_agent.py
├── utils/
│   ├── llm_client.py
│   └── code_steps.py
├── requirements.txt
├── .streamlit/
│   ├── secrets.toml.example
│   └── config.toml
└── README.md
```

---

## Pages

### Home (`🏠_Home.py`)
- Orientation page only — no interaction
- Visual concept map: 4 teaching concepts with one-line definitions
- Card per concept with "Go to demo →" link to relevant page
- No LLM calls on this page

### LLM Page (`1_🤖_LLM.py`)
- Demonstrates: pure LLM prompt, stateless, probabilistic
- Student types a query, clicks Send
- Response displayed with metadata (model, provider, tokens if available)
- Ask the same question twice — responses may differ (probabilistic demonstration)
- Sidebar: provider selector (OpenAI / Anthropic / Ollama)

### Deterministic Page (`2_⚙️_Deterministic.py`)
- Demonstrates: rule-based, no LLM, deterministic, predictable ceiling
- Same query → always same output
- Shows the keyword rule table so students see exactly what's hardcoded
- Deliberately breaks on out-of-scope queries to show the ceiling of rule-based systems
- No LLM calls — pure Python if/elif logic

### Stateful Agent Page (`3_🧠_Stateful_Agent.py`)
- Demonstrates: memory, context accumulation, stateful conversation
- Maintains conversation history in `st.session_state`
- Full history sent to LLM on each turn
- Visible memory panel shows what the agent "remembers"
- Clear memory button resets state — demonstrates what stateless feels like by contrast
- Sidebar: provider selector

### Compare All Page (`4_📊_Compare_All.py`)
- Three equal-width columns: LLM | Deterministic | Stateful
- Single shared query input at top — all three respond simultaneously
- "What just happened?" auto-explainer below responses (plain-English behavioral diff)
- Run history table accumulates all queries + all three responses for the session
- Sidebar: provider selector (applies to LLM + Stateful columns)

### How It Works Page (`5_📖_How_It_Works.py`)
- Agent selector: LLM / Deterministic / Stateful
- Step-through walkthrough driven by content in `code_steps.py`
- Each step shows:
  - Concept title
  - Highlighted code block (exact relevant lines)
  - Plain-English explanation (3–5 sentences for beginners)
  - "Why this matters" callout linking code to concept
- Previous / Next buttons + progress bar
- Step counts: LLM ~6, Deterministic ~5, Stateful ~7

---

## Agent Modules

### `agents/llm_agent.py`
- Single function: `get_response(query: str, provider_config: dict) -> str`
- Builds a minimal prompt, calls `llm_client.get_response()`, returns text
- No state, no memory — fresh context every call
- Intentionally simple for teaching

### `agents/deterministic_agent.py`
- Single function: `get_response(query: str) -> str`
- Keyword matching via `if/elif` chain
- Covers ~10 hardcoded intents (greetings, what is AI, what is an agent, etc.)
- Returns a fallback message for unrecognized input
- Zero LLM dependency — demonstrates rule-based systems in isolation

### `agents/stateful_agent.py`
- Class `StatefulAgent` with `chat(query: str) -> str` method
- `self.history: list[dict]` stores all prior turns as `{role, content}` dicts
- Each call appends user query, sends full history to LLM, appends response
- `reset()` method clears history
- Persisted in `st.session_state` so state survives Streamlit reruns

---

## LLM Client (`utils/llm_client.py`)

Single function: `get_response(messages: list[dict], provider: str, **kwargs) -> str`

| Provider | Model | Auth |
|---|---|---|
| `openai` | `gpt-4o-mini` | `OPENAI_API_KEY` from `st.secrets` |
| `anthropic` | `claude-haiku-4-5-20251001` | `ANTHROPIC_API_KEY` from `st.secrets` |
| `ollama` | `llama3.2` (configurable) | None — local HTTP |

Provider selected via sidebar `st.selectbox`. Selection stored in `st.session_state["provider"]` so it persists across reruns. Falls back gracefully if a key is missing (shows setup instructions rather than crashing).

---

## Step-Through Content (`utils/code_steps.py`)

Returns a list of step dicts per agent:

```python
{
    "title": "Step 3: Building the prompt",
    "code": "...",          # exact code snippet
    "explanation": "...",   # 3-5 sentences, beginner language
    "why_it_matters": "..."  # connection to concept
}
```

All educational content is isolated here — instructor can edit explanations without touching page code.

---

## Sample Queries (used on Compare All page)

Designed to expose behavioral differences dramatically:

1. `"What is AI?"` — all three should answer, LLM probabilistic vs deterministic always-same
2. `"What did I just ask you?"` — LLM fails (no memory), stateful succeeds
3. `"My name is Alex, remember that"` — LLM forgets, stateful remembers
4. `"What is my name?"` — stark contrast between stateful and others
5. `"What is the weather today?"` — deterministic breaks gracefully (out of scope)

---

## LLM Provider Config

**Local:** `.streamlit/secrets.toml` (gitignored):
```toml
OPENAI_API_KEY = "sk-..."
ANTHROPIC_API_KEY = "sk-ant-..."
```

**Streamlit Cloud:** Set the same keys as Secrets in the Cloud dashboard. No code change needed — same `st.secrets` API.

**No key fallback:** Students without any API key use Ollama (local, free, no key).

A committed `secrets.toml.example` provides setup instructions.

---

## README Sections

1. What this lab teaches
2. Project structure walkthrough
3. Quick start (venv + `streamlit run`)
4. API key setup (local + Streamlit Cloud)
5. Deploy to Streamlit Cloud
6. "How to use this in a classroom" — suggested page order + discussion prompts per concept

---

## Non-Goals

- No authentication or user accounts
- No persistent storage (session state only, resets on browser refresh)
- No fine-tuning or embedding demonstrations
- No production deployment concerns (this is a teaching tool)
