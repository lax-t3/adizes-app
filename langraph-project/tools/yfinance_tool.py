import yfinance as yf


def get_stock_fundamentals(ticker: str) -> dict:
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
