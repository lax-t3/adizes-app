from datetime import datetime
from state import ResearchState


def merger(state: ResearchState) -> dict:
    sections = []

    f = state.get("fundamentals") or {}
    if f:
        lines = [f"**Fundamentals — {state.get('ticker', '')}**"]
        lines += [f"  {k}: {v}" for k, v in f.items() if v is not None]
        sections.append("\n".join(lines))

    for items, header in [
        (state.get("news_data") or [], "**Recent News**"),
        (state.get("risk_data") or [], "**Risk Factors**"),
    ]:
        if items:
            sections.append("\n".join([header] + [f"  - {item}" for item in items]))

    return {
        "merged_research": "\n\n".join(sections),
        "execution_trace": [{
            "node": "merger",
            "timestamp": datetime.now().isoformat(),
            "summary": f"Merged {len(sections)} research sections",
        }],
    }
