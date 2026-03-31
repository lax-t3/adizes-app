import tempfile
from pathlib import Path

import pytest

from rag.indexer import chunk_document, index_exists, clear_index

PDF_PATH = "Corporate_HR_Policy_Document.pdf"


def test_chunk_document_returns_list():
    chunks = chunk_document(PDF_PATH)
    assert isinstance(chunks, list)
    assert len(chunks) > 0


def test_chunk_document_items_have_page_content():
    chunks = chunk_document(PDF_PATH)
    assert all(hasattr(chunk, "page_content") for chunk in chunks)


def test_chunk_document_respects_max_size():
    chunks = chunk_document(PDF_PATH, chunk_size=500)
    assert all(len(chunk.page_content) <= 500 for chunk in chunks)


def test_index_exists_returns_false_for_missing_dir():
    assert index_exists("/nonexistent/path/xyz") is False


def test_index_exists_returns_false_for_empty_dir():
    with tempfile.TemporaryDirectory() as tmpdir:
        assert index_exists(tmpdir) is False


def test_index_exists_returns_true_when_dir_has_files():
    with tempfile.TemporaryDirectory() as tmpdir:
        path = Path(tmpdir)
        (path / "test.txt").write_text("")
        assert index_exists(tmpdir) is True


def test_chunk_document_raises_for_missing_pdf():
    with pytest.raises(FileNotFoundError):
        chunk_document("/nonexistent/file.pdf")


def test_clear_index_removes_directory():
    with tempfile.TemporaryDirectory() as tmpdir:
        target = Path(tmpdir) / "chroma_test"
        target.mkdir()
        (target / "test.bin").write_bytes(b"data")
        clear_index(str(target))
        assert not target.exists()


def test_clear_index_is_noop_for_missing_dir():
    # should not raise even if directory does not exist
    clear_index("/nonexistent/path/xyz_does_not_exist_abc")
