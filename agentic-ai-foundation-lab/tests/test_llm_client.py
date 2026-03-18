import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from unittest.mock import patch, MagicMock
from utils.llm_client import get_response, _get_secret


class TestGetSecret:
    def test_reads_env_var_when_st_secrets_unavailable(self):
        os.environ["TEST_KEY"] = "test-value"
        with patch("utils.llm_client.st") as mock_st:
            mock_st.secrets.get.side_effect = Exception("no streamlit context")
            result = _get_secret("TEST_KEY")
        assert result == "test-value"
        del os.environ["TEST_KEY"]

    def test_returns_empty_string_when_key_missing(self):
        with patch("utils.llm_client.st") as mock_st:
            mock_st.secrets.get.return_value = ""
            result = _get_secret("NONEXISTENT_KEY")
        assert result == ""


class TestGetResponse:
    def test_unknown_provider_returns_error_string(self):
        result = get_response([{"role": "user", "content": "hi"}], "unknown_provider")
        assert "Unknown provider" in result

    def test_openai_missing_key_returns_error_string(self):
        with patch("utils.llm_client._get_secret", return_value=""):
            result = get_response([{"role": "user", "content": "hi"}], "openai")
        assert "OPENAI_API_KEY" in result

    def test_anthropic_missing_key_returns_error_string(self):
        with patch("utils.llm_client._get_secret", return_value=""):
            result = get_response([{"role": "user", "content": "hi"}], "anthropic")
        assert "ANTHROPIC_API_KEY" in result

    def test_openai_returns_response_text(self):
        mock_response = MagicMock()
        mock_response.choices[0].message.content = "Hello from OpenAI"
        with patch("utils.llm_client._get_secret", return_value="sk-fake"):
            with patch("openai.OpenAI") as mock_openai:
                mock_openai.return_value.chat.completions.create.return_value = mock_response
                result = get_response([{"role": "user", "content": "hi"}], "openai")
        assert result == "Hello from OpenAI"

    def test_anthropic_extracts_system_messages(self):
        mock_response = MagicMock()
        mock_response.content[0].text = "Hello from Anthropic"
        messages = [
            {"role": "system", "content": "You are helpful."},
            {"role": "user", "content": "hi"},
        ]
        with patch("utils.llm_client._get_secret", return_value="sk-ant-fake"):
            with patch("anthropic.Anthropic") as mock_anthropic:
                mock_client = mock_anthropic.return_value
                mock_client.messages.create.return_value = mock_response
                result = get_response(messages, "anthropic")
                call_kwargs = mock_client.messages.create.call_args[1]
                assert call_kwargs["system"] == "You are helpful."
                assert all(m["role"] != "system" for m in call_kwargs["messages"])
        assert result == "Hello from Anthropic"

    def test_ollama_connection_refused_returns_setup_instructions(self):
        import httpx
        with patch("ollama.chat", side_effect=httpx.ConnectError("Connection refused")):
            result = get_response([{"role": "user", "content": "hi"}], "ollama")
        assert "ollama" in result.lower() or "Ollama" in result
