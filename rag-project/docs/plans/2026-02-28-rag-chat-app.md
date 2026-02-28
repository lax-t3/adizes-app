# RAG Chat App Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Streamlit chat app that answers questions about a local PDF using LangChain, ChromaDB, and OpenAI.

**Architecture:** PDF is loaded, chunked, embedded with OpenAI, and stored in a local ChromaDB instance on first run. On each user query, the question is embedded, top-4 similar chunks are retrieved, and GPT-4o generates an answer via a LangChain RetrievalQA chain.

**Tech Stack:** Python 3.10+, Streamlit, LangChain, langchain-openai, langchain-chroma, ChromaDB, PyPDF, python-dotenv, pytest

---

## Prerequisites

- Python 3.10+ installed
- `OPENAI_API_KEY` available
- `Corporate_HR_Policy_Document.pdf` in project root
- Working directory: `/Users/vrln/rag-project`

---

### Task 1: Project Setup

**Files:**
- Create: `requirements.txt`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `rag/__init__.py`
- Create: `tests/__init__.py`

**Step 1: Create requirements.txt**

```
langchain==0.3.19
langchain-openai==0.3.6
langchain-chroma==0.2.2
chromadb==0.6.3
pypdf==5.3.1
streamlit==1.42.2
python-dotenv==1.0.1
pytest==8.3.5
pytest-mock==3.14.0
```

**Step 2: Create .env.example**

```
OPENAI_API_KEY=sk-your-key-here
```

**Step 3: Create .gitignore**

```
.env
chroma_db/
__pycache__/
*.pyc
.pytest_cache/
```

**Step 4: Create empty init files**

```bash
mkdir -p rag tests
touch rag/__init__.py tests/__init__.py
```

**Step 5: Install dependencies**

```bash
pip install -r requirements.txt
```

Expected: All packages install without errors.

**Step 6: Create .env with real API key**

```bash
cp .env.example .env
# Then edit .env and add your real OPENAI_API_KEY
```

**Step 7: Commit**

```bash
git add requirements.txt .env.example .gitignore rag/__init__.py tests/__init__.py
git commit -m "chore: project setup with dependencies and structure"
```

---

### Task 2: Indexer — chunk_document()

**Files:**
- Create: `rag/indexer.py`
- Create: `tests/test_indexer.py`

**What this module does:**
- `chunk_document(pdf_path)` — loads PDF, splits into chunks, returns list of LangChain `Document` objects
- `index_exists(persist_dir)` — returns True if ChromaDB already has data at that path
- `build_index(pdf_path, persist_dir)` — embeds chunks and persists to ChromaDB; skips if already indexed

**Step 1: Write failing test for chunk_document**

```python
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
```

**Step 2: Run tests to verify they fail**

```bash
pytest tests/test_indexer.py -v
```

Expected: `ImportError: cannot import name 'chunk_document' from 'rag.indexer'`

**Step 3: Implement chunk_document in rag/indexer.py**

```python
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
```

**Step 4: Run tests to verify they pass**

```bash
pytest tests/test_indexer.py -v
```

Expected: All 3 tests PASS (uses real PDF, no API call needed for chunk_document).

**Step 5: Commit**

```bash
git add rag/indexer.py tests/test_indexer.py
git commit -m "feat: add PDF chunking and ChromaDB indexer"
```

---

### Task 3: Retriever — get_qa_chain() and get_answer()

**Files:**
- Create: `rag/retriever.py`
- Create: `tests/test_retriever.py`

**What this module does:**
- `get_qa_chain(persist_dir)` — loads ChromaDB, returns a LangChain `RetrievalQA` chain
- `get_answer(question, chain)` — runs the chain, returns `{"answer": str, "sources": list}`

**Step 1: Write failing tests**

```python
# tests/test_retriever.py
import pytest
from unittest.mock import MagicMock, patch
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
```

**Step 2: Run tests to verify they fail**

```bash
pytest tests/test_retriever.py -v
```

Expected: `ImportError: cannot import name 'get_answer' from 'rag.retriever'`

**Step 3: Implement retriever.py**

```python
# rag/retriever.py
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_chroma import Chroma
from langchain.chains import RetrievalQA


def get_qa_chain(persist_dir: str) -> RetrievalQA:
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    vectorstore = Chroma(
        persist_directory=persist_dir,
        embedding_function=embeddings,
    )
    retriever = vectorstore.as_retriever(search_kwargs={"k": 4})
    llm = ChatOpenAI(model="gpt-4o", temperature=0)
    chain = RetrievalQA.from_chain_type(
        llm=llm,
        chain_type="stuff",
        retriever=retriever,
        return_source_documents=True,
    )
    return chain


def get_answer(question: str, chain: RetrievalQA) -> dict:
    result = chain.invoke({"query": question})
    sources = [doc.page_content for doc in result.get("source_documents", [])]
    return {"answer": result["result"], "sources": sources}
```

