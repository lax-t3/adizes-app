import uuid
import streamlit as st
from dotenv import load_dotenv
from graph.builder import build_graph
from checkpointing.setup import make_checkpointer, make_config, get_checkpoint_history
from state import initial_state
from ui.cards import CONCEPT_CARDS
from ui.trace_display import render_trace
from ui.hitl_panel import render_hitl_panel

load_dotenv()

st.set_page_config(page_title="LangGraph Investment Research Demo", layout="wide")
st.title("Investment Research Brief — LangGraph Multi-Agent Demo")

# ── Session state ────────────────────────────────────────────────────────────
if "graph" not in st.session_state:
    st.session_state.graph = build_graph(make_checkpointer())
if "thread_id" not in st.session_state:
    st.session_state.thread_id = str(uuid.uuid4())
if "app_state" not in st.session_state:
    st.session_state.app_state = "idle"   # idle | hitl | complete | error
if "events" not in st.session_state:
    st.session_state.events = []

graph = st.session_state.graph

# ── Sidebar ──────────────────────────────────────────────────────────────────
with st.sidebar:
    st.header("Research Query")
    query = st.text_input(
        "Enter query",
        placeholder="e.g. Full AAPL analysis  or  MSFT price check",
        key="query_input",
    )
    run_clicked = st.button(
        "▶ Run Research",
        disabled=st.session_state.app_state not in ("idle",),
    )

    if st.button("🔄 New Session"):
        st.session_state.thread_id = str(uuid.uuid4())
        st.session_state.app_state = "idle"
        st.session_state.events = []
        st.rerun()

    st.divider()
    st.caption(f"Thread: `{st.session_state.thread_id[:8]}…`")
    st.caption(f"State: `{st.session_state.app_state}`")

    if st.session_state.app_state != "idle":
        config = make_config(st.session_state.thread_id)
        try:
            gs = graph.get_state(config)
            render_trace(gs.values.get("execution_trace", []))
        except Exception:
            pass

# ── Run the graph ────────────────────────────────────────────────────────────
if run_clicked and query:
    st.session_state.thread_id = str(uuid.uuid4())
    st.session_state.events = []
    config = make_config(st.session_state.thread_id)

    with st.spinner("Running research agents…"):
        try:
            events = []
            for event in graph.stream(initial_state(query), config, stream_mode="updates"):
                events.append(event)
            st.session_state.events = events
        except Exception as e:
            st.session_state.app_state = "error"
            st.session_state.error_msg = str(e)
            st.rerun()

    gs = graph.get_state(config)
    if "review_gate" in (gs.next or []):
        st.session_state.app_state = "hitl"
    else:
        st.session_state.app_state = "complete"
    st.rerun()

# ── Render by app_state ───────────────────────────────────────────────────────
config = make_config(st.session_state.thread_id)

if st.session_state.app_state == "idle":
    st.info("Enter a query in the sidebar and click **▶ Run Research** to start.")
    st.markdown("""
**Example queries:**
- `Full AAPL analysis` → complex path (3 parallel agents + full brief)
- `MSFT price check` → simple path (fundamentals only)
- `TSLA risks and competitors` → complex path
    """)

elif st.session_state.app_state == "hitl":
    gs = graph.get_state(config)
    values = gs.values

    # Show HITL concept card
    card = CONCEPT_CARDS["review_gate"]
    with st.expander(f"⚡ LangGraph: {card.title} — {card.problem_solved}", expanded=True):
        st.markdown(card.description)
        st.code(card.code_snippet, language="python")

    st.divider()
    st.subheader("⏸ Graph Paused — Human Review Required")

    approval_status, feedback = render_hitl_panel(
        values.get("draft_brief", ""),
        values.get("iteration", 1),
    )

    if approval_status:
        graph.update_state(config, {"approval_status": approval_status, "human_feedback": feedback})
        with st.spinner("Resuming graph…"):
            try:
                for event in graph.stream(None, config, stream_mode="updates"):
                    st.session_state.events.append(event)
            except Exception as e:
                st.session_state.error_msg = str(e)
                st.session_state.app_state = "error"
                st.rerun()

        resumed = graph.get_state(config)
        if "review_gate" in (resumed.next or []):
            st.session_state.app_state = "hitl"
        else:
            st.session_state.app_state = "complete"
        st.rerun()

elif st.session_state.app_state == "complete":
    gs = graph.get_state(config)
    values = gs.values
    final = values.get("final_brief", "")

    if final:
        st.success("✓ Research complete — brief approved.")
        st.markdown(final)
        st.download_button(
            "⬇ Download Brief (Markdown)",
            data=final,
            file_name=f"{values.get('ticker', 'brief')}_investment_brief.md",
            mime="text/markdown",
        )
    else:
        st.warning("Research ended — brief was rejected without revision.")

    # Show concept cards for each node that ran (in execution_trace order)
    trace = values.get("execution_trace", [])
    seen_nodes = []
    for entry in trace:
        n = entry.get("node")
        if n and n not in seen_nodes:
            seen_nodes.append(n)

    with st.expander("⚡ Concepts Demonstrated in This Run", expanded=False):
        for node_name in seen_nodes:
            card = CONCEPT_CARDS.get(node_name)
            if card:
                st.markdown(f"**{card.title}** — *{card.problem_solved}*")
                st.markdown(card.description)
                st.code(card.code_snippet, language="python")
                st.divider()

    with st.expander("🔍 Time-Travel Debug — Execution Timeline", expanded=False):
        card = CONCEPT_CARDS["finalizer"]
        st.markdown(f"**{card.title}:** {card.description}")
        st.code(card.code_snippet, language="python")
        st.divider()
        history = get_checkpoint_history(graph, config)
        for h in history:
            next_str = ", ".join(h["next"]) if h["next"] else "END"
            st.text(f"Step {h['step']:>3} | {h['node']:<20} → {next_str}")

    if st.button("▶ Run Another Query"):
        st.session_state.thread_id = str(uuid.uuid4())
        st.session_state.app_state = "idle"
        st.session_state.events = []
        st.rerun()

elif st.session_state.app_state == "error":
    st.error(f"Execution error: {st.session_state.get('error_msg', 'Unknown')}")
    st.info("The last successful checkpoint is preserved. Click below to resume from it.")

    card = CONCEPT_CARDS["synthesizer"]
    with st.expander(f"⚡ LangGraph: {card.title} — {card.problem_solved}"):
        st.markdown(card.description)
        st.code(card.code_snippet, language="python")

    if st.button("↺ Resume from Checkpoint"):
        with st.spinner("Resuming…"):
            try:
                for event in graph.stream(None, config, stream_mode="updates"):
                    st.session_state.events.append(event)
                resumed = graph.get_state(config)
                if "review_gate" in (resumed.next or []):
                    st.session_state.app_state = "hitl"
                else:
                    st.session_state.app_state = "complete"
            except Exception as e:
                st.session_state.error_msg = str(e)
        st.rerun()
