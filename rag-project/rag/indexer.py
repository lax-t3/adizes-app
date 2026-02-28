# rag/indexer.py
from pathlib import Path
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_chroma import Chroma


def chunk_document(pdf_path: str) -> list:
    loader = PyPDFLoader(pdf_path)
    documents = loader.load()
    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
    return splitter.split_documents(documents)


def index_exists(persist_dir: str) -> bool:
    path = Path(persist_dir)
    return path.exists() and any(path.iterdir())


def build_index(pdf_path: str, persist_dir: str) -> Chroma:
    if index_exists(persist_dir):
        embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
        return Chroma(persist_directory=persist_dir, embedding_function=embeddings)

    chunks = chunk_document(pdf_path)
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    vectorstore = Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        persist_directory=persist_dir,
    )
    return vectorstore
