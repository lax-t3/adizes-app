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
from __future__ import annotations

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
        # never crashes with an ugly traceback.
        return f"Error: {str(e)}"
