# tests/test_indexer.py
import pytest
import tempfile
import os
from pathlib import Path
from rag.indexer import chunk_document, index_exists

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

def test_index_exists_returns_false_for_missing_dir():
    assert index_exists("/nonexistent/path/xyz") is False

def test_index_exists_returns_false_for_empty_dir():
    with tempfile.TemporaryDirectory() as tmpdir:
        assert index_exists(tmpdir) is False

def test_index_exists_returns_true_when_dir_has_files():
    with tempfile.TemporaryDirectory() as tmpdir:
        open(os.path.join(tmpdir, "test.txt"), "w").close()
        assert index_exists(tmpdir) is True

def test_chunk_document_raises_for_missing_pdf():
    with pytest.raises(FileNotFoundError):
        chunk_document("/nonexistent/file.pdf")
