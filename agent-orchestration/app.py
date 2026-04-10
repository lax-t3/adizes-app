import os
import anthropic
import streamlit as st
from dotenv import load_dotenv

from agents.parser import run_parser
from agents.specialists import run_specialists
from agents.synthesizer import run_synthesizer
from models.context import JDQIContext

load_dotenv()

INDUSTRIES = ["High-tech Manufacturing", "IT/SaaS/AI", "GCC", "Other"]

DIM_LABELS = {
    "completeness":      "Completeness",
    "skill_specificity": "Skill Specificity",
    "cognitive_load":    "Cognitive Load",
    "inclusion_signals": "Inclusion Signals",
    "compensation":      "Compensation",
    "role_coherence":    "Role Coherence",
}


def _score_badge(score: int) -> tuple[str, str]:
    """Return (label, delta_color) for a JDQI score."""
    if score >= 75:
        return "Excellent", "normal"
    if score >= 50:
        return "Fair", "off"
    return "Needs Work", "inverse"


def _get_client() -> anthropic.Anthropic:
    key = os.getenv("ANTHROPIC_API_KEY")
    if not key:
        st.error(
            "**ANTHROPIC_API_KEY not set.** "
            "Add it to `.env` as `ANTHROPIC_API_KEY=sk-ant-...` and restart."
        )
        st.stop()
    return anthropic.Anthropic(api_key=key)


def run_pipeline(jd_text: str, industry: str, client: anthropic.Anthropic) -> None:
    context: JDQIContext = {"jd_text": jd_text, "industry": industry}

    st.divider()
    st.subheader("Pipeline")

    # ── Agent 1: JD Parser ───────────────────────────────────────────
    parser_ph = st.empty()
    parser_ph.info("⏳ **Agent 1 — JD Parser** (Sonnet)  Extracting structure...")
    try:
        context["parsed_jd"] = run_parser(jd_text, industry, client)
        parsed = context["parsed_jd"]
        parser_ph.success(
            f"✅ **Agent 1 — JD Parser**  "
            f"`{parsed['role_title']}` · {parsed['seniority_level']} · "
            f"{len(parsed['required_skills'])} required skills"
        )
    except Exception as e:
        parser_ph.error(f"❌ JD Parser failed — {e}")
        return

    # ── Agents 2–7: Specialist Analyzers (parallel) ──────────────────
    st.write("**Agents 2–7 — Specialist Analyzers** (Sonnet, parallel)")
    spec_cols = st.columns(3)
    spec_phs: dict[str, st.delta_generator.DeltaGenerator] = {}

    for i, (key, label) in enumerate(DIM_LABELS.items()):
        ph = spec_cols[i % 3].empty()
        ph.info(f"⏳ {label}")
        spec_phs[key] = ph

    def on_specialist_done(key: str, result: dict) -> None:
        spec_phs[key].success(f"✅ {DIM_LABELS[key]} — {result.get('score', '?')}/100")

    try:
        context["dimension_results"] = run_specialists(
            jd_text, context["parsed_jd"], client, on_specialist_done
        )
    except Exception as e:
        st.error(f"Specialist analysis failed — {e}")
        return

    # ── Agents 8 + 9: Synthesis Executor → Advisor ───────────────────
    synth_ph = st.empty()
    synth_ph.info("⏳ **Agent 8 — Synthesis Executor** (Sonnet)  Building brief...")

    advisor_ph = st.empty()
    advisor_ph.warning("🔶 **Agent 9 — Advisor** (Opus)  Waiting for tool call...")

    def on_advisor_called() -> None:
        synth_ph.info("⏳ **Agent 8 — Synthesis Executor**  Tool call dispatched → Advisor")
        advisor_ph.warning("🔶 **Agent 9 — Advisor** (Opus)  Consulting... (~30s)")

    try:
        context["advisor_report"] = run_synthesizer(context, client, on_advisor_called)
        score = context["advisor_report"]["jdqi_score"]
        synth_ph.success("✅ **Agent 8 — Synthesis Executor**  Complete")
        advisor_ph.success(f"✅ **Agent 9 — Advisor** (Opus)  JDQI Score: **{score}/100**")
    except Exception as e:
        advisor_ph.error(f"❌ Advisor failed — {e}")
        return

    st.session_state.jdqi_context = context
    st.session_state.accepted = []


