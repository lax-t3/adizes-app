"""
AWS Bedrock Guardrails integration.

Validates text against a configured Bedrock guardrail via the
`apply_guardrail` API. Used as an input gate (JD text) and
output gate (advisor report narrative) in the JDQI pipeline.

Credential resolution order (first match wins):
  1. AWS_PROFILE env var  — uses a named ~/.aws/credentials profile
  2. Explicit key vars    — AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY
                            + AWS_SESSION_TOKEN (required for STS/assumed-role creds)
  3. Neither set          — warns and skips guardrail check

AWS_REGION defaults to ap-south-1.
"""

import os
from dataclasses import dataclass
from typing import Optional

import boto3
from botocore.exceptions import BotoCoreError, ClientError

_GUARDRAIL_ID = "ovpwtkmupag5"
_GUARDRAIL_VERSION = "1"


@dataclass
class GuardrailResult:
    passed: bool
    action: str           # "NONE" or "GUARDRAIL_INTERVENED"
    blocked_reason: Optional[str] = None


def _aws_creds_configured() -> bool:
    """Return True if a profile or explicit key+secret are set."""
    if os.getenv("AWS_PROFILE", "").strip():
        return True
    return bool(
        os.getenv("AWS_ACCESS_KEY_ID", "").strip()
        and os.getenv("AWS_SECRET_ACCESS_KEY", "").strip()
    )


def _get_client():
    """Build a bedrock-runtime boto3 client.

    Uses AWS_PROFILE if set; otherwise uses explicit key/secret/token vars.
    STS/assumed-role credentials require AWS_SESSION_TOKEN in addition to
    the key and secret — without it, AWS returns UnrecognizedClientException.
    """
    region = os.getenv("AWS_REGION", "ap-south-1")
    profile = os.getenv("AWS_PROFILE", "").strip()

    access_key = os.getenv("AWS_ACCESS_KEY_ID", "").strip()
    secret_key = os.getenv("AWS_SECRET_ACCESS_KEY", "").strip()

    # Explicit keys take priority over any profile — this prevents a shell-level
    # AWS_PROFILE from overriding the credentials supplied in .env.
    if access_key and secret_key:
        return boto3.client(
            "bedrock-runtime",
            region_name=region,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            aws_session_token=os.getenv("AWS_SESSION_TOKEN") or None,
        )

    if profile:
        session = boto3.Session(profile_name=profile, region_name=region)
        return session.client("bedrock-runtime")

    return boto3.client("bedrock-runtime", region_name=region)


def _extract_assessment_reason(response: dict) -> str:
    """Build a human-readable reason string from the guardrail assessments."""
    parts: list[str] = []

    for assessment in response.get("assessments", []):
        # Topic policy violations
        for t in assessment.get("topicPolicy", {}).get("topics", []):
            if t.get("action") == "BLOCKED":
                parts.append(f"Topic blocked: {t.get('name', '?')} ({t.get('type', '')})")

        # Content filters (hate, violence, sexual, insults, etc.)
        for f in assessment.get("contentPolicy", {}).get("filters", []):
            if f.get("action") == "BLOCKED":
                parts.append(
                    f"Content filter: {f.get('type', '?')} "
                    f"[confidence={f.get('confidence', '?')}]"
                )

        # Word/phrase policy
        for w in assessment.get("wordPolicy", {}).get("customWords", []):
            if w.get("action") == "BLOCKED":
                parts.append(f"Blocked word/phrase: {w.get('match', '?')}")
        for w in assessment.get("wordPolicy", {}).get("managedWordLists", []):
            if w.get("action") == "BLOCKED":
                parts.append(f"Managed word list match: {w.get('match', '?')}")

        # Sensitive information (PII, etc.)
        for r in assessment.get("sensitiveInformationPolicy", {}).get("regexes", []):
            if r.get("action") == "BLOCKED":
                parts.append(f"Sensitive info (regex): {r.get('name', '?')}")
        for p in assessment.get("sensitiveInformationPolicy", {}).get("piiEntities", []):
            if p.get("action") == "BLOCKED":
                parts.append(f"PII detected: {p.get('type', '?')}")

    return "; ".join(parts) if parts else "Guardrail intervened (no detailed assessment available)"


def check_guardrail(text: str, source: str) -> GuardrailResult:
    """
    Apply the Bedrock guardrail to `text`.

    Args:
        text:   The text to evaluate.
        source: "INPUT" or "OUTPUT"

    Returns:
        GuardrailResult with passed=True if the guardrail did not
        intervene, passed=False (with blocked_reason) if it did.
    """
    if not text or not text.strip():
        return GuardrailResult(passed=True, action="NONE")

    if not _aws_creds_configured():
        return GuardrailResult(
            passed=False,
            action="AWS_ERROR",
            blocked_reason="AWS credentials not configured — set AWS_PROFILE (or AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY) in .env",
        )

    client = _get_client()

    try:
        response = client.apply_guardrail(
            guardrailIdentifier=_GUARDRAIL_ID,
            guardrailVersion=_GUARDRAIL_VERSION,
            source=source,
            content=[{"text": {"text": text[:50_000]}}],  # 50k char limit
        )
    except (BotoCoreError, ClientError) as exc:
        # Surface AWS errors as a passed=False so the pipeline can warn the user
        return GuardrailResult(
            passed=False,
            action="AWS_ERROR",
            blocked_reason=str(exc),
        )

    action = response.get("action", "NONE")
    if action == "GUARDRAIL_INTERVENED":
        reason = _extract_assessment_reason(response)
        return GuardrailResult(passed=False, action=action, blocked_reason=reason)

    return GuardrailResult(passed=True, action=action)


def extract_report_text(report: dict) -> str:
    """Flatten an AdvisorReport dict to a single string for output guardrail check."""
    parts: list[str] = []

    if bc := report.get("benchmark_comparison"):
        parts.append(bc)

    for item in report.get("dimension_breakdown", []):
        if n := item.get("narrative"):
            parts.append(n)

    for item in report.get("suggested_additions", []):
        if s := item.get("suggestion"):
            parts.append(s)
        if imp := item.get("impact"):
            parts.append(imp)

    return "\n\n".join(parts)
