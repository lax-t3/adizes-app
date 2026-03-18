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
│   ├── 🏠_Home.py                  # Streamlit entrypoint — run this file
│   └── pages/
│       ├── 1_🤖_LLM.py
│       ├── 2_⚙️_Deterministic.py
│       ├── 3_🧠_Stateful_Agent.py
│       ├── 4_📊_Compare_All.py
│       └── 5_📖_How_It_Works.py
├── agents/
│   ├── __init__.py                 # empty
│   ├── llm_agent.py
│   ├── deterministic_agent.py
│   └── stateful_agent.py
├── utils/
│   ├── __init__.py                 # empty
│   ├── llm_client.py
│   └── code_steps.py
├── requirements.txt
├── .streamlit/
│   ├── secrets.toml                # gitignored — student fills in API keys
│   ├── secrets.toml.example        # committed — template with instructions
│   └── config.toml                 # page layout + theme config
└── README.md
```

**Entrypoint:** `streamlit run app/🏠_Home.py`

**Import paths:** `agents/` and `utils/` live at the repo root. Pages live in
`app/` and `app/pages/`. Every file that imports from agents or utils adds the
repo root to `sys.path` using:

```python
import sys, os
# Resolve repo root regardless of where `streamlit run` is called from
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, ROOT)
```

For `app/pages/*.py`: `__file__` = `app/pages/1_🤖_LLM.py` → `../..` = repo root. ✓
For `app/🏠_Home.py`: `__file__` = `app/🏠_Home.py` → `../..` also = repo root. ✓

This makes `from agents.llm_agent import get_response` work on both local venv
and Streamlit Cloud regardless of working directory.

---

## `requirements.txt`

```
streamlit>=1.35.0
openai>=1.30.0
anthropic>=0.28.0
ollama>=0.2.0
```

No version pins beyond minimum — keeps setup simple for beginners and avoids
Streamlit Cloud build failures from overly strict pins.

---

## `.streamlit/config.toml`

```toml
[server]
headless = true

[browser]
gatherUsageStats = false

[theme]
base = "light"
```

---

## `.streamlit/secrets.toml.example`

```toml
# Copy this file to secrets.toml and fill in your keys.
# secrets.toml is gitignored — never commit real keys.

OPENAI_API_KEY = "sk-..."          # Get from platform.openai.com
ANTHROPIC_API_KEY = "sk-ant-..."   # Get from console.anthropic.com
# Ollama requires no key — just run 'ollama serve' locally
# OLLAMA_MODEL = "llama3.2"        # Optional: override default Ollama model
```

`.streamlit/secrets.toml` is listed in `.gitignore`.

---

## Pages

### Home (`🏠_Home.py`)
- Orientation page only — no interaction, no LLM calls
- `st.set_page_config(layout="wide")`
- Four concept cards in a 2×2 grid using `st.columns`:
  - Card 1: AI Agent vs LLM vs Chatbot
  - Card 2: Deterministic vs Probabilistic
  - Card 3: Stateless vs Stateful
  - Card 4: Agent Roles & Responsibility Boundaries
- Each card: concept title, 2-sentence definition, "Go to demo →" button using `st.page_link()`

### LLM Page (`1_🤖_LLM.py`)
- Demonstrates: pure LLM prompt, stateless, probabilistic
- Provider selector in sidebar (see Provider Selector spec below)
- Student types a query, clicks Send
- Response displayed in `st.chat_message("assistant")`
- Metadata shown below: provider, model name
- Prompt students to ask the same question twice — notice variation
- Session state key: `st_llm_response` (page-scoped)

### Deterministic Page (`2_⚙️_Deterministic.py`)
- Demonstrates: rule-based, no LLM, deterministic, predictable ceiling
- No provider selector (no LLM used)
- Shows the intent rule table in a `st.dataframe` or `st.table`
- Student types query, clicks Send — always same output for same input
- Shows "MATCHED INTENT: greeting" label so students see which rule fired
- Out-of-scope queries return: `"I don't know how to handle that. My rules only cover: [list]"`
- No session state needed (stateless by design)

### Stateful Agent Page (`3_🧠_Stateful_Agent.py`)
- Demonstrates: memory, context accumulation, stateful conversation
- Provider selector in sidebar
- `StatefulAgent` instance stored in `st.session_state["stateful_agent"]`
  (not recreated on rerun — this is the key statefulness pattern)
- Visible memory panel: `st.expander("🧠 What I remember")` shows full history as JSON
- `st.chat_input` for query entry
- "Clear Memory" button calls `st.session_state["stateful_agent"].reset()`
- Chat history displayed using `st.chat_message` loop
- Session state keys: `stateful_agent`, `stateful_chat_display`

### Compare All Page (`4_📊_Compare_All.py`)
- Provider selector in sidebar (applies to LLM + Stateful columns only)
- Shared `st.text_input` + "Ask All Three" button at top
- On button click: call all three agents, store results in session state, rerun
- Three equal-width `st.columns`: LLM | Deterministic | Stateful
  - Each column: agent name header, response box
- "What just happened?" section below columns — always visible after first query
  - Static explanatory text keyed to which sample query was used if matched,
    otherwise a generic diff: "LLM: new response each time | Deterministic: always same |
    Stateful: remembered context from earlier turns"
- Run history: `st.expander("📋 Full Run History")` — `st.dataframe` with columns
  [Query, LLM Response, Deterministic Response, Stateful Response]
  accumulated in `st.session_state["compare_history"]` (list of dicts)
- Session state keys: `compare_llm_resp`, `compare_det_resp`, `compare_stat_resp`,
  `compare_history`, `compare_stateful_agent`
- Provider: reads `st.session_state["provider"]` (same global key as all other pages)
- `compare_stateful_agent` is intentionally separate from `stateful_agent` (Stateful page's
  instance) — the two pages maintain independent conversation histories so students can
  compare behavior cleanly without cross-contamination between demos

### How It Works Page (`5_📖_How_It_Works.py`)
- `st.radio` at top: select agent (LLM / Deterministic / Stateful)
- Changing agent selection resets step index to 0 via:
  `if st.session_state.get("how_selected_agent") != selected: st.session_state["how_step"] = 0`
- Steps loaded from `code_steps.get_steps(agent_name)` → `list[dict]`
- Progress bar: `st.progress(current_step / total_steps)`
- Step display:
  - `st.subheader(step["title"])`
  - `st.code(step["code"], language="python")`
  - `st.markdown(step["explanation"])`
  - `st.info("💡 Why this matters: " + step["why_it_matters"])`
- Prev / Next buttons in `st.columns([1, 6, 1])` — Prev disabled on step 0, Next disabled on last
- Session state keys: `how_step` (int), `how_selected_agent` (str)

---

## Agent Modules

All agent modules must include heavy inline comments — the code is teaching material.

### `agents/llm_agent.py`

```python
def get_response(query: str, provider: str) -> str:
    """
    Stateless LLM call. No memory. Every call is independent.
    Returns the model's text response, or an error string (never raises).
    """
```

- Wraps `llm_client.get_response([{"role": "user", "content": query}], provider)`
- On any exception: returns `f"Error: {str(e)}"` — never raises to the page

### `agents/deterministic_agent.py`

```python
def get_response(query: str) -> tuple[str, str]:
    """
    Returns (response_text, matched_intent).
    matched_intent is the rule label that fired, or "unknown".
    """
```

**Intent list (10 intents):**

| Intent label | Keywords |
|---|---|
| `greeting` | hello, hi, hey |
| `farewell` | bye, goodbye, see you |
| `what_is_ai` | what is ai, what is artificial intelligence |
| `what_is_agent` | what is an agent |
| `what_is_llm` | what is llm, what is a language model |
| `what_is_chatbot` | what is a chatbot |
| `deterministic` | what is deterministic |
| `stateful` | what is stateful, what is stateless |
| `name_tell` | my name is |
| `unknown` | (fallback) |

Matching: lowercase the query, check `if keyword in query` for each intent in order.

### `agents/stateful_agent.py`

```python
class StatefulAgent:
    def __init__(self, provider: str):
        self.history: list[dict] = []  # {"role": "user"|"assistant", "content": str}
        self.provider = provider

    def chat(self, query: str) -> str:
        """Appends query to history, sends full history to LLM, appends + returns response."""

    def reset(self) -> None:
        """Clears all history."""
```

**Critical:** The `StatefulAgent` instance is stored in `st.session_state["stateful_agent"]`.
Pages create it once: `if "stateful_agent" not in st.session_state: st.session_state["stateful_agent"] = StatefulAgent(provider)`.
They never reinstantiate it on rerun — this is what makes memory persist.

---

## LLM Client (`utils/llm_client.py`)

```python
def get_response(messages: list[dict], provider: str) -> str:
    """
    Unified LLM call. Returns response text or raises ValueError on bad provider.
    All exceptions from API calls are propagated — callers handle errors.

    messages format (canonical, used for all providers):
        [{"role": "system"|"user"|"assistant", "content": str}, ...]

    Anthropic adaptation: system messages are extracted from the list and passed
    as the separate `system=` parameter; remaining messages are passed as `messages=`.
    """
```

| Provider | Model | Auth | Error if missing |
|---|---|---|---|
| `openai` | `gpt-4o-mini` | `st.secrets["OPENAI_API_KEY"]` | Returns error string |
| `anthropic` | `claude-haiku-4-5` | `st.secrets["ANTHROPIC_API_KEY"]` | Returns error string |
| `ollama` | `llama3.2` | None | Returns error string with setup instructions |

**Anthropic message adaptation:**
```python
system_msgs = [m["content"] for m in messages if m["role"] == "system"]
user_msgs = [m for m in messages if m["role"] != "system"]
system_str = "\n".join(system_msgs) if system_msgs else "You are a helpful assistant."
client.messages.create(model=..., system=system_str, messages=user_msgs, ...)
```

**Ollama on Streamlit Cloud:** The client checks `platform.node()` and shows
`"Ollama requires a local server. Select OpenAI or Anthropic when using Streamlit Cloud."`
if connection is refused (catches `httpx.ConnectError`).

**Ollama model:** Defaults to `llama3.2`. If `ollama list` returns a different model,
a `OLLAMA_MODEL` key in `st.secrets` can override it (optional).

---

## Provider Selector (sidebar, shared pattern)

Used on LLM, Stateful, and Compare All pages. Pattern is identical on all three:

```python
with st.sidebar:
    provider = st.selectbox(
        "LLM Provider",
        ["openai", "anthropic", "ollama"],
        key="provider"  # shared across pages via session_state
    )
```

`st.session_state["provider"]` persists the selection when navigating between pages.

---

## `session_state` Key Namespace

All keys are prefixed to avoid cross-page collisions:

| Key | Page | Type | Purpose |
|---|---|---|---|
| `provider` | global | str | Selected LLM provider |
| `llm_response` | LLM | str | Last LLM response |
| `stateful_agent` | Stateful | StatefulAgent | Agent instance with history |
| `stateful_chat_display` | Stateful | list[dict] | Chat messages for display |
| `compare_history` | Compare | list[dict] | Accumulated run history |
| `compare_stateful_agent` | Compare | StatefulAgent | Separate agent for Compare page |
| `how_step` | How It Works | int | Current step index |
| `how_selected_agent` | How It Works | str | Selected agent for walkthrough |

---

## Step-Through Content (`utils/code_steps.py`)

```python
def get_steps(agent: str) -> list[dict]:
    """agent: 'llm' | 'deterministic' | 'stateful'"""
```

Each step dict:
```python
{
    "title": "Step 3: Building the prompt",
    "code": "messages = [{'role': 'user', 'content': query}]",
    "explanation": "...",       # 3-5 sentences, beginner language
    "why_it_matters": "..."     # connection to the concept being taught
}
```

**LLM steps (6):** import → init client → build messages → call API → parse response → return string

**Deterministic steps (5):** import → define intents → keyword match loop → fallback → return tuple

**Stateful steps (7):** import → init class → session_state ownership → append to history →
build full context → call API → append response + return

---

## Sample Queries

Used as suggested queries in the Compare All and individual demo pages:

| # | Query | What it reveals |
|---|---|---|
| 1 | `What is AI?` | All three answer; LLM may vary slightly each time |
| 2 | `What is an agent?` | Deterministic hits rule; LLM gives broader answer |
| 3 | `My name is Alex, remember that` | LLM forgets next turn; Stateful remembers |
| 4 | `What is my name?` | Stark contrast: LLM says "I don't know", Stateful says "Alex" |
| 5 | `What is the weather today?` | Deterministic fails gracefully; LLM guesses/refuses |

These 5 queries are shown as clickable suggestion chips on the Compare All page.

---

## Agent Comments Requirement

All files in `agents/` must include:
- Module-level docstring explaining the concept being demonstrated
- Inline comments on every non-trivial line
- A `# TEACHING NOTE:` comment at key decision points explaining *why* the code is written this way

---

## README Sections

1. What this lab teaches (with concept table)
2. Project structure (annotated tree)
3. Quick start: venv setup + `pip install -r requirements.txt` + `streamlit run app/🏠_Home.py`
4. API key setup: local (`secrets.toml`) + Streamlit Cloud (dashboard Secrets UI)
5. Using Ollama (no API key): `ollama pull llama3.2` + `ollama serve`
6. Deploy to Streamlit Cloud: repo connect → set Secrets → deploy
7. How to use this in a classroom: suggested page order + discussion prompts per concept

---

## Non-Goals

- No authentication or user accounts
- No persistent storage (session state only, resets on browser refresh)
- No fine-tuning or embedding demonstrations
- No production deployment concerns (this is a teaching tool)
