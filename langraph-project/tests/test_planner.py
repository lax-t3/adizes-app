from unittest.mock import patch, MagicMock
from agents.planner import planner


def _mock_response(json_str: str) -> MagicMock:
    msg = MagicMock()
    msg.content = [MagicMock(text=json_str)]
    return msg


def test_planner_tags_simple_query():
    resp = _mock_response('{"plan": ["Check price", "Review news"], "complexity": "simple"}')
    with patch("agents.planner.client") as mock_client:
        mock_client.messages.create.return_value = resp
        result = planner({"query": "AAPL price?", "ticker": "AAPL", "execution_trace": []})
    assert result["complexity"] == "simple"
    assert result["plan"] == ["Check price", "Review news"]


def test_planner_tags_complex_query():
    resp = _mock_response('{"plan": ["Fetch fundamentals", "Search news", "Assess risks", "Synthesize"], "complexity": "complex"}')
    with patch("agents.planner.client") as mock_client:
        mock_client.messages.create.return_value = resp
        result = planner({"query": "Full AAPL analysis", "ticker": "AAPL", "execution_trace": []})
    assert result["complexity"] == "complex"
    assert len(result["plan"]) == 4


def test_planner_appends_trace_with_complexity():
    resp = _mock_response('{"plan": ["step"], "complexity": "simple"}')
    with patch("agents.planner.client") as mock_client:
        mock_client.messages.create.return_value = resp
        result = planner({"query": "q", "ticker": "X", "execution_trace": []})
    entry = result["execution_trace"][0]
    assert entry["node"] == "planner"
    assert "complexity=simple" in entry["summary"]


def test_planner_calls_claude_with_cache_control():
    resp = _mock_response('{"plan": ["s"], "complexity": "simple"}')
    with patch("agents.planner.client") as mock_client:
        mock_client.messages.create.return_value = resp
        planner({"query": "q", "ticker": "X", "execution_trace": []})
    call_kwargs = mock_client.messages.create.call_args.kwargs
    system = call_kwargs["system"]
    assert system[0]["cache_control"] == {"type": "ephemeral"}
