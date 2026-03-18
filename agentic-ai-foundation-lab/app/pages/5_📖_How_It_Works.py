"""How It Works Page — Step-through code walkthrough for all three agents."""
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
