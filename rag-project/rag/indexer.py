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


def build_index(
    pdf_paths: "str | list[str]",
    persist_dir: str = "chroma_db",
    mode: str = "add",
) -> Chroma:
    """Build or load a ChromaDB index from one or more PDF paths.

    Args:
        pdf_paths: A single PDF path string or a list of PDF path strings.
        persist_dir: Directory where ChromaDB persists data.
        mode: 'replace' clears the existing index before indexing;
              'add' appends new documents to an existing index (creates
              a fresh index if none exists).
    """
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

    if isinstance(pdf_paths, str):
        pdf_paths = [pdf_paths]

    if mode == "replace":
        clear_index(persist_dir)

    all_chunks = []
    for path in pdf_paths:
        all_chunks.extend(chunk_document(path))

    if mode == "add" and index_exists(persist_dir):
        vectorstore = Chroma(persist_directory=persist_dir, embedding_function=embeddings)
        vectorstore.add_documents(all_chunks)
        return vectorstore

    return Chroma.from_documents(all_chunks, embeddings, persist_directory=persist_dir)
