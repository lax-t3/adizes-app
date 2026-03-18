"""Deterministic Agent Demo Page — Rule-based system with no LLM."""
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
- No LLM calls — pure Python if/elif logic
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
