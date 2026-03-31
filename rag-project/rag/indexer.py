import shutil
from pathlib import Path

from langchain_community.document_loaders import PyPDFLoader
from langchain_core.documents import Document
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_chroma import Chroma


def chunk_document(pdf_path: str, chunk_size: int = 1000, chunk_overlap: int = 200) -> list:
    path = Path(pdf_path)
    if not path.exists():
        raise FileNotFoundError(f"PDF not found: {path}")

    loader = PyPDFLoader(str(path))
    documents = loader.load()

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )
    chunks = splitter.split_documents(documents)
    return chunks


def index_exists(persist_dir: str) -> bool:
    path = Path(persist_dir)
    if not path.exists():
        return False
    return any(path.iterdir())


def clear_index(persist_dir: str = "chroma_db") -> None:
    """Delete the ChromaDB persist directory and all its contents."""
    path = Path(persist_dir)
    if path.exists():
        shutil.rmtree(path)


def build_index(pdf_path: str, persist_dir: str = "chroma_db") -> Chroma:
    """Build or load ChromaDB index. Cache-first: skips re-indexing if persist_dir already has data.
    Note: if persist_dir exists, pdf_path is ignored and the cached index is returned.
    """
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

    if index_exists(persist_dir):
        return Chroma(persist_directory=persist_dir, embedding_function=embeddings)

    chunks = chunk_document(pdf_path)
    return Chroma.from_documents(chunks, embeddings, persist_directory=persist_dir)
