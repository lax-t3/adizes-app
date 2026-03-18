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
from __future__ import annotations


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
            "We import Python's built-in sys and os modules to handle file paths. "
            "Then we calculate the repo root directory and add it to Python's search path — "
            "this is what allows us to import from the utils folder. "
            "Finally, we import the shared get_response function from our LLM client. "
            "The alias _llm_call (with underscore) signals it's an internal detail, not part of this module's public API."
        ),
        "why_it_matters": (
            "This agent delegates all LLM communication to llm_client.py — "
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
            "The function takes two inputs: the user's text (query) and which LLM to use (provider). "
            "It always returns a string — either the model's answer or an error message. "
            "Notice the docstring says 'never raises' — this is a design choice. "
            "By catching errors internally, we prevent the Streamlit page from showing an ugly crash screen. "
            "Type hints (str) tell the reader exactly what goes in and what comes out."
        ),
        "why_it_matters": (
            "A well-defined interface (inputs to outputs) is the foundation of clean agent design — "
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
            "Each message is a dict with two keys: role (who spoke) and content (what they said). "
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
            "The _llm_call function handles all provider-specific details (OpenAI vs Anthropic vs Ollama). "
            "This one-liner is the entire intelligence of this agent — "
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
            "except Exception catches ALL exceptions — a broad catch is appropriate here "
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
            "Its entire job is: receive query, wrap in message format, call LLM, return response. "
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
    # ... 7 more intents
]""",
        "explanation": (
            "The agent's entire knowledge is stored in this list of dicts called INTENTS. "
            "Each intent has a label (the concept), a list of keywords that trigger it, "
            "and a hardcoded response. This is called a rulebook or knowledge base. "
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
            "The in operator checks if the keyword is a substring of the normalized query. "
            "The first match wins — we immediately return and stop checking the rest. "
            "This is an O(n x k) scan through intents x keywords, which is fine for a small rulebook."
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
            "This is the ceiling of a rule-based system — it can only handle what was explicitly programmed. "
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
#   INTENTS = [...]       <- the rulebook (data)
#   def get_response()    <- the matcher (logic)
#   def get_rules_table() <- for display in the UI""",
        "explanation": (
            "Notice that this file has zero imports from external packages or our own utils. "
            "It is 100% pure Python — no API calls, no network, no tokens. "
            "This makes it the fastest and most predictable module in the entire lab. "
            "It will run identically on any machine, offline, forever, without any keys or accounts. "
            "This is what makes it a deterministic and rule-based system."
        ),
        "why_it_matters": (
            "The complete absence of an LLM is the point — "
            "an agent does not need AI to be useful, and understanding the difference helps you "
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
            "A function is called and forgotten — it cannot remember anything between calls. "
            "A class INSTANCE persists in memory and can store data in its attributes (self.history). "
            "self.history starts as an empty list. Every user message and assistant response "
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
            "Streamlit re-runs the entire Python script on every user interaction. "
            "If we wrote agent = StatefulAgent(provider) at the top of the page, "
            "a NEW agent would be created on every rerun — erasing all memory instantly. "
            "Instead, we store the agent instance in st.session_state, which persists across reruns. "
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
            "The very first thing chat() does is save the user's message to history. "
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
            "We pass self.history — the ENTIRE conversation so far — to the LLM. "
            "The LLM receives turn 1, turn 2, turn 3... all the way to the current message. "
            "This is why the LLM can answer 'What is my name?' if you told it your name two turns ago. "
            "The LLM itself is still stateless — it just predicts based on what it sees. "
            "WE are creating the illusion of memory by feeding it the full context every time."
        ),
        "why_it_matters": (
            "This one line is what makes this agent stateful — "
            "the LLM agent sees only a single message; the stateful agent sees the full history."
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
            "hit 'Clear Memory', then ask again — the agent genuinely will not know. "
            "This contrast makes the memory feature concrete and visible."
        ),
        "why_it_matters": (
            "Seeing statefulness disappear on demand makes the concept more concrete — "
            "memory is not magic, it is just a list that we choose to keep or clear."
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
            "The difference is not the model — it is how much context we include. "
            "Statefulness is a property of the CODE around the model, not the model itself."
        ),
        "why_it_matters": (
            "This comparison is the central lesson: intelligence and memory in AI systems "
            "often come from how we manage context, not from the model alone."
        ),
    },
]
