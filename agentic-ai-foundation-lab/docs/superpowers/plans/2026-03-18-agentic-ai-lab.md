# Agentic AI Foundation Lab — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a multi-page Streamlit lab that teaches AI agent concepts (LLM vs Agent vs Chatbot, deterministic vs probabilistic, stateless vs stateful) through live demos, side-by-side comparisons, and step-through code walkthroughs.

**Architecture:** Multi-page Streamlit app with a shared LLM client abstraction. Three standalone agent modules (llm_agent, deterministic_agent, stateful_agent) expose clean interfaces used by five demo pages. Educational content (code walkthroughs) lives in `utils/code_steps.py`, isolated from page code.

**Tech Stack:** Python 3.11, Streamlit ≥1.35, OpenAI SDK, Anthropic SDK, Ollama SDK, pytest

---

## File Map

| File | Responsibility |
|---|---|
| `requirements.txt` | Dependencies |
| `.gitignore` | Keep secrets.toml out of git |
| `.streamlit/config.toml` | Wide layout, light theme |
| `.streamlit/secrets.toml.example` | Key setup instructions (committed) |
| `agents/__init__.py` | Package marker |
| `agents/llm_agent.py` | Stateless LLM call wrapper |
| `agents/deterministic_agent.py` | Keyword-rule engine, no LLM |
| `agents/stateful_agent.py` | StatefulAgent class with conversation history |
| `utils/__init__.py` | Package marker |
| `utils/llm_client.py` | Unified provider adapter (OpenAI / Anthropic / Ollama) |
| `utils/code_steps.py` | All step-through walkthrough content |
| `app/🏠_Home.py` | Streamlit entrypoint + concept card grid |
| `app/pages/1_🤖_LLM.py` | Pure LLM demo page |
| `app/pages/2_⚙️_Deterministic.py` | Deterministic rule-based demo page |
| `app/pages/3_🧠_Stateful_Agent.py` | Stateful agent demo page |
| `app/pages/4_📊_Compare_All.py` | Side-by-side comparison page |
| `app/pages/5_📖_How_It_Works.py` | Step-through code explainer page |
| `tests/test_deterministic_agent.py` | Unit tests for rule engine |
| `tests/test_llm_client.py` | Unit tests for provider adapter |
| `tests/test_llm_agent.py` | Unit tests for stateless agent |
| `tests/test_stateful_agent.py` | Unit tests for StatefulAgent |
| `README.md` | Setup, classroom guide, deploy instructions |

---

## Task 1: Project Scaffold

**Files:**
- Create: `requirements.txt`
- Create: `.gitignore`
- Create: `.streamlit/config.toml`
- Create: `.streamlit/secrets.toml.example`
- Create: `agents/__init__.py`
- Create: `utils/__init__.py`
- Create: `tests/__init__.py`
- Create: `app/pages/.gitkeep`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p agents utils tests app/pages .streamlit
```

- [ ] **Step 2: Create `requirements.txt`**

```
streamlit>=1.35.0
openai>=1.30.0
anthropic>=0.28.0
ollama>=0.2.0
pytest>=8.0.0
```

- [ ] **Step 3: Create `.gitignore`**

```
.streamlit/secrets.toml
__pycache__/
*.pyc
.env
venv/
.venv/
*.egg-info/
.pytest_cache/
```

- [ ] **Step 4: Create `.streamlit/config.toml`**

```toml
[server]
headless = true

[browser]
gatherUsageStats = false

[theme]
base = "light"
```

- [ ] **Step 5: Create `.streamlit/secrets.toml.example`**

```toml
# Copy this file to .streamlit/secrets.toml and fill in your keys.
# secrets.toml is gitignored — never commit real keys.

OPENAI_API_KEY = "sk-..."           # Get from platform.openai.com
ANTHROPIC_API_KEY = "sk-ant-..."    # Get from console.anthropic.com
# Ollama requires no key — just run 'ollama serve' locally
# OLLAMA_MODEL = "llama3.2"         # Optional: override default Ollama model
```

- [ ] **Step 6: Create empty `__init__.py` files**

Create `agents/__init__.py`, `utils/__init__.py`, `tests/__init__.py` — each with empty content.

- [ ] **Step 7: Create virtual environment and install dependencies**

```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Expected: All packages install without errors.

- [ ] **Step 8: Commit scaffold**

```bash
git add requirements.txt .gitignore .streamlit/ agents/__init__.py utils/__init__.py tests/__init__.py
git commit -m "chore: scaffold project structure and dependencies"
```

---

## Task 2: LLM Client

**Files:**
- Create: `utils/llm_client.py`
- Create: `tests/test_llm_client.py`

- [ ] **Step 1: Write failing tests**

Create `tests/test_llm_client.py`:

```python
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from unittest.mock import patch, MagicMock
from utils.llm_client import get_response, _get_secret


class TestGetSecret:
    def test_reads_env_var_when_st_secrets_unavailable(self):
        os.environ["TEST_KEY"] = "test-value"
        with patch("utils.llm_client.st") as mock_st:
            mock_st.secrets.get.side_effect = Exception("no streamlit context")
            result = _get_secret("TEST_KEY")
        assert result == "test-value"
        del os.environ["TEST_KEY"]

    def test_returns_empty_string_when_key_missing(self):
        with patch("utils.llm_client.st") as mock_st:
            mock_st.secrets.get.return_value = ""
            result = _get_secret("NONEXISTENT_KEY")
        assert result == ""


class TestGetResponse:
    def test_unknown_provider_returns_error_string(self):
        result = get_response([{"role": "user", "content": "hi"}], "unknown_provider")
        assert "Unknown provider" in result

    def test_openai_missing_key_returns_error_string(self):
        with patch("utils.llm_client._get_secret", return_value=""):
            result = get_response([{"role": "user", "content": "hi"}], "openai")
        assert "OPENAI_API_KEY" in result

    def test_anthropic_missing_key_returns_error_string(self):
        with patch("utils.llm_client._get_secret", return_value=""):
            result = get_response([{"role": "user", "content": "hi"}], "anthropic")
        assert "ANTHROPIC_API_KEY" in result

    def test_openai_returns_response_text(self):
        mock_response = MagicMock()
        mock_response.choices[0].message.content = "Hello from OpenAI"
        with patch("utils.llm_client._get_secret", return_value="sk-fake"):
            with patch("openai.OpenAI") as mock_openai:
                mock_openai.return_value.chat.completions.create.return_value = mock_response
                result = get_response([{"role": "user", "content": "hi"}], "openai")
        assert result == "Hello from OpenAI"

    def test_anthropic_extracts_system_messages(self):
        mock_response = MagicMock()
        mock_response.content[0].text = "Hello from Anthropic"
        messages = [
            {"role": "system", "content": "You are helpful."},
            {"role": "user", "content": "hi"},
        ]
        with patch("utils.llm_client._get_secret", return_value="sk-ant-fake"):
            with patch("anthropic.Anthropic") as mock_anthropic:
                mock_client = mock_anthropic.return_value
                mock_client.messages.create.return_value = mock_response
                result = get_response(messages, "anthropic")
                # Verify system was passed as separate param
                call_kwargs = mock_client.messages.create.call_args[1]
                assert call_kwargs["system"] == "You are helpful."
                assert all(m["role"] != "system" for m in call_kwargs["messages"])
        assert result == "Hello from Anthropic"

    def test_ollama_connection_refused_returns_setup_instructions(self):
        import httpx
        with patch("ollama.chat", side_effect=httpx.ConnectError("Connection refused")):
            result = get_response([{"role": "user", "content": "hi"}], "ollama")
        assert "ollama serve" in result.lower() or "Ollama" in result
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pytest tests/test_llm_client.py -v
```

