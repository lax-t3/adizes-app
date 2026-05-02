import json
import re
from datetime import datetime
import anthropic
from state import ResearchState

client = anthropic.Anthropic()

def _strip_fences(text: str) -> str:
    text = text.strip()
    text = re.sub(r'^```(?:json)?\s*', '', text)
    text = re.sub(r'\s*```$', '', text)
    return text.strip()


_SYSTEM = """You are an investment research planner. Output a JSON object only:
{
  "plan": ["step 1", "step 2", "step 3"],
  "complexity": "simple"
}
Rules:
- complexity "simple": price check, quick overview, single metric
- complexity "complex": full analysis, comparison, deep dive, multiple aspects
- plan: 3-5 short action strings
Output ONLY valid JSON, no other text."""


def planner(state: ResearchState) -> dict:
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        system=[{"type": "text", "text": _SYSTEM, "cache_control": {"type": "ephemeral"}}],
        messages=[{
            "role": "user",
            "content": f"Query: {state['query']}\nTicker: {state['ticker']}",
        }],
    )
    try:
        data = json.loads(_strip_fences(response.content[0].text))
        plan = data["plan"]
        complexity = data["complexity"]
    except (json.JSONDecodeError, KeyError) as exc:
        raise ValueError(
            f"Planner: malformed Claude response — {exc}\n{response.content[0].text!r}"
        ) from exc
    return {
        "plan": plan,
        "complexity": complexity,
        "execution_trace": [{
            "node": "planner",
            "timestamp": datetime.now().isoformat(),
            "summary": f"complexity={complexity}, {len(plan)} steps planned",
        }],
    }
