# RAG Chat App

A Streamlit chat application that lets you ask questions about PDF documents using a RAG (Retrieval-Augmented Generation) pipeline powered by OpenAI and ChromaDB.

## Demo

Ask natural language questions about any PDF and get accurate, sourced answers:

- "What is the leave policy?"
- "What are the working hours?"
- "What is the code of conduct?"

Each answer includes the source text chunks used to generate it.

## Stack

- **UI:** Streamlit
- **LLM:** OpenAI GPT-4o
- **Embeddings:** OpenAI text-embedding-3-small
- **Vector Store:** ChromaDB (local)
- **Framework:** LangChain
- **Python:** 3.11+

## Setup

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. Add your OpenAI API key

```bash
cp .env.example .env
```

Edit `.env`:
```
OPENAI_API_KEY=sk-your-key-here
```

Get your key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys).

### 3. Add your PDF

Place your PDF in the project root. The default document is `Corporate_HR_Policy_Document.pdf`. To use a different file, update `PDF_PATH` in `app.py`.

### 4. Run the app

```bash
python3.11 -m streamlit run app.py
```

Opens at `http://localhost:8501`.

**First run:** The PDF is chunked and embedded into ChromaDB (~2–5 seconds, uses OpenAI API).
**Subsequent runs:** Cached index is reused — instant startup.

## Project Structure

```
rag-project/
├── app.py              # Streamlit chat UI
├── rag/
│   ├── indexer.py      # PDF loading, chunking, ChromaDB storage
│   └── retriever.py    # RetrievalQA chain and answer helper
├── tests/              # 9 pytest tests (no API key required)
├── chroma_db/          # Local vector index (auto-created, gitignored)
├── .env.example        # API key template
└── requirements.txt
```

## How It Works

```
PDF → chunk (500 chars) → embed (OpenAI) → ChromaDB
                                               ↓
User question → embed → similarity search (top 4 chunks)
                                               ↓
                              GPT-4o → answer + sources
```

## Running Tests

```bash
python3.11 -m pytest tests/ -v
```

All 9 tests run without an API key.

## Re-indexing

To force a fresh index (e.g., after changing the PDF):

```bash
rm -rf chroma_db/
python3.11 -m streamlit run app.py
```
