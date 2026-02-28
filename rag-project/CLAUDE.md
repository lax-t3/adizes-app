# RAG Chat App — Claude Code Guide

## Project Overview

A Streamlit chat application for querying PDF documents using a RAG (Retrieval-Augmented Generation) pipeline. Built with LangChain, ChromaDB, and the OpenAI API.

## Stack

| Layer         | Choice                                      |
|---------------|---------------------------------------------|
| UI            | Streamlit 1.42.2                            |
| Framework     | LangChain 0.3.19                            |
| LLM           | OpenAI GPT-4o (`gpt-4o`)                   |
| Embeddings    | OpenAI `text-embedding-3-small`             |
| Vector Store  | ChromaDB 0.6.3 (local, file-persisted)      |
| PDF Loader    | LangChain PyPDFLoader (via langchain-community) |
| Python        | 3.11+ required                              |

## Project Structure

```
rag-project/
├── app.py                   # Streamlit entry point
├── rag/
│   ├── __init__.py
│   ├── indexer.py           # chunk_document, index_exists, build_index
│   └── retriever.py         # get_qa_chain, get_answer
├── tests/
│   ├── __init__.py
│   ├── test_indexer.py      # 7 tests (uses real PDF, no API calls)
│   └── test_retriever.py    # 2 tests (mocked chain, no API calls)
├── chroma_db/               # Persisted vector index (gitignored, auto-created)
├── docs/plans/              # Design doc and implementation plan
├── .env                     # OPENAI_API_KEY (gitignored, must be created)
├── .env.example             # Template
└── requirements.txt
```

## Environment Setup

```bash
# Install dependencies (Python 3.11)
pip3.11 install -r requirements.txt

# Create .env with your OpenAI key
cp .env.example .env
# Edit .env: OPENAI_API_KEY=sk-...
```

## Running the App

```bash
python3.11 -m streamlit run app.py
```

Opens at `http://localhost:8501`. On first run, the PDF is indexed into ChromaDB (one-time OpenAI API call). Subsequent runs reuse the cached index.

## Running Tests

```bash
python3.11 -m pytest tests/ -v
```

All 9 tests run without an OpenAI API key (mocked or file-only).

## Key Architecture Decisions

- **Cache-first indexing:** `build_index` checks if `chroma_db/` already exists and skips re-indexing. Delete `chroma_db/` to force a full re-index.
- **Session state guards:** Both `build_index` and `get_qa_chain` are wrapped in `st.session_state` checks so they only run once per browser session, not on every Streamlit rerender.
- **Single document:** Currently hardcoded to `Corporate_HR_Policy_Document.pdf`. For multi-doc support, see notes in `docs/plans/2026-02-28-rag-chat-app.md`.
- **Chunk settings:** `chunk_size=500`, `chunk_overlap=50` in `rag/indexer.py`.
- **Retrieval k:** Top 4 chunks retrieved per query (`k=4` in `rag/retriever.py`).

## Extending to Multiple Documents

1. Change `build_index` to accept a list of paths and add `source_file` metadata to each chunk
2. In `app.py`, use `glob.glob("*.pdf")` to discover all PDFs in the folder
3. Delete `chroma_db/` and re-run to rebuild the index

## Common Issues

| Problem | Fix |
|---|---|
| `OPENAI_API_KEY not found` | Create `.env` with your key |
| `PDF not found` | Ensure the PDF is in the project root |
| Stale answers after changing PDF | Delete `chroma_db/` to force re-indexing |
| `No module named streamlit` | Run with `python3.11 -m streamlit run app.py` |
