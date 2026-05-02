import operator
from state import ResearchState, initial_state


def test_initial_state_has_all_fields():
    state = initial_state("What is AAPL?")
    assert state["query"] == "What is AAPL?"
    assert state["ticker"] == ""
    assert state["execution_trace"] == []
    assert state["iteration"] == 0
    assert state["approval_status"] == "pending"
    assert state["complexity"] == "simple"


def test_initial_state_research_fields_are_empty():
    state = initial_state("x")
    assert state["fundamentals"] == {}
    assert state["news_data"] == []
    assert state["risk_data"] == []
    assert state["merged_research"] == ""
    assert state["draft_brief"] == ""
    assert state["final_brief"] == ""


def test_execution_trace_reducer_concatenates():
    a = [{"node": "supervisor"}]
    b = [{"node": "planner"}]
    assert operator.add(a, b) == [{"node": "supervisor"}, {"node": "planner"}]


def test_execution_trace_parallel_append_is_safe():
    base = []
    f_entry = [{"node": "fundamentals"}]
    n_entry = [{"node": "news"}]
    merged = operator.add(operator.add(base, f_entry), n_entry)
    assert len(merged) == 2
    assert merged[0]["node"] == "fundamentals"
    assert merged[1]["node"] == "news"
