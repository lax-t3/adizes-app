"""Agentic AI Foundation Lab — Home Page (entrypoint)."""
import sys
import os

# app/🏠_Home.py is one level below repo root: go up once
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
st.markdown(
    "**Suggested learning path:** "
    "LLM Demo → Deterministic Demo → Stateful Agent → Compare All → How It Works"
)