Expected: Most tests FAIL (module doesn't exist yet).

- [ ] **Step 3: Create `utils/llm_client.py`**

```python
"""
LLM Client — Unified Provider Adapter
======================================
Abstracts OpenAI, Anthropic, and Ollama behind a single get_response() function.
All three providers use the same input format (OpenAI-style messages list).
"""

import os
import sys
import streamlit as st


def _get_secret(key: str, default: str = "") -> str:
    """
    Read a secret key from st.secrets (Streamlit app context) or
    fall back to environment variables (useful for testing).
    """
    try:
        return st.secrets.get(key, default)
    except Exception:
        return os.environ.get(key, default)


def get_response(messages: list[dict], provider: str) -> str:
    """
    Send messages to the selected LLM provider and return the response text.
    Never raises — all errors are returned as descriptive strings.

    Args:
        messages: List of {"role": "system"|"user"|"assistant", "content": str}
        provider: "openai", "anthropic", or "ollama"

    Returns:
        The model's response text, or an error message string.
    """
    if provider == "openai":
        return _call_openai(messages)
    elif provider == "anthropic":
        return _call_anthropic(messages)
    elif provider == "ollama":
        return _call_ollama(messages)
    else:
        return f"Error: Unknown provider '{provider}'. Choose openai, anthropic, or ollama."


def _call_openai(messages: list[dict]) -> str:
    """Call OpenAI gpt-4o-mini."""
    try:
        api_key = _get_secret("OPENAI_API_KEY")
        if not api_key:
            return (
                "Error: OPENAI_API_KEY not set.\n"
                "1. Copy .streamlit/secrets.toml.example to .streamlit/secrets.toml\n"
                "2. Add your key from platform.openai.com"
            )
        from openai import OpenAI
        client = OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            max_tokens=512,
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"OpenAI Error: {str(e)}"


def _call_anthropic(messages: list[dict]) -> str:
    """
    Call Anthropic claude-haiku-4-5.

    TEACHING NOTE: Anthropic's API differs from OpenAI's — it requires the
    system prompt as a separate 'system' parameter, not inside the messages list.
    This function adapts the common messages format to match Anthropic's API.
    """
    try:
        api_key = _get_secret("ANTHROPIC_API_KEY")
        if not api_key:
            return (
                "Error: ANTHROPIC_API_KEY not set.\n"
                "1. Copy .streamlit/secrets.toml.example to .streamlit/secrets.toml\n"
                "2. Add your key from console.anthropic.com"
            )
        import anthropic

        # Extract system messages — Anthropic requires these as a separate param
        system_msgs = [m["content"] for m in messages if m["role"] == "system"]
        user_msgs = [m for m in messages if m["role"] != "system"]
        system_str = "\n".join(system_msgs) if system_msgs else "You are a helpful assistant."

        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model="claude-haiku-4-5",
            system=system_str,
            messages=user_msgs,
            max_tokens=512,
        )
        return response.content[0].text
    except Exception as e:
        return f"Anthropic Error: {str(e)}"


def _call_ollama(messages: list[dict]) -> str:
    """
    Call a locally-running Ollama model.
    Requires `ollama serve` to be running on the local machine.
    """
    try:
        import ollama
        model = _get_secret("OLLAMA_MODEL", "llama3.2")
        response = ollama.chat(model=model, messages=messages)
        return response["message"]["content"]
    except Exception as e:
        error_str = str(e)
        if "connect" in error_str.lower() or "refused" in error_str.lower():
            return (
                "⚠️ Ollama connection failed.\n\n"
                "To use Ollama locally:\n"
                "1. Install from https://ollama.com\n"
                "2. Run: ollama pull llama3.2\n"
                "3. Run: ollama serve\n\n"
                "If using Streamlit Cloud, select OpenAI or Anthropic instead."
            )
        return f"Ollama Error: {error_str}"
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pytest tests/test_llm_client.py -v
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add utils/llm_client.py tests/test_llm_client.py
git commit -m "feat: add llm_client with OpenAI/Anthropic/Ollama adapters"
```

---

## Task 3: Deterministic Agent

**Files:**
- Create: `agents/deterministic_agent.py`
- Create: `tests/test_deterministic_agent.py`

- [ ] **Step 1: Write failing tests**

Create `tests/test_deterministic_agent.py`:

```python
import os, sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from agents.deterministic_agent import get_response, get_rules_table, INTENT_LABELS


class TestGetResponse:
    def test_greeting_hi(self):
        response, intent = get_response("hi there")
        assert intent == "greeting"
        assert len(response) > 0

    def test_greeting_hello(self):
        _, intent = get_response("Hello!")
        assert intent == "greeting"

    def test_farewell(self):
        _, intent = get_response("bye bye")
        assert intent == "farewell"

    def test_what_is_ai(self):
        _, intent = get_response("what is ai?")
        assert intent == "what_is_ai"

    def test_what_is_agent(self):
        _, intent = get_response("What is an agent?")
        assert intent == "what_is_agent"

    def test_what_is_llm(self):
        _, intent = get_response("what is llm")
        assert intent == "what_is_llm"

    def test_what_is_chatbot(self):
        _, intent = get_response("what is a chatbot")
        assert intent == "what_is_chatbot"

    def test_deterministic(self):
        _, intent = get_response("what is deterministic")
        assert intent == "deterministic"

    def test_stateful(self):
        _, intent = get_response("what is stateful")
        assert intent == "stateful"

    def test_name_tell(self):
        _, intent = get_response("my name is Alex")
        assert intent == "name_tell"

    def test_unknown_returns_fallback(self):
        response, intent = get_response("what is the weather today?")
        assert intent == "unknown"
        assert "don't know" in response.lower() or "only cover" in response.lower()

    def test_same_input_same_output(self):
        """Determinism: identical inputs must produce identical outputs."""
        r1, i1 = get_response("what is ai?")
        r2, i2 = get_response("what is ai?")
        assert r1 == r2
        assert i1 == i2

    def test_case_insensitive(self):
        _, intent_lower = get_response("what is ai")
        _, intent_upper = get_response("WHAT IS AI")
        assert intent_lower == intent_upper == "what_is_ai"


class TestGetRulesTable:
    def test_returns_list_of_dicts(self):
        table = get_rules_table()
        assert isinstance(table, list)
        assert len(table) == len(INTENT_LABELS)

    def test_each_row_has_required_keys(self):
        for row in get_rules_table():
            assert "Intent" in row
            assert "Trigger Keywords" in row
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pytest tests/test_deterministic_agent.py -v
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `agents/deterministic_agent.py`**

```python
"""
Deterministic Agent — Rule-Based System
========================================

CONCEPT: What is a "deterministic" system?
A deterministic system always produces the SAME output for the SAME input.
There is no randomness, no creativity, no learning — just explicit rules.

Think of it like a vending machine:
  - Press A1 → always get chips
  - Press B2 → always get water
  - Press Z9 → ERROR (no such button)

This agent uses a simple keyword-matching rulebook.
It has NO connection to any AI model — it's pure Python if/elif logic.

CONCEPT: What is an "agent" vs an "LLM"?
An AGENT makes decisions and takes actions based on logic or goals.
An LLM is just a text predictor.
This deterministic agent DECIDES what to say based on rules — making it
closer to the definition of an "agent", even though it's not intelligent.
"""

# ─────────────────────────────────────────────────────────────────────────────
# RULEBOOK — The agent's complete knowledge is defined HERE, explicitly.
# TEACHING NOTE: This is the "brain" of a deterministic agent.
# Every possible input must be anticipated and hardcoded.
# Anything outside this list triggers the FALLBACK rule.
# ─────────────────────────────────────────────────────────────────────────────
INTENTS = [
    {
        "label": "greeting",
        "keywords": ["hello", "hi", "hey", "good morning", "good evening"],
        "response": "Hello! I'm a rule-based agent. I can only answer questions about AI concepts.",
    },
    {
        "label": "farewell",
        "keywords": ["bye", "goodbye", "see you", "take care"],
        "response": "Goodbye! Remember: I'll give you the exact same answer next time you say bye!",
    },
    {
        "label": "what_is_ai",
        "keywords": ["what is ai", "what is artificial intelligence", "define ai"],
        "response": (
            "AI (Artificial Intelligence) is the simulation of human intelligence in machines. "
            "It includes machine learning, reasoning, and problem-solving."
        ),
    },
    {
        "label": "what_is_agent",
        "keywords": ["what is an agent", "what is ai agent", "define agent"],
        "response": (
            "An AI agent is a system that perceives its environment, makes decisions, "
            "and takes actions to achieve a goal. I am an example of a simple rule-based agent!"
        ),
    },
    {
        "label": "what_is_llm",
        "keywords": ["what is llm", "what is a language model", "large language model"],
        "response": (
            "An LLM (Large Language Model) is an AI trained on massive amounts of text data "
            "to predict and generate human-like language. Examples: GPT-4, Claude, Llama."
        ),
    },
    {
        "label": "what_is_chatbot",
        "keywords": ["what is a chatbot", "what is chatbot", "define chatbot"],
        "response": (
            "A chatbot is a program that simulates conversation with humans. "
            "Early chatbots (like me!) used rules. Modern chatbots use LLMs."
        ),
    },
    {
        "label": "deterministic",
        "keywords": ["what is deterministic", "deterministic system", "deterministic vs"],
        "response": (
            "A deterministic system always produces the same output for the same input. "
            "I am deterministic — ask me this question again and you'll get this exact answer!"
        ),
    },
    {
        "label": "stateful",
        "keywords": ["what is stateful", "what is stateless", "stateful vs stateless"],
        "response": (
            "STATEFUL means a system remembers previous interactions. "
            "STATELESS means each interaction is independent with no memory. "
            "I am stateless — I don't remember what you said before this message."
        ),
    },
    {
        "label": "name_tell",
        "keywords": ["my name is"],
        "response": (
            "Nice to meet you! But I'm stateless — I won't remember your name. "
            "Ask the Stateful Agent on page 3 — it actually remembers!"
        ),
    },
]

# Flat list of intent labels, used for the fallback message and rules table
INTENT_LABELS = [intent["label"] for intent in INTENTS]


def get_response(query: str) -> tuple[str, str]:
    """
    Match the query against the rulebook and return a response.

    TEACHING NOTE: This is the entire "intelligence" of a deterministic agent —
    a loop checking if any keyword appears in the lowercased query.
    Simple, predictable, and completely transparent.

    Args:
        query: The user's input text

    Returns:
        Tuple of (response_text, matched_intent_label).
        matched_intent_label is "unknown" if no rule matched.
    """
    # Normalize input: lowercase and strip whitespace
    # TEACHING NOTE: Without this, "Hello" and "hello" match different rules.
    normalized = query.lower().strip()

    # Check each intent in order
    # TEACHING NOTE: ORDER MATTERS here. The first matching intent wins.
    for intent in INTENTS:
        for keyword in intent["keywords"]:
            if keyword in normalized:
                # Found a match — return the hardcoded response and rule label
                return intent["response"], intent["label"]

    # FALLBACK: No rule matched
    # TEACHING NOTE: This is the "ceiling" of rule-based systems.
    # Anything outside the rulebook gets this generic response.
    known = ", ".join(INTENT_LABELS)
    fallback = (
        f"I don't know how to handle that. "
        f"My rules only cover: {known}. "
        f"Try asking 'What is AI?' or 'What is an agent?'"
    )
    return fallback, "unknown"


def get_rules_table() -> list[dict]:
    """
    Return the rulebook as a list of dicts for display in a Streamlit table.
    Each row: {"Intent": label, "Trigger Keywords": comma-separated keywords}
    """
    return [
        {
            "Intent": intent["label"],
            "Trigger Keywords": ", ".join(intent["keywords"]),
        }
        for intent in INTENTS
    ]
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pytest tests/test_deterministic_agent.py -v
```

Expected: All 13 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add agents/deterministic_agent.py tests/test_deterministic_agent.py
git commit -m "feat: add deterministic rule-based agent with tests"
```

---

## Task 4: LLM Agent

**Files:**
- Create: `agents/llm_agent.py`
- Create: `tests/test_llm_agent.py`

- [ ] **Step 1: Write failing tests**

Create `tests/test_llm_agent.py`:

```python
import os, sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from unittest.mock import patch
from agents.llm_agent import get_response


class TestGetResponse:
    def test_returns_string(self):
        with patch("agents.llm_agent._llm_call", return_value="Hello world"):
            result = get_response("hi", "openai")
        assert isinstance(result, str)
        assert result == "Hello world"

    def test_sends_query_as_user_message(self):
        """The query must be wrapped in a user role message."""
        captured = {}

        def mock_llm(messages, provider):
            captured["messages"] = messages
            captured["provider"] = provider
            return "response"

        with patch("agents.llm_agent._llm_call", side_effect=mock_llm):
            get_response("What is AI?", "openai")

        assert captured["messages"] == [{"role": "user", "content": "What is AI?"}]
        assert captured["provider"] == "openai"

    def test_no_memory_between_calls(self):
        """Each call must be independent — no state carried over."""
        call_count = 0

        def mock_llm(messages, provider):
            nonlocal call_count
            call_count += 1
            # Each call must only have the one user message — no accumulated history
            assert len(messages) == 1
            return f"response {call_count}"

        with patch("agents.llm_agent._llm_call", side_effect=mock_llm):
            get_response("First question", "openai")
            get_response("Second question", "openai")

        assert call_count == 2

    def test_exception_returns_error_string_not_raise(self):
        with patch("agents.llm_agent._llm_call", side_effect=Exception("API down")):
            result = get_response("hi", "openai")
        assert "Error" in result
        assert "API down" in result
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pytest tests/test_llm_agent.py -v
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `agents/llm_agent.py`**

```python
"""
LLM Agent — Pure Stateless Language Model Call
================================================

CONCEPT: What is a "pure LLM" call?
A pure LLM is like asking a question to a very knowledgeable person with
perfect amnesia. Every time you talk to them, they start completely fresh.
They don't remember what you said before, they don't follow rules, and
they might give a slightly different answer each time — that's what makes
it PROBABILISTIC (non-deterministic).

This agent has:
  - NO memory  (stateless)
  - NO rules   (not deterministic)
  - NO goals   (not a full agent)

It just sends your message to the language model and returns the answer.
"""

import sys
import os

# Add repo root to sys.path so we can import from 'utils'
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, ROOT)

