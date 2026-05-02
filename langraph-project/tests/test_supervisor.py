from agents.supervisor import supervisor


def test_extracts_ticker_from_mixed_query():
    result = supervisor({"query": "Analyze AAPL fundamentals", "execution_trace": []})
    assert result["ticker"] == "AAPL"


def test_extracts_first_uppercase_word():
    result = supervisor({"query": "Compare MSFT and GOOGL performance", "execution_trace": []})
    assert result["ticker"] == "MSFT"


def test_falls_back_when_no_uppercase_word():
    result = supervisor({"query": "apple stock overview", "execution_trace": []})
    assert result["ticker"] == "APPLE"


def test_appends_trace_entry_with_ticker():
    result = supervisor({"query": "TSLA full analysis", "execution_trace": []})
    assert len(result["execution_trace"]) == 1
    entry = result["execution_trace"][0]
    assert entry["node"] == "supervisor"
    assert "TSLA" in entry["summary"]
    assert "timestamp" in entry
