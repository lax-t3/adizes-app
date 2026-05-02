import uuid
from unittest.mock import patch, MagicMock
from langgraph.checkpoint.memory import MemorySaver
from graph.builder import build_graph
from state import initial_state


def _mock_claude(text: str) -> MagicMock:
    msg = MagicMock()
    msg.content = [MagicMock(text=text)]
    return msg


def _mock_yf():
    return {
        "price": 189.0, "pe_ratio": 28.0, "revenue_ttm": None,
        "gross_margin": None, "market_cap": None, "week_52_range": "N/A",
    }


def _config():
    return {"configurable": {"thread_id": str(uuid.uuid4())}}


def test_graph_compiles_without_error():
    assert build_graph() is not None


def test_simple_path_interrupts_at_review_gate():
    with patch("agents.planner.client") as mp, \
         patch("agents.fundamentals.get_stock_fundamentals", return_value=_mock_yf()), \
         patch("agents.synthesizer.client") as ms:

        mp.messages.create.return_value = _mock_claude(
            '{"plan": ["Check price"], "complexity": "simple"}'
        )
        ms.messages.create.return_value = _mock_claude("## AAPL Brief\n\nStrong.")

        g = build_graph(MemorySaver())
        config = _config()
        g.invoke(initial_state("AAPL price check"), config)

        state = g.get_state(config)
        assert "review_gate" in state.next


def test_approve_produces_final_brief():
    with patch("agents.planner.client") as mp, \
         patch("agents.fundamentals.get_stock_fundamentals", return_value=_mock_yf()), \
         patch("agents.synthesizer.client") as ms:

        mp.messages.create.return_value = _mock_claude(
            '{"plan": ["Check price"], "complexity": "simple"}'
        )
        ms.messages.create.return_value = _mock_claude("## AAPL Brief")

        g = build_graph(MemorySaver())
        config = _config()
        g.invoke(initial_state("AAPL"), config)
        g.update_state(config, {"approval_status": "approved"})
        final = g.invoke(None, config)

        assert final["final_brief"]
        assert "APPROVED" in final["final_brief"]


def test_reject_stop_ends_without_final_brief():
    with patch("agents.planner.client") as mp, \
         patch("agents.fundamentals.get_stock_fundamentals", return_value=_mock_yf()), \
         patch("agents.synthesizer.client") as ms:

        mp.messages.create.return_value = _mock_claude(
            '{"plan": ["Check"], "complexity": "simple"}'
        )
        ms.messages.create.return_value = _mock_claude("brief")

        g = build_graph(MemorySaver())
        config = _config()
        g.invoke(initial_state("AAPL"), config)
        g.update_state(config, {"approval_status": "rejected_stop"})
        final = g.invoke(None, config)

        assert not final.get("final_brief")


def test_reject_revise_loops_back_to_synthesizer():
    with patch("agents.planner.client") as mp, \
         patch("agents.fundamentals.get_stock_fundamentals", return_value=_mock_yf()), \
         patch("agents.synthesizer.client") as ms:

        mp.messages.create.return_value = _mock_claude(
            '{"plan": ["Check"], "complexity": "simple"}'
        )
        ms.messages.create.return_value = _mock_claude("brief")

        g = build_graph(MemorySaver())
        config = _config()
        g.invoke(initial_state("AAPL"), config)
        g.update_state(config, {
            "approval_status": "rejected_revise",
            "human_feedback": "Add more China risk detail",
        })
        g.invoke(None, config)

        state = g.get_state(config)
        assert "review_gate" in state.next
        assert state.values["iteration"] == 2
