import yfinance as yf


def get_stock_fundamentals(ticker: str) -> dict:
    try:
        t = yf.Ticker(ticker)
        info = t.info
        low = info.get("fiftyTwoWeekLow", "N/A")
        high = info.get("fiftyTwoWeekHigh", "N/A")
        return {
            "price": info.get("currentPrice"),
            "pe_ratio": info.get("trailingPE"),
            "revenue_ttm": info.get("totalRevenue"),
            "gross_margin": info.get("grossMargins"),
            "market_cap": info.get("marketCap"),
            "week_52_range": f"{low} - {high}",
        }
    except Exception as e:
        return {
            "price": None,
            "pe_ratio": None,
            "revenue_ttm": None,
            "gross_margin": None,
            "market_cap": None,
            "week_52_range": "N/A - N/A",
            "error": str(e),
        }
