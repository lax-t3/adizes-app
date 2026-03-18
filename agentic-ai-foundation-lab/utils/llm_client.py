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
