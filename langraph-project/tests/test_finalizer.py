from agents.review_gate import review_gate
from agents.finalizer import finalizer


def test_review_gate_returns_only_trace():
    result = review_gate({"approval_status": "approved", "execution_trace": []})
    assert set(result.keys()) == {"execution_trace"}
    assert result["execution_trace"][0]["node"] == "review_gate"
    assert "approved" in result["execution_trace"][0]["summary"]
    assert "timestamp" in result["execution_trace"][0]


def test_review_gate_records_rejection():
    result = review_gate({"approval_status": "rejected_stop", "execution_trace": []})
    assert "rejected_stop" in result["execution_trace"][0]["summary"]


def test_finalizer_wraps_draft_brief_with_approved_header():
    result = finalizer({
        "ticker": "AAPL",
        "draft_brief": "## AAPL Brief\n\nStrong fundamentals.",
        "execution_trace": [],
    })
    assert "APPROVED" in result["final_brief"]
    assert "AAPL" in result["final_brief"]
    assert "Reviewed and approved" in result["final_brief"]
    assert "## AAPL Brief" in result["final_brief"]


def test_finalizer_appends_trace():
    result = finalizer({"ticker": "TSLA", "draft_brief": "brief", "execution_trace": []})
    assert result["execution_trace"][0]["node"] == "finalizer"
    assert "TSLA" in result["execution_trace"][0]["summary"]
    assert "timestamp" in result["execution_trace"][0]