from utils.llm_client import get_response as _llm_call


def get_response(query: str, provider: str) -> str:
    """
    Send a single query to the LLM and return its response.

    TEACHING NOTE: Notice what's NOT here:
      - No memory or history being loaded or saved
      - No rules or conditions
      - No state being modified
    Each call is completely independent. This is what "stateless" means.

    Args:
        query:    The user's question or message
        provider: "openai", "anthropic", or "ollama"

    Returns:
        The LLM's response as a string.
        Returns an error string (never raises) if the call fails.
    """
    try:
        # Build the simplest possible message: just the user's query.
        # TEACHING NOTE: This is a "messages list" — the standard format for
        # talking to LLMs. "role" tells the model who is speaking.
        # We create a FRESH list every single call — no history included.
        messages = [
            {"role": "user", "content": query}
        ]

        # Send to the LLM and return its response.
        # TEACHING NOTE: _llm_call doesn't know or care about previous calls.
        # The LLM receives only this one message and responds cold every time.
        return _llm_call(messages, provider)

    except Exception as e:
        # TEACHING NOTE: We catch ALL exceptions here so the Streamlit page
        # never crashes with an ugly traceback. Users see a friendly message instead.
        return f"Error: {str(e)}"
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pytest tests/test_llm_agent.py -v
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add agents/llm_agent.py tests/test_llm_agent.py
git commit -m "feat: add stateless llm_agent with tests"
```

---

## Task 5: Stateful Agent

**Files:**
- Create: `agents/stateful_agent.py`
- Create: `tests/test_stateful_agent.py`

- [ ] **Step 1: Write failing tests**

Create `tests/test_stateful_agent.py`:

```python
import os, sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from unittest.mock import patch
from agents.stateful_agent import StatefulAgent


class TestStatefulAgent:
    def setup_method(self):
        self.agent = StatefulAgent(provider="openai")

    def test_starts_with_empty_history(self):
        assert self.agent.get_history() == []

    def test_chat_returns_response(self):
        with patch("agents.stateful_agent._llm_call", return_value="Hello!"):
            result = self.agent.chat("hi")
        assert result == "Hello!"

    def test_history_accumulates_after_each_turn(self):
        with patch("agents.stateful_agent._llm_call", return_value="resp1"):
            self.agent.chat("turn 1")
        with patch("agents.stateful_agent._llm_call", return_value="resp2"):
            self.agent.chat("turn 2")

        history = self.agent.get_history()
        assert len(history) == 4  # user + assistant + user + assistant
        assert history[0] == {"role": "user", "content": "turn 1"}
        assert history[1] == {"role": "assistant", "content": "resp1"}
        assert history[2] == {"role": "user", "content": "turn 2"}
        assert history[3] == {"role": "assistant", "content": "resp2"}

    def test_full_history_sent_to_llm_on_second_call(self):
        """Statefulness: second call must include both turns in messages."""
        captured_messages = []

        def mock_llm(messages, provider):
            captured_messages.append(list(messages))
            return "response"

        with patch("agents.stateful_agent._llm_call", side_effect=mock_llm):
            self.agent.chat("first message")
            self.agent.chat("second message")

        # Second call should have 3 messages: user1, assistant1, user2
        assert len(captured_messages[1]) == 3
        assert captured_messages[1][0]["content"] == "first message"
        assert captured_messages[1][1]["content"] == "response"
        assert captured_messages[1][2]["content"] == "second message"

    def test_reset_clears_history(self):
        with patch("agents.stateful_agent._llm_call", return_value="r"):
            self.agent.chat("something")
        self.agent.reset()
        assert self.agent.get_history() == []

    def test_get_history_returns_copy(self):
        """Mutation of returned history must not affect agent's internal state."""
        with patch("agents.stateful_agent._llm_call", return_value="r"):
            self.agent.chat("msg")
        h = self.agent.get_history()
        h.clear()
        assert len(self.agent.get_history()) == 2  # still has user + assistant
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pytest tests/test_stateful_agent.py -v
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `agents/stateful_agent.py`**

