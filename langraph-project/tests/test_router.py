from langgraph.graph import END
from langgraph.types import Send
from graph.router import route_after_planner, route_after_review


def _state(**overrides):
    return {"complexity": "simple", "approval_status": "pending", "iteration": 0, **overrides}


def test_simple_path_returns_string():
    assert route_after_planner(_state(complexity="simple")) == "fundamentals"


def test_complex_path_returns_three_sends():
    result = route_after_planner(_state(complexity="complex"))
    assert isinstance(result, list)
    assert len(result) == 3
    assert all(isinstance(s, Send) for s in result)
    assert {s.node for s in result} == {"fundamentals", "news", "risk"}


def test_approved_routes_to_finalizer():
    assert route_after_review(_state(approval_status="approved")) == "finalizer"


def test_rejected_stop_routes_to_end():
    assert route_after_review(_state(approval_status="rejected_stop")) == END


def test_rejected_revise_routes_to_synthesizer():
    result = route_after_review(_state(approval_status="rejected_revise", iteration=1))
    assert result == "synthesizer"


def test_rejected_revise_at_iteration_3_forces_finalizer():
    result = route_after_review(_state(approval_status="rejected_revise", iteration=3))
    assert result == "finalizer"


def test_unknown_status_defaults_to_synthesizer():
    result = route_after_review(_state(approval_status="unknown", iteration=0))
    assert result == "synthesizer"
