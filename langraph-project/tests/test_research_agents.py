from unittest.mock import patch


def test_fundamentals_writes_fundamentals_field():
    mock_data = {
        "price": 189.30, "pe_ratio": 28.4, "revenue_ttm": 385_000_000_000,
        "gross_margin": 0.441, "market_cap": 2_900_000_000_000, "week_52_range": "164 - 199",
    }
    with patch("agents.fundamentals.get_stock_fundamentals", return_value=mock_data):
        from agents.fundamentals import fundamentals
        result = fundamentals({"ticker": "AAPL", "execution_trace": []})
    assert result["fundamentals"]["price"] == 189.30
    assert result["execution_trace"][0]["node"] == "fundamentals"
    assert "AAPL" in result["execution_trace"][0]["summary"]


def test_news_writes_news_data_field():
    with patch("agents.news.search_web", return_value=["AAPL up 2%", "Apple beats earnings"]):
        from agents.news import news
        result = news({"ticker": "AAPL", "execution_trace": []})
    assert result["news_data"] == ["AAPL up 2%", "Apple beats earnings"]
    assert result["execution_trace"][0]["node"] == "news"
    assert "2" in result["execution_trace"][0]["summary"]


def test_risk_writes_risk_data_field():
    with patch("agents.risk.search_web", return_value=["China revenue risk", "Antitrust"]):
        from agents.risk import risk
        result = risk({"ticker": "AAPL", "execution_trace": []})
    assert result["risk_data"] == ["China revenue risk", "Antitrust"]
    assert result["execution_trace"][0]["node"] == "risk"


def test_news_searches_with_ticker_in_query():
    with patch("agents.news.search_web", return_value=[]) as mock_search:
        from agents.news import news
        news({"ticker": "TSLA", "execution_trace": []})
    call_query = mock_search.call_args[0][0]
    assert "TSLA" in call_query


def test_risk_searches_with_risk_keywords():
    with patch("agents.risk.search_web", return_value=[]) as mock_search:
        from agents.risk import risk
        risk({"ticker": "MSFT", "execution_trace": []})
    call_query = mock_search.call_args[0][0]
    assert "MSFT" in call_query
    assert "risk" in call_query.lower()