```python
"""
Stateful Agent — Memory-Enabled LLM Wrapper
=============================================

CONCEPT: What makes an agent "stateful"?
A stateful agent REMEMBERS previous interactions.

It does this by keeping a list of all past messages (the "history")
and including that entire history in every new request to the LLM.

The LLM itself is stateless — it doesn't remember anything.
The STATEFULNESS comes from OUR CODE: we store the conversation
history and send it along with each new message.

CONCEPT: Agent Roles & Responsibility Boundaries
This agent has a clearly defined, single responsibility:
  INPUT:  a new user message
  ACTION: append to history, call LLM with full context, save response
  OUTPUT: the LLM's response text

It does NOT handle display, session management, or UI. Those are
the Streamlit page's responsibility. Clean role separation makes
each piece of code easier to understand, test, and change independently.
"""

import sys
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, ROOT)

from utils.llm_client import get_response as _llm_call


class StatefulAgent:
    """
    An LLM-powered agent that remembers the full conversation history.

    TEACHING NOTE: This is a class (not a function) because it needs to
    HOLD STATE between calls. A plain function forgets everything when it returns.
    A class instance persists its data in self.history across many calls.
    """

    def __init__(self, provider: str):
        """
        Create a new agent with empty memory.

        Args:
            provider: "openai", "anthropic", or "ollama"
        """
        # TEACHING NOTE: This list IS the agent's memory.
        # Each dict has "role" ("user" or "assistant") and "content" (the text).
        self.history: list[dict] = []

        # Store the provider so we know which LLM to call
        self.provider = provider

    def chat(self, query: str) -> str:
        """
        Send a message and get a response, using full conversation history.

        TEACHING NOTE: Compare this to llm_agent.get_response().
        That function builds a fresh 1-message list every call.
        THIS function includes ALL previous messages — that's statefulness.

        Args:
            query: The user's new message

        Returns:
            The assistant's response text.
        """
        # Step 1: Add the user's new message to history BEFORE calling the LLM.
        # TEACHING NOTE: We append first so the full context (including this new
        # message) gets sent. The LLM sees the entire conversation in one call.
        self.history.append({"role": "user", "content": query})

        # Step 2: Send the ENTIRE history to the LLM.
        # TEACHING NOTE: This is the key difference from stateless.
        # The LLM receives all prior turns, so it can answer "What is my name?"
        # if we told it our name two turns ago.
        response_text = _llm_call(self.history, self.provider)

        # Step 3: Save the assistant's response to history for future context.
        self.history.append({"role": "assistant", "content": response_text})

        return response_text

    def reset(self) -> None:
        """
        Clear all conversation history.

        TEACHING NOTE: After reset(), this agent behaves exactly like the
        stateless LLM agent — because there's no history to include.
        Great classroom demo: reset, then ask "What is my name?" — it won't know.
        """
        self.history = []

    def get_history(self) -> list[dict]:
        """Return a copy of the conversation history (safe to modify)."""
        return list(self.history)
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pytest tests/test_stateful_agent.py -v
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Run all tests**

```bash
pytest tests/ -v
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add agents/stateful_agent.py tests/test_stateful_agent.py
git commit -m "feat: add StatefulAgent with conversation memory and tests"
```

---

## Task 6: Step-Through Content

**Files:**
- Create: `utils/code_steps.py`

No tests needed — this is pure educational data (list of dicts). Correctness is
validated when the How It Works page renders it.

- [ ] **Step 1: Create `utils/code_steps.py`**

```python
"""
Step-Through Code Walkthrough Content
======================================
All educational content for the "How It Works" page.
Each agent has a list of steps. Each step has:
  - title:          Short heading shown above the code block
  - code:           The exact code snippet for this step
  - explanation:    Plain-English description for beginners (3-5 sentences)
  - why_it_matters: One-sentence link to the concept being taught
"""


def get_steps(agent: str) -> list[dict]:
    """
    Return the step-through walkthrough for a given agent.

    Args:
        agent: "llm" | "deterministic" | "stateful"

    Returns:
        List of step dicts with keys: title, code, explanation, why_it_matters
    """
    if agent == "llm":
        return _LLM_STEPS
    elif agent == "deterministic":
        return _DETERMINISTIC_STEPS
    elif agent == "stateful":
        return _STATEFUL_STEPS
    else:
        return []


# ─────────────────────────────────────────────────────────────────────────────
# LLM AGENT — 6 steps
# ─────────────────────────────────────────────────────────────────────────────
_LLM_STEPS = [
    {
        "title": "Step 1: Imports — What does this agent depend on?",
        "code": """\
import sys
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, ROOT)

from utils.llm_client import get_response as _llm_call""",
        "explanation": (
            "We import Python's built-in `sys` and `os` modules to handle file paths. "
            "Then we calculate the repo root directory and add it to Python's search path — "
            "this is what allows us to import from the `utils` folder. "
            "Finally, we import the shared `get_response` function from our LLM client. "
            "The alias `_llm_call` (with underscore) signals it's an internal detail, not part of this module's public API."
        ),
        "why_it_matters": (
            "This agent delegates all LLM communication to `llm_client.py` — "
            "the agent's job is WHAT to send, not HOW to send it."
        ),
    },
    {
        "title": "Step 2: Function signature — The agent's public interface",
        "code": """\
def get_response(query: str, provider: str) -> str:
    \"\"\"
    Stateless LLM call. No memory. Every call is independent.
    Returns the model's text response, or an error string (never raises).
    \"\"\" """,
        "explanation": (
            "The function takes two inputs: the user's text (`query`) and which LLM to use (`provider`). "
            "It always returns a string — either the model's answer or an error message. "
            "Notice the docstring says 'never raises' — this is a design choice. "
            "By catching errors internally, we prevent the Streamlit page from showing an ugly crash screen. "
            "Type hints (`str`) tell the reader exactly what goes in and what comes out."
        ),
        "why_it_matters": (
            "A well-defined interface (inputs → outputs) is the foundation of clean agent design — "
            "the page using this function doesn't need to know anything about how it works internally."
        ),
    },
    {
        "title": "Step 3: Building the message — The 'messages list' format",
        "code": """\
messages = [
    {"role": "user", "content": query}
]""",
        "explanation": (
            "LLMs don't receive raw text — they receive a structured list of messages. "
            "Each message is a dict with two keys: `role` (who spoke) and `content` (what they said). "
            "Here we build a list with just ONE message: the user's current query. "
            "There is no system prompt, no history — just this single fresh message. "
            "This is the simplest possible way to talk to an LLM."
        ),
        "why_it_matters": (
            "We create a FRESH list every call with only the current message — "
            "this single design decision is what makes the agent STATELESS."
        ),
    },
    {
        "title": "Step 4: Calling the LLM — Sending the message",
        "code": """\
return _llm_call(messages, provider)""",
        "explanation": (
            "We send the messages list to the LLM client and return its response directly. "
            "The `_llm_call` function handles all provider-specific details (OpenAI vs Anthropic vs Ollama). "
            "This one-liner is the entire 'intelligence' of this agent — "
            "it just forwards the user's message to the model and passes back the answer. "
            "No transformation, no rules, no memory."
        ),
        "why_it_matters": (
            "The LLM generates its response from scratch each time — "
            "probabilistic, non-deterministic, and completely stateless."
        ),
    },
    {
        "title": "Step 5: Error handling — Protecting the UI",
        "code": """\
try:
    messages = [{"role": "user", "content": query}]
    return _llm_call(messages, provider)
except Exception as e:
    return f"Error: {str(e)}" """,
        "explanation": (
            "We wrap the LLM call in a try/except block. "
            "If anything goes wrong (bad API key, network issue, model unavailable), "
            "we catch the exception and return a readable error string instead of crashing. "
            "`except Exception` catches ALL exceptions — a broad catch is appropriate here "
            "because we want the app to be resilient to any kind of failure. "
            "The error is shown to the user as text, not a stack trace."
        ),
        "why_it_matters": (
            "In agent design, making errors visible without crashing is a key principle — "
            "the caller (the page) should never have to handle exceptions from the agent."
        ),
    },
    {
        "title": "Step 6: Complete file — The full stateless agent",
        "code": """\
def get_response(query: str, provider: str) -> str:
    try:
        # Fresh message list — no history, no state
        messages = [{"role": "user", "content": query}]
        return _llm_call(messages, provider)
    except Exception as e:
        return f"Error: {str(e)}" """,
        "explanation": (
            "The complete implementation is just 5 lines of logic. "
            "This simplicity is intentional — a stateless LLM agent has no business logic to hide. "
            "Its entire job is: receive query → wrap in message format → call LLM → return response. "
            "Every design decision (no history, no rules, catch all errors) directly reflects "
            "the concept it demonstrates: a raw, stateless, probabilistic language model call."
        ),
        "why_it_matters": (
            "Simple code is a feature, not a limitation — "
            "this agent's simplicity makes it a perfect baseline for comparison with the stateful agent."
        ),
    },
]


