from dataclasses import dataclass


@dataclass
class ConceptCard:
    title: str
    description: str
    code_snippet: str
    problem_solved: str


CONCEPT_CARDS: dict[str, ConceptCard] = {
    "supervisor": ConceptCard(
        title="StateGraph + TypedDict",
        description="A single ResearchState TypedDict is shared across all agents. Every node reads from it and returns a partial dict update. LangGraph merges updates using field-level reducers.",
        code_snippet="class ResearchState(TypedDict):\n    ticker: str\n    execution_trace: Annotated[list[dict], operator.add]",
        problem_solved="Problem 5 — Multiple specialist agents cannot collaborate",
    ),
    "planner": ConceptCard(
        title="Typed State Write + Custom Reducer",
        description="The Planner writes plan and complexity to shared state. execution_trace uses operator.add — every node appends its entry without overwriting entries from other nodes.",
        code_snippet='return {\n    "plan": [...],\n    "complexity": "simple",\n    "execution_trace": [{"node": "planner", ...}],\n}',
        problem_solved="Problem 1 — Loses intermediate context during multi-step reasoning",
    ),
    "router": ConceptCard(
        title="conditional_edges + Send() Fan-Out",
        description="The Router reads state.complexity. For 'simple' it returns a string. For 'complex' it returns a list of Send() objects — LangGraph executes all three agents in parallel.",
        code_snippet='def route_after_planner(state):\n    if state["complexity"] == "simple":\n        return "fundamentals"\n    return [Send("fundamentals", state),\n            Send("news", state),\n            Send("risk", state)]',
        problem_solved="Problem 3 — No conditional decisions or parallel research paths",
    ),
    "fundamentals": ConceptCard(
        title="Parallel Fan-Out (complex path)",
        description="On complex queries, Fundamentals, News, and Risk run simultaneously via Send(). Each writes to its own non-overlapping field. operator.add on execution_trace merges their trace entries safely.",
        code_snippet="g.add_edge('fundamentals', 'merger')\ng.add_edge('news', 'merger')\ng.add_edge('risk', 'merger')\n# All three fan-in at merger",
        problem_solved="Problem 3 — No parallel research paths",
    ),
    "news": ConceptCard(
        title="Parallel Fan-Out (complex path)",
        description="On complex queries, Fundamentals, News, and Risk run simultaneously via Send(). Each writes to its own non-overlapping field. operator.add on execution_trace merges their trace entries safely.",
        code_snippet="g.add_edge('fundamentals', 'merger')\ng.add_edge('news', 'merger')\ng.add_edge('risk', 'merger')\n# All three fan-in at merger",
        problem_solved="Problem 3 — No parallel research paths",
    ),
    "risk": ConceptCard(
        title="Parallel Fan-Out (complex path)",
        description="On complex queries, Fundamentals, News, and Risk run simultaneously via Send(). Each writes to its own non-overlapping field. operator.add on execution_trace merges their trace entries safely.",
        code_snippet="g.add_edge('fundamentals', 'merger')\ng.add_edge('news', 'merger')\ng.add_edge('risk', 'merger')\n# All three fan-in at merger",
        problem_solved="Problem 3 — No parallel research paths",
    ),
    "merger": ConceptCard(
        title="Fan-In + operator.add Reducer",
        description="Merger runs after all parallel agents complete. It combines populated research fields. Because execution_trace uses operator.add, all three agents' trace entries are accumulated without conflict.",
        code_snippet="execution_trace: Annotated[list[dict], operator.add]\n# Parallel agents each append; LangGraph concatenates all lists.",
        problem_solved="Problem 3 — Branch merge",
    ),
    "synthesizer": ConceptCard(
        title="SqliteSaver Checkpointing",
        description="Before synthesis, every prior state is persisted to SQLite. If Synthesizer fails, call invoke() again with the same thread_id — LangGraph resumes from the last good checkpoint.",
        code_snippet="from langgraph.checkpoint.sqlite import SqliteSaver\ng.compile(checkpointer=SqliteSaver(conn))\n# Resuming:\ngraph.invoke(None, config)  # replays from checkpoint",
        problem_solved="Problem 2 — Failures require restarting the entire workflow",
    ),
    "review_gate": ConceptCard(
        title="interrupt_before + update_state",
        description="The graph pauses before review_gate. Streamlit shows the draft brief and approval buttons. update_state() injects the human's decision into state. invoke(None, config) resumes from the interrupt.",
        code_snippet="g.compile(interrupt_before=['review_gate'])\n# Human decides:\ngraph.update_state(config, {'approval_status': 'approved'})\ngraph.invoke(None, config)  # resumes",
        problem_solved="Problem 4 — Critical responses generated without human review",
    ),
    "finalizer": ConceptCard(
        title="get_state_history — Time-Travel Debug",
        description="get_state_history() returns every persisted checkpoint in reverse order. Each can be replayed by passing its config to invoke(). Shows the full execution path including any revision loops.",
        code_snippet="for state in graph.get_state_history(config):\n    print(state.metadata['step'], list(state.next))",
        problem_solved="Capstone Req: Debugging & Explainability",
    ),
}
