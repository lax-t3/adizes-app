from datetime import datetime
from state import ResearchState
from tools.ddg_search import search_web


def risk(state: ResearchState) -> dict:
    snippets = search_web(f"{state['ticker']} risks competitors regulatory outlook", max_results=5)
    return {
        "risk_data": snippets,
        "execution_trace": [{
            "node": "risk",
            "timestamp": datetime.now().isoformat(),
            "summary": f"Found {len(snippets)} risk items for {state['ticker']}",
        }],
    }