**Step 4: Run tests to verify they pass**

```bash
pytest tests/test_retriever.py -v
```

Expected: Both tests PASS (uses mocks, no API call).

**Step 5: Run full test suite**

```bash
pytest tests/ -v
```

Expected: All 5 tests PASS.

**Step 6: Commit**

```bash
git add rag/retriever.py tests/test_retriever.py
git commit -m "feat: add retrieval QA chain and answer helper"
```

---

### Task 4: Streamlit App

**Files:**
- Create: `app.py`

**Note:** No automated tests for Streamlit UI — manual verification steps are provided.

**Step 1: Write app.py**

```python
# app.py
import os
import streamlit as st
from dotenv import load_dotenv
from rag.indexer import build_index
from rag.retriever import get_qa_chain, get_answer

load_dotenv()

PDF_PATH = "Corporate_HR_Policy_Document.pdf"
CHROMA_DIR = "chroma_db"

st.set_page_config(page_title="HR Policy Chat", page_icon="📄", layout="centered")

# --- API Key Check ---
if not os.getenv("OPENAI_API_KEY"):
    st.error("OPENAI_API_KEY not found. Create a .env file with your key.")
    st.stop()

# --- Sidebar ---
with st.sidebar:
    st.title("📄 HR Policy Chat")
    st.markdown("---")
    st.markdown(f"**Document:** `{PDF_PATH}`")

    with st.spinner("Checking index..."):
        vectorstore = build_index(PDF_PATH, CHROMA_DIR)
    st.success("✅ Document indexed")

    st.markdown(f"**Model:** GPT-4o")
    st.markdown(f"**Embeddings:** text-embedding-3-small")
    st.markdown(f"**Vector Store:** ChromaDB (local)")

# --- Session State ---
if "chain" not in st.session_state:
    with st.spinner("Loading QA chain..."):
        st.session_state.chain = get_qa_chain(CHROMA_DIR)

if "messages" not in st.session_state:
    st.session_state.messages = []

# --- Chat History ---
st.title("Chat with HR Policy")

for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])
        if msg["role"] == "assistant" and msg.get("sources"):
            with st.expander("📎 Sources"):
                for i, src in enumerate(msg["sources"], 1):
                    st.markdown(f"**Chunk {i}:** {src}")

# --- Chat Input ---
if prompt := st.chat_input("Ask a question about the HR policy..."):
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    with st.chat_message("assistant"):
        with st.spinner("Thinking..."):
            try:
                result = get_answer(prompt, st.session_state.chain)
                answer = result["answer"]
                sources = result["sources"]
            except Exception as e:
                answer = f"Error: {str(e)}"
                sources = []

        st.markdown(answer)
        if sources:
            with st.expander("📎 Sources"):
                for i, src in enumerate(sources, 1):
                    st.markdown(f"**Chunk {i}:** {src}")

    st.session_state.messages.append({
        "role": "assistant",
        "content": answer,
        "sources": sources,
    })
```

**Step 2: Run the app manually**

```bash
streamlit run app.py
```

Expected: Browser opens at `http://localhost:8501`

**Step 3: Manual verification checklist**

- [ ] Sidebar shows "✅ Document indexed"
- [ ] Sidebar shows model info
- [ ] Type: "What is the leave policy?" → receives relevant answer
- [ ] Sources expander shows extracted text chunks
- [ ] Type a follow-up question → conversation history persists
- [ ] Restart app → index is reused (no re-indexing spinner)

**Step 4: Commit**

```bash
git add app.py
git commit -m "feat: add Streamlit chat UI with sidebar and source display"
```

---

### Task 5: Final Verification & Cleanup

**Step 1: Run full test suite**

```bash
pytest tests/ -v
```

Expected: All tests PASS.

**Step 2: Verify .gitignore excludes sensitive files**

```bash
git status
```

Expected: `.env` and `chroma_db/` do NOT appear in untracked files.

**Step 3: Final commit**

```bash
git add .
git commit -m "chore: final cleanup and verification"
```

---

## Notes for Future Multi-Doc Support

When ready to extend to multiple PDFs:
1. In `indexer.py`: change `build_index` to accept a list of paths, add `source_file` metadata to each chunk
2. In `app.py`: use `glob.glob("*.pdf")` to discover all PDFs in the folder
3. ChromaDB schema change is backward-compatible — just re-index