# ─────────────────────────────────────────────────────────────────────────────
# DETERMINISTIC AGENT — 5 steps
# ─────────────────────────────────────────────────────────────────────────────
_DETERMINISTIC_STEPS = [
    {
        "title": "Step 1: The Rulebook — Explicit knowledge as data",
        "code": """\
INTENTS = [
    {
        "label": "greeting",
        "keywords": ["hello", "hi", "hey"],
        "response": "Hello! I'm a rule-based agent.",
    },
    {
        "label": "what_is_ai",
        "keywords": ["what is ai", "what is artificial intelligence"],
        "response": "AI is the simulation of human intelligence in machines.",
    },
    # ... 8 more intents
]""",
        "explanation": (
            "The agent's entire knowledge is stored in this list of dicts called `INTENTS`. "
            "Each intent has a label (the concept), a list of keywords that trigger it, "
            "and a hardcoded response. This is called a 'rulebook' or 'knowledge base'. "
            "Notice there's no AI model here — this is pure Python data. "
            "To add new knowledge, you simply add a new dict to this list."
        ),
        "why_it_matters": (
            "Because all responses are hardcoded, the same input ALWAYS produces the same output — "
            "this is the definition of determinism."
        ),
    },
    {
        "title": "Step 2: Function signature — Two outputs, not one",
        "code": """\
def get_response(query: str) -> tuple[str, str]:
    \"\"\"
    Returns (response_text, matched_intent_label).
    matched_intent is the rule label that fired, or 'unknown'.
    \"\"\" """,
        "explanation": (
            "Notice this function returns a TUPLE of two strings, not just one. "
            "The first is the response text. The second is the name of the rule that matched. "
            "Returning the matched intent label lets the UI show students WHICH rule fired — "
            "making the agent's decision-making completely transparent. "
            "This is a deliberate teaching design choice: show your work."
        ),
        "why_it_matters": (
            "Exposing the matched intent is a form of agent explainability — "
            "unlike an LLM, a deterministic agent can always explain exactly why it said what it said."
        ),
    },
    {
        "title": "Step 3: Matching — The keyword search loop",
        "code": """\
normalized = query.lower().strip()

for intent in INTENTS:
    for keyword in intent["keywords"]:
        if keyword in normalized:
            return intent["response"], intent["label"]""",
        "explanation": (
            "We first normalize the query to lowercase to make matching case-insensitive. "
            "Then we loop through every intent and check if any of its keywords appear in the query. "
            "The `in` operator checks if the keyword is a substring of the normalized query. "
            "The first match wins — we immediately return and stop checking the rest. "
            "This is an O(n×k) scan through intents×keywords, which is fine for a small rulebook."
        ),
        "why_it_matters": (
            "ORDER MATTERS — the first matching intent wins, so a query containing two keyword matches "
            "will always be handled by whichever intent appears first in the list."
        ),
    },
    {
        "title": "Step 4: The Fallback — The ceiling of rule-based systems",
        "code": """\
# No rule matched — return the fallback
known = ", ".join(INTENT_LABELS)
fallback = (
    f"I don't know how to handle that. "
    f"My rules only cover: {known}."
)
return fallback, "unknown" """,
        "explanation": (
            "If no keyword matched, we reach the fallback. "
            "We list all known intents so the user knows exactly what the agent can handle. "
            "This is the 'ceiling' of a rule-based system — it can only handle what was explicitly programmed. "
            "Unlike an LLM, it cannot generalize or make reasonable guesses about unknown inputs. "
            "The fallback intent label is 'unknown'."
        ),
        "why_it_matters": (
            "The fallback exposes the fundamental limitation of deterministic systems: "
            "they can only handle what the programmer explicitly anticipated."
        ),
    },
    {
        "title": "Step 5: No LLM, no imports from utils — Pure Python",
        "code": """\
# agents/deterministic_agent.py has NO imports from utils/
# No OpenAI, no Anthropic, no network calls.

# The entire file is:
#   INTENTS = [...]     <- the rulebook (data)
#   def get_response()  <- the matcher (logic)
#   def get_rules_table() <- for display in the UI""",
        "explanation": (
            "Notice that this file has zero imports from external packages or our own utils. "
            "It's 100% pure Python — no API calls, no network, no tokens. "
            "This makes it the fastest and most predictable module in the entire lab. "
            "It will run identically on any machine, offline, forever, without any keys or accounts. "
            "This is what makes it a 'deterministic' and 'rule-based' system."
        ),
        "why_it_matters": (
            "The complete absence of an LLM is the point — "
            "an agent doesn't need AI to be useful, and understanding the difference helps you "
            "choose the right tool for the right job."
        ),
    },
]


# ─────────────────────────────────────────────────────────────────────────────
# STATEFUL AGENT — 7 steps
# ─────────────────────────────────────────────────────────────────────────────
_STATEFUL_STEPS = [
    {
        "title": "Step 1: A class, not a function — Why statefulness needs a class",
        "code": """\
class StatefulAgent:
    def __init__(self, provider: str):
        self.history: list[dict] = []
        self.provider = provider""",
        "explanation": (
            "The stateful agent is a CLASS, unlike the other two agents which are plain functions. "
            "A function is called and forgotten — it can't remember anything between calls. "
            "A class INSTANCE persists in memory and can store data in its attributes (self.history). "
            "`self.history` starts as an empty list. Every user message and assistant response "
            "will be appended here, building up over the course of the conversation."
        ),
        "why_it_matters": (
            "Choosing a class over a function is the fundamental design decision that enables statefulness — "
            "without persistent storage, memory is impossible."
        ),
    },
    {
        "title": "Step 2: Session state ownership — Where does the instance live?",
        "code": """\
# In the Streamlit page (NOT in the agent file):

if "stateful_agent" not in st.session_state:
    st.session_state["stateful_agent"] = StatefulAgent(provider)

agent = st.session_state["stateful_agent"]""",
        "explanation": (
            "Streamlit re-runs the entire Python script on every user interaction (button click, text input, etc.). "
            "If we wrote `agent = StatefulAgent(provider)` at the top of the page, "
            "a NEW agent would be created on every rerun — erasing all memory instantly. "
            "Instead, we store the agent instance in `st.session_state`, which persists across reruns. "
            "We check 'if not in session_state' so we only create it ONCE for the session."
        ),
        "why_it_matters": (
            "This pattern — create once, retrieve always — is how ALL Streamlit apps manage state. "
            "Without it, every click would reset the agent to zero memory."
        ),
    },
    {
        "title": "Step 3: Appending to history — Recording the user's message",
        "code": """\
def chat(self, query: str) -> str:
    # Step 1: Add the user's new message to history
    self.history.append({"role": "user", "content": query})""",
        "explanation": (
            "The very first thing `chat()` does is save the user's message to history. "
            "We do this BEFORE calling the LLM, so the full context (including this new message) "
            "gets included in the API call. "
            "Each message is a dict with 'role' (who spoke) and 'content' (what they said). "
            "The role is 'user' for user messages and 'assistant' for model responses."
        ),
        "why_it_matters": (
            "Recording the query BEFORE the LLM call ensures the model always sees the complete "
            "conversation including the current turn."
        ),
    },
    {
        "title": "Step 4: Sending full history — The core of statefulness",
        "code": """\
    # Step 2: Send the ENTIRE history to the LLM
    response_text = _llm_call(self.history, self.provider)""",
        "explanation": (
            "We pass `self.history` — the ENTIRE conversation so far — to the LLM. "
            "The LLM receives turn 1, turn 2, turn 3... all the way to the current message. "
            "This is why the LLM can answer 'What is my name?' if you told it your name two turns ago. "
            "The LLM itself is still stateless — it just predicts based on what it sees. "
            "WE are creating the illusion of memory by feeding it the full context every time."
        ),
        "why_it_matters": (
            "This one line is what makes this agent 'stateful' — "
            "the LLM sees history, the LLM agent sees only a single message."
        ),
    },
    {
        "title": "Step 5: Saving the response — Completing the memory loop",
        "code": """\
    # Step 3: Save the assistant's response to history
    self.history.append({"role": "assistant", "content": response_text})

    return response_text""",
        "explanation": (
            "After getting the LLM's response, we save it to history too. "
            "This is essential — without it, the next turn would be missing context. "
            "Imagine a conversation where we remember what WE said but forgot what the assistant replied. "
            "By storing both user messages and assistant responses, future turns have full context. "
            "Finally, we return the response text to the caller (the Streamlit page)."
        ),
        "why_it_matters": (
            "Saving BOTH sides of the conversation — user and assistant — is what creates "
            "true multi-turn context, not just message history."
        ),
    },
    {
        "title": "Step 6: Reset — Demonstrating statelessness through contrast",
        "code": """\
def reset(self) -> None:
    \"\"\"
    Clear all conversation history.
    After reset(), this agent behaves exactly like the stateless LLM agent.
    \"\"\"
    self.history = []""",
        "explanation": (
            "The reset method simply empties the history list. "
            "After calling reset(), the next chat() call will send only the new message to the LLM — "
            "no prior context, no memory. "
            "This is a great classroom demonstration: ask 'What is my name?', get an answer, "
            "hit 'Clear Memory', then ask again — the agent genuinely won't know. "
            "This contrast makes the memory feature concrete and visible."
        ),
        "why_it_matters": (
            "Seeing statefulness disappear on demand makes the concept more concrete — "
            "memory isn't magic, it's just a list that we choose to keep or clear."
        ),
    },
    {
        "title": "Step 7: Complete comparison — LLM vs Stateful agent",
        "code": """\
# LLM Agent (stateless):
def get_response(query: str, provider: str) -> str:
    messages = [{"role": "user", "content": query}]  # always fresh
    return _llm_call(messages, provider)

# Stateful Agent (stateful):
def chat(self, query: str) -> str:
    self.history.append({"role": "user", "content": query})  # accumulate
    response = _llm_call(self.history, self.provider)        # send full history
    self.history.append({"role": "assistant", "content": response})
    return response""",
        "explanation": (
            "Side by side, the difference is visible: the LLM agent builds a fresh 1-message list. "
            "The stateful agent appends to a growing history and sends the whole thing. "
            "Both call the exact same underlying LLM. "
            "The difference isn't the model — it's how much context we include. "
            "Statefulness is a property of the CODE around the model, not the model itself."
        ),
        "why_it_matters": (
            "This comparison is the central lesson: 'intelligence' and 'memory' in AI systems "
            "often come from how we manage context, not from the model alone."
        ),
    },
]
```

- [ ] **Step 2: Commit**

```bash
git add utils/code_steps.py
git commit -m "feat: add step-through educational content for all three agents"
```

---

## Task 7: Home Page

**Files:**
- Create: `app/🏠_Home.py`

- [ ] **Step 1: Create `app/🏠_Home.py`**

```python
import sys
import os

