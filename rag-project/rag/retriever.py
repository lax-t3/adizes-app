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


def get_answer(question: str, chain) -> dict:
    result = chain.invoke({"query": question})
    sources = [doc.page_content for doc in result.get("source_documents", [])]
    return {"answer": result["result"], "sources": sources}
