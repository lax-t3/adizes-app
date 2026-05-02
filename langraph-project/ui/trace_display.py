import streamlit as st


def render_trace(execution_trace: list[dict]) -> None:
    if not execution_trace:
        st.sidebar.caption("No steps completed yet.")
        return
    for entry in execution_trace:
        node = entry.get("node", "?")
        summary = entry.get("summary", "")
        st.sidebar.markdown(f"✓ **{node}** — {summary}")
