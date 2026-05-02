import re
from datetime import datetime
from state import ResearchState


def supervisor(state: ResearchState) -> dict:
    query = state["query"]
    match = re.search(r'\b([A-Z]{1,5})\b', query)
    ticker = match.group(1) if match else query.upper()[:5].strip()
    return {
        "ticker": ticker,
        "execution_trace": [{
            "node": "supervisor",
            "timestamp": datetime.now().isoformat(),
            "summary": f"Extracted ticker: {ticker}",
        }],
    }
