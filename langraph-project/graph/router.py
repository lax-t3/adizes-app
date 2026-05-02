from langgraph.graph import END
from langgraph.types import Send
from state import ResearchState


def route_after_planner(state: ResearchState):
    if state["complexity"] == "simple":
        return "fundamentals"
    return [
        Send("fundamentals", state),
        Send("news", state),
        Send("risk", state),
    ]


def route_after_review(state: ResearchState):
    status = state.get("approval_status", "pending")
    if status == "approved":
        return "finalizer"
    if status == "rejected_stop":
        return END
    if state.get("iteration", 0) >= 3:
        return "finalizer"
    return "synthesizer"
