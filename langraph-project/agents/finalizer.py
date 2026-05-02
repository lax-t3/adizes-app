from datetime import datetime
from state import ResearchState


def finalizer(state: ResearchState) -> dict:
    ticker = state.get("ticker", "Unknown")
    brief = state.get("draft_brief", "")
    if not brief:
        raise ValueError(f"finalizer: draft_brief is empty for ticker '{ticker}'")
    final = (
        f"# APPROVED — {ticker} Investment Brief\n\n"
        f"{brief}\n\n"
        f"---\n*Reviewed and approved by human analyst.*"
    )
    return {
        "final_brief": final,
        "execution_trace": [{
            "node": "finalizer",
            "timestamp": datetime.now().isoformat(),
            "summary": f"Brief finalized for {ticker}",
        }],
    }
