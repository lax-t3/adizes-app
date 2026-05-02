import streamlit as st


def render_hitl_panel(draft_brief: str, iteration: int) -> tuple[str | None, str]:
    """
    Returns (approval_status, human_feedback) when a button is clicked.
    Returns (None, "") if no button has been clicked yet.
    """
    col1, col2 = st.columns([2, 1])

    with col1:
        st.markdown("**Draft Investment Brief**")
        st.markdown(draft_brief)

    with col2:
        st.markdown("**Review Decision**")
        feedback = st.text_area(
            "Feedback (required for Revise)",
            key=f"feedback_{iteration}",
            height=100,
            placeholder="Describe what to improve…",
        )
        st.caption(f"Iteration {iteration} / 3")

        if st.button("✓ Approve Brief", key=f"approve_{iteration}", use_container_width=True):
            return "approved", ""
        if st.button("✗ Reject — Stop", key=f"stop_{iteration}", use_container_width=True):
            return "rejected_stop", ""
        if st.button("↺ Reject — Revise", key=f"revise_{iteration}", use_container_width=True):
            return "rejected_revise", feedback

    return None, ""
