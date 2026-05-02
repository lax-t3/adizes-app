from datetime import datetime
from state import ResearchState
from tools.ddg_search import search_web


def risk(state: ResearchState) -> dict:
    snippets = search_web(f"{state['ticker']} risks competitors regulatory outlook", max_results=5)
    count = len(snippets)
    summary = (
        f"Found {count} risk items for {state['ticker']}"
        if count > 0
        else f"No risk results for {state['ticker']} (possible tool failure)"
    )
    return {
        "risk_data": snippets,
        "execution_trace": [{
            "node": "risk",
            "timestamp": datetime.now().isoformat(),
            "summary": summary,
        }],
    }
