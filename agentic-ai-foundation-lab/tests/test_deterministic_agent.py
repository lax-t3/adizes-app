import os, sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from agents.deterministic_agent import get_response, get_rules_table, INTENT_LABELS


class TestGetResponse:
    def test_greeting_hi(self):
        response, intent = get_response("hi there")
        assert intent == "greeting"
        assert len(response) > 0

    def test_greeting_hello(self):
        _, intent = get_response("Hello!")
        assert intent == "greeting"

    def test_farewell(self):
        _, intent = get_response("bye bye")
        assert intent == "farewell"

    def test_what_is_ai(self):
        _, intent = get_response("what is ai?")
        assert intent == "what_is_ai"

    def test_what_is_agent(self):
        _, intent = get_response("What is an agent?")
        assert intent == "what_is_agent"

    def test_what_is_llm(self):
        _, intent = get_response("what is llm")
        assert intent == "what_is_llm"

    def test_what_is_chatbot(self):
        _, intent = get_response("what is a chatbot")
        assert intent == "what_is_chatbot"

    def test_deterministic(self):
        _, intent = get_response("what is deterministic")
        assert intent == "deterministic"

    def test_stateful(self):
        _, intent = get_response("what is stateful")
        assert intent == "stateful"

    def test_name_tell(self):
        _, intent = get_response("my name is Alex")
        assert intent == "name_tell"

    def test_unknown_returns_fallback(self):
        response, intent = get_response("what is the weather today?")
        assert intent == "unknown"
        assert "don't know" in response.lower() or "only cover" in response.lower()

    def test_same_input_same_output(self):
        """Determinism: identical inputs must produce identical outputs."""
        r1, i1 = get_response("what is ai?")
        r2, i2 = get_response("what is ai?")
        assert r1 == r2
        assert i1 == i2

    def test_case_insensitive(self):
        _, intent_lower = get_response("what is ai")
        _, intent_upper = get_response("WHAT IS AI")
        assert intent_lower == intent_upper == "what_is_ai"

    def test_what_is_ai_agent_matches_agent_not_ai(self):
        """Ordering: 'what is ai agent' should hit what_is_agent, not what_is_ai."""
        _, intent = get_response("what is ai agent")
        assert intent == "what_is_agent"


class TestGetRulesTable:
    def test_returns_list_of_dicts(self):
        table = get_rules_table()
        assert isinstance(table, list)
        assert len(table) == len(INTENT_LABELS)

    def test_each_row_has_required_keys(self):
        for row in get_rules_table():
            assert "Intent" in row
            assert "Trigger Keywords" in row
