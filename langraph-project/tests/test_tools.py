from unittest.mock import patch, MagicMock


def test_get_stock_fundamentals_maps_yfinance_fields():
    mock_info = {
        "currentPrice": 189.30,
        "trailingPE": 28.4,
        "totalRevenue": 385_600_000_000,
        "grossMargins": 0.441,
        "marketCap": 2_900_000_000_000,
        "fiftyTwoWeekLow": 164.08,
        "fiftyTwoWeekHigh": 199.62,
    }
    mock_ticker = MagicMock()
    mock_ticker.info = mock_info
    with patch("tools.yfinance_tool.yf.Ticker", return_value=mock_ticker):
        from tools.yfinance_tool import get_stock_fundamentals
        result = get_stock_fundamentals("AAPL")
    assert result["price"] == 189.30
    assert result["pe_ratio"] == 28.4
    assert "164.08" in result["week_52_range"]


def test_get_stock_fundamentals_handles_missing_fields():
    mock_ticker = MagicMock()
    mock_ticker.info = {}
    with patch("tools.yfinance_tool.yf.Ticker", return_value=mock_ticker):
        from tools.yfinance_tool import get_stock_fundamentals
        result = get_stock_fundamentals("FAKE")
    assert result["price"] is None
    assert "N/A" in result["week_52_range"]


def test_search_web_returns_body_strings():
    mock_results = [
        {"body": "AAPL stock rises on earnings beat", "title": "T1"},
        {"body": "Apple reports record revenue", "title": "T2"},
        {"title": "No body entry"},
    ]
    mock_ddgs = MagicMock()
    mock_ddgs.text.return_value = mock_results
    with patch("tools.ddg_search.DDGS") as mock_cls:
        mock_cls.return_value.__enter__.return_value = mock_ddgs
        from tools.ddg_search import search_web
        result = search_web("AAPL stock news", max_results=5)
    assert len(result) == 2
    assert result[0] == "AAPL stock rises on earnings beat"


def test_search_web_passes_max_results():
    mock_ddgs = MagicMock()
    mock_ddgs.text.return_value = []
    with patch("tools.ddg_search.DDGS") as mock_cls:
        mock_cls.return_value.__enter__.return_value = mock_ddgs
        from tools.ddg_search import search_web
        search_web("query", max_results=3)
    mock_ddgs.text.assert_called_once_with("query", max_results=3)