# Add repo root to path (Home.py is at app/ — one level up reaches repo root)
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, ROOT)

import streamlit as st

st.set_page_config(
    page_title="Agentic AI Foundation Lab",
    page_icon="🤖",
    layout="wide",
)

# ── Header ────────────────────────────────────────────────────────────────────
st.title("🤖 Agentic AI Foundation Lab")
st.markdown(
    "An interactive lab for learning the foundational concepts of AI agents, "
    "language models, and intelligent systems — through live demos and code walkthroughs."
)
st.divider()

# ── Concept cards (2×2 grid) ──────────────────────────────────────────────────
col1, col2 = st.columns(2)

with col1:
    with st.container(border=True):
        st.subheader("🤖 AI Agent vs LLM vs Chatbot")
        st.markdown(
            "An **LLM** predicts text. A **Chatbot** wraps an LLM in a conversational UI. "
            "An **Agent** uses an LLM (or rules) to make decisions and take actions toward a goal."
        )
        st.page_link("pages/1_🤖_LLM.py", label="Go to LLM Demo →")

    with st.container(border=True):
        st.subheader("⚙️ Deterministic vs Probabilistic")
        st.markdown(
            "**Deterministic** systems always return the same output for the same input. "
            "**Probabilistic** systems (like LLMs) can return different outputs each time."
        )
        st.page_link("pages/2_⚙️_Deterministic.py", label="Go to Deterministic Demo →")

with col2:
    with st.container(border=True):
        st.subheader("🧠 Stateless vs Stateful Agents")
        st.markdown(
            "A **stateless** agent forgets everything between calls. "
            "A **stateful** agent maintains memory across turns, enabling multi-turn conversations."
        )
        st.page_link("pages/3_🧠_Stateful_Agent.py", label="Go to Stateful Demo →")

    with st.container(border=True):
        st.subheader("📋 Agent Roles & Responsibility Boundaries")
        st.markdown(
            "Well-designed agents have a **single clear role**: perceive input, decide, act. "
            "Mixing responsibilities (UI + logic + memory) makes agents hard to understand and test."
        )
        st.page_link("pages/4_📊_Compare_All.py", label="Go to Compare All →")

st.divider()

# ── Suggested learning path ───────────────────────────────────────────────────
st.markdown(
    "**Suggested learning path:** "
    "LLM Demo → Deterministic Demo → Stateful Agent → Compare All → How It Works"
)
```

- [ ] **Step 2: Verify the app launches**

```bash
cd /Users/vrln/agentic-ai-foundation-lab
source .venv/bin/activate
streamlit run app/🏠_Home.py
```

Expected: Browser opens, home page shows 4 concept cards in a 2×2 grid. No errors in terminal.

- [ ] **Step 3: Commit**

```bash
git add "app/🏠_Home.py"
git commit -m "feat: add Home page with concept card grid"
```

---

## Task 8: LLM Demo Page

**Files:**
- Create: `app/pages/1_🤖_LLM.py`

- [ ] **Step 1: Create `app/pages/1_🤖_LLM.py`**

```python
import sys
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, ROOT)

import streamlit as st
from agents.llm_agent import get_response

st.set_page_config(page_title="Pure LLM Demo", page_icon="🤖", layout="wide")

# ── Sidebar: provider selector ────────────────────────────────────────────────
with st.sidebar:
    st.header("⚙️ Settings")
    provider = st.selectbox(
        "LLM Provider",
        ["openai", "anthropic", "ollama"],
        key="provider",
    )
    st.caption("This selection is shared across all demo pages.")

# ── Page content ──────────────────────────────────────────────────────────────
st.title("🤖 Pure LLM — Stateless & Probabilistic")

with st.expander("📚 What is this?", expanded=True):
    st.markdown("""
**This page demonstrates a pure LLM call.** Every time you send a message:
- The LLM receives ONLY your current message — no history, no rules
- It generates a response probabilistically (may differ each time)
- It immediately forgets everything after responding

**Try this:**
1. Ask *"What is my name?"* — the LLM won't know (you never told it)
2. Ask *"What is AI?"* twice — notice the answers may vary slightly
    """)

st.divider()

# ── Input ─────────────────────────────────────────────────────────────────────
query = st.text_input(
    "Your message:",
    placeholder="e.g. What is AI?",
    key="llm_query_input",
)

col_btn, col_hint = st.columns([1, 5])
with col_btn:
    send = st.button("Send", type="primary", use_container_width=True)
with col_hint:
    st.caption("💡 Try the same question twice — watch for variation in responses!")

# ── Response ──────────────────────────────────────────────────────────────────
if send and query.strip():
    with st.spinner("Calling LLM..."):
        response = get_response(query.strip(), provider)
    st.session_state["llm_response"] = response
    st.session_state["llm_last_query"] = query.strip()

if "llm_response" in st.session_state:
    st.markdown("**Response:**")
    with st.chat_message("assistant"):
        st.markdown(st.session_state["llm_response"])

    model_name = {
        "openai": "gpt-4o-mini",
        "anthropic": "claude-haiku-4-5",
        "ollama": st.secrets.get("OLLAMA_MODEL", "llama3.2") if hasattr(st, "secrets") else "llama3.2",
    }.get(provider, provider)
    st.caption(f"Provider: `{provider}` | Model: `{model_name}`")
```

- [ ] **Step 2: Visit the page in browser and verify**

With `streamlit run app/🏠_Home.py` running, navigate to page "🤖 LLM" in the sidebar. Type a query, click Send. Response should appear.

- [ ] **Step 3: Commit**

```bash
git add "app/pages/1_🤖_LLM.py"
git commit -m "feat: add LLM demo page"
```

---

## Task 9: Deterministic Demo Page

**Files:**
- Create: `app/pages/2_⚙️_Deterministic.py`

- [ ] **Step 1: Create `app/pages/2_⚙️_Deterministic.py`**

```python
import sys
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, ROOT)

import streamlit as st
from agents.deterministic_agent import get_response, get_rules_table

st.set_page_config(page_title="Deterministic Agent", page_icon="⚙️", layout="wide")

st.title("⚙️ Rule-Based Deterministic Agent")

with st.expander("📚 What is this?", expanded=True):
    st.markdown("""
**This agent uses no AI model.** It matches your message against a hardcoded rulebook.

Key observations:
- Same input → **always same output** (deterministic)
- No LLM calls — pure Python `if/elif` logic
- Ask anything outside the rulebook — it fails gracefully
- There is no "creativity", no "understanding" — just pattern matching

**Try this:** Ask *"What is the weather today?"* — watch the fallback response.
    """)

st.divider()

# ── Rules table ───────────────────────────────────────────────────────────────
with st.expander("📋 View the complete rulebook", expanded=False):
    st.markdown("The agent's complete knowledge. Nothing can happen that isn't in this table.")
    st.dataframe(get_rules_table(), use_container_width=True, hide_index=True)

# ── Input ─────────────────────────────────────────────────────────────────────
query = st.text_input(
    "Your message:",
    placeholder="e.g. What is AI?",
    key="det_query_input",
)

col_btn, col_hint = st.columns([1, 5])
with col_btn:
    send = st.button("Send", type="primary", use_container_width=True)
with col_hint:
    st.caption("💡 Ask the same question multiple times — the answer never changes!")

# ── Response ──────────────────────────────────────────────────────────────────
if send and query.strip():
    response, intent = get_response(query.strip())
    st.session_state["det_response"] = response
    st.session_state["det_intent"] = intent

if "det_response" in st.session_state:
    intent = st.session_state["det_intent"]
    if intent == "unknown":
        st.warning(f"🚫 MATCHED INTENT: `{intent}` — no rule found")
    else:
        st.success(f"✅ MATCHED INTENT: `{intent}`")

    with st.chat_message("assistant"):
        st.markdown(st.session_state["det_response"])

    st.caption("No LLM was called. This response came from a Python dictionary.")
