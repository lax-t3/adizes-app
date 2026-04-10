import json
import anthropic
from models.context import JDQIContext, AdvisorReport


_SYSTEM = """You are a senior talent acquisition expert with deep knowledge of hiring best practices
across High-tech Manufacturing, IT/SaaS/AI, and GCC (Global Capability Centre) industries.

You will receive a complete JD quality analysis. Produce a comprehensive JDQI report.

Return ONLY valid JSON — no markdown, no explanation — matching this exact schema:
{
  "jdqi_score": <int 0-100, weighted composite>,
  "benchmark_comparison": "<2-3 paragraph narrative comparing this JD to best-in-class JDs for this role and industry>",
  "dimension_breakdown": [
    {"dimension": "completeness", "score": <int>, "narrative": "<1-2 sentences>"},
    {"dimension": "skill_specificity", "score": <int>, "narrative": "<1-2 sentences>"},
    {"dimension": "cognitive_load", "score": <int>, "narrative": "<1-2 sentences>"},
    {"dimension": "inclusion_signals", "score": <int>, "narrative": "<1-2 sentences>"},
    {"dimension": "compensation", "score": <int>, "narrative": "<1-2 sentences>"},
    {"dimension": "role_coherence", "score": <int>, "narrative": "<1-2 sentences>"}
  ],
  "suggested_additions": [
    {"section": "<section name>", "suggestion": "<specific text or content to add>", "impact": "<why this matters for hiring outcomes>"},
    ... (3-6 suggestions, most impactful first)
  ]
}

Scoring weights: completeness 25%, skill_specificity 20%, role_coherence 20%, cognitive_load 15%, inclusion_signals 10%, compensation 10%."""


def _strip_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        end = -1 if lines[-1].strip() == "```" else len(lines)
        text = "\n".join(lines[1:end])
    return text


def run_advisor(context: JDQIContext, client: anthropic.Anthropic) -> AdvisorReport:
    """Opus advisor — reads full shared context, returns scored JDQI report."""
    response = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=4000,
        system=_SYSTEM,
        messages=[{
            "role": "user",
            "content": (
                f"Role: {context['parsed_jd']['role_title']} | "
                f"Industry: {context['industry']} | "
                f"Seniority: {context['parsed_jd']['seniority_level']}\n\n"
                f"Specialist dimension results:\n{json.dumps(context['dimension_results'], indent=2)}\n\n"
                f"Original JD:\n{context['jd_text']}"
            )
        }]
    )
    return json.loads(_strip_fences(response.content[0].text))
