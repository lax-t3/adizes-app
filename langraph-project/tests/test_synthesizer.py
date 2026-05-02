from unittest.mock import patch, MagicMock
from agents.synthesizer import synthesizer


def _mock_resp(text: str) -> MagicMock:
    msg = MagicMock()
    msg.content = [MagicMock(text=text)]
    return msg


def _state(**overrides):
    base = {
        "ticker": "AAPL",
        "merged_research": "price: 189",
        "human_feedback": "",
        "iteration": 0,
        "execution_trace": [],
    }
    return {**base, **overrides}


def test_synthesizer_writes_draft_brief():
    with patch("agents.synthesizer.client") as mc:
        mc.messages.create.return_value = _mock_resp("## AAPL Brief\n\nStrong fundamentals.")
        result = synthesizer(_state())
    assert "AAPL Brief" in result["draft_brief"]
    assert result["approval_status"] == "pending"


def test_synthesizer_increments_iteration():
    with patch("agents.synthesizer.client") as mc:
        mc.messages.create.return_value = _mock_resp("brief")
        result = synthesizer(_state(iteration=2))
    assert result["iteration"] == 3


def test_synthesizer_includes_feedback_on_revise():
    with patch("agents.synthesizer.client") as mc:
        mc.messages.create.return_value = _mock_resp("revised brief")
        synthesizer(_state(human_feedback="Add more China risk detail", iteration=1))
        user_content = mc.messages.create.call_args.kwargs["messages"][0]["content"]
    assert "Add more China risk detail" in user_content


def test_synthesizer_uses_prompt_caching():
    with patch("agents.synthesizer.client") as mc:
        mc.messages.create.return_value = _mock_resp("brief")
        synthesizer(_state())
        system = mc.messages.create.call_args.kwargs["system"]
    assert system[0]["cache_control"] == {"type": "ephemeral"}


def test_synthesizer_appends_trace():
    with patch("agents.synthesizer.client") as mc:
        mc.messages.create.return_value = _mock_resp("brief")
        result = synthesizer(_state(iteration=1))
    assert result["execution_trace"][0]["node"] == "synthesizer"
    assert "iteration 2" in result["execution_trace"][0]["summary"]