def display_report(context: JDQIContext) -> None:
    report = context["advisor_report"]
    score = report["jdqi_score"]
    label, delta_color = _score_badge(score)

    st.divider()
    st.subheader("JDQI Report")

    col1, col2 = st.columns([1, 3])
    col1.metric("JDQI Score", f"{score} / 100", delta=label, delta_color=delta_color)
    col2.progress(score / 100)

    # ── Dimension breakdown ──────────────────────────────────────────
    st.subheader("Dimension Breakdown")
    for item in report["dimension_breakdown"]:
        dim = item["dimension"]
        c1, c2, c3 = st.columns([2, 1, 5])
        c1.write(f"**{DIM_LABELS.get(dim, dim.replace('_', ' ').title())}**")
        c2.write(f"**{item['score']}**/100")
        c3.progress(item["score"] / 100)
        st.caption(f"\u00a0\u00a0{item['narrative']}")

    # ── Benchmark comparison ─────────────────────────────────────────
    with st.expander("Benchmark Comparison — Opus Analysis", expanded=False):
        st.write(report["benchmark_comparison"])

    # ── Suggested additions ──────────────────────────────────────────
    st.divider()
    st.subheader("Suggested Additions")
    st.caption("Accept suggestions to build your revised JD additions list.")

    for i, s in enumerate(report["suggested_additions"]):
        with st.container(border=True):
            c1, c2, c3, c4 = st.columns([2, 4, 3, 1])
            c1.write(f"**{s['section']}**")
            c2.write(s["suggestion"])
            c3.caption(s["impact"])
            if c4.button("Accept", key=f"accept_{i}"):
                entry = f"[{s['section']}] {s['suggestion']}"
                if entry not in st.session_state.accepted:
                    st.session_state.accepted.append(entry)
                    st.rerun()

    if st.session_state.get("accepted"):
        st.subheader("Revised JD Additions")
        st.code("\n\n".join(st.session_state.accepted), language=None)
        if st.button("Clear selections"):
            st.session_state.accepted = []
            st.rerun()


def main() -> None:
    st.set_page_config(
        page_title="JD Quality Intelligence",
        page_icon="🎯",
        layout="wide",
    )

    if "jdqi_context" not in st.session_state:
        st.session_state.jdqi_context = None
    if "accepted" not in st.session_state:
        st.session_state.accepted = []

    st.title("🎯 JD Quality Intelligence (JDQI)")
    st.caption(
        "**Claude Advisor Strategy demo** — "
        "Sonnet specialists analyse in parallel · Opus advisor consulted on-demand via tool call"
    )

    client = _get_client()

    # ── Input form ───────────────────────────────────────────────────
    with st.form("jd_form"):
        jd_text = st.text_area(
            "Paste your Job Description",
            height=320,
            placeholder="Paste the full JD text here…",
        )
        industry = st.selectbox("Industry", INDUSTRIES)
        submitted = st.form_submit_button(
            "Analyse JD ▶", type="primary", use_container_width=True
        )

    if submitted:
        if not jd_text.strip():
            st.warning("Please paste a job description before analysing.")
        else:
            st.session_state.jdqi_context = None
            st.session_state.accepted = []
            run_pipeline(jd_text, industry, client)

    # ── Render stored report (persists across Accept button clicks) ──
    if st.session_state.jdqi_context is not None:
        display_report(st.session_state.jdqi_context)


if __name__ == "__main__":
    main()
