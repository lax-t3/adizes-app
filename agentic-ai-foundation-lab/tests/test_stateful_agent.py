from __future__ import annotations
import os, sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from unittest.mock import patch
from agents.stateful_agent import StatefulAgent


class TestStatefulAgent:
    def setup_method(self):
        self.agent = StatefulAgent(provider="openai")

    def test_starts_with_empty_history(self):
        assert self.agent.get_history() == []

    def test_chat_returns_response(self):
        with patch("agents.stateful_agent._llm_call", return_value="Hello!"):
            result = self.agent.chat("hi")
        assert result == "Hello!"

    def test_history_accumulates_after_each_turn(self):
        with patch("agents.stateful_agent._llm_call", return_value="resp1"):
            self.agent.chat("turn 1")
        with patch("agents.stateful_agent._llm_call", return_value="resp2"):
            self.agent.chat("turn 2")

        history = self.agent.get_history()
        assert len(history) == 4  # user + assistant + user + assistant
        assert history[0] == {"role": "user", "content": "turn 1"}
        assert history[1] == {"role": "assistant", "content": "resp1"}
        assert history[2] == {"role": "user", "content": "turn 2"}
        assert history[3] == {"role": "assistant", "content": "resp2"}

    def test_full_history_sent_to_llm_on_second_call(self):
        """Statefulness: second call must include both turns in messages."""
        captured_messages = []

        def mock_llm(messages, provider):
            captured_messages.append(list(messages))
            return "response"

        with patch("agents.stateful_agent._llm_call", side_effect=mock_llm):
            self.agent.chat("first message")
            self.agent.chat("second message")

        # Second call should have 3 messages: user1, assistant1, user2
        assert len(captured_messages[1]) == 3
        assert captured_messages[1][0]["content"] == "first message"
        assert captured_messages[1][1]["content"] == "response"
        assert captured_messages[1][2]["content"] == "second message"

    def test_reset_clears_history(self):
        with patch("agents.stateful_agent._llm_call", return_value="r"):
            self.agent.chat("something")
        self.agent.reset()
        assert self.agent.get_history() == []

    def test_get_history_returns_copy(self):
        """Mutation of returned history must not affect agent's internal state."""
        with patch("agents.stateful_agent._llm_call", return_value="r"):
            self.agent.chat("msg")
        h = self.agent.get_history()
        h.clear()
        assert len(self.agent.get_history()) == 2  # still has user + assistant
