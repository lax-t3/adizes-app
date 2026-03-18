from __future__ import annotations
import os, sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from unittest.mock import patch
from agents.llm_agent import get_response


class TestGetResponse:
    def test_returns_string(self):
        with patch("agents.llm_agent._llm_call", return_value="Hello world"):
            result = get_response("hi", "openai")
        assert isinstance(result, str)
        assert result == "Hello world"

    def test_sends_query_as_user_message(self):
        """The query must be wrapped in a user role message."""
        captured = {}

        def mock_llm(messages, provider):
            captured["messages"] = messages
            captured["provider"] = provider
            return "response"

        with patch("agents.llm_agent._llm_call", side_effect=mock_llm):
            get_response("What is AI?", "openai")

        assert captured["messages"] == [{"role": "user", "content": "What is AI?"}]
        assert captured["provider"] == "openai"

    def test_no_memory_between_calls(self):
        """Each call must be independent — no state carried over."""
        call_count = 0

        def mock_llm(messages, provider):
            nonlocal call_count
            call_count += 1
            assert len(messages) == 1
            return f"response {call_count}"

        with patch("agents.llm_agent._llm_call", side_effect=mock_llm):
            get_response("First question", "openai")
            get_response("Second question", "openai")

        assert call_count == 2

    def test_exception_returns_error_string_not_raise(self):
        with patch("agents.llm_agent._llm_call", side_effect=Exception("API down")):
            result = get_response("hi", "openai")
        assert "Error" in result
        assert "API down" in result
