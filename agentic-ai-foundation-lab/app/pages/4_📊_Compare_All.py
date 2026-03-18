"""Compare All Page — Side-by-side comparison of all three agents."""
import sys
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, ROOT)

import pandas as pd
import streamlit as st
from agents.llm_agent import get_response as llm_get
from agents.deterministic_agent import get_response as det_get
from agents.stateful_agent import StatefulAgent

st.set_page_config(page_title="Compare All", page_icon="📊", layout="wide")

# ── Sidebar ───────────────────────────────────────────────────────────────────
with st.sidebar:
    st.header("⚙️ Settings")
    provider = st.selectbox(
        "LLM Provider",
        ["openai", "anthropic", "ollama"],
        key="provider",
    )
    st.caption("Applies to LLM and Stateful columns.")

# ── Initialise session state ──────────────────────────────────────────────────
if "compare_stateful_agent" not in st.session_state:
    st.session_state["compare_stateful_agent"] = StatefulAgent(provider)
else:
    # Update provider if user changed it in the sidebar
    st.session_state["compare_stateful_agent"].provider = provider
if "compare_history" not in st.session_state:
    st.session_state["compare_history"] = []

compare_agent: StatefulAgent = st.session_state["compare_stateful_agent"]

# ── Page header ───────────────────────────────────────────────────────────────
st.title("📊 Compare All Three Agents")
st.markdown(
    "Ask the same question to all three agents simultaneously. "
    "Watch how their responses differ — and why."
)
st.divider()

# ── Suggestion chips ──────────────────────────────────────────────────────────
SAMPLE_QUERIES = [
    "What is AI?",
    "What is an agent?",
    "My name is Alex, remember that",
    "What is my name?",
    "What is the weather today?",
]

st.markdown("**💡 Suggested queries (click to use):**")
chip_cols = st.columns(len(SAMPLE_QUERIES))
for i, q in enumerate(SAMPLE_QUERIES):
    if chip_cols[i].button(q, key=f"chip_{i}", use_container_width=True):
        # Write directly into the text input's own session state key
        # so the widget is populated on the next rerun
        st.session_state["compare_query_input"] = q
        st.rerun()

# ── Shared query input ────────────────────────────────────────────────────────
query = st.text_input(
    "Or type your own question:",
    key="compare_query_input",
    placeholder="e.g. What is AI?",
)

ask = st.button("🚀 Ask All Three", type="primary")

# ── Run all three agents ──────────────────────────────────────────────────────
if ask and query.strip():
    q = query.strip()
    with st.spinner("Asking all three agents..."):
        llm_resp = llm_get(q, provider)
        det_resp, det_intent = det_get(q)
        stat_resp = compare_agent.chat(q)

    st.session_state["compare_llm_resp"] = llm_resp
    st.session_state["compare_det_resp"] = det_resp
    st.session_state["compare_det_intent"] = det_intent
    st.session_state["compare_stat_resp"] = stat_resp
    st.session_state["compare_last_query"] = q
    st.session_state["compare_history"].append({
        "Query": q,
        "LLM Response": llm_resp,
        "Deterministic Response": det_resp,
        "Stateful Response": stat_resp,
    })

# ── Side-by-side columns ──────────────────────────────────────────────────────
if "compare_llm_resp" in st.session_state:
    st.divider()
    col_llm, col_det, col_stat = st.columns(3)

    with col_llm:
        st.subheader("🤖 LLM Agent")
        st.caption("Stateless · Probabilistic")
        st.info(st.session_state["compare_llm_resp"])

    with col_det:
        st.subheader("⚙️ Deterministic Agent")
        st.caption("Stateless · Deterministic · No LLM")
        intent = st.session_state.get("compare_det_intent", "")
        if intent == "unknown":
            st.warning(st.session_state["compare_det_resp"])
        else:
            st.success(st.session_state["compare_det_resp"])
        st.caption(f"Matched intent: `{intent}`")

    with col_stat:
        st.subheader("🧠 Stateful Agent")
        st.caption("Stateful · Memory-enabled")
        st.info(st.session_state["compare_stat_resp"])
        st.caption(f"Memory: {len(compare_agent.get_history())} messages stored")

    # ── What just happened? ────────────────────────────────────────────────────
    st.divider()
    st.subheader("💬 What just happened?")

    last_q = st.session_state.get("compare_last_query", "").lower()
    if "what is my name" in last_q:
        st.markdown("""
- **LLM:** Has no memory — doesn't know your name unless you told it in THIS single message.
- **Deterministic:** No rule for "what is my name" — triggers unknown fallback.
- **Stateful:** Checked its conversation history — if you said your name earlier this session, it knows!
        """)
    elif "my name is" in last_q:
        st.markdown("""
- **LLM:** Acknowledged your name in this response, but will forget it next message.
- **Deterministic:** Matched the `name_tell` rule and gave its hardcoded response.
- **Stateful:** Saved your name to memory — ask "What is my name?" next and it will remember!
        """)
    elif "weather" in last_q:
        st.markdown("""
- **LLM:** Attempted an answer (may guess or refuse — probabilistic behavior).
- **Deterministic:** Hit the fallback — no weather rule exists. Shows the ceiling of rule-based systems.
- **Stateful:** Used the LLM with context — may give a more nuanced response.
        """)
    else:
        st.markdown("""
- **LLM:** Generated a fresh response. Ask the same question again — it may differ slightly.
- **Deterministic:** If a rule matched, the response will be identical every time.
- **Stateful:** Responded with awareness of everything said earlier in this session.
        """)

# ── Run history ───────────────────────────────────────────────────────────────
if st.session_state["compare_history"]:
    st.divider()
    with st.expander(
        f"📋 Full Run History ({len(st.session_state['compare_history'])} queries)",
        expanded=False,
    ):
        df = pd.DataFrame(st.session_state["compare_history"])
        st.dataframe(df, use_container_width=True, hide_index=True)
