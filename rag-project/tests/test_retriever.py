# tests/test_retriever.py
import pytest
from unittest.mock import MagicMock
from rag.retriever import get_answer


def test_get_answer_returns_answer_key():
    mock_chain = MagicMock()
    mock_chain.invoke.return_value = {
        "result": "Employees get 20 days of leave.",
        "source_documents": [],
    }
    result = get_answer("What is the leave policy?", mock_chain)
    assert "answer" in result
    assert result["answer"] == "Employees get 20 days of leave."


def test_get_answer_returns_sources_key():
    mock_chain = MagicMock()
    mock_chain.invoke.return_value = {
        "result": "Some answer.",
        "source_documents": [MagicMock(page_content="chunk text")],
    }
    result = get_answer("Any question?", mock_chain)
    assert "sources" in result
    assert len(result["sources"]) == 1
    assert result["sources"][0] == "chunk text"
