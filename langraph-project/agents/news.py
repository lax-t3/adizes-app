from datetime import datetime
from state import ResearchState
from tools.ddg_search import search_web


def news(state: ResearchState) -> dict:
    snippets = search_web(f"{state['ticker']} stock news latest", max_results=5)
    return {
        "news_data": snippets,
        "execution_trace": [{
            "node": "news",
            "timestamp": datetime.now().isoformat(),
            "summary": f"Found {len(snippets)} news items for {state['ticker']}",
        }],
    }