```

- [ ] **Step 2: Verify in browser**

Navigate to "⚙️ Deterministic" page. Test with "What is AI?" (should show intent), and "What is the weather?" (should show unknown).

- [ ] **Step 3: Commit**

```bash
git add "app/pages/2_⚙️_Deterministic.py"
git commit -m "feat: add deterministic rule-based demo page"
```

---

## Task 10: Stateful Agent Page

**Files:**
- Create: `app/pages/3_🧠_Stateful_Agent.py`

- [ ] **Step 1: Create `app/pages/3_🧠_Stateful_Agent.py`**

```python
import sys
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, ROOT)

import streamlit as st
from agents.stateful_agent import StatefulAgent

st.set_page_config(page_title="Stateful Agent", page_icon="🧠", layout="wide")

# ── Sidebar ───────────────────────────────────────────────────────────────────
with st.sidebar:
    st.header("⚙️ Settings")
    provider = st.selectbox(
        "LLM Provider",
        ["openai", "anthropic", "ollama"],
        key="provider",
    )
    st.divider()
    if st.button("🗑️ Clear Memory", use_container_width=True):
        if "stateful_agent" in st.session_state:
            st.session_state["stateful_agent"].reset()
        st.session_state["stateful_chat_display"] = []
        st.rerun()

# ── Initialise agent and chat display in session state (once per session) ─────
if "stateful_agent" not in st.session_state:
    st.session_state["stateful_agent"] = StatefulAgent(provider)

if "stateful_chat_display" not in st.session_state:
    st.session_state["stateful_chat_display"] = []

agent: StatefulAgent = st.session_state["stateful_agent"]

# ── Page content ──────────────────────────────────────────────────────────────
st.title("🧠 Stateful Memory Agent")

with st.expander("📚 What is this?", expanded=True):
    st.markdown("""
**This agent remembers the full conversation history.**

How it works:
- Every message you send is saved to a history list
- On each new turn, the ENTIRE history is sent to the LLM
- The LLM can reference anything said earlier in the conversation

**Try this sequence:**
1. *"My name is Alex"*
2. *"What is AI?"*
3. *"What is my name?"* ← the agent will remember!

Then hit **Clear Memory** in the sidebar and ask *"What is my name?"* again — it won't know.
    """)

# ── Memory panel ──────────────────────────────────────────────────────────────
with st.expander(f"🧠 What I remember ({len(agent.get_history())} messages)", expanded=False):
    history = agent.get_history()
    if history:
        for i, msg in enumerate(history):
            role_label = "👤 User" if msg["role"] == "user" else "🤖 Assistant"
            st.markdown(f"**{role_label}:** {msg['content']}")
    else:
        st.info("Memory is empty. Start a conversation below.")

st.divider()

# ── Chat history display ───────────────────────────────────────────────────────
for msg in st.session_state["stateful_chat_display"]:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])

# ── Chat input ────────────────────────────────────────────────────────────────
user_input = st.chat_input("Talk to the stateful agent...")

if user_input:
    # Show user message immediately
    with st.chat_message("user"):
        st.markdown(user_input)
    st.session_state["stateful_chat_display"].append(
        {"role": "user", "content": user_input}
    )

    # Get agent response
    with st.chat_message("assistant"):
        with st.spinner("Thinking..."):
            response = agent.chat(user_input)
        st.markdown(response)

    st.session_state["stateful_chat_display"].append(
        {"role": "assistant", "content": response}
    )
    st.rerun()
```

- [ ] **Step 2: Verify in browser**

Navigate to "🧠 Stateful Agent". Tell it your name, ask something else, then ask "What is my name?" — it should remember. Clear memory, ask again — it shouldn't.

- [ ] **Step 3: Commit**

```bash
git add "app/pages/3_🧠_Stateful_Agent.py"
git commit -m "feat: add stateful agent demo page with memory panel"
```

---

## Task 11: Compare All Page

**Files:**
- Create: `app/pages/4_📊_Compare_All.py`

- [ ] **Step 1: Create `app/pages/4_📊_Compare_All.py`**

```python
import sys
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, ROOT)

import streamlit as st
from agents.llm_agent import get_response as llm_get
from agents.deterministic_agent import get_response as det_get
from agents.stateful_agent import StatefulAgent

st.set_page_config(page_title="Compare All", page_icon="📊", layout="wide")

# ── Sidebar ───────────────────────────────────────────────────────────────────
with st.sidebar:
    st.header("⚙️ Settings")
    provider = st.selectbox(
        "LLM Provider",
        ["openai", "anthropic", "ollama"],
        key="provider",
    )
    st.caption("Applies to LLM and Stateful columns.")

# ── Initialise session state ──────────────────────────────────────────────────
if "compare_stateful_agent" not in st.session_state:
    st.session_state["compare_stateful_agent"] = StatefulAgent(provider)
if "compare_history" not in st.session_state:
    st.session_state["compare_history"] = []

compare_agent: StatefulAgent = st.session_state["compare_stateful_agent"]

# ── Page header ───────────────────────────────────────────────────────────────
st.title("📊 Compare All Three Agents")
st.markdown(
    "Ask the same question to all three agents simultaneously. "
    "Watch how their responses differ — and why."
)
st.divider()

# ── Suggestion chips ──────────────────────────────────────────────────────────
SAMPLE_QUERIES = [
    "What is AI?",
    "What is an agent?",
    "My name is Alex, remember that",
    "What is my name?",
    "What is the weather today?",
]

st.markdown("**💡 Suggested queries (click to use):**")
chip_cols = st.columns(len(SAMPLE_QUERIES))
selected_query = ""
for i, q in enumerate(SAMPLE_QUERIES):
    if chip_cols[i].button(q, key=f"chip_{i}", use_container_width=True):
        selected_query = q

# ── Shared query input ────────────────────────────────────────────────────────
query = st.text_input(
    "Or type your own question:",
    value=selected_query,
    key="compare_query_input",
    placeholder="e.g. What is AI?",
)

ask = st.button("🚀 Ask All Three", type="primary", use_container_width=False)

# ── Run all three agents ──────────────────────────────────────────────────────
if ask and query.strip():
    q = query.strip()
    with st.spinner("Asking all three agents..."):
        llm_resp = llm_get(q, provider)
        det_resp, det_intent = det_get(q)
        stat_resp = compare_agent.chat(q)

    st.session_state["compare_llm_resp"] = llm_resp
    st.session_state["compare_det_resp"] = det_resp
    st.session_state["compare_det_intent"] = det_intent
    st.session_state["compare_stat_resp"] = stat_resp
    st.session_state["compare_last_query"] = q
    st.session_state["compare_history"].append({
        "Query": q,
        "LLM Response": llm_resp,
        "Deterministic Response": det_resp,
        "Stateful Response": stat_resp,
    })

# ── Side-by-side columns ──────────────────────────────────────────────────────
if "compare_llm_resp" in st.session_state:
    st.divider()
    col_llm, col_det, col_stat = st.columns(3)

    with col_llm:
        st.subheader("🤖 LLM Agent")
        st.caption("Stateless · Probabilistic")
        st.info(st.session_state["compare_llm_resp"])

    with col_det:
        st.subheader("⚙️ Deterministic Agent")
        st.caption("Stateless · Deterministic · No LLM")
        intent = st.session_state.get("compare_det_intent", "")
        if intent == "unknown":
            st.warning(st.session_state["compare_det_resp"])
        else:
            st.success(st.session_state["compare_det_resp"])
        st.caption(f"Matched intent: `{intent}`")

    with col_stat:
        st.subheader("🧠 Stateful Agent")
        st.caption("Stateful · Memory-enabled")
        st.info(st.session_state["compare_stat_resp"])
        st.caption(f"Memory: {len(compare_agent.get_history())} messages stored")

    # ── What just happened? ────────────────────────────────────────────────────
    st.divider()
    st.subheader("💬 What just happened?")

    last_q = st.session_state.get("compare_last_query", "").lower()
    if "what is my name" in last_q:
        st.markdown("""
- **LLM:** Has no memory — doesn't know your name unless you told it in THIS single message.
- **Deterministic:** Has no LLM — matched the "name_tell" rule (or fell back to "unknown").
- **Stateful:** Checked its conversation history — if you said your name earlier this session, it knows!
        """)
    elif "my name is" in last_q:
        st.markdown("""
- **LLM:** Acknowledged your name in this response, but will forget it next message.
- **Deterministic:** Matched the `name_tell` rule and gave its hardcoded response.
- **Stateful:** Saved your name to memory — ask "What is my name?" next and it will remember!
        """)
    elif "weather" in last_q:
        st.markdown("""
- **LLM:** Attempted an answer (may guess or refuse — probabilistic behavior).
- **Deterministic:** Hit the fallback — no weather rule exists. Shows its ceiling.
- **Stateful:** Used the LLM with context — may give a more nuanced response.
        """)
    else:
        st.markdown("""
- **LLM:** Generated a fresh response. Ask the same question again — it may differ slightly.
- **Deterministic:** If a rule matched, the response will be identical every time.
- **Stateful:** Responded with awareness of everything said earlier in this session.
        """)

# ── Run history ───────────────────────────────────────────────────────────────
if st.session_state["compare_history"]:
    st.divider()
    with st.expander(f"📋 Full Run History ({len(st.session_state['compare_history'])} queries)", expanded=False):
        import pandas as pd
        df = pd.DataFrame(st.session_state["compare_history"])
        st.dataframe(df, use_container_width=True, hide_index=True)
