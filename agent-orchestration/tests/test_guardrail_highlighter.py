import pytest
from unittest.mock import MagicMock
from agents.guardrails import scan_jd_for_violations


def _make_client(response_text: str) -> MagicMock:
    msg = MagicMock()
    msg.content = [MagicMock(text=response_text)]
    client = MagicMock()
    client.messages.create.return_value = msg
    return client


def test_scan_returns_phrases_from_valid_json():
    client = _make_client('["young and energetic", "candidates aged 25-35"]')
    result = scan_jd_for_violations(
        "We want young and energetic candidates aged 25-35.",
        "Topic blocked: Discriminatory_Hiring_Criteria (DENY)",
        client,
    )
    assert result == ["young and energetic", "candidates aged 25-35"]


def test_scan_handles_text_around_json():
    client = _make_client('Here are the phrases: ["male preferred"]\nDone.')
    result = scan_jd_for_violations("male preferred applicants only.", "Topic blocked: X", client)
    assert result == ["male preferred"]


def test_scan_returns_empty_list_on_json_parse_failure():
    client = _make_client("Sorry, I cannot identify any phrases.")
    result = scan_jd_for_violations("Some JD text.", "Topic blocked: X", client)
    assert result == []


def test_scan_returns_empty_list_on_api_exception():
    client = MagicMock()
    client.messages.create.side_effect = Exception("API error")
    result = scan_jd_for_violations("Some JD text.", "Topic blocked: X", client)
    assert result == []


def test_scan_returns_empty_list_for_empty_jd():
    client = _make_client('["phrase"]')
    result = scan_jd_for_violations("", "Topic blocked: X", client)
    assert result == []
    client.messages.create.assert_not_called()


def test_scan_returns_empty_list_for_empty_array_response():
    client = _make_client("[]")
    result = scan_jd_for_violations("Normal JD text.", "Topic blocked: X", client)
    assert result == []
