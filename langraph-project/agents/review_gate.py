from datetime import datetime
from state import ResearchState


def review_gate(state: ResearchState) -> dict:
    # interrupt_before pauses the graph BEFORE this node runs.
    # The human calls update_state() then invoke(None, config) to resume.
    # When this body executes, state already contains the human's decision.
    # The 3-way routing lives on the conditional edge that follows, not here.
    return {
        "execution_trace": [{
            "node": "review_gate",
            "timestamp": datetime.now().isoformat(),
            "summary": f"Human decision: {state.get('approval_status', 'pending')}",
        }]
    }
