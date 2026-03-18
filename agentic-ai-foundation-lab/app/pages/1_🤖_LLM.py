"""LLM Demo Page — Pure stateless LLM call demonstration."""
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

if "llm_response" in st.session_state:
    st.markdown("**Response:**")
    with st.chat_message("assistant"):
        st.markdown(st.session_state["llm_response"])

    model_name = {
        "openai": "gpt-4o-mini",
        "anthropic": "claude-haiku-4-5",
        "ollama": "llama3.2",
    }.get(provider, provider)
    st.caption(f"Provider: `{provider}` | Model: `{model_name}`")
