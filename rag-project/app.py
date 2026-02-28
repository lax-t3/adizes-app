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

    if "vectorstore" not in st.session_state:
        with st.spinner("Checking index..."):
            st.session_state.vectorstore = build_index(PDF_PATH, CHROMA_DIR)
    st.success("✅ Document indexed")

    st.markdown("**Model:** GPT-4o")
    st.markdown("**Embeddings:** text-embedding-3-small")
    st.markdown("**Vector Store:** ChromaDB (local)")

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
        answer = ""
        sources = []
        with st.spinner("Thinking..."):
            try:
                result = get_answer(prompt, st.session_state.chain)
                answer = result["answer"]
                sources = result["sources"]
            except Exception as e:
                answer = f"Error: {str(e)}"

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
