# tests/test_indexer.py
import pytest
from pathlib import Path
from rag.indexer import chunk_document

PDF_PATH = Path(__file__).parent.parent / "Corporate_HR_Policy_Document.pdf"

def test_chunk_document_returns_list():
    chunks = chunk_document(str(PDF_PATH))
    assert isinstance(chunks, list)
    assert len(chunks) > 0

def test_chunk_document_items_have_page_content():
    chunks = chunk_document(str(PDF_PATH))
    assert all(hasattr(c, "page_content") for c in chunks)
    assert all(len(c.page_content) > 0 for c in chunks)

def test_chunk_document_respects_max_size():
    chunks = chunk_document(str(PDF_PATH))
    # Each chunk should be <= chunk_size (500) + some overlap tolerance
    assert all(len(c.page_content) <= 600 for c in chunks)
