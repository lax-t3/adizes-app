import tempfile
from pathlib import Path

import streamlit as st
from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings

from rag.indexer import build_index, chunk_document, clear_index, index_exists
from rag.retriever import get_answer

PERSIST_DIR = "chroma_db"

st.set_page_config(page_title="RAG PDF Q&A", layout="wide")
st.title("PDF Question & Answer")

# ── Sidebar: Index Management ─────────────────────────────────────────────
with st.sidebar:
    st.header("Index Management")

    uploaded_files = st.file_uploader(
        "Upload PDF files", type="pdf", accept_multiple_files=True
    )

    mode = st.radio(
        "Index mode",
        options=["Add to index", "Replace index"],
    )

    if st.button("Build Index", disabled=not uploaded_files):
        with st.spinner("Indexing…"):
            with tempfile.TemporaryDirectory() as tmpdir:
                # Write each UploadedFile to a real temp path on disk
                all_paths = []
                for f in uploaded_files:
                    tmp_path = Path(tmpdir) / f.name
                    tmp_path.write_bytes(f.read())
                    all_paths.append(str(tmp_path))

                # Validate each PDF; skip corrupt files
                valid_paths, failed = [], []
                for path in all_paths:
                    try:
                        chunk_document(path)
                        valid_paths.append(path)
                    except Exception as exc:
                        failed.append((Path(path).name, str(exc)))

                for name, err in failed:
                    st.warning(f"Skipped '{name}': {err}")

                if valid_paths:
                    index_mode = "replace" if mode == "Replace index" else "add"
                    try:
                        build_index(valid_paths, persist_dir=PERSIST_DIR, mode=index_mode)
                        if index_mode == "replace":
                            st.session_state["session_files"] = []
                        st.session_state.setdefault("session_files", []).extend(
                            Path(p).name for p in valid_paths
                        )
                        st.success(f"Indexed {len(valid_paths)} file(s).")
                        st.rerun()
                    except Exception as exc:
                        st.error(f"Indexing failed: {exc}")

    # Index status
    st.divider()
    if index_exists(PERSIST_DIR):
        embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
        vs = Chroma(persist_directory=PERSIST_DIR, embedding_function=embeddings)
        chunk_count = vs._collection.count()
        st.success(f"Index ready — {chunk_count} chunks")
        files = st.session_state.get("session_files", [])
        if files:
            st.caption("This session: " + ", ".join(files))
    else:
        st.info("No index yet")

    # Clear index
    st.divider()
    if st.button("Clear Index"):
        st.session_state["confirm_clear"] = True

    if st.session_state.get("confirm_clear"):
        st.warning("Delete all indexed documents?")
        c1, c2 = st.columns(2)
        with c1:
            if st.button("Confirm", key="confirm_yes"):
                clear_index(PERSIST_DIR)
                st.session_state.pop("confirm_clear", None)
                st.session_state.pop("session_files", None)
                st.rerun()
        with c2:
            if st.button("Cancel", key="confirm_no"):
                st.session_state.pop("confirm_clear", None)
                st.rerun()

# ── Main area: Q&A ────────────────────────────────────────────────────────
if not index_exists(PERSIST_DIR):
    st.info("Upload and index PDFs using the sidebar to get started.")
else:
    question = st.text_input("Ask a question about your documents")

    if st.button("Ask", disabled=not question.strip()):
        with st.spinner("Thinking…"):
            try:
                result = get_answer(question)
                st.markdown("### Answer")
                st.markdown(result["answer"])
                with st.expander("Sources"):
                    for i, chunk in enumerate(result["sources"], 1):
                        st.markdown(f"**Chunk {i}**")
                        st.text(chunk)
            except Exception as exc:
                st.error(f"Error: {exc}")
