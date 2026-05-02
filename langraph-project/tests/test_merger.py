from agents.merger import merger


def _state(**overrides):
    base = {
        "ticker": "AAPL",
        "fundamentals": {},
        "news_data": [],
        "risk_data": [],
        "execution_trace": [],
    }
    return {**base, **overrides}


def test_simple_path_shows_fundamentals_only():
    result = merger(_state(fundamentals={"price": 189.30, "pe_ratio": 28.4}))
    assert "Fundamentals" in result["merged_research"]
    assert "Recent News" not in result["merged_research"]
    assert "Risk Factors" not in result["merged_research"]


def test_complex_path_shows_all_three_sections():
    result = merger(_state(
        fundamentals={"price": 189.30},
        news_data=["AAPL up 2%"],
        risk_data=["China risk"],
    ))
    assert "Fundamentals" in result["merged_research"]
    assert "Recent News" in result["merged_research"]
    assert "Risk Factors" in result["merged_research"]


def test_handles_none_news_and_risk():
    result = merger(_state(fundamentals={"price": 100}, news_data=None, risk_data=None))
    assert result["merged_research"]  # no KeyError or crash
    assert "Recent News" not in result["merged_research"]


def test_trace_counts_sections():
    result = merger(_state(
        fundamentals={"price": 100},
        news_data=["n1"],
        risk_data=["r1"],
    ))
    assert result["execution_trace"][0]["node"] == "merger"
    assert "3" in result["execution_trace"][0]["summary"]


def test_fundamentals_none_values_skipped():
    result = merger(_state(fundamentals={"price": 189, "pe_ratio": None}))
    assert "pe_ratio" not in result["merged_research"]
    assert "189" in result["merged_research"]
