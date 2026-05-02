from langgraph.graph import StateGraph, START, END
from state import ResearchState
from agents.supervisor import supervisor
from agents.planner import planner
from agents.fundamentals import fundamentals
from agents.news import news
from agents.risk import risk
from agents.merger import merger
from agents.synthesizer import synthesizer
from agents.review_gate import review_gate
from agents.finalizer import finalizer
from graph.router import route_after_planner, route_after_review


def build_graph(checkpointer=None):
    g = StateGraph(ResearchState)

    g.add_node("supervisor", supervisor)
    g.add_node("planner", planner)
    g.add_node("fundamentals", fundamentals)
    g.add_node("news", news)
    g.add_node("risk", risk)
    g.add_node("merger", merger)
    g.add_node("synthesizer", synthesizer)
    g.add_node("review_gate", review_gate)
    g.add_node("finalizer", finalizer)

    g.add_edge(START, "supervisor")
    g.add_edge("supervisor", "planner")
    g.add_conditional_edges("planner", route_after_planner)
    g.add_edge("fundamentals", "merger")
    g.add_edge("news", "merger")
    g.add_edge("risk", "merger")
    g.add_edge("merger", "synthesizer")
    g.add_edge("synthesizer", "review_gate")
    g.add_conditional_edges(
        "review_gate",
        route_after_review,
        {"finalizer": "finalizer", "synthesizer": "synthesizer", END: END},
    )
    g.add_edge("finalizer", END)

    return g.compile(
        checkpointer=checkpointer,
        interrupt_before=["review_gate"],
    )
