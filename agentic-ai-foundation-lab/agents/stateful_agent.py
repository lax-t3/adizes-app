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
from __future__ import annotations

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

        # TEACHING NOTE: If the LLM call returned an error string (e.g., missing API key),
        # we do NOT save it to history — an error message is not a real assistant turn.
        # Saving errors to history would corrupt future context with garbage.
        if not response_text.startswith("Error:") and not response_text.startswith("⚠️"):
            self.history.append({"role": "assistant", "content": response_text})
        else:
            # Pop the user message we just added — this turn effectively didn't happen
            self.history.pop()

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