```

- [ ] **Step 2: Add pandas to requirements.txt** (needed for the history dataframe)

```
streamlit>=1.35.0
openai>=1.30.0
anthropic>=0.28.0
ollama>=0.2.0
pytest>=8.0.0
pandas>=2.0.0
```

Then run: `pip install pandas`

- [ ] **Step 3: Verify in browser**

Navigate to "📊 Compare All". Click a suggestion chip, click "Ask All Three". All three columns should populate. Run history should accumulate. "What just happened?" should show contextual explanation.

- [ ] **Step 4: Commit**

```bash
git add "app/pages/4_📊_Compare_All.py" requirements.txt
git commit -m "feat: add Compare All page with side-by-side agent comparison"
```

---

## Task 12: How It Works Page

**Files:**
- Create: `app/pages/5_📖_How_It_Works.py`

- [ ] **Step 1: Create `app/pages/5_📖_How_It_Works.py`**

```python
import sys
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, ROOT)

import streamlit as st
from utils.code_steps import get_steps

st.set_page_config(page_title="How It Works", page_icon="📖", layout="wide")

st.title("📖 How It Works — Step-Through Code Walkthrough")
st.markdown(
    "Walk through each agent's source code step by step. "
    "Select an agent below, then use **Previous** and **Next** to explore."
)
st.divider()

# ── Agent selector ────────────────────────────────────────────────────────────
AGENT_OPTIONS = {
    "🤖 LLM Agent (stateless)": "llm",
    "⚙️ Deterministic Agent (rule-based)": "deterministic",
    "🧠 Stateful Agent (memory-enabled)": "stateful",
}

selected_label = st.radio(
    "Choose an agent to explore:",
    list(AGENT_OPTIONS.keys()),
    horizontal=True,
    key="how_agent_label",
)
selected_agent = AGENT_OPTIONS[selected_label]

# Reset step index when agent changes
if st.session_state.get("how_selected_agent") != selected_agent:
    st.session_state["how_step"] = 0
    st.session_state["how_selected_agent"] = selected_agent

# ── Load steps ────────────────────────────────────────────────────────────────
steps = get_steps(selected_agent)
total_steps = len(steps)
current_step = st.session_state.get("how_step", 0)

if not steps:
    st.error("No steps found for this agent.")
    st.stop()

# ── Progress bar ──────────────────────────────────────────────────────────────
st.progress(
    (current_step + 1) / total_steps,
    text=f"Step {current_step + 1} of {total_steps}",
)

# ── Step content ──────────────────────────────────────────────────────────────
step = steps[current_step]

st.subheader(step["title"])
st.code(step["code"], language="python")
st.markdown(step["explanation"])
st.info(f"💡 **Why this matters:** {step['why_it_matters']}")

st.divider()

# ── Navigation buttons ────────────────────────────────────────────────────────
nav_left, nav_center, nav_right = st.columns([1, 6, 1])

with nav_left:
    if st.button("← Previous", disabled=(current_step == 0), use_container_width=True):
        st.session_state["how_step"] = current_step - 1
        st.rerun()

with nav_center:
    st.empty()

with nav_right:
    if st.button("Next →", disabled=(current_step == total_steps - 1), use_container_width=True):
        st.session_state["how_step"] = current_step + 1
        st.rerun()
```

- [ ] **Step 2: Verify in browser**

Navigate to "📖 How It Works". Select each agent. Click Next/Previous through steps. Progress bar should update. Previous should be disabled on step 1, Next on the last step.

- [ ] **Step 3: Commit**

```bash
git add "app/pages/5_📖_How_It_Works.py"
git commit -m "feat: add How It Works step-through code walkthrough page"
```

---

## Task 13: README and Final Smoke Test

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

````markdown
# Agentic AI Foundation Lab

An interactive Streamlit lab for learning foundational AI concepts through
live demos, side-by-side comparisons, and step-through code walkthroughs.

## What This Lab Teaches

| Concept | Demo |
|---|---|
| AI Agent vs LLM vs Chatbot | All three demo pages |
| Deterministic vs Probabilistic | LLM vs Deterministic pages |
| Stateless vs Stateful | LLM vs Stateful Agent pages |
| Agent Roles & Responsibility Boundaries | Compare All + How It Works |

---

## Project Structure

```
agentic-ai-foundation-lab/
├── app/
│   ├── 🏠_Home.py          ← Streamlit entrypoint
│   └── pages/
│       ├── 1_🤖_LLM.py
│       ├── 2_⚙️_Deterministic.py
│       ├── 3_🧠_Stateful_Agent.py
│       ├── 4_📊_Compare_All.py
│       └── 5_📖_How_It_Works.py
├── agents/                 ← Agent logic (no UI code)
│   ├── llm_agent.py
│   ├── deterministic_agent.py
│   └── stateful_agent.py
├── utils/
│   ├── llm_client.py       ← OpenAI / Anthropic / Ollama adapter
│   └── code_steps.py       ← Step-through educational content
├── tests/                  ← pytest unit tests
└── requirements.txt
```

---

## Quick Start (Local)

**1. Create and activate virtual environment (Python 3.11 required):**
```bash
python3.11 -m venv .venv
source .venv/bin/activate      # macOS/Linux
# .venv\Scripts\activate       # Windows
```

**2. Install dependencies:**
```bash
pip install -r requirements.txt
```

**3. Set up API keys:**
```bash
cp .streamlit/secrets.toml.example .streamlit/secrets.toml
# Edit .streamlit/secrets.toml — add your API key(s)
```

**4. Run the app:**
```bash
streamlit run app/🏠_Home.py
```

The app opens at **http://localhost:8501**

---

## API Key Setup

### Local (`.streamlit/secrets.toml`)

```toml
OPENAI_API_KEY = "sk-..."          # platform.openai.com
ANTHROPIC_API_KEY = "sk-ant-..."   # console.anthropic.com
```

### Streamlit Cloud

1. Go to your app's dashboard → **Settings → Secrets**
2. Add the same keys in TOML format

### No API Key? Use Ollama (free, local, offline)

```bash
# Install Ollama from https://ollama.com, then:
ollama pull llama3.2
ollama serve
```

Select "ollama" as the provider in the sidebar.

---

## Deploy to Streamlit Cloud

1. Push this repo to GitHub
2. Go to [share.streamlit.io](https://share.streamlit.io) → **New app**
3. Repo: your repo | Branch: main | **Main file: `app/🏠_Home.py`**
4. Add API keys in **Settings → Secrets**
5. Click **Deploy**

Note: Ollama will not work on Streamlit Cloud (requires a local server).

---

## Run Tests

```bash
pytest tests/ -v
```

---

## How to Use This in a Classroom

**Suggested page order:**

1. **Home** — Orient students to the 4 concepts (5 min)
2. **LLM Demo** — Ask "What is AI?" twice, observe variation. Ask "What is my name?" (5 min)
3. **Deterministic Demo** — Same questions, notice identical answers. Try out-of-scope query (5 min)
4. **Stateful Agent** — Tell it your name, ask other questions, ask "What is my name?" (10 min)
5. **Compare All** — Run all 5 sample queries one by one, discuss "What just happened?" (15 min)
6. **How It Works** — Walk through each agent's code step-by-step (20 min)

**Discussion prompts by concept:**

- *LLM vs Agent*: "Is this LLM an agent? Why or why not? What would it need to become one?"
- *Deterministic vs Probabilistic*: "Which would you trust more for a medical diagnosis? A legal contract? A creative writing assistant?"
- *Stateless vs Stateful*: "Why do most chatbots feel like they remember you? Where is that memory actually stored?"
- *Roles & Boundaries*: "What happens if you put the memory logic inside the page instead of the agent class? Try it."
````

- [ ] **Step 2: Run full test suite**

```bash
pytest tests/ -v
```

Expected: All tests PASS with green output.

- [ ] **Step 3: Smoke test all pages**

With `streamlit run app/🏠_Home.py` running, manually visit each page and verify:
- [ ] Home: 4 cards render, page links work
- [ ] LLM: query → response, provider selector visible
- [ ] Deterministic: rules table visible, intents fire correctly
- [ ] Stateful: tell it your name, clear memory, verify memory wipes
- [ ] Compare All: suggestion chips, all three columns respond, history accumulates
- [ ] How It Works: all 3 agents load, prev/next navigation works, progress bar updates

- [ ] **Step 4: Final commit**

```bash
git add README.md
git commit -m "feat: add README with setup, deploy, and classroom guide"
```

---

## Done

All 13 tasks complete. The lab is fully functional with:
- ✅ 3 agent modules with unit tests
- ✅ Shared configurable LLM client (OpenAI / Anthropic / Ollama)
- ✅ 5 Streamlit pages with side-by-side comparison
- ✅ Step-through code walkthrough with 18 educational steps
- ✅ README with classroom guide and Streamlit Cloud deploy instructions
