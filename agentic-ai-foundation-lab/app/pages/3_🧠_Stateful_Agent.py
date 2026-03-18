"""Stateful Agent Demo Page — Memory-enabled LLM with conversation history."""
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
else:
    # Update provider if user changed it in the sidebar
    st.session_state["stateful_agent"].provider = provider

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
        for msg in history:
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
    with st.chat_message("user"):
        st.markdown(user_input)
    st.session_state["stateful_chat_display"].append(
        {"role": "user", "content": user_input}
    )

    with st.chat_message("assistant"):
        with st.spinner("Thinking..."):
            response = agent.chat(user_input)
        st.markdown(response)

    st.session_state["stateful_chat_display"].append(
        {"role": "assistant", "content": response}
    )
    st.rerun()
