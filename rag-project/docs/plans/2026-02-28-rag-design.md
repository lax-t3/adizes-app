# RAG Chat App — Design Document
**Date:** 2026-02-28
**Status:** Approved

## Overview

A Streamlit-based chat application that lets users ask questions about a PDF document using a Retrieval-Augmented Generation (RAG) pipeline. The app uses LangChain, ChromaDB (local vector store), and the OpenAI API for both embeddings and completions.

---

## Stack

| Layer         | Choice                              |
|---------------|-------------------------------------|
| UI            | Streamlit                           |
| Framework     | LangChain                           |
| LLM           | OpenAI API — GPT-4o                 |
| Embeddings    | OpenAI API — text-embedding-3-small |
| Vector Store  | ChromaDB (local, file-persisted)    |
| Doc Loader    | LangChain PyPDFLoader               |

---

## Data Flow

```
PDF File
  │
  ▼
LangChain PyPDFLoader         (extract text)
  │
  ▼
RecursiveCharacterTextSplitter (chunk_size=500, overlap=50)
  │
  ▼
OpenAI text-embedding-3-small  (embed each chunk)
  │
  ▼
ChromaDB (persisted to ./chroma_db/)
  │
  │  ← Index built once on first run, reused on restart
  │
  ▼
User types question in Streamlit chat
  │
  ▼
Embed question → ChromaDB similarity search (top 4 chunks)
  │
  ▼
LangChain RetrievalQA chain → GPT-4o
  │
  ▼
Streamed answer displayed in chat UI
```

---

## File Structure

```
rag-project/
├── app.py                  # Streamlit entry point
├── rag/
│   ├── __init__.py
│   ├── indexer.py          # PDF loading, chunking, embedding, ChromaDB storage
│   └── retriever.py        # Query pipeline: embed → retrieve → GPT-4o
├── chroma_db/              # Persisted ChromaDB data (auto-created, gitignored)
├── .env                    # OPENAI_API_KEY (gitignored)
├── .env.example            # Template for .env
├── requirements.txt
└── Corporate_HR_Policy_Document.pdf
```

---

## Components

### `rag/indexer.py`
- Loads the PDF using `PyPDFLoader`
- Splits text with `RecursiveCharacterTextSplitter` (chunk_size=500, overlap=50)
- Embeds chunks using `OpenAIEmbeddings(model="text-embedding-3-small")`
- Stores in ChromaDB at `./chroma_db/`
- Detects if index already exists — skips re-indexing on subsequent runs

### `rag/retriever.py`
- Loads existing ChromaDB collection
- Builds a `RetrievalQA` chain with GPT-4o and a `ChromaDB` retriever (k=4)
- Accepts a question string, returns answer + source documents

### `app.py`
- Reads `OPENAI_API_KEY` from `.env` on startup; shows clear error if missing
- Calls indexer on first run (with status indicator in sidebar)
- Maintains conversation history in `st.session_state`
- Renders chat with `st.chat_message` bubbles
- Shows source chunks in a collapsible `st.expander` under each answer

---

## UI Layout

```
┌─────────────────────────────────────────────┐
│ Sidebar                                     │
│  • Document: HR_Policy.pdf                  │
│  • Status: ✅ Indexed                        │
│  • Model: GPT-4o                            │
├─────────────────────────────────────────────┤
│ Chat area                                   │
│                                             │
│  [user]  What is the leave policy?          │
│  [bot]   The leave policy states...         │
│          ▶ Sources (expand)                 │
│                                             │
│  [input bar pinned at bottom]               │
└─────────────────────────────────────────────┘
```

---

## Error Handling

| Scenario                  | Behavior                                      |
|---------------------------|-----------------------------------------------|
| Missing `.env` / API key  | Clear error banner on startup, app halts      |
| PDF not found             | Error message with instructions               |
| ChromaDB already indexed  | Skip re-indexing silently                     |
| OpenAI API failure        | Show error in chat bubble, don't crash app    |

---

## Future Extensions (not in scope now)

- Multi-document support: add `source_file` metadata to ChromaDB, auto-discover all PDFs in folder
- User PDF upload via Streamlit `st.file_uploader`
- Swap LLM (Claude, Ollama) via config flag
