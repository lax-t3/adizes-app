from datetime import datetime
from state import ResearchState


def review_gate(state: ResearchState) -> dict:
    # Trivial interrupt target. Human has already updated state before this runs.
    # The 3-way routing lives on the conditional edge that follows, not here.
    return {
        "execution_trace": [{
            "node": "review_gate",
            "timestamp": datetime.now().isoformat(),
            "summary": f"Human decision: {state.get('approval_status', 'pending')}",
        }]
    }
