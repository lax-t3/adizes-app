from datetime import datetime
from state import ResearchState
from tools.yfinance_tool import get_stock_fundamentals


def fundamentals(state: ResearchState) -> dict:
    data = get_stock_fundamentals(state["ticker"])
    return {
        "fundamentals": data,
        "execution_trace": [{
            "node": "fundamentals",
            "timestamp": datetime.now().isoformat(),
            "summary": f"Fetched yfinance data for {state['ticker']}: price={data.get('price')}",
        }],
    }
