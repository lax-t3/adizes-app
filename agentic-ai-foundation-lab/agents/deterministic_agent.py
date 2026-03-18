from __future__ import annotations

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
        "label": "what_is_agent",
        "keywords": ["what is an agent", "what is ai agent", "define agent"],
        "response": (
            "An AI agent is a system that perceives its environment, makes decisions, "
            "and takes actions to achieve a goal. I am an example of a simple rule-based agent!"
        ),
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
        # Single keyword intentional — teaches the boundary of pattern matching
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
