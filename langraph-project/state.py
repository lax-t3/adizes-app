from typing import Annotated, Literal, TypedDict
import operator


class ResearchState(TypedDict):
    # Input
    query: str
    ticker: str
    # Planning
    plan: list[str]
    complexity: Literal["simple", "complex"]
    # Research (one field per worker — no overlapping writes)
    fundamentals: dict
    news_data: list[str]
    risk_data: list[str]
    merged_research: str
    # Synthesis & review
    draft_brief: str
    human_feedback: str
    approval_status: Literal["pending", "approved", "rejected_stop", "rejected_revise"]
    iteration: int           # caps Reject+Revise loop at 3
    # Output
    final_brief: str
    # Audit — append-only via custom reducer
    execution_trace: Annotated[list[dict], operator.add]


def initial_state(query: str) -> ResearchState:
    return ResearchState(
        query=query,
        ticker="",
        plan=[],
        complexity="simple",
        fundamentals={},
        news_data=[],
        risk_data=[],
        merged_research="",
        draft_brief="",
        human_feedback="",
        approval_status="pending",
        iteration=0,
        final_brief="",
        execution_trace=[],
    )
