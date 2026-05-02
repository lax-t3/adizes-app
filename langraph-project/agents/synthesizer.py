from datetime import datetime
import anthropic
from state import ResearchState

client = anthropic.Anthropic()

_SYSTEM = """You are an investment research analyst. Write a concise investment brief in markdown.

Structure (use these exact headers):
## [TICKER] Investment Brief

**Fundamentals Summary** — 2-3 sentences on key metrics

**News Sentiment** — 1-2 sentences

**Key Risks**
- risk 1
- risk 2

**Outlook** — Buy / Hold / Sell with one-sentence rationale

Be factual. Never invent data not present in the research."""


def synthesizer(state: ResearchState) -> dict:
    feedback = state.get("human_feedback", "")
    feedback_section = f"\n\nRevision requested by human reviewer:\n{feedback}" if feedback else ""
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=[{"type": "text", "text": _SYSTEM, "cache_control": {"type": "ephemeral"}}],
        messages=[{
            "role": "user",
            "content": (
                f"Research for {state['ticker']}:\n\n{state['merged_research']}"
                f"{feedback_section}"
            ),
        }],
    )
    new_iteration = state.get("iteration", 0) + 1
    return {
        "draft_brief": response.content[0].text,
        "iteration": new_iteration,
        "approval_status": "pending",
        "execution_trace": [{
            "node": "synthesizer",
            "timestamp": datetime.now().isoformat(),
            "summary": f"Draft brief generated (iteration {new_iteration})",
        }],
    }
